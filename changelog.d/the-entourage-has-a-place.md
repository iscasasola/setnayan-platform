## 2026-09-14 · feat(invitation): the entourage is on the invitation, under Details

The couple has been able to give every guest an entourage role since the role
vocabulary shipped — ~30 values on `guests.role` / `guests.extra_roles`, grouped
into tiers by `lib/role-sets.ts`, already driving the seating avatars and the
emcee script. **Nothing published them.** The public site has sixteen widget
types and none is the entourage, so the ninongs, ninangs, bridesmaids and
groomsmen a couple had carefully assigned were invisible to the guests standing
with them.

- `lib/entourage.ts` — pure: guest rows in, ordered groups out, in the order a
  Filipino invitation prints them (parents · principal sponsors · secondary
  sponsors · honour attendants · bridesmaids · groomsmen · bearers · the
  ceremony's voices · the Nikah's). The published roles are an **allow-list**,
  so a role added to `GuestRole` is never silently published.
- `app/[slug]/_lib/loaders.ts` — `loadEntourage`, four columns, filtered to the
  allow-list in the query itself, matching on **both** `role` and `extra_roles`.
- `app/[slug]/_components/entourage-section.tsx` — the section, mounted in BOTH
  of `site-body`'s trees, with the anchor `#site-entourage`.

**Owner rulings, 2026-09-14.** (1) Names carry their roles. A group holding one
role prints it once as the heading; a group holding several prints it beside
every name. (2) Asked whether this earns a sixth slot in the bottom bar, the
owner kept the **locked five** (Home · Details · Story · Camera · Me) and put the
entourage under Details with its own anchor. `site-nav.ts` is untouched and a
test fails if it ever learns the word.

**Measured, not assumed:** `event_sponsors` — the table behind
`/dashboard/<eventId>/sponsors` — held **zero rows in production**, while
`guests.role` is in use and already carries `principal_sponsor`. The list is
built from the guest rows alone; a second source would be two mechanisms
answering one question.

⚠ **A disclosure decision worth the owner's eye:** the entourage is shown to
whoever this page already admits. On a private event that is only people through
the gate; on a public event it is anybody with the link — the same footing as the
couple's names, date and venue, which are already public there. One line in
`page.tsx` changes it if that is not wanted.

SPEC IMPACT: New public-site surface + two owner rulings (the five-slot bar is
kept; the entourage is a Details section, not a tab).
