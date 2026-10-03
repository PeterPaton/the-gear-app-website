// Supabase Edge Function: kit-suggest
// ------------------------------------------------------------------
// Turns a shoot description into a kit list chosen from a spec-tagged slice
// of the equipment catalog. The browser builds that slice (gear-compat.js →
// buildCandidatePool) and re-checks whatever comes back with its
// compatibility engine; when the check finds problems it calls this function
// again with `revise` so the model can fix them. The engine — not the model —
// has the final say on compatibility.
//
// Request:  { prompt, candidates: ["c0|name|role|tags", …],
//             revise?: { kit: [{ ref, qty, reason }], issues: [string] } }
// Response: { name, summary, items: [{ ref, qty, reason }], notes: [string] }
//
// Secrets: ANTHROPIC_API_KEY. Deploy with verify_jwt = true. Only signed-in
// users may call it (the anon key alone is rejected), so the public key in the
// page can't be used to spend API credit.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.131.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MAX_CANDIDATES = 900;

const SYSTEM = `You are a camera department kit planner. You assemble kit lists from a rental/inventory catalog for the shoot the user describes.

Every catalog line is: ref|name|role|tags. Choose ONLY refs that appear in the catalog.

Tags describe the interfaces the system knows about:
- body: mount=, sensor=, batt= (battery types it takes), media= (card types), out= (video outputs), xlr (built-in XLR input), kg≈ (body weight)
- lens: mount=, covers= (image circle: 2/3 < MFT < S35 < FF < LF < MF), (swappable) = interchangeable mount
- adapter: FROM>TO lens mount adapter. converter: FROM>TO video converter
- battery / media: batt= / media= types. gimbal: payload=. monitor: in= (video inputs)
- fits= : accessory made only for those camera families

Compatibility is the hard part of this job, so build outward from the camera:
1. Pick the camera body (or matching bodies for multi-cam) first.
2. Every lens must share the body's mount, or include the adapter that bridges it. Lenses should cover the sensor; if they don't, say a crop mode is required.
3. Include batteries whose batt= matches the body, and media whose media= matches it, in sensible quantities for a shoot day.
4. Monitors need an in= that matches the body's out=, or include a converter.
5. Gimbals need payload above body + lens (+ ~0.3kg rigging).
6. XLR shotgun mics need a body with xlr or an XLR recorder/adapter.
7. Accessories with fits= only belong in the kit if that camera is in it.
Where a tag is missing the spec is unknown — prefer items whose tags let compatibility be verified.

Keep the kit realistic for the brief (usually 8–18 line items). "reason" is a few words a camera assistant would write. Use "notes" for assumptions and anything the crew must check on the day (crop modes, mount swaps, firmware).`;

const KIT_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    summary: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ref: { type: "string" },
          qty: { type: "integer" },
          reason: { type: "string" },
        },
        required: ["ref", "qty", "reason"],
        additionalProperties: false,
      },
    },
    notes: { type: "array", items: { type: "string" } },
  },
  required: ["name", "summary", "items", "notes"],
  additionalProperties: false,
};

type KitLine = { ref: string; qty: number; reason: string };
type Payload = {
  prompt?: string;
  candidates?: string[];
  revise?: { kit?: KitLine[]; issues?: string[] };
};

// The gateway has already verified the JWT signature (verify_jwt = true);
// here we only require that it belongs to a signed-in user, not the anon key.
function isSignedInUser(req: Request): boolean {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const part = token.split(".")[1];
  if (!part) return false;
  try {
    const claims = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return claims.role === "authenticated";
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!isSignedInUser(req)) return json({ error: "Sign in to use suggestions" }, 401);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY is not set for this function", code: "no-key" }, 503);

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const prompt = String(payload.prompt || "").trim().slice(0, 2000);
  const candidates = Array.isArray(payload.candidates)
    ? payload.candidates.slice(0, MAX_CANDIDATES).map((l) => String(l).slice(0, 300))
    : [];
  if (!prompt) return json({ error: "Missing prompt" }, 400);
  if (!candidates.length) return json({ error: "Empty catalog" }, 400);
  const validRefs = new Set(candidates.map((l) => l.split("|")[0]));

  let content = `SHOOT BRIEF:\n${prompt}\n\nCATALOG (ref|name|role|tags):\n${candidates.join("\n")}`;
  if (payload.revise?.kit?.length) {
    const draft = payload.revise.kit.map((k) => `${k.ref} ×${k.qty} — ${k.reason}`).join("\n");
    const issues = (payload.revise.issues || []).map((i) => `- ${i}`).join("\n");
    content += `\n\nA previous draft of this kit failed the compatibility check.\nDRAFT:\n${draft}\n\nCHECK RESULTS:\n${issues}\n\n` +
      `Return a corrected kit that resolves every conflict and need above — swap or add items from the catalog. ` +
      `Keep what already works. If something can't be resolved from this catalog, say so in notes.`;
  }

  const client = new Anthropic({ apiKey });
  try {
    const msg = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: KIT_SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });

    if (msg.stop_reason === "refusal") return json({ error: "The model declined this request", code: "refusal" }, 422);
    if (msg.stop_reason === "max_tokens") return json({ error: "Kit list was cut off — try a narrower brief", code: "truncated" }, 502);

    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const parsed = JSON.parse(text);
    const items: KitLine[] = [];
    const seen = new Set<string>();
    for (const raw of parsed.items || []) {
      if (!validRefs.has(raw.ref) || seen.has(raw.ref)) continue; // drop invented or repeated refs
      seen.add(raw.ref);
      items.push({ ref: raw.ref, qty: Math.max(1, Math.min(99, Math.round(Number(raw.qty) || 1))), reason: String(raw.reason || "") });
    }
    if (!items.length) return json({ error: "No catalog items came back", code: "empty" }, 502);
    return json({
      name: String(parsed.name || "Suggested Kit"),
      summary: String(parsed.summary || ""),
      items,
      notes: Array.isArray(parsed.notes) ? parsed.notes.map(String) : [],
    });
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      return json({ error: `Anthropic API ${e.status ?? ""}: ${e.message}`, code: "api" }, 502);
    }
    return json({ error: (e as Error)?.message || String(e), code: "internal" }, 500);
  }
});
