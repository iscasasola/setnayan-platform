## 2026-09-24 · fix(event-hub): every reveal needs Event Hub Pro — a free couple's guests get no reveal

Owner ruling 2026-09-24, verbatim: "all reveal is paid".

- **The bug, measured on prod:** the Reveal Studio master toggle (`reveal_studio_config.config.enabled`)
  was ON with `veil-sheer` as the house default, and `RevealOverlay` activated on
  `configEnabled || FLAG_ON || override || premiumUnlocked` — so every free couple's Save-the-Date
  and invitation stage played the paid veil. The ownership read was even skipped whenever the toggle
  was on.
- **One decision:** `revealAllowedFor()` in `apps/web/lib/reveal-access.ts` — not Pro → `NO_REVEAL`
  regardless of the admin default; Pro → their choice, else the admin default; `'none'` stands;
  `?reveal=` only on a `NEXT_PUBLIC_STD_REVEAL=1` staff preview build. The admin toggle is no longer
  an input.
- **Wired once:** `RevealOverlayServer` (both guest doors — the Event Hub and the invite door — go
  through it) now always reads Event Hub Pro ownership and hands off to the new synchronous
  `RevealMount`, which does not mount the overlay at all for a free couple. The client overlay re-runs
  the same function (it alone can read a preview `?reveal=`).
- **Writes:** `chooseRevealTemplate` refuses a non-`'none'` opening without Pro (`'none'` is always
  writable); `saveAllStdContent` refuses a CHANGE to a reveal-only effect (butterflies · petals ·
  colours · gold dials) without Pro, while `music` (the free film's toggle in the same JSON) stays
  writable. The builder shows "Opening effects need Event Hub Pro — nothing was saved" in its existing
  error slot.
- The admin Reveal Studio hint no longer claims the toggle switches reveals on for couples.
- Tests: `lib/reveal-access.test.ts` (decision + write tables) and
  `app/[slug]/_components/reveal/reveal-mount.test.ts` (element-tree render: free couple + admin
  toggle ON → no overlay mounted).

SPEC IMPACT: None
