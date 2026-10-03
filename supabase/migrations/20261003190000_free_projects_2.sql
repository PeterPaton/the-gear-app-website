-- Free plan: 2 projects, 18 inventory items (re-applied here because the
-- earlier 18-item migration never reached the live database).
update public.plans set max_inventory_items = 18, max_projects = 2 where id = 'free';
