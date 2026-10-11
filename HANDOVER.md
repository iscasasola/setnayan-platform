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

- A is mutation-tested (11 mutations on a scratch copy via `SW_ASKS_FROM`, each red). Before → after, counted by the test:
  one canvas load 2 → 1 · warm-up of three stages 6 → 3 · six canvas loads 12 → 6 · a guest's own visit 2 → 2 (unchanged).

## DIAGNOSED (B) — not fixed: every one sits in a DO-NOT-EDIT file
- CAUSE 2 (3–5 iframes of the same stage page at once) = the STYLE CARDS. `stage-panel/style-carousel.tsx` `StyleCards`
  mounts one `StylePreview` (`stage-panel/style-preview.tsx`) per style of the picked part; each is
  `<iframe sandbox="allow-same-origin" src="/<slug>?phase=…&editor=1&only=<key>&style=<type>:<id>">` — a whole server
  render of the guest page per card. They load even when the couple never opens Style: the toolbar opens on `edit`
  (`stage-panel/store.ts` `stageTool = 'edit'`), `StageStyle` still mounts the look body, and `stage-tools.tsx` only hides
  it with `visibility:hidden` (`[data-stage-tool-now="edit"] [data-phone-chrome="panel"]`) — a hidden iframe still loads.
  Script-less, so no GuestPreload ran in them: that is why no bare `/<slug>` followed those in the log.
- CAUSE 4 (each press "re-fetches the whole Maker page, no rsc header") = `router.refresh()`, and the missing header is the
  LOGGER's: Next strips `rsc` / `next-router-state-tree` / `next-router-prefetch` from `headers()`
  (`next/dist/server/async-storage/request-store.js` `getHeaders` deletes `FLIGHT_HEADERS`), so a server component can
  never see them. The chain: `editor-shell.tsx` `move` → `makerSave(…, requestMakerRefresh)` (UNHELD) →
  `MAKER_REFRESH_EVENT` → `hub-draft-bar.tsx` `router.refresh()` (whole Maker render) → new `renderStamp` →
  `canvasStamp` → `BufferedCanvasFrame` `frameKey` changes → a new `loading` iframe (a guest-page navigation).

## HALF-DONE
- (nothing half-written in the tree)

## NEXT THREE STEPS
1. C · cause 3 — the warm-up proposal (read DECISION_LOG `warm` rows first; propose, do not change).
2. Changelog fragment `changelog.d/rd-maker-asks-once.md`; full `tsc` under the heavy lock (apps/web, `.next` absent).
3. Lab run with a request log (a logging proxy in front of `next dev`, needs the heavy lock) to count causes 2 and 4.
