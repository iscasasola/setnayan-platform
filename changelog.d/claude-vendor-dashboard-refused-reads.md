## 2026-08-18 · fix(vendor-dashboard): a refused read stops reading as "you have none"

31 unbound reads across 16 supplier-facing files. Supabase RESOLVES with
`{ error }` rather than throwing, so a refused read arrived as `data: null`,
`?? []` made it empty, and the screen stated the absence as fact — to a supplier
running their business.

What a person was being told, measured per file:

- **earnings** — ₱0 pending · ₱0 released · ₱0 on hold. Totals are now unset
  (em-dash), never zero, and the page says why.
- **manpower** — the read that decides whether the open-gig query RUNS AT ALL.
  Refused, claimable paid gigs were reported as hosts posting none. Nothing on
  screen looked broken. (Its `vendor` read also bounced them to /verify, i.e.
  "you are not verified", from a query that never answered.)
- **calendar** — a refused settings read made the plan ceiling compute to 0, so
  a paying Pro/Enterprise supplier was told the waitlist "isn't part of your
  current plan. Upgrade" — and their already-picked couples read as 0/N.
- **partnerships** — one read backs all three inboxes: an incoming proposal
  waiting on them vanished, and the propose picker read as an empty
  marketplace. That picker has already shipped permanently empty once (42703).
- **on-the-day** — the venue-day screen: a refused brief made the live headcount
  "0 / 0 attending".
- **production sheet** — a caterer's portion rules, which every ingredient total
  is computed from, read as "No portion rules yet — add your first below".
- **packages · locked-qr · activities · website · services** — their own work
  (packages, issued QRs, programme, connected domains, category requests sent to
  us) read as never made, inviting them to build it a second time.
- **contracts · customers · clients** — label and state swallows: "For Unknown
  event", a lost wedding date that also silently re-sorts the client list, and a
  sent quote reading as "In conversation".
- **shop** — six probe reads whose deliberate pre-migration fallback is KEPT;
  the reason now reaches the logs. The worst asked the supplier again for a
  registration number we are already holding.

Every fallback that was a deliberate trade is unchanged. New guard:
`app/vendor-dashboard/reads-are-honest.test.ts` (3 rules, mutation-checked).
`actions.ts` files are deliberately out of scope — there an absence DENIES,
which is the fix, not the defect.

SPEC IMPACT: None.
