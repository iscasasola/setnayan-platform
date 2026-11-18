## 2026-11-16 · fix(couple): Memories on a desk is the 48rem reading column (owner, item 12)

Owner, DECISION_LOG `75a46e3c` (16 Nov, item 12, "a"): *Memories on desktop is a 48rem column*. W1 measured the event
Memories page at 64rem on a 1280 desk (RW-343) and asked for this ruling. From 701px the `data-memories-stage` column is
now `tab:max-w-3xl`, centred, instead of `tab:max-w-5xl`. Below 701 the div is still an unstyled block, so the phone is
unchanged. Galleries stays on the wide stage, since the ruling names Memories only.

- **Guard:** `app/dashboard/[eventId]/memories/the-memories-column-is-48rem.test.ts` checks three things: the stage's
  only desk cap is `3xl`, `3xl` means 48rem in this app's theme, and the column is centred. It also checks that no
  class on the stage binds below 701. Sabotage: restoring `5xl` turns it red; a bare `max-w-3xl` (binding on a phone)
  turns it red.
- `secondary-pages-read.test.ts` held the old D1 width for Memories. Its row now holds the reading column and cites
  this ruling.

SPEC IMPACT: None. The DECISION_LOG row already records the ruling.
