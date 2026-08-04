## 2026-07-26 · fix(security): SEC-8b — take every remaining credential column off the browser read surface

SEC-8 (`20271009210000`) closed `public.oauth_grants`. This is the sweep of everything
still SELECTable by `anon` or `authenticated` afterwards. Same root cause as SEC-2b and
SEC-8: **RLS is ROW-level and can never hide a COLUMN.**

Three tables, and they were **not** equally dangerous — stated separately so neither is
over- nor under-stated:

1. **`patiktok_oauth_grants` — the exploitable shape.** Plaintext `access_token` /
   `refresh_token`, table-level SELECT to both browser roles, and a PERMISSIVE row policy
   `couple_reads_patiktok_oauth_grants` (`event_id IN current_couple_event_ids()`) that
   admits every couple member of the event to the row. `GET
   /rest/v1/patiktok_oauth_grants?select=refresh_token` would have returned a live TikTok
   credential to any couple member. **Dormant, not safe** — 0 rows, because Patiktok has
   issued no grants (`publishPatiktokCompilation` returns `not-implemented`). Fixed while
   empty so the feature cannot ship already-broken.

2. **`platform_integration_secrets` — 9 `_enc` columns, 1 live row, NOT reachable.** These
   are Setnayan's own platform-wide credentials (Maya keys, OpenAI, Resend, TikTok/Google/
   YouTube client secrets). RLS is on and the table has **zero policies**, so both browser
   roles match no rows and the grants are inert. Locked anyway: the only thing between the
   internet and every platform credential was the *absence* of a policy, so the day anyone
   adds one for a good reason, nine secrets go with it. Encrypted at rest lowers severity;
   it is not a reason to publish the ciphertext.

3. **`vendor_ig_connections.access_token_enc`** — `authenticated` was already revoked,
   `anon` was not. Unreachable (no anon policy, 0 rows). Finishing a half-applied revoke.

⚠ **The naive fix is a no-op.** Postgres: *"if a role has been granted privileges on a
table, then revoking the same privileges from individual columns will have no effect."*
All three tables held table-level SELECT, so `REVOKE SELECT (col) … FROM anon,
authenticated` applies without error and changes nothing. This migration therefore does
REVOKE-then-GRANT with the allow-list computed from **live** privileges, so it unions with
any earlier denial instead of undoing it — the pattern from SEC-8 and SEC-2b.

**Every reader audited first; nothing had to move.** The couple-facing TikTok panel reads
`tiktok_handle, tiktok_open_id, expires_at` (token-free, still works); the disconnect action
uses the session client only for the `event_members` check and does the write on
`createAdminClient()`; the OAuth callback writes on admin; the refresh cron's TikTok branch
short-circuits `provider_not_yet_implemented`; and `lib/patiktok-tiktok.ts` names the tokens
only in a type and a comment. All `platform_integration_secrets` readers already use
`createAdminClient()` — they must, since a session-client read returns zero rows today.

**Neutralisation, measured:**

| probe | result |
|---|---|
| N1 · migration removed | 2 of 9 fail (both finding tests); all 4 controls stay green |
| N2 · the naive column `REVOKE` | **2 of 9 fail — caught.** (SEC-8's equivalent probe was *not* caught, because a sibling migration had already converted that table to a column list; these three have no such predecessor, so the harness matches prod) |
| N3 · fix only `patiktok`, leave the rest | the migration's own post-condition **RAISEs during replay**, naming all 10 remaining columns — a partial fix cannot apply |

Exposure baseline verified mechanically: **ADDED 0 · REMOVED 0 · CHANGED 17 · WIDENED 0** —
every change is `S` dropped. Answered by narrowing, not by baselining the openness.

Writes are deliberately untouched (`IUD` remains at table level): RLS gates writes row-wise
and the only write policy on the grants table is `is_admin()`, so a non-admin matches zero
rows for UPDATE. The SELECT hole existed precisely because the *read* policy does match.

SPEC IMPACT: None.
