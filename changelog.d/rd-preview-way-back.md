## 2026-09-28 · feat(maker): every preview has a way back to the Maker

Owner, verbatim: *"no way to get back. event when we played the preview, it has no way to return to the event hub maker"* (DECISION_LOG 2026-09-28, "EVERY PREVIEW HAS A WAY BACK TO THE MAKER").

- The Maker's ▶ → "Preview the whole <stage>" tab (`/<slug>?phase=<stage>&preview=draft`) now draws one small fixed **"← Back to the Maker"** control, bottom-left, above the guest Event Bar (44px, safe-area aware, over the opening's veil and the Save-the-Date film, stepping aside while the RSVP sheet is open). It returns to the Maker at the same stage, and the same scene or made-once page (the preview now carries `scene=` / `tool=`).
- Drawn ONLY for a verified host's preview (`previewWayBackHref` in `app/[slug]/_lib/editor-canvas.ts`): never a guest's page, never the Maker's canvas (`editor=1`), a theme tile or a one-scene page; never in a frame (the Maker's Reveal page frames `preview=draft` — the control checks `window.self === window.top` after mount, so server HTML never carries it); `print:hidden`.
- On a phone (< 768px) and in any installed shell (App Store shell, desktop app, installed PWA) the preview now opens in the SAME view; a desktop browser keeps the new tab, which carries the way back (`lib/maker-preview-way-back.ts`).
- Guard: `app/[slug]/_lib/every-preview-has-a-way-back.test.ts`.

SPEC IMPACT: None (implements the recorded 2026-09-28 decision; no decision changed).
