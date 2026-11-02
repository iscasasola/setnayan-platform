# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-08-03 · feat(guest-site): a booked supplier's doorway into their own tools

Third build item of the event-website work (owner, 2026-08-03: *"for couples, public, guest, vendors (their controls for that event also)"*, then *"finish"*). Follows #4068 and #4069.

**The gap.** A booked photographer, band or emcee opening their client's wedding link was treated as a stranger. Their run of show, their cues, their call time all exist — in their own workspace — and **nothing on the wedding site pointed at any of it**, so a supplier had to be sent a separate long address out of band. The project's own wayfinding rule calls a shipped surface with no doorway a defect; this was that defect for the whole supplier side.

**The shape: a door, not a room.** A single strip that LINKS OUT to `/vendor-dashboard/clients/{eventId}`. It renders nothing of the supplier's own world, because a supplier works many weddings — their week, their invoices and their other clients do not belong inside one couple's page. It also carries **nothing about the event**: the couple's page is already on screen, so the strip cannot become a second, unaudited leak of event data.

**Mounted above the tier fork, deliberately.** A booked supplier can arrive as *either* identity — as a guest if the couple also invited them, or anonymously with just the link. Gating the strip inside one tree would hide it from half of real suppliers.

**Security follows the shipped owner-capability pattern exactly, for its stated reasons plus one.** `VendorCapability` is an additive value beside the identity union, never a third arm — and the extra reason is decisive: **a person can hold two roles at one event** (owner ruling 2026-08-01, *"there is a stylist and an emcee both in 1 service"*). A `kind: 'vendor'` arm could not express a guest who is also the booked florist; a discriminant admits one answer, a capability composes. It is also why `site-body.tsx`'s two-arm ternary must stay two-armed — a third arm would fall into the guest branch rather than fail to compile.

- `resolveVendorCapability` grants **only** after the database confirms this auth user owns a vendor profile the couple booked on **this** event. No query param, header, cookie or prop can shortcut it, and a guest-session cookie is not an account.
- A compile-time `VendorLeak` assertion proves **neither identity tier can carry the capability's keys**, mirroring the existing `OwnerLeak` proof.
- `loadVendorBooking` joins the couple's own `event_vendors` list to `vendor_profiles` via `linked_vendor_profile_id`, so an **unclaimed hand-typed booking resolves to nobody** — correct, there is no account to send anywhere.
- Three firewall tests, including a key-poisoning attempt and an event-binding check. **Mutation-verified**: removing the booking gate fails them.

Verified: 6,310/6,310 unit tests, `tsc --noEmit` clean, `next lint` clean. No migration, no flag, no route change. Renders for nobody except a confirmed booked supplier, so every existing visitor's page is byte-identical.

SPEC IMPACT: closes the supplier half of the owner's *"one address everyone can be told"* ruling (`DECISION_LOG.md` 2026-08-03). The vendor-side surfaces it links to already ship.
