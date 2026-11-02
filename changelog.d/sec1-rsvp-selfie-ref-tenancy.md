## 2026-07-30 · fix(security): the RSVP selfie ref was unpinned — a guest could store a private-bucket key as their avatar

Found by the **stored-ref sweep** I recommended after #3909: *enumerate every column that stores a client-supplied `r2://` ref, then ask who signs it and whether the write pinned it.* This is the fourth oracle that method has turned up, and the most interesting one — because **the fix already existed and was only half-wired.**

### The bug

`guestSelfiePolicy(eventId, guestId)` was written by #3729 for exactly this flow, and was already applied in `app/papic/face-enroll-actions.ts`. It was **never applied on the RSVP path** (`app/[slug]/actions.ts`), which writes the **same column** read by the **same renderers**. One writer guarded, one not.

Why that mattered:

- the RSVP write uses the **admin client**, so RLS cannot help;
- `guests.photo_url` is resolved through `displayUrlForStoredAsset` on at least **five** surfaces — the guest list, both seating views, the 3D plan and the guest avatar;
- so a crafted RSVP post naming `r2://setnayan-vendor-verification/vendors/X/verification/dti.pdf` (or another event's selfie, or a payment screenshot in `thread-files`) would be stored as that guest's avatar and **signed for the couple** — a cross-tenant read out of a private bucket, through a form any invited guest can submit;
- the consent and age booleans gating the write are themselves **client-supplied**, so they were no obstacle.

The same `selfieRef` also lands in `guest_face_enrollments.asset_url`, so pinning once at the read fixes both consumers.

### The fix

One guard at the source, using the policy that already existed. A ref that fails is treated as **absent** rather than fatal — this file's own rule is that *"a selfie/enrollment failure must NEVER roll back the RSVP that already succeeded"*, and `null` simply skips the enrollment block.

### The lesson, which is the real value here

**A policy with only some of its writers wired is a paper record.** Exactly the shape #3729 itself recorded about the `face_enrollment` control — *"until now this control had ZERO runtime callers, so it was a paper record."* The guard existing is not the same as the guard being reached.

So the sweep question needs a second half: not just *"is there a policy for this flow?"* but ***"is it applied at every writer of the column?"*** A `git grep` of the policy name against the writers of its column answers it in one line.

### Tests — 4 cases

The policy is pure, so three exercise it directly (own selfie kept; every private bucket refused; another guest's *and* another event's selfie refused) plus a wiring scan asserting the RSVP path pins the ref, degrades to `null` rather than throwing, and that **neither consumer reads the raw form field**.

**Probed:** reverting `photo_url` to the raw ref fails the wiring test by name.

**Verification:** `tsc --noEmit` clean · `next lint` clean · **`test:unit` 5,533/5,533 pass**.

### Exposure

Prod is pre-launch — 3 events, 1 vendor profile — so there was no second tenant's material to reach. Preventative, like the rest of the SEC-1 family.

SPEC IMPACT: None — no price, SKU, schema, flag or RLS change. Security register updated with the sweep method and this refinement.
