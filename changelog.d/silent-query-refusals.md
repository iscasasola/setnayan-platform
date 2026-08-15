## 2026-08-15 · fix(queries): four places the database said NO and the app heard "nothing to show"

Found by reading the production error log after the vendor-dashboard outage (#4448). Four separate red entries, none of which had ever been diagnosed, all the same disease: **a REJECTED query is not a THROWN error, so the only symptom is an absence.** The repo has now paid for this shape a phantom column, a phantom enum value, a phantom RPC argument, a blocked iframe, an unresolved `r2://` and a stale CHECK constraint. These are numbers seven through ten.

---

### 1 · 🔴 The public "saved by N couples" badge has NEVER rendered — on any shop page, ever

`count_saves_for_vendor` is `SECURITY DEFINER` with an owner-or-admin gate in its body. The public shop page calls it through the **service-role** client, because a stranger reading a shop page has no session at all.

🔑 **Service role bypasses RLS. It does not bypass a hand-written `RAISE EXCEPTION` inside a SECURITY DEFINER function.** The call site's comment asserted otherwise — *"the RPC's EXECUTE grant is authenticated-only, but a public render needs it"* — which is **true about the GRANT and silent about the GATE**. Getting past the door is not getting past the bouncer. Every call raised `P0001 forbidden`; the fail-soft turned that into `0`; `FAVORITES_MIN_DISPLAY` is 3, so the badge never drew.

**Proved against production before writing a line**, by running the real function as the real role:

```
SET LOCAL ROLE service_role;
SELECT public.count_saves_for_vendor(<a real vendor id>);
→ REFUSED  SQLSTATE=P0001  MESSAGE=forbidden
```

Migration `20271141980127` admits the trusted server. Owner and admin unchanged; **`anon` still refused**. It grants the server nothing it lacked — service role already bypasses RLS on both underlying tables and could count them raw; the refusal only forced our own server to either duplicate the definition of the number somewhere else or show nothing. Only an integer has ever left that function, and only an integer leaves it now.

#### 🚨 And the FIRST cut of that migration opened the gate to everyone, `anon` included

It used the repo's usual idiom, `current_user NOT IN ('authenticated','anon')`. **Inside a `SECURITY DEFINER` body `current_user` is the function's OWNER, not the caller** — so the test is always true. Measured in prod, in a SECURITY DEFINER function, under each role:

| `SET LOCAL ROLE` | `current_user` | `session_user` | `current_setting('role')` |
|---|---|---|---|
| service_role | postgres | postgres | **service_role** |
| authenticated | postgres | postgres | **authenticated** |
| anon | postgres | postgres | **anon** |

Caught by **dry-running the function against prod inside a rolled-back transaction** before committing. Reading it did not catch it and no unit test could have — the same lesson as the 2026-08-12 moderation revoke that would have shipped silent universal auto-approval. Corrected to `current_setting('role', true) = 'service_role'`, then re-run: **service_role ALLOWED · authenticated REFUSED · anon REFUSED.**

✅ **The six shipped functions that DO use that idiom were checked against prod by `prosecdef`, not by reading, and every one is SECURITY INVOKER** — where `current_user` really is the caller. The idiom is right for them and wrong here. 🔑 **Copy an idiom with its precondition, or don't copy it.**

Written as an equality on the one role admitted, not a `NOT IN` deny-list: a deny-list is a bill you keep paying, and a new Postgres role would silently join the allowed side.

---

### 2 · 🚨 The six-hourly health probe could not see the thing it exists to watch

`songDeskNarrowingLockout` asks the real gate twice — once with the event-tile narrowing, once with it suppressed — and reports the difference. But `resolveSongDeskAccess` fetched the narrowing itself via `get_vendor_event_brief`, whose gate refuses anyone who is not a booked vendor. The probe runs as the trusted server, so that call answered `42501 not_a_vendor` **every six hours since 2026-07-31**, and the helper reads only `data`, so the refusal arrived as `null` — which the gate's contract defines as *"decline to narrow"*.

**Both calls were therefore the same call. The difference was always zero.** The probe written after the outage that made all three specialization desks unreachable would have reported all-clear straight through a repeat of it.

🔑 Its own file says *"a check that is structurally incapable of failing is worse than no check: it occupies the slot where a real one would go."* That was true of this probe, in the file that says it, for its whole life.

**No gate was widened.** `fetchBookedPairs` already hands the probe `booked_categories` for every booking, and its sibling probe already maps them with the same function — so it passes what it holds instead of knocking on a door it can never open. `resolveSongDeskAccess` gained an opt-in `knownEventTiles`; every vendor-facing caller omits it and still fetches. `undefined` means "fetch", `null` still means "decline to narrow" — deliberately **not** collapsed with `??`, which would make an explicit null trigger the fetch the caller was avoiding.

---

### 3 · Six Real Stories pages asked the database for a fixture, twice per render

`loadEditorialData` short-circuits the curated sentinels and returns without touching the DB. `EditorialContent` then ran **two more** queries with the same id — the masthead monogram on `events`, and the paid-perk probe on `orders`. A sentinel is not a UUID, so Postgres rejected both with `22P02` on every render of all six samples since 2026-07-31.

⚠ **Correcting something I told the owner earlier in the session: the page was NOT half-empty.** Measured on the live site before changing anything — `M & J`, `#6B4E3D`, the Commemorative Edition masthead and the watermark all render. Both call sites fail soft to exactly the right answer for a sample, which is why it survived a fortnight. The cost was two doomed round trips per render and two red 400s per page in the log a **real** fault has to be noticed in.

The predicate moved to `editorial/sample-ids.ts` — no `server-only` import, so a unit test can reach it. `data.ts` re-exports it and now types its fixture table as `Record<SampleEditorialId, …>`, so **TypeScript refuses a missing member or an extra key**: the correspondence between the id list and the fixtures is a mechanism, not a comment.

🪤 The loader's own `SAMPLE_EDITORIALS[eventId]` short-circuit **walked the prototype** — an event whose id was `'constructor'` or `'toString'` would have been served something that is not their wedding. Never bit in prod; replaced with the same list-membership predicate. The type checker is what surfaced it.

---

### 4 · `/join/<anything>` handed a URL segment straight to a `uuid` column

`22P02` again, mintable by anyone who can type a URL. The visitor's outcome was already right ("this link isn't valid"), so nothing looked wrong — it just wrote a red 400 into the log on demand. New `lib/is-uuid.ts` is deliberately **lenient** (any 8-4-4-4-12 hex), matching what Postgres accepts rather than what v4 looks like: a stricter test would refuse an id the database is happy with, trading a logged 400 for a page that wrongly says "not found".

---

### Guards — and the three of my own that were decoration

`lib/silent-query-refusals.test.ts` (10) + `lib/is-uuid.test.ts` (4). Every one mutation-tested with the **occurrence count printed before → after**; 12 sabotages, all landed, all caught.

🪤 **Three cuts were decoration and the mutation run said so, not my reading of them:**

1. `/if \(!isSample\) \{[\s\S]*?eventCoupleWebsiteProActive\(/` — `[\s\S]*?` is lazy but **unbounded**, so with two guarded blocks the match started at the first `if (!isSample)` and ran past the end of that block down to the second one's call. Un-gating the second block left it **green**. Now it walks back from the call to its nearest enclosing `if (`, which cannot span blocks.
2. The false-premise ban was windowed to ±2000 chars around the RPC's first mention — which is the surviving comment's opening line, so the banned sentence fell **outside** the window. Rewritten to assert the **correction is present** rather than the error absent, because the banned text lives only in comments and stripping them would leave nothing to search.
3. The `current_user` ban fired on the migration's own warning about `current_user`.

🔑 **Every guard here that searched raw text matched its own explanation first — three times in one file.** Strip comments, then search. And a lazy quantifier is not a scope.

---

### Verification

- Full unit suite **8224 pass / 4 fail**; those 4 (`papic-*-metering`, `vendor-deep-search*`) fail **identically on the untouched tree** — missing `@electric-sql/pglite` / `@anthropic-ai/sdk` locally.
- `tsc --noEmit` **byte-identical** to the untouched baseline (262 local `Cannot find module` errors, **zero** touching a changed file). An intermediate run had 264 — the two extra were the prototype-lookup finding above, fixed.
- 12 lint scripts + `migration:check` (1126 migrations) all pass.
- The migration dry-run against prod, rolled back, is quoted in §1.

⚠ **Not verifiable from a session:** the badge appearing on a live shop page needs an approved, visible shop with ≥3 savers; prod has 2 vendors, both hidden, and 0 savers. The gate is proved by the rolled-back prod run in both directions, not by a screenshot.

SPEC IMPACT: None — no SKU, price or product rule changes. Favourites were already ruled PUBLIC (owner, 2026-07-02); this makes the shipped code behave the way that ruling said.
