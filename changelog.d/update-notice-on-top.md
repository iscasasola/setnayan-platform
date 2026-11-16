## 2026-11-16 · fix(app): "Setnayan was updated" is never under a sheet, and is drawn once (walk RW-7853-a)

Live fault on #7853. While a person is typing, a stale tab shows the "Setnayan was updated" notice instead of
reloading — and the place people type most, the phone's full-screen chat thread (z 45), was drawn OVER the in-flow
notice, so the one person it was for never saw it. Its wrapper was also a second `role="status"` around
`NoticeLine`'s own, so one notice was two live regions (announced twice).

- `lib/build-version.ts` — `LAYER_OVER_THE_PAGE` (`[aria-modal="true"]`, `[data-chat-takeover]`) and the pure
  `aLayerCoversThePage` (a drawn modal, or the thread while it is fixed — a phone).
- `app/_components/stale-tab-notice.tsx` — on a plain page the notice stays in the flow at the very top (the one notice
  system's place, never fixed over the page). While a layer covers the page it hands the SAME notice to
  `stale-tab-notice-lift.tsx`, which portals it to <body> on the app's existing top notification layer
  (`PEEK_TOAST_PLACE`, z 100 — above rise 40, Sheet 50, side panel 75, takeover 45). Flow OR lifted, never both. The
  wrapper is no longer a live region. Layers are followed by a MutationObserver only while the notice is up. The lift is
  lazy-loaded, so the shared chunk does not grow.
- 🔒 `lib/the-update-notice-is-on-top.test.ts` — one mount in every layout, one notice element, one live region, the
  exclusive branches, the layer order, and the rule executed. Each sabotaged once → red.
- `the-maker-sample-shows-no-app-notices.test.ts` and `the-maker-canvas-is-only-the-page.test.ts` now also hold the
  lifted copy to `data-app-chrome` (anchor moved off the removed `role="status"`; nothing loosened).
- Shot: `build-sessions/shots-update-notice-on-top/390-chat-thread-open-notice-on-top.png` (dev lab chat thread, 390 px,
  `/api/health` stubbed to a newer version, text typed in the composer).

SPEC IMPACT: None.
