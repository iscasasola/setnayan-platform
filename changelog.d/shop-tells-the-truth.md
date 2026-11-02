## 2026-08-28 · feat(vendor): the shop tells the truth

Four things a supplier could not previously learn from their own dashboard.

**The room is called what it is.** The supplier's day-of room is now the **Event
Hub** everywhere a person reads it — the sidebar, the bottom nav, the 72px icon
strip, and every page title. Owner, on the drawing: on the day a supplier is
inside the event's hub, and calling it two things in two places is how the
vocabulary drifts. **Labels only.** The `on-the-day` key and route are frozen —
`vendor-nav-destinations.ts` records that the key is load-bearing in four places
and that three of them fail silently. The plan named five copies; there were
**six** (the icon strip's caption, keyed by the stable key, would have gone on
saying "On the day" beside five renamed rows), and one of the five it named —
`more/page.tsx` — is a redirect stub that mentions the word only in a comment.
`nav_slot_override` holds **0 rows** in production, so no admin override
out-ranks any of this.

**A hidden shop learns why.** A shop that is approved but not listed in the
marketplace got no rail (the order-of-operations rail returns null the moment
`verification_state` says verified), no banner, and the hero line "You're all
caught up — new leads land here the moment a couple unlocks you" — a promise
that cannot come true. That is the same defect the rail's own docblock was
written to kill, one column over: findability is decided by TWO columns and the
rail reads one. Production holds a shop in exactly that state. **And nothing
else tells them** — `transitionVendorVisibility` writes an audit row and calls
no notifier at all, so this banner is the only telling there is; the copy
therefore promises no message we do not send. **No fix button where there is no
fix:** a vendor cannot write `public_visibility`, so the banner asks a human
instead of shipping a control that would refuse in silence.

**A supplier on two days of one celebration sees both.** The Event Hub's picker
collapsed its list with a Map keyed on `eventId` alone, and a Map keyed on a
repeated key keeps the LAST value — so a supplier booked on the rehearsal dinner
AND the wedding day saw that couple once and the earlier day vanished. The
vanished row is the one carrying the Launch button on ITS day, so on the morning
of the rehearsal the picker offered nothing to launch. `fetchVendorRoomEvents`
already returns one entry per (event, date), so the collapse was pure loss.
Safe by arithmetic today: production holds one pool booking, on one day.

**Performance says what its numbers mean.** "Usually responds in 2h" is one of
the few claims Setnayan publishes about a shop on a page couples browse, and it
is refused five different ways — the shop it is about could see none of that.
A card on Performance now names the number, whether couples can see it, and
exactly what would change it, on every tier. **Derived, never re-implemented:**
`replyTimeBadgeLabel` is now computed from a new `replyTimeVerdict`, so the
sentence a shop reads and the badge a couple reads cannot disagree. No invented
statistic: production holds zero marketplace bookings, so no "shops that answer
fast get booked twice as often" line ships.

SPEC IMPACT: `DECISION_LOG.md` — the vendor room's rename to Event Hub, and the
finding that visibility changes notify nobody.
