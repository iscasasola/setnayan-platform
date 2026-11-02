## 2026-09-18 · fix(oauth): the Google grants are renewed by a registered job, not a cron nobody runs

Measured on production:

```
oauth_grants                2 rows · 2 refresh tokens · 2 access tokens EXPIRED
                            (one since 2026-07-10, one since 2026-08-31)
live_studio_channel_grants  3 rows · 3 refresh tokens · 3 access tokens EXPIRED
                            (all since 2026-09-02)
every refresh_token matched '1//%'  — Google PLAINTEXT
```

Five live Google connections — a couple's YouTube and Drive, and all three Live
Studio pool channels — with every access token long dead and nothing renewing
them. **A couple finds out on the wedding day.**

The worker has existed since iteration 0011 in
`app/api/cron/oauth-refresh/route.ts`, carrying its own note:

> `TODO(0011): wire the actual cron schedule.` · *"the actual scheduling is an
> owner-side task"*

🔑 **That schedule was never coming, because this repo has no scheduler by
design.** `vercel.json` carries `"crons": []`, `cron.job` is empty, and all
twenty-two periodic jobs ride request traffic through `claim_periodic_job`. A
route waiting for a cron was waiting for a mechanism the project had decided not
to have — so **registry membership, not "is it scheduled", is the first question
about any job here.**

🔒 **And it is why the token vault had sealed nothing.** This sweep is the only
writer that calls `sealToken`. The vault shipped 13 September and has encrypted
**zero** production rows, because the one thing that writes a sealed value had
never run.

- `lib/oauth-refresh-sweep.ts` — the body, callable.
- `lib/oauth-refresh-job.ts` — `runClaimedJob('oauth-refresh', …)`, hourly,
  reading its cadence **from the registry** rather than restating it.
- Registry row + `after(() => maybeRunOAuthRefresh())` on the home page, beside
  the three jobs already there, and added to the guard that polices them.
- The route keeps its secret and its JSON; an owner-side cron still works.

⚠ **This does NOT retro-seal the five refresh tokens.** It seals each *access*
token as it refreshes. Opening and re-sealing the five existing refresh tokens
is a backfill, named here rather than implied.

**Two of my own guards were wrong first, and sabotage found both.** One asserted
the registry's `gapMs` while the wrapper passed its own separate constant —
widening the load-bearing one stayed green. The fix was not a test that two
numbers agree but **deleting the second number**. The other was written against
a `server-only` module and could not even import it.

SPEC IMPACT: None.
