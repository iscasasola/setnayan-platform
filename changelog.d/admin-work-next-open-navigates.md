## 2026-11-16 · fix(admin): Work's Next card "Open" opens the queue (live fix)

On live `/admin/work` (027f641) the top card read "Next · Oldest 47h · past SLA — Payments · 1 waiting". Its Open
did nothing, while `/admin/payments` worked when typed in. **Cause:** when a queue can unfold in place, the card's
Open borrowed the list row's toggle link, `/admin/work?open=payments`. That unfolds a drawer on the Payments row far
down the list, under the notices, the suppliers' inbox, the strip and the chips. The drawer sat out of sight on a
phone and on a desk, so the page redrew looking the same, and a second press folded the drawer shut.

- **Fix** (`app/admin/queues/_components/queues-triage-feed.tsx`): the Next card's Open goes to the queue's own page
  (`next.href`). The rows in the list keep their unfold.
- **Guard:** `app/admin/queues/_components/the-next-card-opens-its-queue.test.ts` renders the real feed with Payments
  ranked first and unfoldable, as on live. It checks that the card's one link is `/admin/payments`, including when
  `?open=payments` is already set. It fails on main, where the link was `/admin/work?open=payments` and then
  `/admin/work`.
- **Checked** at 390×844 and 1280×800 on the rendered card with the live stylesheet. The link is `/admin/payments`,
  and the topmost element at the button's centre is the link itself, so nothing covers it.

No server action, no migration. SPEC IMPACT: None.
