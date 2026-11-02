## 2026-08-20 · fix(availability): a slow database must not take the whole site down

🔴 **AN OUTAGE, NOT A HYPOTHETICAL.** For roughly 50 minutes on 2026-08-20 the
production database stopped accepting connections. Vercel was healthy and the
app was healthy — and **every page on setnayan.com returned 504
`MIDDLEWARE_INVOCATION_TIMEOUT`**, including public pages, for visitors with no
session at all. Measured, not inferred:

- edge logs for that hour: `/auth/v1/token` **139× status 522**,
  `/rest/v1/events` **244× 522**, `/rest/v1/vendor_profiles` **254× 522**;
- the pooler retrying every ~7s: `DbHandler: Connection failed {:error, :timeout}`;
- `/api/health` answered in **0.2s throughout** — the one path the middleware
  matcher excludes. That contrast is what located the fault.

**THE MECHANISM.** `updateSession()` awaits `supabase.auth.getUser()` in front of
every request the matcher covers, which is everything except static assets and
`/health`. The await never returned, so the platform killed each request at ~25s.

🔑 **THE FAULT WAS NOT SLOWNESS — IT WAS THAT THE CHECK IS UNBOUNDED AND EVERY
PAGE WAITS ON IT.** For an anonymous visitor on a public page, the answer changes
nothing about what renders. Making them wait 25 seconds and then handing them a
gateway error is the worst available trade.

**THE FIX.** One deadline (2s) around the whole session check. Past it, the
request continues **as if nobody is signed in**.

⚖ **WHY THAT DIRECTION IS SAFE HERE, checked rather than assumed.** Every
protected surface does its own server-side `auth.getUser()` and redirects; the
middleware's copy feeds only the `?demo=1` admin flag and one
already-signed-in redirect target. A timeout therefore cannot open a door — at
worst somebody signed in briefly sees the signed-out version of a public page,
with their cookies untouched.

🪤 **THE LOSING SIDE OF A RACE KEEPS RUNNING, and that is the half a naive fix
misses.** The Supabase client's `setAll` cookie callback can fire seconds after
we have answered, rebuilding the response and rewriting session cookies on a
request already sent. A `bailed` flag makes it a no-op after the budget expires.
**Stopping the waiting without stopping the writing is not a fix.**

🔊 The degrade logs once. An outage that degrades silently is one nobody
measures — every page would render signed-out and look perfectly fine.

⚠ **WHAT THIS DOES NOT DO, said plainly:** a page that reads the database in its
own body still waits on the database. This keeps the PUBLIC site standing when
the database is unwell; it cannot make a dashboard work without one.

**Verification.** 5 unit tests on the real timing behaviour + 5 source guards.
**6 mutations, each landing verified by occurrence count, all 6 turn the suite
RED**: budget removed (1→0) · timeout keeps the user (1→0) · late-cookie guard
deleted (1→0) · degrade goes silent (1→0) · budget raised to 24s (1→0) · timer
left running (1→0).

🪤 **AND THE SIXTH GUARD WAS DECORATION ON ITS FIRST RUN.** The leaked-timer test
counted `process._getActiveHandles()`, which does not include timers — deleting
the `clearTimeout` left it **green**. Rewritten against
`process.getActiveResourcesInfo()`, which does; the same mutation is now red.
**A guard that watches the wrong list watches nothing.**

SPEC IMPACT: None. No product behaviour changes while the database is healthy.
