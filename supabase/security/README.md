# The exposure surface freeze

`exposure-surface.baseline.txt` is a written-down list of everything the public
internet can reach in this database. A test regenerates that list on every pull
request and compares it to the committed file. If the list grows, CI fails.

You are probably reading this because that test failed. Skip to
**[I hit this in CI](#i-hit-this-in-ci)**.

---

## Why this exists

Supabase publishes every table in the `public` schema as a REST endpoint, and
the `anon` key is in the page source **by design** — that is how the product is
supposed to work. The consequence is easy to forget: **the database is on the
internet, and the UI is not a security boundary.** Anything the browser's key is
allowed to do, a stranger with `curl` can do, without ever loading your page.

On 2026-07-26 an audit found seven separate production vulnerabilities in a
single day. Different features, different authors, different months — and every
single one was the same mistake:

| # | What shipped | What it meant |
|---|---|---|
| 1 | An upload endpoint signed any storage key it was handed | Any user could fetch another vendor's government ID |
| 2 | A wedding guest could `SELECT` the couple's whole `events` row | The QR master token and a Google OAuth token came with it |
| 3 | Same row, still live at the time: birth dates and budget | RLS is **row**-level — it can never hide a column |
| 4 | Head-count came from the submitted form | A ₱2,800 order priced itself at ₱0 |
| 5 | Order total came from the client | Pay ₱1 for anything |
| 6 | A host-writable field fed a live price lookup | ₱1,499 became ₱99 |
| 7 | The "is this video safe" verdict was `PATCH`-able | Publish unscreened video |

Nothing caught any of them, and the reason is not that people were careless. It
is that **nobody knew what the surface was.** There was no list. A new table
ships with Supabase's stock `GRANT ALL ... TO anon, authenticated`; a policy
gets relaxed to `USING (true)` at 1am to unblock a demo and never gets tightened;
a new column lands on a table strangers can already read. No test, lint, or
review step was watching any of it.

This file is the list. It is not a fix for any one bug — it is the thing that
makes the *class* of bug visible in a pull request diff, where a human can see it.

---

## What is in the file

One fact per line, tab-separated, fully sorted:

```
kind <TAB> key <TAB> value
```

| kind | one line per | catches |
|---|---|---|
| `schema` | schema `anon`/`authenticated` can USE | a whole new schema going public |
| `rls` | table with **RLS switched off** | a new table that forgot RLS, or RLS disabled |
| `rlsforce` | table with FORCE ROW LEVEL SECURITY (a *protection*) | that protection being removed |
| `tpriv` | table × role × privilege | the stock `GRANT ALL` landing on a sensitive new table |
| `col` | column, with each role's `S`/`I`/`U` | a secret column on a table strangers already read |
| `policy` | policy in `public` **or `storage`**, including its full `USING` / `WITH CHECK` text | a predicate quietly relaxed to `true` |
| `view` | view or matview readable by a browser | a view that stops honouring the caller's RLS |
| `func` | function a browser may `EXECUTE` | a new anon-callable `SECURITY DEFINER` RPC |

Two shapes deserve their own note, because they are the ones that keep biting:

- **`col` exists because RLS cannot hide a column.** A perfect row policy on
  `vendor_profiles` still hands over `tin_number` and `registered_address` to
  everyone the policy admits. The only fixes are a column-level `REVOKE`, a
  split table, or a view — and none of that is visible unless the columns are
  written down.
- **`policy` stores the predicate verbatim, not a hash.** Relaxing
  `event_id IN current_event_ids()` to `true` changes no grant, no command and
  no role. The predicate text is the only place it shows up, so you should be
  able to *read* the loosening in the diff.

Sparse by design: a table that has RLS on, or a column no low-trust role can
touch, emits nothing. The quiet cases stay quiet so the loud ones are visible.

---

## The rule: widening fails, narrowing does not

**Widening fails the build.** A new grant, a newly exposed column, RLS switched
off, a new anon-callable `SECURITY DEFINER` function, a view that stops honouring
RLS, a new permissive policy, a dropped restrictive one.

**Narrowing passes, silently and with no ceremony.** Revoke whatever you like;
the test prints a note and stays green. Refresh the baseline whenever suits you.

That asymmetry is deliberate and it is the most important design decision here.
A guard that makes *tightening* red is a guard that gets deleted within a month —
and then it protects nothing at all. Making the safe direction free is what keeps
the dangerous direction expensive.

**One honest exception.** If a policy predicate changes from one non-trivial
expression to another, no differ can prove the new one is tighter — deciding
whether `a AND b` implies `a OR c` is not a thing a diff does. Those are reported
as widenings so a person reads them. The two cases that *can* be decided are:
a predicate becoming `true` is always a widening, and a predicate that stops
being `true` is always a narrowing.

---

## I hit this in CI

The failure names the object and explains the risk. You have exactly two options.

### 1. Narrow it

If the exposure was not intentional — and it usually is not, because the stock
Supabase grant is `ALL` — take it back:

```sql
-- a whole table the browser should never touch
REVOKE ALL ON TABLE public.new_secrets FROM anon, authenticated;

-- or just the dangerous columns, keeping the rest readable
REVOKE SELECT (api_token, tin_number) ON public.some_table FROM anon, authenticated;

-- an RPC that only the server should call
REVOKE ALL ON FUNCTION public.do_money_thing(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.do_money_thing(uuid) TO service_role;
```

> ⚠️ **`REVOKE ... FROM PUBLIC` alone does not lock a function down on Supabase.**
> Supabase's default privileges grant `anon` and `authenticated` their own
> explicit `EXECUTE` entries when the function is created, and those are not part
> of `PUBLIC`. Verified against prod on 2026-07-26: five functions written with
> the `FROM PUBLIC` form were still anon-callable, including a token-minting RPC
> and an admin review-override. **Always name the roles:**
> `REVOKE ... FROM PUBLIC, anon, authenticated;`

Re-run. Narrowing never needs a baseline update.

### 2. Accept it deliberately

If the exposure really is intended, regenerate the baseline and commit it **in
the same pull request as the migration that caused it**:

```bash
pnpm --filter @setnayan/web exposure:baseline
```

Then look at your own diff before you push. Every added line is something a
stranger with the anon key can now do. If any of them makes you hesitate, that
hesitation is the entire return on this file.

---

## Regenerating

```bash
pnpm --filter @setnayan/web exposure:baseline
```

Replays every migration into an in-process PGlite (WASM Postgres) and rewrites
the baseline. No Docker, no local Supabase, no network, no credentials — and it
never touches production. Takes about a minute.

**Legitimate reasons to regenerate:** you added a table, column, policy, view or
RPC and the new exposure is intended; you narrowed something and want the file to
match; a migration changed a policy predicate on purpose.

**Not legitimate:** the test is failing and you want it to stop. Regenerating
without reading the diff converts a security control into a rubber stamp — which
is worse than deleting it, because it still looks like protection.

---

## How it runs

| Where | What | Needs a DB? |
|---|---|---|
| `apps/web/tests/db/exposure-freeze.db.test.ts` | the real comparison | in-process PGlite — no external DB |
| `scripts/lint-exposure-baseline.mjs` | file is canonical, floors met, **guard is wired** | no |

Both run on every pull request in `.github/workflows/ci.yml`. The DB test rides
the existing `test:db:ci` glob (`tests/db/*.db.test.ts`), so it is gated the same
way every other data-layer guard is.

### Why it cannot pass vacuously

This repo has shipped vacuous DB tests twice — a connection that *owns* a table
skips RLS entirely, so an RLS assertion run as the owner passes no matter what
the policy says. Four defences, each an assertion rather than a comment:

1. **Floors.** The collected surface must exceed a minimum per kind. A catalog
   query that silently returns nothing can no longer look like a clean surface.
2. **Baseline integrity.** The file must exist, parse, be canonically sorted,
   have unique keys, and match the fact count written in its own header — so a
   truncated or emptied baseline fails instead of agreeing with everything.
3. **Behavioural probe.** The introspection is cross-checked by actually
   becoming `authenticated` via `SET ROLE` and confirming that a privilege the
   surface says is *absent* is really refused, and one it says is *present* is
   really allowed. The probe first asserts the connected role is
   `authenticated`, is **not** the table owner, and has no `BYPASSRLS`.
4. **Neutralisation.** The differ is fed seventeen synthetic widenings and nine
   narrowings and must classify every one correctly. Remove the guard logic and
   those tests fail.

There is no skip path: PGlite is in-process, so "no database available" is not a
state this test can reach, and no failure is swallowed by a `try`/`catch`.

---

## Scope, honestly

The baseline is generated from **the migrations**, replayed into PGlite. It is
therefore a statement about what this repository declares — not a live read of
production. That is what makes it reproducible in CI on any machine with no
credentials, and it is the right trade, but it has two consequences worth knowing:

- **Objects that exist only in prod are invisible to it.** Reconciled against
  prod on 2026-07-26: two tables (`event_service_deliveries`,
  `pioneer_incentive_logs`) and five anon-callable functions
  (`confirm_guest_delivery`, `list_vendor_delivery_bookings`,
  `undo_guest_delivery`, `get_vendor_mood_board`, `rls_auto_enable`) exist in
  production but are created by **no migration**. They were applied out of band.
  Back-filling migrations for them would bring them under this guard.
- **Everything else matched.** Views matched prod byte-for-byte, including
  `security_invoker` state. Every other difference was fully accounted for by
  those out-of-band objects. See the pull request that introduced this file for
  the full reconciliation table.

The freeze also does not read *policy semantics* — it records that a predicate
changed, not whether the new one is safe. It is a tripwire that forces review,
not a proof of correctness.

**Schema scope.** Grants, RLS and columns are tracked for `public` only, because
that is the product. Policies additionally cover `storage`, since our own
migrations write RLS on `storage.objects` and a bucket policy relaxed to
`USING (true)` is the same bug as a table policy relaxed to `USING (true)`.
Storage's own table/column grants are deliberately excluded — `storage.objects`
is Supabase-platform-managed and the replay harness stubs a simplified version
of it, so privileges reported for it would be fiction. `realtime` and `cron`
policies are platform-managed and out of scope for the same reason.
