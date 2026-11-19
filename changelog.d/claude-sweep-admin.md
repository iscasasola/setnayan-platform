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

**Handover pass (16 Nov):** the branch now stacks on the shared-layer PR (`claude/clean-look-tokens`), which owns the
frame values. The frames read their lift as `shadow-[var(--sn-frame-shadow)]`, which Tailwind 3 compiles to a
shadow COLOUR (measured: `--tw-shadow-color`, no `box-shadow`), so no frame would have lifted; `ADMIN_FRAME` now uses the
token key `shadow-sn-frame`. `no-card.baseline.txt` is left at the shared PR's version (counts only fell) so the
sibling sweeps cannot conflict on its header; the batch regenerates it once.

**`ActionButton` gains `formName` (controller ruling, 16 Nov, on this PR's question):** the field a submit POSTS is
now its own prop, apart from `name` (the accessible name). Before, one prop did both, so twelve admin buttons that post
`action=…` / a queue decision (integrity-watch, repost-watch, the queue cards) were read aloud as "action"; they now pass
`formName` and are read by their word. With that, the data-privacy control presses (Restore · Approve · Turn off ·
Block · Retire) and the launch-offer presses (Start · Save · End it now · Save the free-fee window) are `ActionButton`s;
they post exactly what they posted before. Held by `lib/action-button-posts-its-form-name.test.ts` (rendered + a
whole-tree check that every `ActionButton` posting a `value` names its field). The Ugat console and Connection logs
keep their own palettes this round (controller: internal tools).

SPEC IMPACT: None — implements the 16 Nov DECISION_LOG rows; no new decision.
