## 2026-08-07 · fix(ci): production migrations stopped reaching the database at 11:17, silently

**Every prod deploy since 11:17 UTC failed**, and nothing said so — the PR checks
are green, the failure is in the *post-merge* deploy job.

**Cause, pinned to the minute.** `supabase/setup-cli` was set to
`version: latest`. Supabase CLI **v2.112.0** was published at **10:08 UTC**; the
last successful deploy was **09:59**, the first failure **11:17**. It breaks
`supabase link`:

```
failed to get api keys: SchemaError(Expected a string matching the RegExp ^...
```

— the CLI validates a timestamp the API returns against a stricter RFC3339
pattern than the API emits. The deploy is fail-closed, so `db push` never ran.

**What that stranded — code live, schema absent:**

| migration | effect in prod right now |
|---|---|
| venue dimensions | the two columns **do not exist** while the code selecting them is live — a phantom column fails the whole query and reads as "nothing found" |
| creator offers free | **sending a creator an offer still charges a token** nobody can buy |
| OAuth credential backfill | the grant revoked 2026-07-26 **still holds its key** |

🔑 **`version: latest` lets a third party break this pipeline without anyone
touching this repo — and it fails AFTER the merge, so CI is green and nobody is
told.** All three workflows that install the CLI (`deploy-prod`,
`supabase-migrations`, `migration-drift-monitor`) are now pinned to **v2.111.0**,
the last release every deploy succeeded on, each with the incident written at the
pin so the next person does not "tidy" it back to `latest`.

To move off the pin: bump deliberately and watch one deploy go green.

SPEC IMPACT: None.
