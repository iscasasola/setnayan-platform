## 2026-11-11 · feat(home): Home is the profile — the bar and ☰ read Home · Discover (slice 1)

Owner, 11 Nov 2026: *"One profile page approve"* (v3, DECISION_LOG "HOME PAGE v3 APPROVED").

- **Bar + ☰ = Home · Discover.** `accountBarTabs({ discoverOpen })` draws two tabs; the ☰ draws Home above Discover,
  with Home's sections (Events · People · Shop · Memories) as small doors under it, and HQ (admins) + Features as
  fine print under the divider. The Home tab comes back to the section you left (`sn-home-last-seg`).
- **Home = `/dashboard`.** A profile header (the SAME `ProfileHeader` the public `/u/[slug]` now draws), the four
  sections as one segmented control (`?seg=`, Shop only for an owner), and ONE pinned row per section
  (`[Section ▾] · doors · one action · ⚙`): Events — N planning · N celebrated · ＋ Event; People — its shipped row,
  N asking you, Invite; Shop — N service cards · N online · ＋ Card, and "Open the Shop dashboard"; Memories — no
  number, no action. Bodies are the shipped pages MOVED (People → `people-segment.tsx`, Memories →
  `memories-segment.tsx`), never redrawn. Re-tap = top; the body slides in from its side; the pinned row folds on
  scroll (shared `usePinFold`); reduced motion = fades only.
- **Old addresses forward with every parameter:** `/dashboard/people?…` → `/dashboard?seg=people&…`,
  `/dashboard/library?…` → `/dashboard?seg=memories&…` (lenses kept), `/dashboard/samahan` → Home › People › Groups.
  `/dashboard/people/[dependentId]` and `/dashboard/samahan/[communityId]` stay. Every in-app door rewritten.
- Guards: new `lib/home-is-the-profile.test.ts`; `the-account-bar-is-the-ruling.test.ts` and ~25 nav guards updated to
  the ruling (none deleted). Raw-hex baseline: the header's 20 colours MOVED from `u/[userSlug]/page.tsx` to
  `profile-header.tsx` (net 0).
- Not in slice 1: Discover × shop, the visitor views, pin a favourite + people chips, service-card faces on Home ›
  Shop, the supplier's Home opening on Shop, a one-line greeting (needs a column).

SPEC IMPACT: None new — implements DECISION_LOG 2026-11-11 "HOME PAGE v3 APPROVED" (already in the corpus).
