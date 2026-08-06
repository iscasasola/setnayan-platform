## 2026-08-06 · fix(prod): two live queries that failed outright and rendered as "nothing here"

Found in production runtime errors, both **still firing on 2026-08-06**. Same
disease both times: a failed Supabase query returns `{ data: null, error }`, and
`?? []` downstream turns that into an empty list. Nothing throws. The screen
looks fine.

**1 · The vendor "confirm you're ready" email has been sending to NOBODY.**
`ghosting.ts` embeds `events` from `event_vendors` with a bare `events!inner`.
There are **two** paths between those tables — the direct foreign key, and a
many-to-many through `event_build_picks` — so PostgREST refuses the whole query
with `PGRST201` rather than guessing. `confirmed` came back null, so the
T-7-days warning to a vendor with a wedding that week never went out.

🔑 **THIS IS THE SECOND TIME THIS ONE QUERY HAS BEEN KILLED THIS WAY.** The
comment directly above it already records a `42703` from naming a column
`event_vendors` does not have. Same query, same silence, different error code —
and both times the only symptom was an email that never arrived. The foreign key
is now named explicitly, and a test pins both failure modes.

**2 · The couple's Papic page quotes a price from an empty tier list.**
`papic_one_tiers` shipped with **RLS enabled, zero policies and zero grants** —
readable by nobody but `service_role` — while the page reads it with the
signed-in client. Every read `403`d.

Fixed by **mirroring its own sibling**, not by inventing a rule: `papic_pass_tiers`
and `platform_retail_catalog_v2` are the same kind of admin-editable catalogue
with no personal data, and both ship `SELECT` to anon+authenticated behind a
`USING (true)` policy. Writes stay service-role only.

🔑 **A grant without a policy would have been inert.** RLS is on, so granting
`SELECT` alone still denies every row — it would have read as fixed and changed
nothing. The test asserts both halves.

🪤 **A guard of mine matched its own migration comment.** The write-grant check
spanned a `--` comment, because comments contain no `;` and `GRANT[^;]*` runs
straight through one, joining fragments of two unrelated statements. **Third time
this session a guard has matched prose instead of code.** The scanner now strips
comments before matching.

**Checked and NOT fixed, deliberately:** the `event_vendors` "invalid enum value
`declined`" errors are already fixed in code — the comment at the call site
documents it — and those errors predate the fix. Re-fixing would have been
churn.

**Verified:** 6 new tests, every one mutation-checked (embed made ambiguous ·
phantom column restored · error log swallowed · grant removed · policy removed ·
write grant leaked) — all go red. Full suite 6,897 pass under `Asia/Manila`;
13/13 lint scripts clean; scoped `tsc` clean.

SPEC IMPACT: None.
