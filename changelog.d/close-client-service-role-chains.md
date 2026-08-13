## 2026-08-13 · fix(security): the 23 client→service-role import chains are closed, and the guard now watches them

`lib/supabase/admin.ts` bypasses RLS. Its docblock has always said "Never import
this from a client component" — a sentence, not a mechanism. Adding it to
`EXTRA_BOUNDARY_MODULES` in `apps/web/scripts/lint-server-only-boundary.mjs`
reported **23** pre-existing `'use client'` → … → `admin.ts` value-import chains.

None of them leaked: the bundler drops the unused edge, so this was latent risk,
not a live incident. It is closed anyway, because the alternative was landing 23
findings as a baseline — and a guard that cries wolf 23 times teaches you to skim
past the one time it is right. That is the same reasoning that already stops this
script from following `'use server'` boundaries.

**23 → 0, with an empty baseline.** Nothing was baselined or suppressed.

### What the chains actually were

Thirteen hub modules were named, but only **three** ever imported the
service-role client — `promo-free-windows.ts` · `reveal-config.ts` ·
`v2-catalog.ts`. The other ten were transitive hops, and every single client
import along them was a pure constant or pure function: `PAPIC_POINTS_PER_CLIP`,
`DEFAULT_VEIL_LOOK`, `CHANNEL_HEARTBEAT_MS`, `programSourceAllowed`,
`panoodStreamingEnabled`, `GUEST_PICK_MAX_VIEWERS_PER_CAMERA`. Not one client
component wanted anything that touches a database.

So the fix is the `lib/ugat/data-pure.ts` pattern, five times — and because the
splits cascade, five files closed all thirteen hubs:

| new pure sibling | closes | cascade |
|---|---|---|
| `lib/reveal-config-pure.ts` | 9 chains | — |
| `lib/papic-cameras-pure.ts` | 7 chains | frees `papic-tier-copy` → `services-step-data`, `vendor-papic-tier`, `papic-storage-telemetry` |
| `lib/panood-camera-seats-pure.ts` | 4 chains | frees `live-studio-channel-cameras` → `live-studio-guest-pick` |
| `lib/live-studio-publish-pure.ts` | 2 chains | — |
| `lib/v2-catalog-pure.ts` | 1 chain | frees `onboarding-pricing` → `persona-packs` |

Each server module keeps its name and `export *`s its pure sibling, so **every
existing server import path still resolves** — the only files that changed their
specifier are the ones that had to.

### Two things worth knowing

- **`live-studio-publish-pure.ts` had to be client-reachable by design.** The
  § 4d posture is that the controller only publishes a permitted stream AND the
  pop-out independently re-resolves the decision, neither trusting the other.
  That requires `programSourceAllowed` in a client component. The entitlement is
  still resolved server-side and passed in; nothing moved decides who paid.
- **`lib/env-flag.test.ts` tracks flags by FILE PATH.** Moving
  `NEXT_PUBLIC_PANOOD_STREAMING_ENABLED` to the pure sibling turned that guard
  red — correctly — and its registry row moved with the flag. Worth remembering:
  a guard elsewhere may be pinned to a path you are about to change.

### Verification

- `lint-server-only-boundary` **GREEN**, empty baseline (631 client files, 172
  server-only modules).
- **Mutation-tested — a guard that cannot go red is not a guard.** Sabotage →
  restore, occurrence count each time: a client re-importing the server module
  `0 → 1 → 0`; a deeper chain `0 → 8 → 0`; a pure sibling itself re-growing the
  `createAdminClient` edge `0 → 8 → 0`. With the `admin.ts` entry removed from
  `EXTRA_BOUNDARY_MODULES`, the same sabotage reports `0` — proving the entry is
  what does the detecting, not something incidental.
- `pnpm typecheck` clean · `pnpm test:unit` **7917/7917** · `pnpm lint` 0 errors ·
  `lint:entitlement-gates` / `lint:dup-rule` / `lint:changelog-dir` pass.

SPEC IMPACT: None. No schema, no RLS, no product behaviour — this is an
import-graph refactor plus one guard entry. Every moved symbol keeps its name,
its value and its server import path.
