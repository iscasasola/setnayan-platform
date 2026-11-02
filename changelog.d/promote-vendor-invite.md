# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-09-08 · feat(vendors): the Setnayan invite is no longer a one-time card — it follows the booking

Owner ruling, DECISION_LOG.md 2026-09-08 item ①, on inviting an off-platform supplier onto
Setnayan: **"we allow this. so promote it."** Production stat that motivated it
(DECISION_LOG.md 2026-08-30): **44 of 45** booked suppliers have never been invited this way.

### Why: the mechanism worked, nobody found it twice

A couple could already generate a real claim link + QR for a manually-added supplier
(`createManualVendorInvite`, `ensureAutoShareInvite` — live since 2026-05-22, and given ONE
correct gate on 2026-09-03 via `lib/supplier-invite-eligibility.ts`'s `canInviteSupplier`). The
only surface for it was `new-manual-vendor-modal.tsx`'s "Invite them to Setnayan (optional)" card,
shown once, right after the couple typed the vendor's details in. Nothing else ever pointed back
at it — not the vendors list, not the per-vendor workspace page's own claim CTA unless the couple
happened to open it.

### What shipped

- **`PlanCardPick.needs_setnayan_invite`** (`lib/wedding-plan-groups.ts`) — a new field stamped by
  `bucketVendorsByGroup` for every pick, using the SAME `canInviteSupplier` gate the workspace page
  already calls. Not a re-derived proxy (no missing-photo / null-business-name guess) — it reads
  the real `marketplace_vendor_id` column, exactly like the other five gates on this question.
- **A badge on the couple's own booked-vendor cards** (`plan-budget-accordion.tsx`'s
  `VendorCardAtom`, `.invite-cta`): "Not on Setnayan yet — invite them", shown only when a pick is
  both LOCKED (booked — contracted/deposit_paid/delivered/complete, mirroring the workspace page's
  own `canOfferInvite` status test) AND `needs_setnayan_invite`. Disappears the moment the supplier
  claims their account (`marketplace_vendor_id` gets set), same as the workspace page's own CTA.
  Links straight to `workspace#invite-vendor` — the exact existing section that already runs the
  invite, not a new write path.
- **`#invite-vendor` anchor** on the workspace page (`workspace/page.tsx`) wrapping whichever of the
  four claim-state sections (pending / claimed / expired / create-link) is showing, so the deep
  link always lands on real content instead of the top of a long page.
- **`lib/one-gate-decides-a-supplier-invite.test.ts`** updated: `lib/wedding-plan-groups.ts` added
  to the tracked `GATES` list (the pick-build site is where this question is actually decided for
  the new surface), call-site count 5 → 6.

Mechanism is untouched — no new write path, no change to what happens when a claim link is sent or
claimed. This is visibility only.

### Tests

New `lib/promote-vendor-invite-nudge.test.ts` (7 tests): the stamp matches `canInviteSupplier`
exactly across the same row shapes the shared predicate's own guard test uses (never a proxy); an
unlocked off-platform pick still carries the fact (the `locked` AND is the card's job, not the
model's); and three render-gate guards pinned against the real source (locked+flag together,
exactly one mount, the `#invite-vendor` anchor exists on both ends). Mutation-checked by hand:
dropping the `locked &&` half, and dropping the anchor `id`, each turn a guard red.

SPEC IMPACT: Resolves `WHAT_IS_LEFT_2026-08-17.md` §6 item 6 in the spec corpus
(`~/Documents/Claude/Projects/Setnayan/`) — logged against DECISION_LOG.md's 2026-09-08 entry.
No schema change, no SKU/price change.
