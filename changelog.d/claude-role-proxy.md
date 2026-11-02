## 2026-10-27 · feat(guests): a role holder can send a proxy — the role stays, the proxy stands in, the pair counts once

Owner, 2026-10-27 (DECISION_LOG "A ROLE HOLDER CAN SEND A PROXY — THE ROLE STAYS, THE PROXY STANDS IN"): *"a person with
role cannot come and will have a proxy instead. we do not want to remove the roled person"* · *"the dress code, call time,
will be same as their proxy role. the person will replace their seat"* · *"not having 2 guests but 1"* · *"catherine
sacdalan's invitation will indicate they are proxying for XXX"* · *"this only works if they have role and not guest"*.
(cale-ice: Mrs. Ma. Theresa Sacdalan-Tria proxied by Maria Catherine Sacdalan — used as FIXTURES only; nothing written to
the live event.)

**Data (migration `20271292712479_a_role_holder_can_send_a_proxy`).** `guests.represented_by_guest_id` (FK → guests, ON
DELETE SET NULL) on the ROLE HOLDER, plus `represented_since` and `proxy_named_by_guest` (the name a holder typed on their
reply). UNIQUE: one holder per proxy. Trigger `a_proxy_stands_in_for_a_role`: role holders only (not plain guests, not the
couple/celebrant), same event, live rows, no chains, not a +1 seat, not a request. Trigger `the_proxy_takes_the_seat`
moves the `event_seat_assignments` row with the link (set → the proxy; cleared → back to the holder). A removed proxy ends
the link. `free_seat_on_decline` keeps the seat when the decline names a proxy. The four SQL readers (caterer, supplier
brief, seat plan, Papic pool) leave a represented holder out — copied by script, one predicate added.

**Counting — the pair is one person, counted as the proxy with the proxy's reply.** `countsTowardEvent`,
`guestHasTicket`, `passCardEligibility`, `countGuestsByEvent` and every inline `.eq(PASSED_AWAY, false)` counter (pax,
check-in, souvenirs, 3D plan, passes, zip, Papic limited, recaps, roadmap, reminders) now also say
`.is(REPRESENTED_BY, null)`; the default `fetchGuestsByEventMeasured` read (seat plan, caterer, prints, send, "N to
invite") excludes the holder; the roster and the export opt in (`includeRepresented`).

**Guest List.** The pair is ONE row (`asOnePair`): the holder's name and role, "Represented by …", the proxy's reply as
the pill; the proxy has no row; a search for either name finds it.

**Guest card.** "Proxy ▾" (role holders only): search this event's guests or "＋ Add someone…"; a represented holder
shows "Proxy · <name> ›" + Remove, the reply reads "Represented by <name> ›", the seat is the proxy's; a typed name from the
holder's reply offers Link / Add as guest; a later "attending" from the holder asks "keep the proxy?" (never auto-changed).
The proxy's card: "Proxy for <holder> ›" chip, the role shown inherited (read-only), the role's attire and call time.
One server action (`setGuestProxy`, link/add/remove/keep), in place, no screen reset.

**Guest side.** One effective-role reading (`effectiveRoleOf`) for Me's parts, the look, the checklist, the greeting and the
ticket's Arrive: the proxy reads "Standing in for … · <role>", the role's dress code and call time; the holder reads
"<proxy> is standing in for you". A role holder's reply offers "I can't come — someone will stand in for me" + a name
(`submitRsvp` stores it with a decline only, role holders only). Prints and the entourage: "<holder> (represented by
<proxy>)".

Guards: `lib/the-pair-counts-once.test.ts`, `lib/a-proxy-wears-the-role.test.ts`, `lib/a-proxy-stands-in-for-a-role.test.ts`,
`tests/db/a-role-holder-can-send-a-proxy.db.test.ts` — each sabotaged red, then restored. Labs: `/dev/guests-lab?part=card&proxy=…`,
`?part=screen&proxies=1`, `/dev/me-lab?proxy=1&who=proxy|holder|ask|print`.

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md` — build note appended to the 2026-10-27 proxy row
(the honest shapes chosen: link on the holder; the holder's reply is never rewritten; the pair counts as the proxy).
