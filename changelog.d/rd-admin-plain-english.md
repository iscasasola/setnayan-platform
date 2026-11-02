## 2026-10-01 · fix(admin): plain English — "supplier" for "vendor", reads that say "couldn't read", no database words on screen (P5b)

P5b of `BUILD_PROMPTS_THU_2026-10-01.md` (source `ADMIN_AUDIT_2026-09-30.md`, rows 10–12, 17–21, 27–30, 32, 36, 42–46).
P5a (#6235; #6238 pending) is not redone.

**Words.** ~480 visible admin strings now say "supplier" (menu labels, Overview tiles, every page, the
nav-registry defaults, the Setup map's table headings, breadcrumbs, `lib/admin/*` row copy). Never an
identifier, route, DB key, log prefix or the legal "Vendor Agreement". Search still finds the page by the old
word (`ADMIN_NAV_ALIASES` keeps "vendor"). "Ugat" no longer shows anywhere a person reads it (the menu and
page titles already read "Set up"; the Interconnections screen was the leak). `lib/ugat/graph.ts` /
`both-ends.ts` prose is NOT swept — it is the Setup map's own content and other prompts own that file.

**Honest reads.** A new shared `ReadFailed` notice (server component, zero client bytes) replaces the empty state
wherever the read was refused: the account card (every read bound; a refused profile is no longer a 404),
Verify (checks skipped on blank shops), Force majeure (evidence signer + change orders), Booking fees
("Status unknown", not "Never billed"; deep link carries the order), Payouts (tiles "—"; supplier box takes a
name), Payment options, Founder seats, Free windows, Papic ladder (editor not mounted → Save cannot write 0/0),
Custom plans (fallback prices named; composer hidden on a refused supplier list), Discount codes (a service the
picker did not return is kept as a ticked row; admin catalogue read no longer hides Live Studio; "Supplier
tokens" label retired), Reviews, Corrections, Concierge abuse, Completions, Chat/Integrity/Repost/User reports/
Live channels (error and empty state no longer render together), Removals history, Data privacy controls +
NPC checklist + data-sheet totals, Demand radar, Songs, Taxonomy, Aliases, Editorial queue, Wedding traditions,
Recaps, Reveal video queue. The Menus read no longer caches a failure as "no renames"
(`lib/nav-registry.ts`: the cached read now throws; `getResolvedNavSlotsMeasured` reports `ok`).
Measured variants share one mechanism with their plain readers (`fetchCustomUnitPricesMeasured`,
`fetchCorrectionRequestsMeasured`, `fetchDataPrivacyControlsMeasured`, `fetchNpcFilingTasksMeasured`,
`fetchSongsAdminMeasured`).

**Developer text.** Raw `error.message` is logged, not printed (ConsoleTable, Live channels, supplier plan,
Verify and Settings redirects; new `lib/admin/plain-refusal.ts`). Gone from screens: table/column names,
migration numbers, file paths, "Hamming distance", "Punch-list item #19e", "PR 1 of 3", `service_role`, the
dead `/admin/operations-hiring/time-log` link, the shell command on Aliases; raw `gcash` / `matched` /
`admin_account_card` / a `'wedding'` fallback now read as words. `/admin/more` search says "Search every admin
page"; Overview tile for the closed payout trail no longer calls it a live schedule.

**Guards** (each sabotage-checked): `app/admin/admin-says-supplier.test.ts` (no visible "vendor" in admin JSX),
`app/admin/admin-reads-say-couldnt-read.test.ts` (render-level pins per fixed row).

**Not done here:** raw `error.message` still rides ~40 other admin `actions.ts` redirects (the five screens the
audit named are fixed); row 30's "which bill is blocking the removal" needs new UI; rows 25/22/31/37 are P5a
part 2 (`rd/admin-do-it-from-admin-2`).

SPEC IMPACT: None.
