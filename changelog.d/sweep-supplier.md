## 2026-11-16 · style(supplier): the supplier area reads the page and frame tokens

The owner's 16 Nov ruling (page #F7F5F4, white frames with a soft lift, no 1 px border) reaches the supplier
area through the token layer: 22 hand-typed white frames in `app/vendor-dashboard/**` and `app/vendor-invite/**`
now read `--sn-frame-bg` / `--sn-frame-radius` / `--sn-frame-shadow` (no border, radius or shadow typed by
hand), the Bundle Maker's loading screen reads `bg-page`, and the hand-styled Cancel · Post in "Post an update"
are `ActionButton`. Looks only: no words, layout or actions changed. Files edited by other open PRs were skipped.
`no-card.baseline.txt` is left as it is (counts only fell; regenerating it rewrites ~340 lines from other areas).

Note: Tailwind 3 reads `shadow-[var(--x)]` as a shadow COLOUR (box-shadow stays none), so the frame uses
`shadow-[shadow:var(--sn-frame-shadow)]`.

SPEC IMPACT: None — applies DECISION_LOG 2026-11-16 ("THE CLEAN WARM LOOK IS APPROVED", "PAGE BACKGROUND = NEUTRAL #F7F5F4").
