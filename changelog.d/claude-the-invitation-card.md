## 2026-09-21 · feat(invitation): the first screen is the invitation card

Owner, on the live page: "doesn't look like the event hub we planned." The
first screen now follows canvas "1 · Arrival" for both a stranger and a guest:
a paper card with a gold hairline frame — "Together with their families", the
mark at ~150px, the names with an italic "and", "invite you to celebrate their
wedding", the date between two gold rules, the first moment's time — then "the
day, the place, the story ↓" into the hub. Every word comes from EventWords
(`_lib/invitation-card.ts`): a birthday says birthday, one person reads
"invites you", a funeral keeps its quiet masthead. The countdown now sits below
the fold. The top bar is pinned (4rem) so the fixed music/account buttons
always sit on it instead of on the content, and `scroll-padding-top` stops
every in-page jump below it. Events with a hero photo keep today's masthead.
Guard: `the-invitation-is-a-card.test.ts`.

SPEC IMPACT: DECISION_LOG.md row (the invitation card; countdown off the first
screen; strangers see the same card).

The paper card's corner routes through the `rounded-sm` token (`--m-r-xs`, 4px)
rather than an ad-hoc `rounded-[3px]` — the radius guard
(`apps/web/scripts/lint-radius.mjs`, strict in CI) keeps every corner on the
one token scale.

`the-hub-moves-with-meaning.test.ts` now counts the arrival marks **per
branch** instead of per file. The masthead returns one of two layouts and each
carries its own `arrive-mark` / `arrive-names` / `arrive-date`; a file-wide
count of 3 would have been satisfied by all three landing in one branch and
none in the other, which is exactly what a regression looks like.
