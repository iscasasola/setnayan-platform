## 2026-08-20 · feat(orders): you are told when someone pays you, at the time they pay

Two moments matter in apply-then-pay, and only the first told anyone:

    order SUBMITTED  → in-app notification to admins (before money exists)
    payment LOGGED   → nobody was told at all

The second is where real pesos have left a real bank account and a customer is
waiting for their purchase to switch on. `logPayment` wrote the row, revalidated
and redirected; the only trace was a queue somebody had to already be looking at.

🔑 THE DAILY OPS DIGEST IS NOT THIS, and it was the only thing standing in for
it. The digest is a next-morning summary, sends only when a queue is non-empty,
and fires around 08:00 Manila. For "your customer has paid", tomorrow is the
wrong answer. It is the safety net UNDER this alert, and a test pins that it
survives so nobody deletes it thinking this replaced it.

⚠ AND AN IN-APP NOTIFICATION IS NOT AN ALERT EITHER. `emitNotification` emails
only types on an explicit allowlist, and `order_awaiting_reconciliation` was not
on it — so even the notification that DID exist reached nobody who was not
already looking at the console. The notification and the allowlist are two halves
of one mechanism; having one is indistinguishable from having neither.

⚖ The duplicate-submit retry deliberately does NOT re-alert: `23505` plus an
idempotency key means the customer pressed submit twice and the first already
notified. Alerting again trains the reader to ignore the alert.

SPEC IMPACT: None.

🪤 THREE OF FIVE MUTATIONS CAME BACK GREEN, FOR THREE DIFFERENT REASONS, and
only the printed counts separated them: one sabotage never landed (`if (false)`
left the searched string intact, 1 → 1); one hit the SIBLING notifier rather than
the new one (2 → 1 at the wrong site); and one was a genuinely weak assertion —
it checked a `catch` EXISTED, so replacing the handler with `throw e` stayed
green. Only the third was a real gap. **"Green" is not one verdict.**
