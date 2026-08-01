# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-08-01 · feat(payments): enter the real available balance, and compute from it

Owner 2026-08-01: *"i can update my account's available balance to accept for the month? so it can compute rather than locking a single amount. whatever I update for that month will be the actual balance. and it resets every month back to 500,000."*

**This fixes a structural flaw in the meter shipped hours earlier** (#3990). That version measured Setnayan order inflow against a fixed ₱500,000 ceiling — but the bank's limit counts **everything** the account receives, including the owner's personal transfers, which Setnayan cannot see. The meter could read 60% while the wallet was actually at 95%. Letting the owner type the real remaining headroom re-syncs it to truth whenever they check.

**Changes**

- **Migration `20271028200000`** — `{gcash,bdo}_available_php` + `_available_as_of`.
- **`channelHeadroom()`** replaces `capUsage()`, with two modes:
  - **owner balance** — deducts only payments recorded **after** `_as_of`, because everything earlier is already inside the figure the owner read. Deducting from the month start instead would double-count every one of those orders and close the rail early.
  - **cap** — no usable override; measures month-to-date inflow against the ceiling, and the copy says plainly that the real figure is **lower**.
- **Monthly reset is derived, not scheduled.** An override whose `_as_of` falls outside the current calendar month simply fails the check and the cap applies again. No cron, no midnight job to fail silently.
- **Window corrected to the calendar month.** #3990 used a rolling 30 days, which disagrees with how GCash reckons a monthly limit — by up to 30 days at month boundaries.
- **Admin** gains an "available balance now" field beside the monthly limit, plus the reading's date.

**When `_as_of` is stamped — the load-bearing detail.** Only when the submitted balance **differs** from the stored one. Re-stamping on every save would mean editing an account *name* silently reset the clock and discarded every order since, overstating headroom until a transfer bounced. The miss is benign and deliberate: an owner who re-checks and lands on the same figure keeps the older timestamp, so orders already reflected in it are deducted again — which **under**-states remaining and closes the rail early. That is the safe direction to be wrong in.

**`created_at`, not `paid_at`, for the since-reading window.** `paid_at` is a DATE the couple asserts, so a same-day order would compare equal to the override instant and be dropped. `created_at` is when *we* recorded it — the honest "after the owner looked" test.

A zero balance is honoured rather than treated as unset: the wallet really can be full, and that must read as **over**, not as 0% used.

SPEC IMPACT: `DECISION_LOG.md` — row for the owner-entered available-balance model, the derived monthly reset, and the calendar-month correction.
