-- Free plan: cap inventory at 18 items (was 50).
update public.plans set max_inventory_items = 18 where id = 'free';
