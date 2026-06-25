-- #4/#14 (money bug-hunt 2026-06-26): the vendor self-comp quarterly quota was a
-- count-then-check with no serialization, so two concurrent self-comps could both
-- read count<cap and both insert, exceeding the cap. Add a transaction-scoped
-- advisory lock keyed on (vendor, quarter) so concurrent inserts serialize: the
-- second waits for the first to commit, re-counts (READ COMMITTED sees the
-- committed row), and the cap holds. Already applied to prod (apply_migration:
-- money_selfcomp_quota_advisory_lock); this is the repo record. Idempotent.
create or replace function public.enforce_vendor_self_comp_quota()
returns trigger language plpgsql as $function$
declare
  q_count int;
  q_cap   int;
begin
  if new.source <> 'vendor_self_comp' then return new; end if;
  if new.vendor_profile_id is null then
    raise exception 'vendor_self_comp requires vendor_profile_id' using errcode = 'check_violation';
  end if;

  -- serialize per (vendor, quarter) before the count-then-check
  perform pg_advisory_xact_lock(
    hashtextextended(new.vendor_profile_id::text || '|' || date_trunc('quarter', new.created_at)::text, 0)
  );

  select coalesce(quarterly_cap, 12) into q_cap
    from public.vendor_self_comp_caps
   where vendor_profile_id = new.vendor_profile_id;
  if q_cap is null then q_cap := 12; end if;

  select count(*) into q_count
    from public.comp_grants
   where source = 'vendor_self_comp'
     and vendor_profile_id = new.vendor_profile_id
     and date_trunc('quarter', created_at) = date_trunc('quarter', new.created_at)
     and revoked_at is null;

  if q_count >= q_cap then
    raise exception 'VENDOR_SELF_COMP_QUOTA_EXCEEDED: cap=% used=%', q_cap, q_count
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;
