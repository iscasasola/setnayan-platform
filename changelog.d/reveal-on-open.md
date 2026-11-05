## 2026-11-04 · feat(fold): an opened section glides its head to the pin line when it runs past the bottom — app-wide

Owner ruling 2026-11-04 ("everytime a group expands, should we pin right under so they see the most of the content of the
expanded? this should apply universally?" → "Yes, app-wide").

- **One implementation:** `app/_components/reveal-engine.ts` (the pure rule) + `app/_components/reveal-on-open.ts`
  (`useRevealOnOpen` hook, `RevealDetailsOnOpen`). After a USER opens a section and the layout has SETTLED (height and
  place stop moving — so a fold above shutting under one-open-at-a-time is measured after), if any of it is below the
  visible bottom of its scroll box (page, or the nearest ancestor that scrolls — a sheet/panel), the scroll glides so the
  section's head sits on the pin line (`--sn-pin-top`, or the box's top; plus one slim 40 px line per open fold around
  it). Fits → nothing moves. Reduced motion → one jump. Touch · wheel · pointer · key, or a scroll that is not ours,
  cancels it. Never on a default-open load, restored state, a controlled open or a `#hash`.
- **Shared `Fold`** joins with one call (head press marks the intent). The head lands full-size on the line, so the slim
  pin takes over only when the user scrolls on — no fight.
- **Wide (≥701) supplier lists:** the row's fold stays SHUT and the body is drawn in the right column, so nothing
  reveals there — the content is already beside the list.
- **Older accordions:** `Collapsible` (a head-less height primitive; its head is the caller's element before it) and
  `FeatureAccordion` (own glass look, server-streamed body) keep their look and join through `useRevealOnOpen`.
  `accordion-build.tsx` / `accordion-lock.tsx` are not expand/collapse at all (the Plan Builder's Add-to-build and Lock
  buttons) — nothing to move. Also joined: the Home service card and the supplier Business-health card.
- **Every native `<details>`** (≈99 files) gets the rule from one capture `toggle` listener in the root layout, only when
  a tap or key came just before (a `<details open>` on load is left alone); `data-no-reveal` opts one out.
- ⚡ **Off the first load:** the hook every fold mounts (`reveal-on-open.ts`) carries only the press and an `import()`;
  the engine and its DOM side (`reveal-dom.ts`) load on the first open. The visible bottom reads `visibleBottom()` from
  `lib/keyboard-ride.ts` (the one keyboard reading) instead of `window.visualViewport`.
- The Fold head, the Fold title and the Home service tile keep their one `setOpen` handler; the press is marked on its
  way down (`onClickCapture`), only for that fold's own head or title.
- 🔒 `every-fold-reveals-on-open.test.ts` (+ `.baseline.txt`, only shrinks) fails a NEW hand-rolled `aria-expanded`
  toggle that is not a menu and does not use the shared piece; `reveal-on-open.test.ts` drives the behaviour.

SPEC IMPACT: INTERACTION_RULES.md § 9 (Fold, kind 19) + DECISION_LOG.md should record the 2026-11-04 app-wide
"reveal on open" ruling — flagged to the controller, not edited by this builder.
