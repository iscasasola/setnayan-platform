## 2026-11-22 · fix(help): Help asks first, merged with main — prefilled contact form kept, chevron on the motion tokens

Merged `origin/main` (22 Nov) into #7614. `/help` keeps this PR's ask-first page and main's prefilled
contact form (`?subject=&body=&topic=`, the Card Maker's "Need your own form?" door) and main's
`getCurrentUser()`. The topic starts as `prefillTopic ?? the coverage's topic`; the subject as
`prefillSubject || the asked words`. The answer rows' chevron turned on a raw 200 ms + cubic-bezier,
which main's `lint-motion-raw` now refuses; it reads `--sn-m-quick` / `--sn-m-settle` instead (same
Quick 200 + Settle). Admin model cap 159 = main's 158 + `/admin/help/guides` (measured: 158 fails
`rank-choices.test.ts`). Server actions stay 1251/1251.

SPEC IMPACT: None
