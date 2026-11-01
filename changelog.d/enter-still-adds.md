## 2026-11-01 · fix(field): Enter still adds in one-line add boxes

Owner ruling 1 Nov ("ENTER STILL ADDS IN ONE-LINE ADD BOXES"). #7142 moved Admin › Categories' "＋ Add" row (group,
category, service — one `AddRow`) and "Your custom domain" onto the Field template (`TypedRow`), where Enter only kept the
words. The template now takes an opt-in `onEnter` (Enter keeps, then hands the kept words to the add; its key says "go"
and never tabs on) and an `autoComplete` prop; both boxes opt in, and the You card's Display name gets
`autoComplete="nickname"` back. Other fields are unchanged. Guard: `apps/web/lib/enter-still-adds.test.ts`.

SPEC IMPACT: None (implements the recorded 1 Nov ruling).
