## 2026-08-26 · fix(security): a Papic photo cannot be minted around the meter

🚨 **`recordSeatCapture` refuses a capture eight ways before it writes anything — and all eight were advisory.** The burst limiter, the 10-second clip cap, the capture window, the paid-order gate, the "this celebration is put away" gate, the RA 10173 geolocation control, and the atomic credit reservation its own docblock calls *"the AUTHORITATIVE, race-safe gate"*.

The row went in through **the claimer's own session**, and `authenticated` held INSERT on `papic_photos`. So the same person could skip the function entirely and POST to `/rest/v1/papic_photos` with the public anon key: **no credits spent**, no length checked, outside the window, on an unpaid camera, on a put-away celebration, carrying geolocation on an event that had switched geolocation off.

🔑 **AND THE GRANT DID NOT SHOW UP WHERE ANYBODY WOULD LOOK FOR IT.** `has_table_privilege('authenticated', 'papic_photos', 'INSERT')` answers **FALSE** and `role_table_grants` lists nothing — the privilege was held at **COLUMN** level, on all **39** grantable columns. A table-level audit reads the table as closed while it is open. This project has already paid for that blind spot once: the samahan grant sweep reported 25 tables and measured **9** only after it was taught to count column grants.

🔑 **THE APP LAYER IS NEVER THE CONTROL.** `lib/supabase/client.ts` ships a browser client, the anon key is public by construction, PostgREST serves every `public` table. *"Our server action always meters correctly"* is not a defence — it is a description of the path we hope people take.

⚖ **WHO COULD DO IT, AND WHY IT GOT WORSE THIS WEEK.** Until 2026-08-26 a claimer was a friend handed a camera. Then the Uploads camera shipped and **the couple claims a seat of their own** — so every host on the platform acquired the ability to mint their own credits. The feature is right; it walked past an open door nobody had noticed, which is the usual way these are found.

⚠ **Nothing was forged.** Prod holds 14 `papic_photos` rows and every one came through the metered path. This closes a door; it does not clean up after anyone.

## What changes

**The grant** — INSERT revoked from `authenticated` and `anon`, at **TABLE** level, because that is what drops the column grants. Revoking column by column would leave any column added later granted, and the next migration to add one would silently re-open this.

**The policy** — `papic_photos_claimer_own` was PERMISSIVE `FOR ALL`, so it also declared an INSERT arm. With the grant gone that arm is unreachable, but a policy that still **says** insert is admitted is how the next reader concludes the door is open and writes code through it. It becomes three policies — SELECT, UPDATE, DELETE — carrying **the same predicates**, mirroring what `20271168890783` did to the couple's `FOR ALL` policy a day earlier.

⚠ **The predicates are copied, not improved.** The old `USING` clause did not ask whether the seat was revoked (only `WITH CHECK` did), so a revoked claimer can still read and delete what they shot. That may or may not be right — it is not this migration's question, and quietly answering it here would hide a behaviour change inside a security fix.

**The write** — `recordSeatCapture` writes its row with the service role. Every gate now runs before the only path that exists. ⚠ An unavailable admin client is a **refusal** here, not a fail-open: the reads above it fail open on purpose (a config error must never stop a wedding being photographed by wrongly answering a question), but this is not a question — with the grant gone there is no second path to fall back to.

**A false sentence corrected in passing.** The geo block claimed *"a hostile direct caller that transmits geo to a control-off event has it dropped here."* It was aspirational. It is true now, and says which it is.

## ⛔ What this does NOT do

**The reservation and the insert are still two steps, not one transaction.** Credits are booked, then the row is written, and an insert failure unwinds the booking in application code. A process that dies in the gap **leaks the credits it reserved** — the couple charged for a photo that does not exist. That errs against us rather than against the meter, which is the right direction to fail while it stands, but it is debt. The repair is a `SECURITY DEFINER` record function that reserves and inserts under one transaction, which deletes the unwind outright.

🔑 **And that repair is not a new idea — it already ships, on the other half of this same feature.** `papic_record_guest_capture` is `SECURITY DEFINER` and does the whole thing in one function: resolve the guest, check the event owns the service, check the uploader is not blocked, check terms were accepted, check the unlock pass, reserve from the pool, insert. **That is why `anon` needs no INSERT grant and has never had one.** The seat path is the odd one out, not the normal one — whoever picks this up copies the guest function's shape rather than designing anything.

⚠ **It writes a different table** — `papic_guest_captures`, and nothing copies between them. So it is a **model to follow, not a second writer of these rows**; the table comment was corrected before merge because the first draft implied otherwise. Measured: all 14 `papic_photos` rows carry a seat and there are none without one. **Do not read "service role" as "atomic"** — the guard says so too, so nobody quotes this file as proof of an invariant it does not test.

