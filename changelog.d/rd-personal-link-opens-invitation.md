## 2026-10-19 · fix(guest-link): a personal link opens the invitation itself, not the reply-first welcome

Owner, 21:40, on a guest's personal link landing on `/{slug}/invite/enter` ("Please reply below — your ticket is
ready once you do." + "Reply to the invitation"): *"why am i at rsvp. we should be at the invitation page and not
here"*.

- `/{slug}/redeem` now lands a listed guest on `/{slug}` — the real invitation (cover, veil, their greeting, role,
  what to wear, arrive by) — whenever the Event Hub's face asks for a reply. Decided by
  `personalLinkLandingPath` (lib/invite-destination.ts) from the page's own `arrivalDestinationFor`.
- `app/[slug]/page.tsx` never sends a keyed guest to `/invite/reply` any more (the 2026-09-26 key-gate redirect is
  retired). Owner, same evening: *"so their QR code should not directly go to RSVP. they only go there when they
  click to the button on the cover"*. Walked live: the maria-and-jose test guest who HAD replied was still bounced
  there (a later-switched question). `keyGate` still sets the "Didn't reply" mark; the reply page still asks
  `rsvpGate` for only what is missing.
- The 30-minute `?k=` re-entry code now rides on `/{slug}?k=` and is spent there (before the private gate) only
  when the browser holds no pass for this event (`invitationReentryHref`, lib/guest-pass-hop.ts).
- Kept: N05 — a dateless / pre-launch (Save the Date) event still opens the Save the Date landing and asks
  nothing; a face that cannot be read keeps the landing. Passcode rules, private locks, the pass book, account-
  beats-pass, the plus-one welcome, the TBA door and the accepted-request "You're in!" are untouched. The reply's
  save still returns to the thank-you door (`/invite/enter?rsvp=`).
- Guard: `app/[slug]/redeem/a-personal-link-opens-the-invitation.test.ts` (+ three re-aimed wiring guards).

SPEC IMPACT: DECISION_LOG.md — new row "A PERSONAL LINK OPENS THE INVITATION ITSELF (2026-10-19)", overriding the
2026-09-30 row "THE PERSONAL LINK OPENS THE GUEST'S OWN LANDING PAGE" and 2026-10-11 N04 for every face that asks
a reply; N05 kept.
