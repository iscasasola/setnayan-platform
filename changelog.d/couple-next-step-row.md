## 2026-11-19 · feat(picked-page): the Next step row on the host's side, and three landing/badge follow-ups

Owner, 19 Nov ("let us finish these"), after #8002 went live.

- **Next step row on the host's view of a supplier.** One shared part for both sides: `app/_components/picked/next-step-row.tsx` (the supplier page's own copy is deleted). The host's rule is `coupleNextStep` in `lib/client-next-step.ts`: not booked and a quote unanswered → "A quote is waiting for you" → Book & Budget; booked → the next installment still to pay ("Next payment ₱48,000 · due Wed, Dec 9") → Book & Budget at the payments; after the event, a delivered handover not yet confirmed → "Your files are ready" → Files. No event-week stage: the crew call is the supplier's read, not the host's.
- **Reads are honest.** `fetchPlanProgressForCouple` now reports `readComplete` — it used to drop both its errors, and a refused payments read folded as "nothing paid", which would have named a paid installment as due. An unread plan, proposals list or handovers list gives no row. A coordinator without Budget & payments (`moneyHidden`) never gets a peso figure or the quote line.
- **An old `#forms` / `#inspiration` link with no `?tab=`** lands on its part, not the top of Details.
- **`?tab=payments#deposit`** lands on the deposit card: a hash beside a `?tab=` is an element of that page and outranks the tab's own part; with no such element the tab's part is used.
- **Chat's unread count on a computer.** The Chat tab is not in a computer's menu, so the count sat on a hidden tab. The Chat column now carries its name and the count, which goes when the reader touches the column.
- Labs: `/dev/chat-lab?pick=…` draws the host's row from the real rule (`?next=quote|handover|none`).

SPEC IMPACT: None (no ruling changed; the host row mirrors the supplier's by the owner's word). The three host lines are the owner's approved wording (19 Nov) — "A quote is waiting for you", "Next payment <amount> · due <day>", "Your files are ready"; with no date the line is "Next payment <amount>", with no amount "Next payment · due <day>" / "Next payment".