## 🛡 Guards + mutations

`tests/db/no-photo-without-a-credit.db.test.ts` — 4 rules: no table-level INSERT for either browser role · **the same question again per column**, over a census of the columns that exist rather than a hand-typed list, with an anti-vacuity floor · no policy declares an INSERT arm · the claimer keeps the three verbs the camera actually uses.

`app/papic/the-meter-is-the-only-door.test.ts` — 3 rules, comments stripped before matching: no `papic_photos` insert on the session client (with a floor of 3 call sites, so a refactor cannot make the rule vacuous) · the writer is the service role **and an unavailable one refuses** · the reserve still runs before the write.

| sabotage | count | result |
|---|---|---|
| session client back on the insert | 1 → 0 | 🔴 |
| the reserve call orphaned | 1 → 0 | 🔴 |
| unavailable admin client falls through silently | 4 → 3 | 🔴 |
| the `authenticated` revoke removed | 1 → 0 | 🔴 |
| the claimer policy back to `FOR ALL` | 1 → 0 | 🔴 |
| the claimer's UPDATE policy never created | 1 → 0 | 🔴 |

🪤 **The reserve mutation reported GREEN on its first run and meant nothing.** The rule matched the bare name `papic_reserve_capture_split`, and the sabotaged `…_splitX` still **contains** it — the same prefix trap as `f.event_dateX`. Re-anchored on the quoted literal; the count above is the re-run.

🪤 **And the first attempt at the UPDATE mutation turned a `FOR UPDATE` policy into `FOR DELETE … WITH CHECK`, which is invalid SQL** — the whole replay failed and all four rules went red at once. A crash is not a signal. Re-run as a valid deletion of the policy, which fails **rule 4 alone**.

## 🔬 Dry-run against production, rolled back

Run inside `BEGIN … ROLLBACK` on the live database before committing, because the PGlite replay runs as **superuser** and cannot answer a privilege question honestly. End state measured **on the real objects**: `0` INSERT columns left for either browser role · **39 UPDATE columns kept**, so the camera can still stamp a clip's web copy · `0` policies declaring INSERT · 7 policies total. Re-queried afterwards to confirm the rollback took: prod is unchanged (39 INSERT columns, 5 policies, the `FOR ALL` still standing) until this merges.

## 🪤 Three guards had to change, and one of them was mine from yesterday

Closing this door broke **8 db tests** — every one of them a guard about this table doing its job.

**`one-door-into-papic-photos` carried a paragraph of my own reasoning that was wrong**, and it is kept as a correction rather than deleted. It read: *"a blanket revoke would have been wrong — the claimer holding a camera IS an `authenticated` user; revoking the grant breaks every camera."* **The second half does not follow from the first.** A camera does not need the *browser* to hold the grant; it needs the capture recorded, and the record path can write with the service role after its gates run. The guest half of this same feature had already been built that way for months. So narrowing the couple's policy was **correct and insufficient** — it closed the couple's door and left the claimer's standing, and the Uploads camera then made every host a claimer, walking the couple straight back through it.

**`capture-moderation-not-self-screenable` would have passed for the wrong reason.** Every behavioural rule there inserts as a paparazzo to prove the uploader cannot forge their own NSFW verdict; with the outer lock in place they would all go green on *"permission denied"* — proving the outer lock and saying nothing about the inner one. **A second lock you cannot test is not a second lock**, and the inner one is what still stands if a future feature ever needs a browser write. The file now restores the base grant **and the claimer's INSERT policy** — both halves, since a refusal by RLS instead of by the ACL is still the wrong reason — for exactly the columns an ordinary capture names, never `moderation_state`, and a new rule 0 asserts the outer lock is really there before the scaffolding lifts it.

🪤 **And rule 0 was decoration on its first run, for the exact reason this whole change exists.** It asked `has_table_privilege(…,'INSERT')` and read FALSE as closed — the function that answers FALSE while 39 column grants are standing. Removing the revoke measured **1 → 0** and the rule stayed **green**. It now censuses every column and every policy: both sabotages red.

## Exposure baseline

Regenerated, and the diff read before committing: **39 columns lose `I` (SIU → SU)** and one `cmd=ALL` policy becomes three narrower named ones. **Nothing else in the 6,213-fact baseline moved** — no added line anywhere is a widening.

**SPEC IMPACT:** None — an enforcement fix under the Papic credit model already locked in `Pricing.md` and `DECISION_LOG.md`.
