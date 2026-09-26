## 2026-09-26 · fix(event-hub): a locked venue no longer says "Venue to be confirmed"

Seen on cale-ice (owner's check, 2026-09-26): the venue is set as a map pin, but for a
guest who has not replied `withheldVenue` clears the pin — and with no name either,
`venue-widget.tsx` fell through to "Venue to be confirmed", telling guests the couple
had no venue (even on the day). The heading now stands aside when the venue is withheld;
the existing line says the true thing: "The address and directions open as soon as you
reply." Two position-anchored tests re-pointed (same properties); new test in
`the-venue-opens-after-the-reply.test.ts` (sabotage → 1 fail).

SPEC IMPACT: None.
