## 2026-09-21 · feat(guests): the couple arranges the Wedding March sections

Owner: *"we should be able to arrange the parents, immediate family and other roles and modify its
sequence."*

- Each section heading on the Wedding March (Parents, Immediate Family, Maid of Honour & Best Man, …)
  gets ↑ / ↓ — plain forms, so they work on a phone and without JavaScript. Arrows step over sections
  nobody is in (they are not drawn). "Put the sections back in the usual order" appears once arranged.
- The invitation (`/[slug]` and `/[slug]/everyone`) prints sections in the couple's order.
- New `events.entourage_section_order TEXT[]` (NULL = built-in order). Read through
  `orderedGroupKeys()`, which drops unknown keys and appends missing ones — so no SQL copy of the key
  list, and a group added later appears for everyone. SELECT granted to `authenticated` only (both
  public readers use the admin client); written with the admin client after `requireHostMembership`;
  `events_host` rebuilt from the latest block (S40) verbatim, with post-conditions that the grant took,
  anon cannot read it, and the host-only private columns still project.
- The order is read in its own query everywhere: an unreadable arrangement prints the built-in order
  (and hides the arrows on the dashboard) — it never breaks the invitation.
- Guards: section-order tests in `lib/march-moves.test.ts` (+3, 2 sabotages caught); every
  `buildEntourage` reader must pass the couple's order (sabotaged: caught). Exposure baseline: +1 line
  `col public.events.entourage_section_order anon=- authenticated=S`.

SPEC IMPACT: None
