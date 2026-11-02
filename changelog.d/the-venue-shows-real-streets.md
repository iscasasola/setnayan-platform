## 2026-08-24 · feat(guest): the venue section shows real streets

**H-4 / AP-10 (W3-D).** A guest reading an invitation and working out how to get
there was shown a decorative gradient band and a line of text. The section is
called `venue_map`. It had never drawn a map.

**Two halves, and the second is the one that mattered.**

1. **The drawing.** `app/[slug]/_components/venue-widget.tsx` now renders the
   `VendorLocationMap` that has shipped on public shop pages since 2026-06-28 —
   the official OpenStreetMap embed, no API key, no paid dependency. Nothing new
   was drawn (RULE 0). The gradient band survives as the no-coordinates
   fallback, so events without a pin are unchanged.
2. **The gate.** The predicate deciding whether that section has content asked
   `venue_name || venue_address` — the two fields a couple TYPES — and never
   asked about the coordinates the map is drawn FROM. Production holds exactly
   one event with venue coordinates and it has neither a name nor an address, so
   the one event we could draw a map for is the one the section would have been
   dropped from. **A fix nobody can reach is no fix**, so the gate moved with the
   drawing.

**The rule was written down twice** — once in `lib/website-section-content.ts`
(the couple's editor) and once in `app/[slug]/_components/site-body.tsx` (the
guest page), under a docblock promising the two "read the same truth". A sentence
is not a mechanism. Both now call one exported `hasVenueContent`.

`SECTION_CONTENT_EVENT_COLUMNS` gains `venue_latitude, venue_longitude`, because
a predicate that reads a column nobody fetched sees `undefined` and answers "no
venue" forever, with nothing thrown.

Also: `"Venue to be confirmed"` no longer prints above a map that confirms it,
and the stale docblock in `vendor-location-map.tsx` claiming the CSP needed no
change — the false sentence that cost that map its first two months as an empty
grey panel — is replaced with what actually happened.

9 assertions, all mutation-measured by occurrence count before → after, all red.

SPEC IMPACT: None — no locked decision, price, SKU or schema is touched. The
OpenStreetMap origin was already in the enforced `frame-src`; the CSP is
unchanged and the existing guard now names this second surface.
