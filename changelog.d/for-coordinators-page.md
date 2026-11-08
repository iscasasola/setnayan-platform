## 2026-11-06 · feat(for-coordinators): the For Coordinators page, built from the 6 Nov approved prototype

New public page `/for-coordinators` (`app/(shell)/for-coordinators/`), inside the shared shell and
full-bleed, built section by section from the owner-approved prototype of 6 Nov
(`prototypes/for_coordinators_2026-11-06/`, corpus — owner: "Coordinator approved"). It replaces the
4 Nov page this branch first carried. Sections, in the prototype's order and words: the scroll-driven
hero (five coordinators) · why · the hard truth · one place, every tool · couples check your dates + one
QR for every moment · four notices · Full Event Access · on the day, you move the show forward (the
couple can too, the emcee can't) · the portfolio · grow your business, not your fees (fee slider, gifts,
the badge shelf) · three honest questions · everything you get (the fold) · plans Free → Verified → Grow ·
the close with the sample shop "Setnayan Weddings". Every call to action opens `/open-shop`.

- Nothing that is a number is typed. Plan and add-on prices: `vendor_billing_catalog`
  (`_prices.server.ts`, no peso fallback). Reach · categories · cards · seats · branches · photos:
  `lib/vendor-tier-caps.ts` (`_facts.ts`). The booking fee: the live schedule
  (`getLiveBookingFeeSchedule`); unreadable → no rate is named and the slider is left out.
- Full Event Access: the parts, the levels each may take and a coordinator's starting levels come from
  `lib/delegate-areas.ts` (`DELEGATE_AREAS` · `areaChoices` · `COORDINATOR_AREAS`).
- The day-of desk reads "Free" while `FREE_SPECIALIZATION_SETS` holds `floor_command` (or the dated
  window is open) — `_claims.server.ts` now asks the same two questions as the paywall.
- The four switched lines (run of show, announcements, prepare-then-release, private notes) still show
  only while their switch is on; an unreadable switch reads OFF.
- QR codes are real (`renderUrlQrSvg`) and point at `setnayan.com/v/setnayan-weddings/…`.
- `/for-coordinators` joins `STORE_SHELL_WEB_ONLY_DOORWAYS` and its footer link gets `data-web-only`
  — the page now shows the supplier plan prices.
- Photos and the Setnayan Weddings logo copied to `public/marketing/2026-11-06/coordinators/`; five 4 Nov
  photos and the 4 Nov shared pieces (`photo-hero.tsx`, `problem-scenes.tsx`, `photo-page.css`), used by
  no other page, are removed. `vendor-grow-sections.tsx` no longer styles `[aria-expanded]` (the fold
  guard): it reads the InfoTip's own `data-open`.
- Migration `20271308786674` (the reserved slug) is unchanged from the 4 Nov build.
- Guard: `app/(shell)/for-coordinators/for-coordinators-says-what-ships.test.ts`, rewritten for the
  6 Nov page.

⛔ Ships draft + `do-not-auto-merge`: the page goes live only after the five promised features are live
(prints/NFC, the scanner, event photos on the card, badge rewards, meetings) and the sample shop
`setnayan-weddings` exists.

SPEC IMPACT: None — this ports `prototypes/for_coordinators_2026-11-06/` (corpus) as approved; the
differences are listed in the PR.
