# HANDOVER — guest-page speed (round 3) · `rd/speed-guest-page`

Stopped 2026-10-12 at the account's weekly limit. **Built, not live. Not in any release.**
Worktree `/Users/icecasasola/Documents/Claude/Projects/wt-speed-guest`, base
`origin/preview/batch-b-event-hub` @ `b6d889f0c`. Nothing pushed. Tree clean.

## ⚠ Read this first — what was NOT checked

- **Full `tsc` has NOT been run on this branch.** The heavy lock was held by others all
  session and the stop came first. Every commit below was only executed through `tsx`
  tests, which do not type-check. **Run it before anything else** (step 1 below).
- `pnpm preflight` not run (by instruction). The whole-tree guards outside the list below
  have not seen these changes.
- Nothing was run against a server. Every number here is from a counting stand-in.
- The two golden pages (`lib/site-body-fixture.golden.html`,
  `lib/every-stage-is-todays-page.golden.json`) — their tests are in the suite that was
  run and passed after commits 2 and 3; not re-run after nothing else changed.

## Commits (oldest first)

| Commit | What |
|---|---|
| `72a55ba82` | The harness: counts the guest page's requests and serial depth per viewer. No behaviour change. |
| `3b8253f98` | Side by side, pass 1: live layer, entourage, bundle list beside orders, the prep-release switch started ahead. |
| `4933d2986` | Side by side, pass 2: an invited guest's own reads leave together. |
| `d38b7e9d3` | The read limit: bounded waits + the honest words. |
| (this one) | `HANDOVER.md` + `changelog.d/rd-speed-guest-page.md`. |

## The dependency graph — as far as it was drawn

Signed-out stranger and invited guest are MEASURED (harness). The Maker's canvas and the
two invite pages are READ ONLY — not measured, not changed beyond the read limit.

### `/[slug]` — what each step truly needs

