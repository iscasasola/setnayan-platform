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

- fix: the Invites line says the per-tier rule ("Each Invites tier you reach pays a reward. Free.") instead of "Every one who books earns you a reward"; the drawing's third access row ("The budget — it stays with the hosts until they share it.") is restored, drawn only while `COORDINATOR_AREAS.budget` defaults to off. Both guarded in `for-coordinators-says-what-ships.test.ts`.

- fix: the sample service card is the live `ServiceFace` + `CardBadgeRow`, exactly as main draws it, instead of a hand-drawn copy (controller, 20 Nov: use the live card; card 14 is held by the scope freeze). The hand card's CSS and its three medal images are removed; guarded in `for-coordinators-says-what-ships.test.ts`.

- fix: the page guard names the old Hub plan without spelling it, so the whole-tree old-name guard stays green.

- merge: main (#8014 reach is not a plan allowance). The Your shop ⓘ now reads "No plan limits bookings or reach. Only a Verified shop is shown in search: …", quoting `reachLadderSentence` as main does; the generated files are regenerated.

## 2026-11-20 · fix(for-coordinators): no months on the public page; the motion guard encodes row 43 and the tokens

- Controller ruling (20 Nov): the client part's ⓘ and the shop part's ⓘ say `SUPPLIER_FREE_BOOKING_LINE`, the owner's
  19 Nov line (DECISION_LOG 2026-11-19 "PROMOTION PAGES", item 4), instead of `FEE_FREE_RULE` ("…for a year"), which
  stays for the in-app client card only. The line lives once in `lib/booking-fee-who-words.ts`, the same edit as #8050.
  `lib/no-fee-wording.test.ts` and the page's own guard pin it and refuse "for a year".
- `lib/the-website-moves-by-the-standard.test.ts`: the same guard as #8050 — every animation and transition on an
  adopted public sheet reads the `--sn-*` tokens, and the only loop is a Drift of 20 s+, `ease-in-out` (MOTION_STANDARD
  row 43). Its old premise (≥ 3 loops) already failed on this head. It also refuses a page's own easing alias
  (`var(--fc-ease)`), keeping stagger counters (`var(--i, 0)`). /features' `nowline` goes from 6 s to 20 s. Main's
  pre-redraw /for-suppliers sheet is exempt until #8050 lands.
- Seen RED once each: a page alias in this sheet, and "for a year" back on the page.
- Merge note: after #8050 lands, `PUBLIC_PAGES` (no-fee-wording) becomes both pages and `TOKENS_LATER` (motion guard)
  becomes empty — a one-line union in each.

SPEC IMPACT: None — the 19 Nov ruling and MOTION_STANDARD row 43 are already in the corpus.
