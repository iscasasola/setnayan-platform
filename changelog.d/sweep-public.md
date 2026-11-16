## 2026-11-16 · style(public): the clean warm look on the public pages and the shop — page, frames and buttons read the tokens

The owner's 16 Nov ruling (DECISION_LOG "THE CLEAN WARM LOOK IS APPROVED" + "PAGE BACKGROUND = NEUTRAL #F7F5F4")
carried into the signed-out pages and the supplier's public shop (`app/v/[slug]`, served at `/{shop}`). Looks only.

- **Page:** the Pricing plan quiz and Our Story `<main>` read `bg-page` (`--sn-page-bg`) instead of a hand-typed white.
  For coordinators' `.fc` scope reads `--sn-page-bg` for its page.
- **Frames:** eleven hand-made boxes (Features "Why Setnayan" ×3, Discover's category tile, review card and
  availability note, Memories' before/after list, and the shop's typical-price card, inspiration tile, sample service
  card and map card) and nine For-coordinators frames now read `--sn-frame-bg` / `--sn-frame-radius` /
  `--sn-frame-shadow`, with no 1 px border. `.fc-dark` sections keep their own dark frame.
- **Buttons:** ten raw `<button>`s with hand-typed looks are `ActionButton` now (Discover's review arrows,
  category-sheet close and lock-a-date; Pricing's "See all included" and the plan quiz's Back; the shop's photos
  sheet back/close/leave/try-again and the date calendar's close).
- `no-card.baseline.txt` is left alone: it is shared and another PR edits it. Fewer cards keeps the ratchet green, and the train regenerates it once.
- Skipped because another open PR edits them — listed in the PR body.

SPEC IMPACT: None — applies the 2026-11-16 rulings already in DECISION_LOG.
