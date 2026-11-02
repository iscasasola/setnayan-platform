## 2026-07-28 · feat(vendor-services): a congratulations moment on every service card creation

Owner: "we want a congratulations everytime they make a service card… a reminder
of the value of service cards is what it compiles for them." A CREATE (wizard or
canvas — both post `commitVendorService`) now redirects with
`&created=live|draft`, and the services manager replaces the plain "Services
updated." with the congratulations banner: take care of this card, use it well
and build your foundation around it; having more cards doesn't mean better —
each card needs substance; every event the card creates is documented on the
card itself; and "you now have X active cards" — counted from the SAME services
array the page renders (pinned by test), worded truthfully for a draft (never
"0 active cards"). Copy lives in the pure `lib/service-card-congrats.ts`
(8 tests). Edits and other saves keep the plain banner; the claim-driven create
path (which lands on /vendor-dashboard, not Services) is unchanged.

SPEC IMPACT: None
