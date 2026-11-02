## 2026-10-21 · fix(venue-map): a venue with no pin says so on the shared map

Owner, on cale-ice: "why do i see a map". The Map switch was on (correct); the one map showed a lone pin "2" at
street level because the ceremony has no pin (typed address only) and `mapFrame` — which already fits every pin it is
given — was given one. Nothing said pin 1 was missing. `PinnedMap` (venue-styles.tsx) now draws every venue as a
numbered pin OR a numbered "<Role> · not on the map" line in the map's corner (and in its aria-label); the card's
directions still search by name and address. Guard: `app/[slug]/_components/every-venue-is-on-the-map-or-says-so.test.ts`
(property over styles × pinned/unpinned mixes + near/far fit; sabotaged red → green). Lab: `/dev/maker-lab/guest?venues=full-photo&map=1&unpinned=ceremony`.

The cale-ice DATA is the owner's to fix (no prod write made): ceremony has no pin; the reception pin on the event row
sits ~3 km north of Vertis North.

SPEC IMPACT: None — implements "VENUE STYLES APPROVED" (2026-09-30) "one map for both" honestly; no new ruling.
