// Gear · Supabase client + data layer.
//
// Equipment table (read-only reference catalog):
//   UUID        uuid PK
//   name        text
//   image_url   text
//   category    text
//
// Projects table (per-user, RLS-protected):
//   id          text PK
//   user_id     uuid FK → auth.users
//   name        text
//   client      text
//   status      text  ('planning' | 'active' | 'wrapped')
//   shoot       text
//   location    text
//   items       jsonb (array of equipment UUIDs)
//   created_at  timestamptz
//
// User inventory table (per-user, RLS-protected):
//   id           uuid PK
//   user_id      uuid FK → auth.users
//   equipment_id uuid FK → equipment.UUID
//   name         text
//   image_url    text
//   category     text
//   qty          int
//   status       text
//   created_at   timestamptz

function __readStoredConfig() {
  try {
    const raw = localStorage.getItem('gear.supabase');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.url || parsed.anonKey)) return parsed;
    }
  } catch (e) {}
  return null;
}

const __stored = __readStoredConfig();
window.SUPABASE_CONFIG = __stored || {
  url: '',
  anonKey: '',
};

(function () {
  // Read live each call — the module-load value of SUPABASE_CONFIG may be
  // empty on first run (before App's catalog effect writes it), so a captured
  // closure would silently no-op every DB call until the next reload.
  const isEnabled = () => {
    const c = window.SUPABASE_CONFIG;
    return !!(c && c.url && c.anonKey && window.supabase);
  };

  // Build a Supabase client. If a session is provided, it injects the user's
  // access token so RLS policies apply correctly.
  function makeClient(session) {
    const c = window.SUPABASE_CONFIG;
    const headers = session
      ? { Authorization: `Bearer ${session.access_token}` }
      : {};
    return window.supabase.createClient(c.url, c.anonKey, {
      global: { headers },
    });
  }

  window.GEAR_DB = {
    get enabled() { return isEnabled(); },
    get mode() { return isEnabled() ? 'supabase' : 'local'; },

    // ── Equipment catalog (public read, no auth needed) ──────────────────
    async loadEquipment(onPage) {
      if (!isEnabled()) return window.GEAR_ITEMS;
      const sb = makeClient(null);
      const PAGE = 1000;
      const all = [];
      let from = 0;
      while (true) {
        const { data, error } = await sb
          .from('equipment')
          .select('UUID, name, image_url, category')
          .order('name', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) {
          console.warn('[GEAR_DB] equipment load failed, using fallback:', error.message);
          return all.length ? all : window.GEAR_ITEMS;
        }
        if (!data || data.length === 0) break;
        // Normalise UUID → id so the rest of the app works uniformly
        const normalised = data.map(r => ({
          ...r,
          id: r.UUID,
        }));
        all.push(...normalised);
        if (typeof onPage === 'function') onPage(all.slice());
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return all;
    },

    // ── Projects (user-scoped, requires session) ─────────────────────────
    async loadProjects(session) {
      if (!isEnabled() || !session) return window.GEAR_PROJECTS;
      const sb = makeClient(session);
      const { data, error } = await sb
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      // Throw on actual query errors instead of returning sample data — letting
      // the caller decide whether to override existing state. Returning the
      // sample list here used to silently wipe a real (saved) project list.
      if (error) throw new Error(error.message);
      return (data || []).map(p => ({ ...p, items: p.items || [] }));
    },

    async saveProject(project, session) {
      if (!isEnabled() || !session) return project;
      const sb = makeClient(session);
      // Destructure out `items` — kit list is stored in project_items table, not here
      const { items, ...projectRow } = project;
      const { data, error } = await sb
        .from('projects')
        .upsert({ ...projectRow, user_id: session.user.id })
        .select()
        .single();
      if (error) console.warn('[GEAR_DB] saveProject:', error.message);
      return data || project;
    },

    async deleteProject(projectId, session) {
      if (!isEnabled() || !session) return;
      const sb = makeClient(session);
      const { error } = await sb
        .from('projects')
        .delete()
        .eq('id', projectId);
      if (error) console.warn('[GEAR_DB] deleteProject:', error.message);
    },

    // ── User inventory (user-scoped, requires session) ───────────────────
    async loadInventory(session) {
      if (!isEnabled() || !session) return [];
      const sb = makeClient(session);
      const { data, error } = await sb
        .from('user_inventory')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        console.warn('[GEAR_DB] inventory load failed:', error.message);
        return [];
      }
      return (data || []).map(r => ({ ...r, id: r.id }));
    },

    async saveInventoryItem(item, session) {
      if (!isEnabled() || !session) return item;
      const sb = makeClient(session);
      // Send only columns the user_inventory table actually has — passing
      // extras (brand, model, serial, value, location) makes the row
      // rejected by Postgres. If you add those columns to your schema later,
      // include them here too.
      const payload = {
        id: item.id,
        user_id: session.user.id,
        equipment_id: item.equipment_id || null,
        name: item.name,
        image_url: item.image_url || null,
        category: item.category || null,
        qty: item.qty || 1,
        status: item.status || 'available',
      };
      const { data, error } = await sb
        .from('user_inventory')
        .upsert(payload)
        .select()
        .single();
      if (error) console.warn('[GEAR_DB] saveInventoryItem:', error.message);
      return data || item;
    },

    async deleteInventoryItem(itemId, session) {
      if (!isEnabled() || !session) return;
      const sb = makeClient(session);
      const { error } = await sb
        .from('user_inventory')
        .delete()
        .eq('id', itemId);
      if (error) console.warn('[GEAR_DB] deleteInventoryItem:', error.message);
    },

    // ── Project items (per-project gear list, requires session) ──────────
    async loadProjectItems(projectId, session) {
      if (!isEnabled() || !session) return [];
      const sb = makeClient(session);
      const { data, error } = await sb
        .from('project_items')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
      if (error) {
        console.warn('[GEAR_DB] loadProjectItems:', error.message);
        return [];
      }
      return data || [];
    },

    // Insert a new project_items row. Caller is responsible for deciding
    // INSERT vs UPDATE based on local state — that lets the UI use a single
    // roundtrip per add (and a single UPDATE for "increment" cases).
    // Pass `clientId` to use a client-generated UUID; this lets the optimistic
    // row already have its final id, avoiding a temp-row remount on replace.
    async addProjectItem(projectId, equipment, session, clientId) {
      if (!isEnabled() || !session) return null;
      const sb = makeClient(session);
      const payload = {
        project_id: projectId,
        equipment_id: equipment.id,
        name: equipment.name,
        image_url: equipment.image_url,
        category: equipment.category,
        qty: 1,
      };
      if (clientId) payload.id = clientId;
      const { data, error } = await sb
        .from('project_items')
        .insert(payload)
        .select()
        .single();
      if (error) console.warn('[GEAR_DB] addProjectItem insert:', error.message);
      return data || null;
    },

    async updateProjectItemQty(itemId, qty, session) {
      if (!isEnabled() || !session) return;
      const sb = makeClient(session);
      if (qty <= 0) {
        // Remove the row entirely when qty reaches zero
        const { error } = await sb
          .from('project_items')
          .delete()
          .eq('id', itemId);
        if (error) console.warn('[GEAR_DB] updateProjectItemQty delete:', error.message);
      } else {
        const { error } = await sb
          .from('project_items')
          .update({ qty })
          .eq('id', itemId);
        if (error) console.warn('[GEAR_DB] updateProjectItemQty update:', error.message);
      }
    },

    async deleteProjectItem(itemId, session) {
      if (!isEnabled() || !session) return;
      const sb = makeClient(session);
      const { error } = await sb
        .from('project_items')
        .delete()
        .eq('id', itemId);
      if (error) console.warn('[GEAR_DB] deleteProjectItem:', error.message);
    },

    // ── Inventory groups (per-user labels that wrap a set of item ids) ───
    // Schema (run once in Supabase SQL editor):
    //   create table user_groups (
    //     id text primary key,
    //     user_id uuid references auth.users(id) on delete cascade,
    //     name text not null,
    //     item_ids jsonb default '[]'::jsonb,
    //     created_at timestamptz default now()
    //   );
    //   alter table user_groups enable row level security;
    //   create policy "own groups" on user_groups for all
    //     using (auth.uid() = user_id) with check (auth.uid() = user_id);
    async loadGroups(session) {
      if (!isEnabled() || !session) return [];
      const sb = makeClient(session);
      const { data, error } = await sb
        .from('user_groups')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        console.warn('[GEAR_DB] loadGroups:', error.message);
        return [];
      }
      return (data || []).map(g => ({ id: g.id, name: g.name, itemIds: g.item_ids || [] }));
    },

    async saveGroup(group, session) {
      if (!isEnabled() || !session) return group;
      const sb = makeClient(session);
      const { data, error } = await sb
        .from('user_groups')
        .upsert({
          id: group.id,
          user_id: session.user.id,
          name: group.name,
          item_ids: group.itemIds || [],
        })
        .select()
        .single();
      if (error) console.warn('[GEAR_DB] saveGroup:', error.message);
      return data ? { id: data.id, name: data.name, itemIds: data.item_ids || [] } : group;
    },

    async deleteGroup(groupId, session) {
      if (!isEnabled() || !session) return;
      const sb = makeClient(session);
      const { error } = await sb
        .from('user_groups')
        .delete()
        .eq('id', groupId);
      if (error) console.warn('[GEAR_DB] deleteGroup:', error.message);
    },

  };
})();
