## 2026-07-18 · fix(security): restrictive RLS — anonymous drafts cannot publish or schedule (anon-onboarding hardening PR-4)

Defense-in-depth for the anon-draft onboarding feature
(`NEXT_PUBLIC_ANON_ONBOARDING_ENABLED`). PR-1 guards the outbound/publish actions
at the SERVER-ACTION layer, but a Supabase native anonymous user holds a real
`authenticated` JWT and could call the PostgREST API **directly**, bypassing
those guards, to write their own event `landing_page_visibility = 'public'` or
set `scheduled_launch_at` — which the read-time launch gate would then turn into
a public/indexable page + a guest-email fan-out. The base policies are permissive
(`authenticated_can_create_event` = `WITH CHECK (TRUE)`; `couple_can_update_event`
has no check), so both the direct-create and direct-publish paths were open at the
DB layer.

- **Migration `20270823141500`** — two RESTRICTIVE policies on `public.events`
  (`anon_cannot_create_public_event` FOR INSERT, `anon_cannot_publish_event` FOR
  UPDATE) that require, for a KNOWN anonymous JWT
  (`auth.jwt()->>'is_anonymous'`), `landing_page_visibility = 'private' AND
  scheduled_launch_at IS NULL`. Follows Supabase's anonymous-auth access-control
  guidance; RESTRICTIVE = ANDs with the permissive couple policies, never weakens
  them.

Scope: only an anonymous principal writing a non-private/scheduled value is
blocked — every other event edit stays open, so anon drafting is unaffected.
Permanent (secured) users and admins are never restricted (`is_anonymous` false
or absent → unrestricted). Onboarding/create-event insert via the service-role
client (RLS bypassed), so legitimate creation is unaffected. Feature stays
flag-OFF; with no anon users the policies are a no-op for every existing account.

SPEC IMPACT: None. (Launch-posture hardening; two restrictive RLS policies, no
product/pricing/SKU change. Verified separately: the null-email trigger migration
`20270205204166` is ALREADY applied in prod — that go-live step is done.)
