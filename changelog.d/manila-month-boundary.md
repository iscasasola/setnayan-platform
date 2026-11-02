# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-08-01 · fix(payments): the receiving-balance month resets on Manila's 1st, not UTC's

Owner 2026-08-01: *"yes return to 500k every first day of the month."*

The available-balance reset (#3993) compared calendar months using the **server's** clock. Vercel runs in UTC, eight hours behind Philippine time — so for roughly the first eight hours of every month, midnight to 8am PHT on the 1st, Manila says September while the server still says August.

**That window is not harmless.** A balance entered at 2am on the 1st would be stamped as the *previous* month, go stale hours later when UTC caught up, and silently drop the meter back to cap mode — which reads **higher** than the truth. Of the two ways to be wrong, "you have more room than you do" is the one that costs a bounced transfer and a confused couple.

**Change:** `inSameCalendarMonth` and `monthStartISO` now derive the date in `Asia/Manila` via `Intl.DateTimeFormat` (`en-CA`, chosen only because it formats as `YYYY-MM-DD`, which slices and sorts correctly — it is not user-facing). Behaviour is otherwise identical; the reset still happens on the 1st, just on the calendar the owner is actually looking at.

Four tests added, all of which fail on the previous code:

- `2026-08-31T16:30Z` (= 1 Sept 00:30 PHT) resolves to **September**
- A balance entered at 2am on the 1st PHT stays `owner_balance` later that day instead of collapsing to `cap`
- Last month's reading **still** goes stale — the reset is moved, not removed
- `23:59` PHT on the 31st is still that month

SPEC IMPACT: None — corrects the timezone of an existing boundary; no schema, pricing, or behaviour change beyond the eight-hour window it fixes.
