// Supabase Edge Function: kit-suggest
// ------------------------------------------------------------------
// Builds and edits kit lists with Claude, paid for with Suggest credits.
//
// The browser picks a spec-tagged slice of the catalog (gear-compat.js →
// buildCandidatePool) and re-checks every kit that comes back with its
// compatibility engine — the engine, not the model, has the final say.
//
//   generate { prompt, candidates }                          1 credit
//   refine   { prompt, instruction, kit, candidates }        1 credit
//   revise   { run_id, prompt, kit, issues, candidates,      free: the automatic
//              instruction? }                                fix-up pass that each
//                                                            charged run includes
//
// Credits are reserved before calling Claude and refunded if the call fails.
// Response: { run_id, name, summary, items: [{ ref, qty, reason }], notes,
//             credits: { monthly, bonus } }
// Out of credits: 402 { code: "no-credits", credits }.
//
// Secrets: ANTHROPIC_API_KEY (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
// provided by the platform). Deploy with verify_jwt = true.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.131.0";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MAX_CANDIDATES = 900;
const MAX_KIT_LINES = 80;
const CREDIT_COST = 1;

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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

When asked to change an existing kit, apply the change and carry its consequences through: swapping the camera means re-checking lenses, batteries, media, monitoring and support against the new body. Leave everything the change doesn't touch as it was.

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

type Mode = "generate" | "refine" | "revise";
type KitLine = { ref: string; qty: number; reason: string };
type Payload = {
  mode?: Mode;
  prompt?: string;
  instruction?: string;
  candidates?: string[];
  kit?: KitLine[];
  issues?: string[];
  run_id?: string;
};
type Credits = { monthly: number; bonus: number };

const creditsFrom = (row: { monthly_credits?: number; bonus_credits?: number } | null): Credits | null =>
  row ? { monthly: Number(row.monthly_credits) || 0, bonus: Number(row.bonus_credits) || 0 } : null;

const kitText = (kit: KitLine[]) => kit.map((k) => `${k.ref} ×${k.qty} — ${k.reason}`).join("\n");

function userContent(mode: Mode, p: { prompt: string; candidates: string[]; instruction: string; kit: KitLine[]; issues: string[] }) {
  let content = `SHOOT BRIEF:\n${p.prompt}\n\nCATALOG (ref|name|role|tags):\n${p.candidates.join("\n")}`;
  if (mode === "refine") {
    content += `\n\nCURRENT KIT:\n${kitText(p.kit)}\n\nCHANGE REQUESTED:\n${p.instruction}\n\n` +
      `Return the complete updated kit with this change applied. Say what changed in notes.`;
  } else if (mode === "revise") {
    if (p.instruction) content += `\n\nCHANGE REQUESTED:\n${p.instruction}`;
    content += `\n\nA draft of this kit failed the compatibility check.\nDRAFT:\n${kitText(p.kit)}\n\n` +
      `CHECK RESULTS:\n${p.issues.map((i) => `- ${i}`).join("\n")}\n\n` +
      `Return a corrected kit that resolves every conflict and need above — swap or add items from the catalog. ` +
      `Keep what already works${p.instruction ? " and keep the requested change" : ""}. ` +
      `If something can't be resolved from this catalog, say so in notes.`;
  }
  return content;
}

