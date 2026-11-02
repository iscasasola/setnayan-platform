## 2026-08-28 · fix(vendor): the answer window is 48 hours, not seven days

**Owner ruling, 2026-08-28**, given in one word when the question was put to him. It restores the
2026-06-02 lock's own figure — which the shipped code had **never** matched. Read out of the live
production object, not from a migration file: `guard_event_vendor_lock_handshake` stamped
`INTERVAL '7 days'`, and `nudge_stale_lock_requests` defaulted to `p_days = 5`.

**What moved, and why it is more than one number:**

- The materialized deadline: 7 days → **48 hours**. Still stamped at the moment of asking, so a
  request made under the old rule would keep the seven days it was given.
- The reminder: day 5 → **24 hours**. 🔴 **It had to move or it would have died silently.**
  `nudge_stale_lock_requests` requires `lock_request_expires_at > NOW()`, so a day-5 reminder
  against a 48-hour deadline could never match a row — the job would have swept nothing and
  reported success forever.
- The countdown: days → **hours below a day**. On a two-day fuse the day-granular label spent
  *half the whole window* saying "Last day to answer" — the same words at 23 hours and at 3
  minutes. All three surfaces (Answers Desk, customer card, Customers roster) now share one
  phrasing instead of wording the same deadline three ways.
- Every rendered sentence that stated the old number, including a **fifth ask path** the first
  sweep missed (`negotiation-actions.ts`, the price-agreed lock) — found by grepping the string,
  not by working from a remembered list of paths.

**One number, one place.** The window is decided in the database and mirrored as
`LOCK_ANSWER_WINDOW_HOURS` for the copy; `the-answer-window-is-48-hours.db.test.ts` fails if the
two disagree, if the reminder falls outside the window, or if the runner and the function default
drift apart. A rule the database enforces and a sentence the product prints are two copies of one
number.

⚠ **The honest cost, stated rather than left to be found.** The sweep is cron-free and
traffic-driven with a 20-hour floor between passes. On a regular cadence a pass always falls in the
24 hours between the reminder and the deadline. **If page traffic goes quiet for more than a day, a
request can close having warned nobody.** No threshold fixes that; only a real schedule would.

🔢 **Safe by arithmetic:** production has never held a lock request — 0 pending, 0 rows with any
`lock_request_state`, 0 ever stamped, 0 ever nudged. The handshake is still behind
`NEXT_PUBLIC_LOCK_HANDSHAKE_ENABLED`, so nothing creates a pending row until the owner presses that.

⛔ **`CLOSED_WINDOW_GRACE_DAYS` is a different seven and did not move** — how long a lapsed ask
stays visible as a closed line. Two sevens, two meanings; a test pins the one that is not the
window.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-28 + `WHATS_NEXT_Shop_Redesign_SESSIONS_2026-08-28.md` — the
S4 open question "48h vs 7 days" is CLOSED by the owner and must not be re-asked.
