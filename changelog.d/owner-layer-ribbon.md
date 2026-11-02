## 2026-07-26 · feat(guest-site): owner-layer surface 1 — the owner ribbon

Mounts the FIRST consumer of the owner-tier gate shipped inert in PR #3764
(`resolveOwnerCapability`). When — and only when — the page resolved a
server-verified `OwnerCapability` for this event, `/[slug]` now renders a
discreet ribbon above the guest site that (a) tells the host they are looking
at their own live site as a guest sees it, (b) links back to
`/dashboard/[eventId]/website/editor` (repo wayfinding rule: a page ships with
its doorway), and (c) exposes the four lifecycle-phase previews
(`?phase=save_the_date|rsvp|event|editorial`) that `page.tsx` already
authorises on host membership but never advertised — with the phase the page
actually rendered marked `aria-current`, including when `?phase=` overrode the
date-derived phase.

- New pure model `apps/web/lib/owner-ribbon.ts` (`buildOwnerRibbon`) — the
  ribbon's whole decision surface, so the visibility gate and the active-phase
  logic are unit-testable. Returns `null` for a null capability, for a
  capability bound to a DIFFERENT event (stricter re-statement of the
  capability's event-binding contract), and for a slugless event.
- New server component `apps/web/app/[slug]/_components/owner-ribbon.tsx` —
  `if (!model) return null` plus Pahina-language markup (paper-deep plate,
  mono eyebrow at `text-ink/70`, terracotta active chip). No `success-`/
  `warn-`/`danger-`/`emerald-` tokens; no gild-on-terracotta.
- Mounted in `site-body.tsx` as a sibling ABOVE both identity trees (inside
  `InvitationShell`, before the anonymous/guest branch) — NOT as a direct child
  of `<article data-pahina-chapters>`, whose children stay hidden until the §6
  scroll observer reveals them. It is chrome, not a chapter. `sticky top-0
  z-[90]` clears the Save-the-Date stack (film z-50/70, reveal z-60, glow z-80).
- READ-ONLY: links only. No server action, no form, no mutation.
- Guest and anonymous DOM is unchanged byte-for-byte — the component renders
  `null` for every viewer without a capability.
- Tests: `apps/web/lib/owner-ribbon.test.ts` (12 tests) pins the visibility
  gate (incl. cross-event denial and every lifecycle phase), the four literal
  `?phase=` hrefs, exactly-one-active tracking the rendered phase, the
  override case, and the read-only shape.

SPEC IMPACT: None — this consumes the already-locked 2026-07-26 role-surface
model (owner opens `/[slug]` like a guest and gets an owner layer on top;
`/dashboard/[eventId]` stays the planning surface). No pricing, SKU or schema
change.
