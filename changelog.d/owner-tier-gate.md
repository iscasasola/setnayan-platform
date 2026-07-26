## 2026-07-26 · feat(pahina): owner-layer capability gate + firewall (foundation only — inert)

Foundation for the owner-locked role-surface model (2026-07-26): the EVENT OWNER
opens the guest site at `/[slug]` and gets an OWNER LAYER unlocked on top of it;
`/dashboard/[eventId]` stays the planning surface. This PR ships **only the gate
and its firewall — no owner UI.** Nothing consumes the capability, so the
rendered page is byte-identical for every visitor, owner included.

- **`OwnerCapability`** added to `app/[slug]/_lib/site-identity.ts` as a
  **separate additive value, not a third `SiteIdentity` arm**. Owner-ness is
  orthogonal to identity tier (a host can view their own site with or without a
  guest cookie), a third arm would force a branch into every `identity.kind`
  switch and both `site-body-plan` golden suites, and keeping it off the union
  is what makes the firewall below provable rather than incidental.
- **`resolveOwnerCapability()`** is the only producer. It gates on **real host
  membership read server-side** via the existing `loadHostMembership`
  (`event_members` ∪ `event_moderators`) — the same React.cache'd query pair
  that already gates the private-event view, `?phase=` preview and `?editor=1`,
  so a host pays one query pair for all of them. No query param, header or
  cookie can shortcut it; a guest-session cookie is not an account. Per the
  2026-07-26 security review: the UI is not the boundary, the DB is.
- **Firewall extended** — compile-time `OwnerLeak extends never` assertion in
  `site-identity.ts` proves NEITHER identity tier can carry owner keys; new
  `guestIdentity()` key-pick constructor gives the guest tier the same runtime
  strip the anonymous tier already had. `lib/anonymous-zero-guest.test.ts` pins
  both tiers against poisoned inputs; new `lib/owner-capability-gate.test.ts`
  pins the gate's negatives (no account · guest cookie for this event · signed-in
  guest with an account · signed-in stranger) and event-binding.
- `page.tsx` now reads the viewer account **once** per request (the guest branch
  reused to re-read it for the claim-account CTA) and threads
  `ownerCapability` into `SiteBody`, which declares it and **deliberately does
  not consume it**.

SPEC IMPACT: None — no schema, pricing, SKU or product-surface change. A later
PR mounts owner controls on this gate; that PR must keep the gate server-side.
