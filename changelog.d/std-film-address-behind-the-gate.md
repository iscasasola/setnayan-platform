## 2026-09-27 · fix(save-the-date): the film never shows a street address to someone the venue gate withholds from

The Save-the-Date film's small place line under the reception name was built in
`app/[slug]/_lib/loaders.ts` as `std_film_venue_city ?? venue_address` and handed
to the film for EVERY viewer, beside the reply gate rather than through it — so a
stranger with a forwarded link, or a guest who had not replied, would have read
the street address in the film and in its "add to calendar" location, while the
Venue scene below correctly withheld it (owner rule, DECISION_LOG 2026-09-27
"YES TO ALL", item 2). Latent: no event had `venue_address` set when found.

Now two halves in `lib/venue-disclosure.ts`: `stdFilmOwnCity` (the loader keeps
only the Save-the-Date's own "City or area" field, and drops it when it is a copy
of the address) and `stdFilmPlaceLine` (the film's mount in `site-body.tsx` falls
back to the address only from the event the page already gated with
`withheldVenue` / `venueIsOpen` — no second rule). A guest who has replied, or
anyone on the day, sees exactly what they saw before.

Also closed the path that could put the address INTO the city field: the Save-the-
Date builder's "Autofill" copied the event's street address into "City or area"
and "Render" saved it. It now fills that field from the couple's own saved city
only; the builder preview still shows the address, as a replied guest sees it.

Guarded by `apps/web/lib/the-save-the-date-film-keeps-the-address-behind-the-reply.test.ts`
(runs loader → gate → mount → film content, calendar links included, for a
stranger, an unreplied guest and a replied guest across three event shapes; plus
wiring checks on the loader, the mount and the builder).

SPEC IMPACT: None — implements the existing 2026-09-20 / 2026-09-27 venue-gate ruling on one more surface.
