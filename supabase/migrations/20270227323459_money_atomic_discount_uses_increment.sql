-- #12 (money bug-hunt 2026-06-26): the discount uses_count counter was bumped via
-- a read-then-write, which loses updates under concurrency so the apply-time cap
-- check (uses_count < max_uses) under-counts and the cap could be exceeded.
-- Atomic increment fixes the counter. Called by the checkout via the service_role
-- admin client only. Already applied to prod (apply_migration:
-- money_atomic_discount_uses_increment); repo record. Idempotent.
create or replace function public.increment_discount_uses(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.discount_codes
     set uses_count = coalesce(uses_count, 0) + 1
   where discount_code_id = p_id;
$$;
revoke execute on function public.increment_discount_uses(uuid) from anon, authenticated, public;
grant execute on function public.increment_discount_uses(uuid) to service_role;