async function signedInUserId(req: Request): Promise<string | null> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const userId = await signedInUserId(req);
  if (!userId) return json({ error: "Sign in to use suggestions", code: "auth" }, 401);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY is not set for this function", code: "no-key" }, 503);

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const mode: Mode = payload.mode ?? "generate";
  if (!["generate", "refine", "revise"].includes(mode)) return json({ error: "Unknown mode" }, 400);

  const prompt = String(payload.prompt || "").trim().slice(0, 2000);
  const instruction = String(payload.instruction || "").trim().slice(0, 1000);
  const candidates = Array.isArray(payload.candidates)
    ? payload.candidates.slice(0, MAX_CANDIDATES).map((l) => String(l).slice(0, 300))
    : [];
  if (!prompt) return json({ error: "Missing prompt" }, 400);
  if (!candidates.length) return json({ error: "Empty catalog" }, 400);
  const validRefs = new Set(candidates.map((l) => l.split("|")[0]));
  const kit: KitLine[] = (Array.isArray(payload.kit) ? payload.kit : [])
    .filter((k) => k && validRefs.has(String(k.ref)))
    .slice(0, MAX_KIT_LINES)
    .map((k) => ({ ref: String(k.ref), qty: Math.max(1, Math.min(99, Math.round(Number(k.qty) || 1))), reason: String(k.reason || "").slice(0, 200) }));
  const issues = (Array.isArray(payload.issues) ? payload.issues : []).slice(0, 40).map((i) => String(i).slice(0, 400));
  if (mode === "refine" && (!instruction || !kit.length)) return json({ error: "Refine needs the current kit and a change to make" }, 400);
  if (mode === "revise" && (!payload.run_id || !kit.length)) return json({ error: "Revise needs run_id and the draft kit" }, 400);

  // Pay for the action, or claim the free fix-up call that came with it.
  let runId: string;
  let credits: Credits | null = null;
  let charged = false;
  if (mode === "revise") {
    const { data: claimed, error } = await admin.rpc("continue_suggest_run", { p_user: userId, p_run: payload.run_id });
    if (error) return json({ error: error.message, code: "billing" }, 500);
    if (!claimed) return json({ error: "This kit has already had its automatic fix-up pass", code: "run-exhausted" }, 409);
    runId = payload.run_id!;
  } else {
    const { data: run, error } = await admin.rpc("start_suggest_run", { p_user: userId, p_kind: mode, p_cost: CREDIT_COST });
    if (error) return json({ error: error.message, code: "billing" }, 500);
    if (!run.ok) return json({ error: "You're out of Suggest credits", code: "no-credits", credits: creditsFrom(run) }, 402);
    runId = run.run_id;
    credits = creditsFrom(run);
    charged = true;
  }
  const refund = async (): Promise<Credits | null> => {
    if (!charged) return credits;
    const { data } = await admin.rpc("refund_suggest_run", { p_run: runId });
    return creditsFrom(data) ?? credits;
  };

  const client = new Anthropic({ apiKey });
  try {
    const msg = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: KIT_SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: userContent(mode, { prompt, candidates, instruction, kit, issues }) }],
    });

    const u = msg.usage;
    await admin.rpc("record_suggest_usage", {
      p_run: runId,
      p_input: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0),
      p_output: u.output_tokens || 0,
    });

    if (msg.stop_reason === "refusal") {
      return json({ error: "The model declined this request", code: "refusal", credits: await refund() }, 422);
    }
    if (msg.stop_reason === "max_tokens") {
      return json({ error: "Kit list was cut off — try a narrower brief", code: "truncated", credits: await refund() }, 502);
    }

    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const parsed = JSON.parse(text);
    const items: KitLine[] = [];
    const seen = new Set<string>();
    for (const raw of parsed.items || []) {
      if (!validRefs.has(raw.ref) || seen.has(raw.ref)) continue; // drop invented or repeated refs
      seen.add(raw.ref);
      items.push({ ref: raw.ref, qty: Math.max(1, Math.min(99, Math.round(Number(raw.qty) || 1))), reason: String(raw.reason || "") });
    }
    if (!items.length) return json({ error: "No catalog items came back", code: "empty", credits: await refund() }, 502);
    return json({
      run_id: runId,
      name: String(parsed.name || "Suggested Kit"),
      summary: String(parsed.summary || ""),
      items,
      notes: Array.isArray(parsed.notes) ? parsed.notes.map(String) : [],
      credits,
    });
  } catch (e) {
    const refunded = await refund();
    if (e instanceof Anthropic.APIError) {
      return json({ error: `Anthropic API ${e.status ?? ""}: ${e.message}`, code: "api", credits: refunded }, 502);
    }
    return json({ error: (e as Error)?.message || String(e), code: "internal", credits: refunded }, 500);
  }
});
