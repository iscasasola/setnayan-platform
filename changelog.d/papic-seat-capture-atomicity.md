## 2026-08-26 · fix(papic): a seat capture's credit and its photograph commit together, or neither — plus the uploads switch on the server and a capturer on guest captures

### 1 · ATOMICITY — the one thing #4879 named as debt and did not pay

`recordSeatCapture` reserved the credits (`papic_reserve_capture_split`) and THEN wrote the `papic_photos` row. **Two round trips.** The application unwind (`releaseCaptureCredits`) covered the ordinary failure — an insert that came back with an error while the same process was still alive to put the credits back. It could not cover a death, a timeout, a container eviction or a deploy landing between the two calls, each of which left the couple **charged for a photograph that does not exist**. Migration `20271169487222` says so in its own header and names the repair.

**New: `papic_record_seat_capture` (migration `20271170528490`)** — `SECURITY DEFINER`, one function, one transaction: re-check the seat, spend the split, insert the row. `recordSeatCapture` now makes ONE call and the unwind on that path is **deleted, not kept as a belt** — there is no longer a state between the spend and the row for anything to clean up, and a release there would refund a spend that either committed with its row or never happened.

🔑 **NOT A NEW SHAPE — `papic_record_guest_capture` has done this for the guest half since it shipped**, which is why `anon` has never needed an INSERT grant on `papic_guest_captures`. It was followed, **not reused**: it writes a different table and nothing copies between them.

**What moved in, and what deliberately did not.** IN: seat authorization, the split reserve, the row. OUT and staying out, each with its reason written into the migration: the Upstash **burst limiter** (cannot move into Postgres, and fails open by design so a limiter outage never stops a wedding being photographed), the **10-second clip cap** (a refusal about the file, decided before anything is presigned), the **capture window**, the **paid-order gate**, the **put-away gate** and the **RA 10173 geo control** (whose decision is passed in as columns, keeping `buildPapicGeoFields` the single place that rule is expressed). 🔑 **All of them refuse BEFORE a credit is touched**, so none can leave a spend without a photograph — which is the property this change is about, not "every check is in SQL".

⛔ **EXECUTE is `service_role` only, and that is load-bearing.** A browser role holding it would let a signed-in claimer name their own id and walk past all five gates above — the hole `20271169487222` closed, one door over. Revoked from **PUBLIC** (revoking the two roles by name leaves the PUBLIC grant standing and every future role arrives holding it), and the migration **refuses to apply** if the door did not close.

🪤 **`current_user` inside a `SECURITY DEFINER` function is the function's OWNER, never the caller** — second time this project has paid for that (`tg_stamp_capturer_person`'s first cut, where the gate could not be true so the pin never fired and the forgery test moved the photo while the trigger watched). And `auth.uid()` is empty under the service role. So identity arrives as `p_claimer_user_id`, resolved outside under the caller's own session exactly as `papic_record_guest_capture` receives `p_guest_id`, and is compared to the seat's claimer inside. A db rule asserts neither symbol appears in the body.

⚠ **Still not promised:** the bytes are in R2 before this runs and R2 is not in the transaction, so a refusal leaves an orphaned object. Orphaned bytes cost storage; a leaked credit costs a couple a photograph.

### 2 · THE UPLOADS SWITCH IS READ ON THE SERVER

`events.papic_uploads_open` governed the studio **screen** — the page hid the file picker. Its own guard named the condition for that stopping being true. 🚨 **Hiding a control is not closing a door:** a server action is a public endpoint, and the live photo wall mirrored to every guest's phone for a whole celebration while the only "off" the product offered closed the venue screens.

New `lib/papic-uploads-open.ts` + the pure `lib/papic-uploads-open-rule.ts`, asked on **both** server paths — the presign (`/api/upload`, as the orphan-byte leak guard) and the write (`recordSeatCapture`, as the door, **above the credit spend**).

🔑 **It keys on the SEAT, not on which screen called** — the Uploads camera's `seat_index` — so it is a fact in the database rather than a claim the client makes, and it already covers a surface nobody has written yet. ⛔ **Every other seat passes through untouched:** the switch must never stop a paparazzo photographing a wedding, which is what the OFF copy promises ("Only what your cameras capture"). ⚠ **Fails OPEN** on an absent, null or refused read, matching the column's `DEFAULT TRUE` — failing closed on a pre-migration database takes uploading away from every couple with no explanation and no error.

