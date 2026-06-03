-- Bride & groom are the foundation of the event: always Attending, never
-- Pending. Owner directive 2026-06-03.
--
-- A BEFORE INSERT OR UPDATE trigger forces rsvp_status = 'attending' whenever
-- the guest's role is bride or groom, so every write path keeps the couple
-- Attending without each call site (event creation, guest edit, CSV import,
-- the public RSVP widget) having to remember. The app also coerces on read
-- (apps/web/lib/guests.ts) so the UI is correct the instant the feature ships,
-- even before this migration is pushed to prod.

create or replace function public.guests_couple_force_attending()
returns trigger
language plpgsql
as $$
begin
  if new.role in ('bride', 'groom') then
    new.rsvp_status := 'attending';
  end if;
  return new;
end;
$$;

drop trigger if exists guests_couple_force_attending_trg on public.guests;
create trigger guests_couple_force_attending_trg
  before insert or update on public.guests
  for each row
  execute function public.guests_couple_force_attending();

-- Backfill couples created before this migration (e.g. the founding couple
-- rows stamped at event creation, which defaulted to 'pending').
update public.guests
set rsvp_status = 'attending', updated_at = now()
where role in ('bride', 'groom')
  and rsvp_status <> 'attending'
  and deleted_at is null;
