## 2026-08-06 · fix(guest): two finished pages nobody could reach, and three links at the foot of the editorial that went nowhere

A feature audit found the same defect three times on the guest side. All three are the shape that is hardest to notice: **the work was done, and only the way in was missing.**

### What was actually true (all three claims verified before anything was built)

**CONFIRMED — the 3D walk-through of the reception is unreachable.** `app/[slug]/venue/page.tsx` ships, renders, and resolves its scene through the `public_venue_scene` SECURITY DEFINER RPC. A repo-wide search for an inbound link finds **none** — every `/venue` hit is `/admin/venues`, an unrelated directory surface. The only way a guest ever saw the 3D room was by typing the address.

**CONFIRMED — the money-gift page has exactly one link, and it is on the wrong side of the product.** `app/[slug]/pabuya/page.tsx` ships. Its single inbound link is `publicHref` in `app/dashboard/[eventId]/pabuya/_components/pabuya-manager.tsx` — **the couple's own dashboard**, which no guest opens. ⚠ One correction to the audit's wording: the page is **not** "switched on" in code. It is gated behind `PABUYA_PUBLIC_ROUTE_ENABLED` (`isPabuyaPublicRouteEnabled`, default OFF → `notFound()`). Whether prod has that variable set is an environment fact this branch cannot read, so the new doorway asks the same function the route asks and simply does not draw while it is off.

**CONFIRMED — three dead links at the foot of the after-the-wedding editorial**, `Colophon` in `app/[slug]/_components/editorial/editorial-content.tsx`: "The Invitation (RSVP)", "The Wedding Day (Live)", "Watch the Film", all three `href="#"`. Two more of the same (`PhaseRibbon`, at the top of the same page) were found while fixing them and are fixed too.

🔑 **The third one nearly got deleted for the wrong reason.** "Watch the Film" reads like a link to a page that was never built — there is no film *route*. It is not: the film is a **section of that same page** (the Live Studio broadcast replay, `WatchTheFilm`), and it simply had no `id` to scroll to. The destination was never missing. **Check what a dead link NAMES before concluding it has nowhere to go.**

### The doorways

🔑 **A doorway is gated on what the DESTINATION demands, not on whether the route exists.** Both pages are *reachable-but-refusing* in ordinary conditions — `/venue` answers "the 3D venue isn't ready yet" until the couple **publishes** the floor plan, `/pabuya` answers "hasn't set up e-gifts yet" until a destination is **enabled**. Linking without those checks trades an invisible page for a visible dead end, which is worse: a guest turned away once stops tapping.

- **`app/[slug]/_lib/site-nav.ts`** — new `resolveGuestDoorways()`, a pure function beside the slot rules. It restates each destination's own gate: the 3D room needs `seating` on the event type **and** `event_floor_plan.published_at IS NOT NULL` (the two questions the RPC asks before answering `{published:false}`); the money gift needs the rollout switch **and** at least one enabled destination. It carries the guest's personal token into the 3D room — that is what makes it show *their* seat — URL-encoded, blank treated as absent. No slug ⇒ no doors, so `/null/venue` cannot be built.
- **`app/[slug]/hub/page.tsx`** — both doors mount as **cards in the Now panel**, directly under the seat card, one tap from opening the hub.

**Why cards and not tabs.** The bottom bar holds **five** slots and both the pre-day and the live-broadcast bars are already full (`Home · Details · Story · Camera · Me` and `Now · Watch · Camera · Gallery · Me`). A sixth tab is not a small addition — it is a redesign of an owner-locked shape — and a tab that appears only when the bar happens to have room teaches people the bar is unreliable, the exact failure `site-nav.ts` exists to prevent. The hub's own menu has the same budget (≤5 pills + More), and `directions` already sits in the overflow sheet, so a panel would have buried the 3D room two taps deep. The Now panel is the first thing the hub shows.

The e-gift count is read through **`fetchEgiftMethods` with `enabledOnly: true`** — the *same* function, the *same* service-role client and the *same* filter the public page uses. "Is there anything behind this door" must be answered by the reader that will actually stand there. It is skipped entirely while the switch is off, so a dark flag costs nothing.

### The dead links

`Colophon` and `PhaseRibbon` now point at real destinations — `/[slug]` (which carries the RSVP) and `/[slug]/hub` — and "Watch the Film" points at the film section, whose `id` and the link's `href` are both spelled from **one** constant (`WATCH_FILM_ANCHOR_ID`), because two hand-typed strings drift apart with CI still green. Each link draws only when its destination is really there: a curated sample has no event row ⇒ no route links; an edition where the couple never broadcast ⇒ no film link. A footer that quietly gets shorter is honest; a link that does nothing is not.

### Tests — `apps/web/lib/finished-pages-need-doorways.test.ts` (19, every one watched failing)

Decision (the resolver), wiring (the hub really mounts both doors **and** reads each gate fact from the destination's own reader), and a scan proving no `href="#"` survives in the editorial.

🪤 **Two guards were vacuous on the first pass and had to be rewritten after watching them stay green under a real break.** The dead-link scan matched its own explanatory comments (fixed by stripping comments before scanning, plus a test that proves the scan can still see a planted dead link). And `/watchFilmShown \? \(/` was satisfied by the row-level `{slug || watchFilmShown ?` guard one line above, so the film link could be made unconditional with CI green — each anchor is now matched *together with* the guard immediately above it. **A guard you have not watched go red is not a guard.**

### Known gap, deliberately not papered over

The hub is only reachable during the live/post window, so these two doors appear **on the day and after, not before it**. For the money gift that is the right moment. For the 3D room it is not — walking the venue is most useful *before* you arrive — but every pre-day guest surface (`site-body.tsx`, `find-my-table`) is owned by other concurrent work on this branch's ownership split. The same card belongs in the venue/details section of the couple's page; that is a one-file follow-up, not a redesign.

SPEC IMPACT: None — no SKU, price, schema, or migration. No new route, no new public surface: this only links pages that already shipped. `PABUYA_PUBLIC_ROUTE_ENABLED` remains the owner's switch and is not flipped here.
