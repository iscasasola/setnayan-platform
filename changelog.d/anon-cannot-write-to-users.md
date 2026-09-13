## 2026-09-02 · fix(security): anon can no longer write to public.users

`anon` held SELECT, UPDATE, TRUNCATE, TRIGGER and REFERENCES on `public.users` — all 53
columns, by a blanket table grant. Supabase publishes every `public` table as a REST
endpoint and the anon key ships in the page source, so those were capabilities reachable
with curl.

Revoked: **UPDATE, TRUNCATE, TRIGGER, REFERENCES**. No policy on `users` admits anon for
any command — every one is `{authenticated}` — so nothing anonymous ever had a reason to
write here. TRUNCATE is the sharpest of the five and the reason this is not merely tidy:
**TRUNCATE is not filtered by RLS at all**, so unlike SELECT/UPDATE it was not held back
by the absence of an anon policy. It is unreachable through PostgREST today, which is a
property of the client, not of the grant.

⚠ **SELECT IS DELIBERATELY KEPT, and that is the interesting half.** PostgreSQL evaluates
an RLS policy expression AS THE CALLING USER, so a policy whose USING clause reads `users`
needs the caller to hold SELECT on `users`. Twenty-plus policies do, and
`creator_chapters.public_can_read_published_chapter` — roles `{anon,authenticated}` — is
evaluated by anon on every public creator-chapter page. Revoking anon's SELECT would not
deny those rows; it would **raise**, and the pages would break.

🔑 A RAISE INSIDE RLS IS NOT "THIS POLICY SAID NO", IT IS "THE WHOLE CHECK FAILED" — the
same mechanism that took down private Realtime channels here (`20271187719883`), where one
ungranted predicate refused every topic at once.

Narrowing the READ is still worth doing later: anon needs only `user_id`,
`public_profile_enabled`, `is_internal`, `is_team_member` and `account_type` out of 53, so
names, emails and all six `*_consent_at` timestamps could come off it. That needs a
revoke-and-re-grant (PostgreSQL will not subtract a column privilege from a table grant)
and its own proof in both directions, so it is not bundled here — putting a live public
page at risk inside a migration whose point is to reduce risk would be the wrong trade.

Guard: `tests/db/anon-cannot-write-to-users.db.test.ts` (3) pins BOTH directions — no write
capability, AND SELECT still present, AND the policy that depends on it still reading
`users`. Mutation-tested: a no-op migration turns it red, and so does over-revoking with
`REVOKE ALL`. Exposure-freeze and both Ugat guards green (a revoke is a narrowing, which
that baseline accepts without an update).

SPEC IMPACT: None.
