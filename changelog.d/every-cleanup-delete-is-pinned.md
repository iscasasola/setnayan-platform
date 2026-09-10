## 2026-09-10 · fix(security): every cleanup job now deletes only the row's OWN file — one choke point, and the browser can no longer choose the key

**The class.** "The row is yours, the field is not" + a service-role delete with no
pin. A non-admin writes `r2://<bucket>/<key>` into a column of a row they own; a
cleanup job running with the ADMIN client later deletes whatever that string
names. Permanent (the buckets are not versioned), cross-tenant, cross-bucket.
PR #5401 closed one instance; a post-merge review that EXECUTED every claim found
three more, and this change closes the class rather than the three:

1. **Papic full-resolution sweep** (ON by default, no admin step). It resolved a
   capture's key against all five buckets — a couple PATCHing their own photo's
   `r2_object_key`, or a supplier inserting a capture, could make it delete a
   supplier's government ID or another couple's photos once the event aged out.
   A camera's claimer could also hand `recordSeatCapture` any key, and the row
   went in through the service role.
2. **Verification-application sweep.** #5401 left it unpinned believing SEC-1
   pinned refs at write time — that pin lived only in the server action. A vendor
   could PATCH its own draft's `doc_uploads`, and after any approve OR reject the
   sweep deleted another shop's seven-year permit.
3. **#5401's own guard was decoration** — `const inScope = [...present]` stayed
   green. Replaced by behavioural tests.

Also found on the same walk and pinned the same way: "Remove for good" (a couple
could aim it at a stranger's file through their own event/photo columns),
face-data retention + both face-withdrawal actions (`couple_writes_face_enrollment`
is FOR ALL), story expiry, erasure (every column it reads is one its subject can
write), the Save-the-Date seal retirement, and BOTH mood-board deletes (the
stylist's own, and the admin's — which read a stylist-writable `storage_path`
verbatim).

**What ships.**
- `lib/cleanup-delete-scope.ts` — the one pure rule: a cleanup delete may name
  only the row's own bucket AND tenant folder (its event, guest,
  supplier-and-event, vendor, thread, samahan, user). Scopes and delete targets
  can only be minted there (identity-checked at runtime, so a hand-built or
  spread-widened scope is refused). Legacy public URLs are never followed.
- `lib/cleanup-delete.ts` — the only code that turns a proven target into an R2
  delete (it binds `bindCleanupExecutor` to `r2Delete`; the refusal of any target
  the planner did not mint is unit-tested with a fake deleter). Every sweep, erasure and retention job goes through it; refusals are
  counted, logged at error level, and the refused pointer is kept.
- Migration `20271219262486_every_cleanup_delete_is_pinned` — the write side:
  REVOKE UPDATE on the five service-written `papic_photos` keys; RESTRICTIVE
  policies holding `papic_photos.clip_web_r2_key`, every `vendor_papic_captures`
  key, and every `r2://` string in `vendor_verification_applications.doc_uploads`
  to the row's own folder. `recordSeatCapture` / `persistSeatClipWebCopy` refuse a
  key outside the seat's own folder before the service role writes it.
- Guards: `cleanup-delete-scope.test.ts` (the rule, by calling it),
  `every-cleanup-delete-is-pinned.test.ts` (every raw-delete caller DERIVED from
  the tree; exact exemption bill, both directions; no sweep-shaped file may be
  exempt), planner/behaviour suites for Papic, vendor identity and erasure, and
  `every-cleanup-delete-is-pinned.db.test.ts` (the write side as a real
  `authenticated` session, each refusal beside an accepted positive control).

**Measured in production before shipping (read-only SELECTs, 2026-09-10):**
every stored ref these jobs read already sits inside its new scope — papic_photos
14/14 (original and web copy), the one application, the one shop logo, the one
profile photo, the one event site-media ref; guest captures, supplier captures,
face enrollments, samahan stories and chat attachments are all empty. So no
legitimate file becomes undeletable. The 150 seeded mood-board rows hold URLs /
seed paths that the old `replace()` never removed either.

**Not done, named:** the `events` site-media columns and
`guest_face_enrollments.asset_url` stay session-writable (their deletes are
pinned); the Camera Bridge dark launch still writes untenanted
`papic/seat-<index>/` keys, which are now never deleted by a sweep. The production
`BEGIN…ROLLBACK` rehearsal of the migration could not be run from the session.

SPEC IMPACT: None — security hardening of existing retention/erasure behaviour;
no product rule, price or retention period changed. (Refused objects are kept,
which can only ever retain a file longer, never delete one sooner.)
