## 2026-11-16 · style(admin): the clean warm look, admin area — frames and buttons read the tokens

Owner, 16 Nov: *"build the color change throught the website"* — DECISION_LOG rows "THE CLEAN WARM LOOK IS
APPROVED" and "PAGE BACKGROUND = NEUTRAL #F7F5F4; FRAMES = WHITE #FFFFFF". This is the admin sweep
(`apps/web/app/admin/**`); the shared values land in the sibling `claude/clean-look-tokens` PR.

- **Frames.** `app/admin/_components/admin-frame.ts` → `ADMIN_FRAME`: fill, corner and lift read
  `--sn-frame-bg` / `--sn-frame-radius` / `--sn-frame-shadow` (the same three Admin › Colours writes). 38
  hand-typed `rounded-2xl border border-ink/10 bg-cream|bg-white …` containers now use it, with no 1 px border
  and no hand-typed shadow.
- **Buttons.** 33 hand-styled `<button>`s move onto `ActionButton` with a tone (brand · ok · danger · neutral ·
  warn). Behaviour, labels, `type`, `disabled` and handlers unchanged.
- **Left alone on purpose:** Admin › Colours (its preview tiles show the colour being set), Ugat's and
  Connection logs' own console palettes, tinted notices (warn/danger/success boxes), dashed empty states,
  form fields, buttons that post `name`/`value` (ActionButton reads `name` as its accessible name), and every
  admin file another open PR edits (listed in the PR).
- Ratchets regenerated lower: `no-card.baseline.txt`, `label-contrast-dark.baseline.json`.

SPEC IMPACT: None — implements the 16 Nov DECISION_LOG rows; no new decision.
