## 2026-08-22 · fix(join): a guest signing in on a NEW PHONE was never attached to the event

`connectEventForUser` — the cross-device path behind the emailed sign-in link —
wrote `joined_via: 'email_link'` into `event_members`. **`join_method` has six
labels and that is not one of them** (`qr_scan · invited · created_event ·
admin_added · invite_claim · guest_signup`, read out of live production).

So Postgres **refused the row every single time**. The refusal lands in `error`,
`connected: !error` returns false, the outer `try/catch` would have swallowed a
throw too, and the route redirects regardless. A guest who signed in from a new
phone landed on an empty home page with their celebration missing — **no error, no
explanation, nothing logged.**

🔑 **THE SIXTH COSTUME OF ONE DISEASE.** A phantom COLUMN in a select · a phantom
ENUM VALUE in a filter · a phantom ARGUMENT in an `.rpc()` · a blocked iframe · an
unresolved `r2://` — and now a phantom ENUM VALUE in an INSERT. **Rejected, never
thrown; the only symptom is an absence.**

⚠ **Typecheck could not catch it.** These writes go through the admin client with
loosely-typed payloads, so `tsc` sees a plain string and is satisfied. Only asking
the schema answers it.

`'guest_signup'` is the correct label and not a nearest-fit: it is what the SAME
act writes on the same device (`lib/link-guest-account.ts` — a guest who scans and
then makes an account). This path is that person without the cookie.

🛡 New `tests/db/enum-literals-are-real.db.test.ts` walks every non-test source file
under `app/` and `lib/`, extracts every bare string literal written into an
enum-typed column, and asks the migration-replayed schema whether each label
exists — for `joined_via`, `entry_source`, `member_type`, `rsvp_status` and
`meal_preference`. It strips comments first (this very fix names the dead label in
prose), asserts the file walk and each pattern actually matched something (a loop
that skips everything passes), and **refuses to run rather than pass vacuously**
when an enum name is wrong — which it did on the first attempt, catching my own
mistaken enum name. A behavioural test then proves the row this path writes is
accepted.

⚠ **When it fails, never widen the list.** Either the literal is wrong or the enum
needs a migration; widening reproduces the exact bug it exists to catch.

3 sabotages, all landed by occurrence count, all RED.

SPEC IMPACT: None.
