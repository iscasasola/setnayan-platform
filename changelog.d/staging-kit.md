## 2026-11-24 · feat(staging): the final-check staging kit — seed, five locks, catalogue copy, checklist

The kit the owner's final check (24 Nov 2026) runs on: 8 cloud checkers at once, on a staging copy (a Supabase
preview branch + a Vercel preview with test sign-ins). This PR builds the kit only and creates nothing anywhere.
Runbook: `build-sessions/FINAL-CHECK-KIT.md`.

- **Five locks** (`apps/web/lib/staging-locks.ts`), each wired into its one choke point and guarded; all are no-ops
  unless `STAGING=1`, except (c), which is never sent by a production build:
  (a) `sendEmail` reaches only `STAGING_EMAIL_SINK`, or drops · (b) `resolveMayaConfig` refuses a live Maya
  endpoint's keys · (c) `X-Robots-Tag: noindex` on every non-production build, never on setnayan.com ·
  (d) `getR2Client` confines every R2 key under `STAGING_R2_PREFIX` (SDK middleware, proven request by request) ·
  (e) `scripts/staging/flags.ts` — production's flag values, and the server names a copy must never carry.
- **Seed** (`scripts/staging/seed.ts` · `seed.sql` · `seal.sql` · `accounts.ts`): refuses production, refuses
  without `STAGING=1`; 10 test sign-ins via the admin API with generated passwords (git-ignored file); 9 events,
  1,056 guests, 15 shops, 36 cards, 29 bookings, 28 chats, 62 tables, 8 orders priced from the catalogue, two big
  messy accounts. Proven on the PGlite replay on every PR (`the-staging-seed-runs-clean.db.test.ts`).
- **Catalogue copy** (`scripts/staging/copy-catalog.ts`): 20 non-personal admin tables, production read only through
  `scripts/lib/read-only-db.mjs`.
- **Area map** (`scripts/staging/areas.ts`): every shipped route (the screens map + the admin map) in exactly one of the 8 checker areas.

SPEC IMPACT: None — a test kit; on production every lock is a no-op and no product rule changes.
