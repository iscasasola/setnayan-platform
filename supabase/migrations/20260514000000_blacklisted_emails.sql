-- Account lifecycle redesign — Delete vs Blacklist.
--
-- Replaces the soft-delete + ban model shipped in 0014 (which combined
-- "occupy the email" with "block sign-in" and didn't fit the vendor →
-- customer re-signup case) with two distinct admin actions:
--
--   • Delete    → hard-deletes the auth user; email is freed for re-signup
--   • Blacklist → hard-deletes the auth user AND records the email here so
--                 re-signup is rejected by the signup server action.
--
-- See apps/web/app/admin/users/actions.ts and apps/web/app/signup/actions.ts.

-- 1. Blacklist table — permanent record of emails that should never sign up.
--    Hard-delete of the matching auth.users row happens at the same time; this
--    row outlives the user so the signup gate can still reject re-attempts.

create table if not exists public.blacklisted_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  reason text,
  blacklisted_at timestamptz not null default now(),
  blacklisted_by_user_id uuid references auth.users(id) on delete set null
);

create index if not exists blacklisted_emails_email_lower_idx
  on public.blacklisted_emails (lower(email));

alter table public.blacklisted_emails enable row level security;

-- Only internal/team-pool admins (via the is_admin() helper from the base
-- migration) can read or write the blacklist. Service-role bypass still works
-- for server actions that use createAdminClient().

drop policy if exists "blacklisted_emails: admin select" on public.blacklisted_emails;
create policy "blacklisted_emails: admin select"
  on public.blacklisted_emails for select
  using (public.is_admin());

drop policy if exists "blacklisted_emails: admin insert" on public.blacklisted_emails;
create policy "blacklisted_emails: admin insert"
  on public.blacklisted_emails for insert
  with check (public.is_admin());

drop policy if exists "blacklisted_emails: admin delete" on public.blacklisted_emails;
create policy "blacklisted_emails: admin delete"
  on public.blacklisted_emails for delete
  using (public.is_admin());

-- 2. One-time cleanup of the transitional soft-delete state.
--    Anyone previously soft-deleted is restored here; the admin should then
--    decide explicitly whether to hard-delete or blacklist via the new UI.
--    `deleted_at` column is left in place for now (deprecated, no new writes).

update public.users set deleted_at = null where deleted_at is not null;

-- 3. Lift any 100-year auth bans applied by the previous soft-delete code.
--    Migrations run as the postgres role which can update auth.users; if
--    your project blocks this, the same statement can be run once via the
--    Supabase dashboard SQL editor.

update auth.users set banned_until = null where banned_until is not null;
