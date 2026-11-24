## 2026-11-24 · fix(live): six faults from the crash log

Six faults real users hit in the last 7 days (`app_telemetry_logs`, read 23 Nov). Each is fixed at its source and held by a guard test that was shown red first.

- **Booking-fee attribution refused for the service role.** `booking_fee_import_created_account` joins `auth.users` for the couple's account age. Production's `service_role` cannot read that table, so the attribution failed with 42501 and the supplier's fee notice fell back to "Couldn't read".
  - Fix (migration `20271361773239`): the same function, body unchanged, is now SECURITY DEFINER. It is still callable by service_role only.
  - Guard: `tests/db/live-faults-run-as-their-callers.db.test.ts` (1), which runs the function as service_role.
- **The inquiry-concentration detector wrote a NULL.** Group chats have no supplier. The detector counted them as inquiries to supplier NULL and inserted a flag with a NULL supplier (23502), which failed the whole run.
  - Fix (same migration): count only threads sent to a supplier.
  - Guard: the same test file (2).
- **Hydration #418 on the public Event Hub.** Schedule times were formatted in the machine's own language (`toLocaleString(undefined, …)`). The server wrote "2:00 PM" while a phone set to another language wrote "14:00".
  - Fix: `formatBlockTime` and `formatBlockTimeRange` now spell the words by hand from the UTC parts, so every device writes the same text.
  - Guard: `lib/a-schedule-time-reads-the-same-everywhere.test.ts` (🌐).
  - Visible change: a block that ends the next day now reads "… → Sat, Dec 19, 1:00 AM", where it used to read "12/19/2026, 1:00:00 AM".
- **The "Reload" in the "Setnayan was updated" notice looked dead.** On a slow line nothing changed on screen until the new page arrived.
  - Fix: it is now the house `ActionButton`. It says "Reloading…" as soon as it is pressed and ignores a second press.
  - Guard: `lib/the-site-updates-itself.test.ts`.
- **Signed-out reads of `events` (42501 as anon).** When the middleware's token refresh is refused, the session cookie is left with its name and an empty value.
  - Cause: the Guests page's gate matched the cookie name only, and the event Home opened its event row before its sign-in check.
  - Fix: both pages now check for a live session cookie first (`isLiveSessionCookie` / `hasLiveSessionCookie`). This needs no extra trip to the server.
  - Guards: `the-guests-page-asks-once.test.ts` 6b and `lib/a-dead-session-reads-nothing.test.ts`.
- **The Messages badge's count "could not be read".** None of those reads reached the database: a phone waking a tab asked before its connection was back.
  - Fix: a read that got no answer at all now waits for the connection (at most 4 s) and asks once more. A failure now records its reason. The badge still never shows 0 for a failed read.
  - Guard: `lib/the-envelope-asks-again-when-the-line-returns.test.ts`.

SPEC IMPACT: None. These are fixes to shipped behaviour; no rule, price or flow changes. The only wording change is the next-day schedule time above.
