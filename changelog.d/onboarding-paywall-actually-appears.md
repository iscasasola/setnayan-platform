## 2026-08-20 · fix(onboarding): the bill goes to the page that can take the money

The owner bought Setnayan AI at the end of a birthday create flow and reported:
*"i had a price to pay. but i there was no payment. it just created."* He was right,
and the order existed the whole time — a real, unpaid PHP 499 order sitting in
production. The flow redirected him to the **Papic studio**, whose banner names no
amount, gives no account to send to, and says *"your cameras activate"* to somebody
who bought the assisted planner. One screen earlier the flow had promised, verbatim,
*"We'll show you where to send it right after this."*

Nothing was designed. The bill page already existed and is canonical — it shows the
total, the reference code with a copy button, the BDO/GCash instructions and the
payment-logging form. A destination was corrected.

Also: a `?next=` errand can no longer carry a buyer past their own bill (swept across
the generic and wedding flows; the simple flow was already right), and the shots card
now names what the next press costs **before** it is pressed instead of reading
free · included · free with an unlabelled `+` as its only way to buy.

SPEC IMPACT: DECISION_LOG.md 2026-08-20 — supersedes the studio landing chosen in the
2026-08-11 onboarding-paywall row, which was an engineering call, not an owner lock.