| Step (page's `[server-timing]` phase) | Truly needs | Depth before | Depth now |
|---|---|---|---|
| `loadEventShell` (page + layout + metadata share it via `cache()`) | the slug | 1 | 1 |
| `resolveProfile` (event type; **session client**, not counted by the harness) | the shell's `event_type` | +1 | +1 |
| `media` — ownership chain: orders → bundle list → comp ∥ internal → founder | the event id only | 4 (steps 2–5) | 3 (bundle leaves with orders) |
| `widgets` (`invitation_widgets`) | the event id | started ahead already | same |
| `guest-session` / `auth` | cookies; one DB check for a cookie holder | not counted | not counted |
| `gates` | session, account, widgets (no DB for a stranger) | 0 | 0 |
| `live-layer`: prep switch → schedule → backdrop → watch links → album door (+ wall on the day) | each needs only the event; the schedule needs the switch; the album door needs the wall ON THE DAY only | 5 in a row (steps 6–10) | 1 (2 on the day) |
| `doorway-facts`, entourage (guests → section order → role names → name style) | the event only | 4 in a row, beside the live layer | 1 |
| `capabilities` (owner / supplier) | the signed-in account | 0 for a stranger; not counted signed in | unchanged |
| `guest-context` (invited only): guest row → QR look → camera → gallery → face step → check-in → first scan → credits | the guest row; needs the live layer's `scheduleBlocks` as an ARGUMENT | 7–10 in a row | 2–3 |

**Why an invited guest is still 7–8 and not ≤ 6:** `loadGuestContext(admin, event, session,
dayOfPhase, slug, scheduleBlocks)` takes the schedule as an argument, so it cannot start
until the live layer has answered. The guest's own row read is inside it. That is the next
cut (step 2 below).

**Why `live-layer` cannot start before `media`:** it needs `dayOfPhase`, which is settled in
`gates` from `forcedPhase = phaseOverride ?? pinnedPhase` (a host preview / a pinned stage),
not from the date alone. I did not move it.

### The Maker's canvas (`editor=1`) — read, not measured
Adds, before `media`: `hostCanvasDraft` → `getCurrentUser` → `loadHostMembership`
(`event_members` ∥ `event_moderators`) → the draft read; `canvasTriedTheme` (membership
again, `cache()`d); `sampleBoardFor`; `resolveHubTheme` for the drafted look. All in a row
at the top of `invitationBody`. Not touched. See the coordinator's finding below — the
canvas's cost is mostly HOW OFTEN the page is rendered, not how deep one render is.

### `/[slug]/invite/enter` and `/[slug]/invite/reply` — read, not measured
`batch-c/requests/REPORT.md` says `invite/enter` awaits ~15 things in a row with no
`loading.tsx`. I did not draw their graphs or flatten them. Both now run inside the read
limit (commit `d38b7e9d3`), nothing else.

## Measured (harness: public wedding, ordinary host, nothing bought, default flags)

| Viewer | Requests | Depth before | Depth now |
|---|---|---|---|
| Stranger, before the day | 23 | 10 | **5** |
| Stranger, on the day | 23 | 10 | 6 |
| Invited guest, before the day | 34 | 17 | **7** |
| Invited guest, on the day | 37 | 20 | 8 |

Targets were depth ≤ 5 / ≤ 6 and calls ≤ 15. **Depth: met for a stranger before the day,
missed by 1–2 elsewhere. Calls: NOT reduced at all** — no read was removed. The 11 reads of
the same `events` row are still 8 separate reads here (`papic_on` ×3 in one invited view).

The harness is a FLOOR for the shape, not production's count: production adds the promo
reads, the roam reads, the event type's profile, the cookie's check, capability reads.

## Built

- `lib/guest-page-reads.harness.ts` + `lib/guest-page-reads.test.ts` — runs the real
  loaders in their own process (`server-only` aliased to `lib/guest-page-reads.empty.cjs`,
  React `cache()` stood in per view) against a counting `fetch`. Pins calls + depth per
  viewer. **It mirrors `invitationBody`, it is not the page — keep it in step.**
- `app/[slug]/_lib/loaders.ts`: `loadLiveLayer` (new helpers `readPublicSchedule`,
  `readStoredBackdrop`, `readWatchLive`, `readGuestWallMirror`), `loadEntourage`,
  `loadGuestContext` (new helpers `readGuestCheckin`, `readFirstScan`,
  `readFaceTaggingWish`) — reads started with `startAhead`, awaited where they were.
- `lib/entitlements.ts` `skuActiveInRender`: the bundle list leaves with the orders read.
- `app/[slug]/page.tsx`: `startAhead(isCoordinatorPrepReleaseEnabled())`.
- `lib/read-limit.ts` + `lib/read-limit.test.ts`; `lib/supabase/db-error-log.ts` routes its
  one `fetch` through `fetchWithinReadLimit`.
- Wrapped: `PublicInvitationPage`, `InvitationBody`, `generateMetadata` (quiet) in
  `app/[slug]/page.tsx`; `GuestTreeLayout` (quiet); `InviteEnterPage` + its metadata;
  `InviteReplyPage`. Each is a 3-line wrapper placed directly above the unchanged function,
  so tests that slice from `export default async function …(` still see the whole body.

Guards re-anchored (same properties): `the-guest-page-starts-its-reads-together`,
`a-removed-guest-leaves-the-invitation`, `details-your-event`,
`role-names-reach-every-screen`, `entitlements-in-render-asks-together`,
`every-scan-goes-through-one-door`.

Sabotaged once each, all reacted: the limit raised as `TimeoutError` (retries multiply);
the "not found" conversion removed; one live-layer read put back in single file.

## Read-limit decisions

| | |
|---|---|
| Per read | 6 s (`READ_LIMIT_MS`) |
| Per request | 10 s shared deadline (`PAGE_BUDGET_MS`), from the first limited read |
| Worst case for the page | 10 s, plus at most one postgrest-js pause (≤ 4 s) if a retry of its own was already sleeping at the deadline |
| Why it does not multiply | raised as `AbortError`, which postgrest-js 2.105.4 rethrows without retrying; nothing under `app/[slug]` uses `withSchemaRetry` |
| Limited | GET, HEAD, POST to `/rpc/…` |
| Never limited | PATCH, DELETE, PUT, POST to a table |
| Outside the wrapped pages | nothing changes |

**Essential (the default — everything not listed):** the guest sees the boundary,
`app/[slug]/error.tsx`: "This invitation didn't load… Your link is fine…". Thrown even
when the code had already decided a "not found", a redirect or an empty list from the read
that never answered. Includes: `events` shell, `invitation_widgets`, `guests`,
`event_schedule_blocks`, `event_vendors` (the venue), seats, `data_privacy_controls`,
`coordinator_broadcasts`, `event_type_profiles`, any table added later.

**Decoration (`DECORATION_READS`) — the part is left out for this view, logged
`graceful_degrade`:** `orders`, `bundle_components`, `promo_free_windows`, the five
ownership RPCs (→ the free look), `event_recaps` (album door), `events(rsvp_backdrop)`,
`events(panood_watch_url,…)`, `events(papic_on)`, `events(pool_gallery_open)`,
`rpc/papic_event_pool_status`, `papic_limited_snapshots`, `papic_guest_captures`,
`photo_tags`, `guest_checkins`, `scan_events` (arrival banner).

⚠ Open judgement calls for whoever continues — I chose, nobody ruled:
- 6 s / 10 s. The investigator measured 1.2 % of first-after-idle reads over 3 s; a tighter
  limit would turn slow-but-working views into the boundary.
- Ownership as decoration means a paying couple's guests get the FREE look for one view
  during a stall. The alternative is the boundary.
- `coordinator_broadcasts` is essential by default; a stalled announcement read takes the
  page to the boundary rather than hiding the announcement.
- The limit is a client-side wait: the database still finishes the query.
- Body stalls AFTER headers are not bounded (the timer is cleared when headers arrive).

## Not built

- **Step 4 (remember same-for-everybody facts): NOT built, deliberately.** I could not
  fence it in the time left. The page mixes the published row with the host's draft
  (`hostDraft`, `overlayHubDraftWidgets`, `triedTheme`) in the same variables, `loadMedia`
  signs addresses inline, and `websiteProActiveFor` reads the view-as-free cookie. A
  `home-reads-remember-nobody`-style graph guard needs the published reads split into a
  session-free module first — that split is the real work and it is not started.
- Reading the `events` row once (the 11). Not started. Each of the extra reads has its own
  failure isolation today (one failing column costs one part); merging them into the shell
  read couples them. A second, `cache()`d "extras" read with per-consumer fallback is the
  shape I would try.
- Hoisting per-item loops into batched queries. Not started.
- `invite/enter` / `invite/reply` flattening. Not started.
- The Maker's canvas path. Not started.

## The exact next three steps

1. **Type-check, then the suites.** From `apps/web`, under the heavy lock:
   `NODE_OPTIONS=--max-old-space-size=8192 ../../node_modules/.bin/tsc --noEmit -p tsconfig.json`.
   Likely places for a type error: `lib/read-limit.ts` (`AbortSignal.any`, the `fetch`
   parameter types), the `startAhead(...) ?? ...` unions in `loadGuestContext`, the
   `InvitationBodyProps` / `GuestTreeLayoutProps` extractions. Then
   `../../node_modules/.bin/tsx --test lib/guest-page-reads.test.ts lib/read-limit.test.ts`
   and every test under `app/[slug]` plus the `lib` tests that name `loaders.ts`.
2. **Get an invited guest to ≤ 6:** split the guest's row read out of `loadGuestContext`
   into its own `cache()`d loader and start it (and the reads that need only the guest id)
   as soon as the session is known in `invitationBody`, beside the live layer — keeping the
   two early returns (`not_found`, the unconfirmed plus-one) ahead of anything else about
   the guest. Update the harness's `view()` to match, then lower the pins.
3. **Cut the calls (≤ 15 was the target; it is 23 / 34):** one `cache()`d read of the extra
   `events` columns (`papic_on`, `event_date`, `event_date_precision`,
   `entourage_section_order`, `rsvp_backdrop`, `role_names`, `panood_watch_url*`,
   `print_details`, `gifts_on`, `live_studio_roam_manifest`), with each consumer falling
   back to its own read if that one is refused. `papic_on` is read three times in one view
   by different callers — start there.

## Preview commands

First byte ×10, as a stranger:
```bash
P=https://<preview-host>; UA="<signed-out phone UA>"
for i in $(seq 10); do curl -s -o /dev/null -A "$UA" -w '%{time_starttransfer}\n' "$P/maria-and-jose"; sleep 2; done
```
The page's own timing line (it prints one per render, `lib/server-timing.ts`):
```bash
vercel logs <deployment-url> | grep '\[server-timing\]' | grep 'slug/invitation-body'
```
Each line is `{"route":"slug/invitation-body:<stage>","total_ms":…,"phases":[{label, ms}…]}`.
Before this branch a warm render read `live-layer 356, media 127, capabilities 52` and a
cold one `live-layer 1,982`. `live-layer` is the phase that should fall. `guest-context`
is the invited guest's. `unnamed` is time no phase claimed.
A read past its limit logs `[supabase-query-error] {"call_site":"read-limit:slug/…","error_code":"READ_LIMIT",…}`.

## A finding from the coordinator, for whoever continues

A logger on a real event showed **the Maker causes ~22 full guest-page renders in 77 s**
(open → switch stage → pick → two moves): the service worker re-fetches the bare guest
page after every canvas load (referer `/sw.js`); the same stage page is loaded 3–5 times at
once as iframes; the warm-up fetches three other stages, each doubled by the service
worker; and each press re-fetches the whole Maker page. Evidence:
`/Users/icecasasola/Documents/Claude/Projects/controller-2026-10-08/speed/MAKER-WHO-ASKS.md`.
That is a bigger lever for the Maker than anything in this branch: this branch makes one
render shallower; it does nothing about how many there are.
