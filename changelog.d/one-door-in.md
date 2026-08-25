## 2026-08-26 · fix(papic): a couple could add photos to their own gallery without spending a credit

`papic_photos_couple_full` was `FOR ALL` with a `WITH CHECK` that asked one thing — *"are you a couple on this event?"* — and never whether the photo was paid for. Combined with the column-wise INSERT grant `authenticated` holds on 39 of that table's columns, **a signed-in couple could POST a row straight to PostgREST: no order, no payment, no admin approval, no grant, no metering.**

Verified against production, not inferred: the policy is `ALL` with a membership-only check, and `authenticated` holds INSERT on 39 columns. Postgres checks the grant first, and the grant is there.

**🔑 THE MONEY SIDE WAS NEVER THE PROBLEM AND IS NOT TOUCHED.** Credits arrive exactly two ways, both correct — the automatic 50-point `free_grant`, and a `topup_order` grant written by SKU activation *after* an admin has compared the payment and approved it (and that grant is idempotent per order, so a double approval cannot double-pay). `lib/papic-free-grant.ts` states plainly that the client has no INSERT policy on `papic_event_point_grants` *"and it must not"*. **Nobody can mint credits.** The hole was that a PHOTO could arrive without one ever being **spent** — the balance never moves, because the photo went around it.

**⛔ AND THE OBVIOUS FIX WOULD HAVE BROKEN EVERY CAMERA.** A blanket `REVOKE INSERT … FROM authenticated` was the tempting move — but **the claimer holding a camera IS an `authenticated` user**, so that revoke takes capture down product-wide. Policies are OR-ed, so narrowing the couple's policy is what leaves exactly one insert door open: the camera's.

**What shipped:** the couple's `FOR ALL` becomes SELECT / UPDATE / DELETE with the identical predicate. A couple keeps every power any shipped code actually uses — read their gallery, hide a photo, delete one — and loses only INSERT.

✅ **Verified safe before writing it.** Every insert into `papic_photos` in the entire app is in `app/papic/actions.ts` (`recordSeatCapture`), three call sites, all under the **claimer's** session, satisfied by `papic_photos_claimer_own` — untouched.

## ⚠ What this does NOT close, stated so nobody reads it as finished

Whoever holds a **claimed camera** can still insert a row for that camera, because `papic_photos_claimer_own` must permit exactly that for capture to work. **Today no couple holds a camera, so this closes the whole reachable gap.** The moment uploading ships, the couple *will* hold an "Uploads" camera and that gap reopens.

🔑 **The real fix then is ATOMICITY, not permission** — a `SECURITY DEFINER` function that reserves the credit and inserts the row in **one transaction**, with direct INSERT revoked. That also **deletes the unwind problem outright**: there is nothing to give back if the reserve and the insert cannot come apart. It belongs in the upload PR, where the camera that reopens the gap is created — not here, where it would rewrite a live capture path for no present gain.

**🛡 `tests/db/one-door-into-papic-photos.db.test.ts`** — 5 rules against the replayed schema: the table exists at all (anti-vacuum) · **no couple policy permits `ALL` or `INSERT`** · the couple keeps SELECT, UPDATE and DELETE · **the camera's policy still permits INSERT** (one door, not zero) · and the table comment still records why, since a comment a reader queries is the only warning at the point of the mistake.

**SPEC IMPACT:** None — it enforces the credit model already described in `DECISION_LOG.md`.
