# HANDOVER — rd/maker-asks-once ("THE MAKER ASKS ONCE")

Branch `rd/maker-asks-once`, cut from origin/main d2e38b7c1. Worktree `~/Documents/Claude/Projects/wt-maker-asks-once`.
Evidence: `~/Documents/Claude/Projects/controller-2026-10-08/speed/MAKER-WHO-ASKS.md`. No push, no PR. Built, not live.

## DONE
- A · CAUSE 1 (the bare `/<slug>` after every canvas load) — FIXED in `apps/web/public/sw.js`.
  The request is NOT the navigation handler. It is the `PRELOAD_ASSETS` branch of the `message` listener, asked by
  `GuestPreload` (`app/[slug]/_components/guest-preload.tsx`, mounted by `site-body.tsx` in every render, canvas included).
  New in sw.js: `isHostCanvasUrl` · `sameOriginUrl` · `isHostAppDocument` · `isHostAppNavigation` · `isHostCanvasClient`;
  the message listener returns for a host-canvas / framed sender; the fetch listener returns (no respondWith, no copy)
  for a navigation the host's app makes. Test: `apps/web/app/sw-the-maker-asks-once.test.ts` (14 tests).

## HALF-DONE
- (nothing half-written in the tree)

## NEXT THREE STEPS
1. Mutation-test step A on a SCRATCH COPY of sw.js via `SW_ASKS_FROM=<copy>` (never mutate the tracked file).
2. B · causes 2 and 4 — diagnose with file + symbol (see notes below as they land); fix only outside the DO-NOT-EDIT list.
3. C · cause 3 — the warm-up proposal (read DECISION_LOG `warm` rows first); then changelog fragment, tsc under the heavy lock.
