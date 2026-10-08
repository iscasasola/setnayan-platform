## 2026-10-08 · ci(release): a release rehearsal that costs nothing and touches nothing live

Owner, 2026-10-08: "we can edit everything locally and just upload 1 big batch" ·
"like a log of what is on the website now, then we create a batch edit it, correct
all bugs, and transfer the data as one go". That day Vercel showed $220.63 of
Build CPU Minutes with 11 days left, production's database (Supabase FREE plan)
had been taken down by load, and the Vercel preview shares that database.

`release-rehearsal.yml` is a button (Actions → release-rehearsal → Run workflow)
that rehearses ONE upload on a GitHub runner — free on this public repo — with no
production secret, no Vercel build and no deploy:

- a throw-away Supabase stack (`supabase start`: real Postgres 17, auth, PostgREST);
- every migration — the live site's set through the repo's own ordering engine
  (`replayInFilenameOrder`, driven over `psql` instead of PGlite), then THIS
  upload's new ones through the real `supabase db push --include-all --yes`;
- a fixture (one host, one event, 30 guests, 12 suppliers, 3 orders);
- the app built with `pnpm build` (the script Vercel runs) and started with
  `next start`, pointed only at that stack;
- the launch-critical journey at 375×812, a screenshot per step, each step
  asserting what a person would check: sign in → event Home → Event Hub Maker
  (Stages → Studio → a draft change → ✓ Apply → the guest page shows it, and did
  not before) → Guests › Setup → one guest's link copied → the guest replies yes
  → the host sees them coming → the public page signed out → two screens left
  open for a minute;
- the database requests each step cost, as a table on the run page.

What it found on its first runs, on `main` @482a671b3 (measured, not estimated):

- one host screen costs ~600 database requests and the Maker ~930, because
  opening it makes the phone ask the server for 13–19 screens (the one opened
  plus background loads); the signed-out guest page costs 35; ✓ Apply costs 426
  for one press; a screen left open for a minute asks nothing;
- the stack `supabase start` builds does not carry production's default
  privileges for `postgres` — 22 migrations failed their own grant
  post-conditions until the rehearsal declared them, as the PGlite replay does;
- the Maker refuses to draw without `R2_PUBLIC_URL` (`lib/r2.ts publicUrlFor`).

Guard: `lib/release-rehearsal-touches-nothing-live.test.ts` — the address guard
refuses every non-loopback host (look-alikes included), every script calls it,
and the workflow names no secret, links no project, calls no Vercel command and
has no trigger but the button. Seven sabotages, each seen red.

Test code and workflow only: +0 routes, +0 exported server actions, no migration,
no screen changes.

SPEC IMPACT: None.