The `handles-have-gates` baseline line was **rewritten rather than deleted** (the reasoning changed rather than expired), and the tripwire that used to demand a server gate now defends what is genuinely still open: the OFF copy is a claim about the whole gallery, true only while every manual-upload path goes through that seat.

### 3 · A GUEST'S CAPTURE RECORDS WHO TOOK IT (migration `20271171474426`)

`papic_photos.captured_by_person_id` got a writer on 2026-08-26; `papic_guest_captures` had **no capturer column at all**, so "each person's own folder" covered the cameras and not the guests. Added, with `tg_stamp_guest_capturer_person` deriving it — and, like its twin, **pinning `guest_id` on UPDATE**, because an honest derivation from a forged input is still a lie. `anon` and `authenticated` hold UPDATE on that table at TABLE level, so the trigger is the only thing between a browser and somebody's name on a photograph they did not take. The migration **refuses to apply** without the trigger.

🔑 **THE HANDOFF SAID THIS NEEDED SOMETHING THAT DOES NOT EXIST. IT DOES.** `WHATS_NEXT_Papic_Meter_Ladder_And_Uploads_2026-08-26.md` § 2.2 says it *"needs a guest-to-person resolution that does not exist yet"*. Measured against the live database: `guests.person_id` exists and the `set_guest_person` trigger has resolved it from the guest's email since `20270514555975`. Nothing new had to be invented.

⚠ **AND IT IS EMPTY IN PRODUCTION, WHICH IS NOT THE SAME THING.** All 40 guest rows carry `person_id IS NULL` (none was added with an email matching a `people` row), and prod holds **0** `papic_guest_captures`. So the column starts empty — the resolver having nothing to resolve, not a gate with no handle. ⚠ **The backfill matches nothing on the way in and must never be cited as ongoing coverage** — a backfill is a point-in-time act; the trigger is the coverage.

### Traps paid for

- 🪤 **A GUARD WENT RED ON ITS OWN PROSE.** The `current_user` rule stripped `--` comments and scanned the whole tail of the migration — which includes a `COMMENT ON FUNCTION` **string literal** explaining that very trap. Prose describing a rule is not a violation of it. Both rules are now scoped to the dollar-quoted body.
- 🪤 **`npx tsc` ABORTED AT 134 WHILE PRINTING `errors=0`.** The repo's own script sets `--max-old-space-size=7168`; run it that way and print the exit code beside the error count.
- ⚠ **Removing a caller from a derived list needs a rule that says why it left.** `the-refund-can-be-seen.test.ts` lost the seat path; `the-meter-is-the-only-door.test.ts` rule 3 now fails if `releaseCaptureCredits` — or a bare `papic_reserve_capture_split` — reappears there, so a fix cannot be mistaken for a deletion.

### Tests

New `tests/db/seat-capture-is-atomic.db.test.ts` (8 rules — including one that adds a CHECK constraint, forces a real insert failure through the real function, and asserts BOTH meters are unmoved; an `EXCEPTION` block added around the insert would be an implicit subtransaction and commit the reserve while discarding the row, and every structural rule would still pass). New `tests/db/guest-capture-has-a-capturer.db.test.ts` (5 rules — the credited value is READ BACK from a real insert, not inferred from the trigger existing). New `lib/papic-uploads-open.test.ts` (5 rules). Rewritten: `app/papic/the-meter-is-the-only-door.test.ts` (5 rules, rule 1 inverted to "zero inserts here"), `lib/the-refund-can-be-seen.test.ts`, `the-uploads-switch-is-real.test.ts` rule 8 + the `handles-have-gates` baseline line.

SPEC IMPACT: None — no price, SKU, scope or owner lock moves. The three open owner decisions in the contract (§ 2.3 the supplier lane's DPO ruling, § 2.4 whether suppliers buy off the 16-rung ladder, § 2.5 the couple's website gallery) are untouched.
