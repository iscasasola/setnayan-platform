## 2026-08-09 · feat(vendor): the order of operations a new shop follows until it can run itself — and the two dead ends and one erased record found on the way

Owner, 2026-08-09: *"Create their order of operations until they can run it by themselves. also we want a controlled, what to do first until they are verified."*

**RULE 0 first: every step the owner described already ships.** Shop details, service cards, the 12-document verification stepper, both QR codes, the subscription gate — all built, all working. Nothing was rebuilt. What did not exist was the **order**. A new shop landed on the Overview and saw an empty decision feed, zeroed tiles, and the line *"You're all caught up — new leads land here the moment a couple unlocks you"* — which cannot happen, because an unverified shop is invisible to every couple. It told a vendor to wait for something that would never arrive.

### The rail

`lib/vendor-first-steps.ts` (pure, 11 unit tests) + `lib/vendor-first-steps.server.ts` (live state) + `app/vendor-dashboard/_components/first-steps.tsx`, mounted at the TOP of the vendor Overview above the focal tile. Five steps: finish your shop details → put up your first service → send in your documents → bring in the customers you already have → Setnayan approves you and you go live. Each carries its real live counter, so the rail can never congratulate a vendor for a step they have not done.

**It recommends an order; it does not lock doors.** Exactly one step is `now`; later steps are dimmed with no call-to-action but keep a live "Go there anyway" link. A vendor could always build a service card before finishing their profile, and that still works — turning the rail into locked doors would REMOVE shipped ability. The one genuine hard gate in the product is named as such and quoted from the server: `verificationSubmitMissing` refuses to submit documents while the business profile is unfinished, and the rail prints that refusal verbatim rather than a second hand-written copy of it.

**Waiting is not doing.** Once documents are submitted, nothing on that step is pressable for up to 5 working days. A `waiting` step is SKIPPED when picking `now`, which promotes *bring in the customers you already have* — free, and works before approval. That is the honest answer to "what do I do while I wait". When there is genuinely nothing left to do, the rail says nothing rather than manufacturing a task.

Renders nothing once the shop is verified, and short-circuits after one cheap read so a live shop pays almost nothing per render. Fail-soft throughout — a nudge must never be what takes the vendor's home page down. Every read degrades toward "step unfinished", the safe direction: nagging a vendor who is done is recoverable; telling them to stop working on the step blocking their own approval is not.

### Dead end 1 — a screen asked for a button that does not exist

`/vendor-dashboard/invite` gated its QR on `slug && is_published` and refused with *"Publish your business profile first"*. **There is no such button.** The only `name="is_published"` control in the entire app is on the ADMIN vendor edit page; the one vendor-side action that ever wrote the column (`saveVendorProfile`) has had no caller since the My Shop inline-edit rewrite; and approving a shop does not set it either — `/admin/verify` writes `public_visibility` + `verification_state` and never touches it. The owner's own fully-verified shop sits at `is_published = false` today and would have hit exactly this wall.

The twin of that QR on My Customers gates on `slug` ALONE and always has — same generator, same output, **one door open and its twin bolted**. `slug` is the honest requirement: the QR encodes the shop's public address, and a database trigger mints that address the moment a shop is named. Now aligned, and the copy on both names the real condition.

This also restores an owner rule: bringing in the customers you already have is free and works BEFORE approval. Gating it on an admin-only flag made it wait for approval.

### Dead end 2 — a gate the screen never mentioned

`create_vendor_subscription` raises `NOT_VERIFIED` for an unapproved shop — correct, owner-locked, and enforced in the database. But the plans page still showed a live Upgrade button to an unverified vendor, so the only way to learn the rule was to pick a plan and be refused. Now the card shows *"Get verified first"* pointing at the verification stepper. The refusal stays in the database; this only decides what the card shows, so a stale or spoofed prop still cannot buy a plan.

### The erased record — a Locked QR overwrote how the couple found the vendor

Owner, same session: *"we have a rule. to check the user first if they found each other first on the website or not."*

That answer lives in `event_vendors.source`, and it is the axis the free-vs-billable model turns on. `vendor_claim_locked_qr()` upserts the couple↔vendor row: on INSERT, stamping `'vendor_locked_qr'` is right — the vendor brought them. On UPDATE it stamped the same value over a row that **already existed**, which is exactly the case where the couple had already found the vendor on Setnayan and shortlisted them. One scan turned `host_marketplace_search` into `vendor_locked_qr`.

Measured against the live classifier `vendor_source_attribution()`: it buckets `host_marketplace_search` + `auto_cascade_from_finalize` as **setnayan**, `host_manual` + `admin` as **off_platform**, and everything else — including `vendor_locked_qr` — as **unattributed**. So a booking Setnayan genuinely sourced silently left the "Setnayan sourced" column on the vendor's own My Performance page.

Migration `20271121904105` replaces the assignment with `COALESCE(source, 'vendor_locked_qr')`: an existing row keeps its origin, a legacy row with no source is still stamped, and the column can never go NULL. The body is prod's own definition read out with `pg_get_functiondef`, with that one clause altered — the existing `locked-qr-date-precision.db.test.ts` still passes 11/11.

**⚠ Not a billing bug today, and it must not be reported as one.** The booking fee reads a THREAD's `inquiry_source` (`booking_fee_is_sourced_surface`), not this column, and `bookingFeeSendGate` has no live caller — production holds zero fee charges. The harm today is attribution. The harm later is that the fee is scoped to *sourced clients only*, and this is the column whose NAME answers that question, so it is the value a future wiring will reach for.

**No backfill:** production holds 0 locked-QR tokens, 0 claimed, and 0 rows stamped `vendor_locked_qr` — verified before the migration was written. There is nothing to restore, and reconstructing an overwritten value would be guesswork dressed as a repair.

### Guards, all mutation-tested

- `lib/vendor-first-steps.test.ts` — 11 tests. Four deliberate mutations (drop the go-live guard · make a waiting step claimable · hand-write the documents blocker · drop the hand-verified shortcut) were each applied, confirmed applied, and each failed the suite.
  🔑 **The first version of the go-live test was decorative and the mutation exposed it.** It used `docsStatus: 'pending_review'`, under which go-live is `waiting` and returns BEFORE the guard is consulted — deleting the guard left it green. The state had to be *application approved, shop not yet flipped verified* (a real transient, since those are separate writes on the admin approve path) for the guard to be reached at all.
- `tests/db/locked-qr-preserves-source.db.test.ts` — 7 tests including an end-to-end assertion through `vendor_source_attribution()` and a neutralisation case that puts the overwrite back, proves the sabotage landed, and watches the source get erased.

SPEC IMPACT: `Vendor_Monetization_Model_LOCKED_2026-07-25.md` — the sourced-vs-import rule now has a named enforcement point on the Locked-QR path. `DECISION_LOG.md` row added 2026-08-09 recording the vendor order of operations and the `is_published` finding.
