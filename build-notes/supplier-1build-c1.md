# Lane C1 — Today + Payment + Files (THE ONE BUILD, 8 Nov 2026)

Cloud lane. Branch `claude/supplier-1build-c1`, cut from `origin/claude/supplier-1build-base`; merged since:
`origin/claude/supplier-1build-base` (moved once) and `origin/claude/supplier-1build-forms-data` (C3). Never merged
another lane's branch. `-foundation` (L1) and `-data` (C2) had not appeared when this was last pushed.

## Done pages (proof: `build-notes/supplier-1build-c1/*.png`, v113 left | build right, 375 px, light, dummy env)

| Page | Proof | Lab |
|---|---|---|
| Today — cover · next events · stats | `today-top-375.png` | `/dev/supplier-lab?easy=two&sup=studio` |
| Today — Needs you today (+ permit row) | `today-needs-375.png` | `?easy=normal&sup=studio` |
| Payment (top) | `payment-375.png` | `?easy=payment` |
| Payment (logged · asks · footer) | `payment-lower-375.png` | `?easy=payment` |
| Files | `files-375.png` | `?easy=files` |

Other lab moments (A14): `?easy=eventday` (photo card says Today + next moment · checked in), `empty`, `unread`,
`setup` (new shop — six steps on top, no cover row, as shipped), `ask`, `locked`, `hallask`, `agreed`, `findlock`.

### What was built (A1–A14, B2 §2.3, §2.4)
- **A1** `lib/supplier-today-greeting.ts` — Manila hour, shop name (`business_name`), "N tasks today" = the Needs list
  length (bills included). `manilaHour` exported from `lib/push-levels.ts`.
- **A2** `today-cover.tsx` (`TodayCover`, `TodayPinnedRow`) — the event Home's cover ground/name reused; ⚙ = the shipped
  `TodaySettings` with the shipped `MenuSettingsButton cover` mode.
- **A3** `lib/supplier-today-next-events.ts` + `today-next-events.tsx` + `readNextEventFacts` (ONE `event_schedule_blocks`
  `.in()` read, ONE `vendor_dayof_configs` `.in()` read, `readEventCover` per card) + `vendor-overview.ts` `nextDay`.
- **A4** `today-stats.tsx` (`TodayStats` full strip + `TodayStatsPinned` for row 2), `vendor-overview.ts`
  `bookedThisMonth` (off the room read, now the DETAILED read so a short read is "couldn't load").
- **A5** `today-counts.tsx` deleted; its guard `the-counts-filter-in-place.test.ts` retired → successor
  `today-stats-each-jump.test.ts`.
- **A6/A7/A10** `TodayNeed` model in `lib/supplier-today.ts` (`todayRowTarget`, `needKindOf`, `TODAY_SHOW_OPTIONS`),
  `view.needs`/`needsCount` in `lib/supplier-today-view.ts`, rows drawn as ONE link each in
  `supplier-today-first-screen.tsx`; `today-thumb-row.tsx` + `lib/today-needs-narrow.ts` (search + Show, in place).
- **A8** `client-day-answers.tsx` (`ClientDayAnswers`) + `lib/client-day-answers.server.ts`; `DateChangeBody` /
  `DeleteRequestBody` exported from `overview-sections.tsx`; card shapes shared via `dateChangeCardOf` /
  `deleteRequestCardOf` (`vendor-overview.ts`). `ANSWERED_ONLY_ON_TODAY = []`.
- **A9** permit row from `badgeDeadline(next_renewal_due_at)` — the column rides the ONE shop-row read; it opens the
  shipped papers page `/vendor-dashboard/profile#docs` (the daily reminder's own link).
- **A11** Today ⚙ contents unchanged; `TodaySettings` gained `cover` only.
- **A12** Events you run · Coming up · Shop row · How is business · inspiration library — unchanged, below Needs you.
- **A13** `vendor_today_v3` (Messages → cover → Next events → stats → Needs you → Show); `lib/supplier-page-tours.ts`.
- **A14** lab moments in `dev/supplier-lab/today-easy-lab.tsx` (mine).
- **#7369 fold** — its three commits cherry-picked (proof PNGs dropped); reds fixed (radius token, two no-card boxes, the
  step-6 test pin); its tour line now "The bar is Today, Clients, Shop and Portfolio."
- **Payment** — `_pages/payment.tsx`, `lib/client-payment-view.ts`, `budget/_components/budget-figures.tsx`
  (`BudgetSummary` now renders `BudgetFigures`; couple behaviour unchanged, budget guards re-pointed).
- **Files** — `_pages/files.tsx`, `_pages/files-finder.tsx`, `lib/shared-files-view.ts`.

### Guards (NEW — each sabotaged once, red seen, restored)
| Guard | Sabotage → red |
|---|---|
| `lib/supplier-today-greeting.test.ts` | `h <= 12` morning · cover fed `numbers.waiting` |
| `lib/supplier-today-next-events.test.ts` | href → `/vendor-dashboard/on-the-day` · refused schedule drawn blank |
| `app/vendor-dashboard/_components/today-rows-jump.test.ts` | `answerDateChange` unhanded in ClientDayAnswers · delete_request → `{to:'today'}` · "Access requests" in Show |
| `app/vendor-dashboard/_components/today-stats-each-jump.test.ts` | null Money drawn ₱0 · Booked → `/vendor-dashboard` |
| `app/vendor-dashboard/_components/today-is-rows.test.ts` (re-aimed) | a row's href → `#whats-new` (4 red) |
| `lib/client-payment-view.test.ts` + `_pages/the-payment-page-reads-like-the-budget.test.ts` | Paid fed `collectPhp` · the Check branch removed |
| `lib/files-folders-are-the-three-sources.test.ts` | `gallery_link → contracts` · date sort ascending |

Re-aimed honestly (no check deleted; a retired premise is replaced by the claim where it lives now): `today-is-rows`,
`empty-today-says-it-once`, `tasks-finish-in-the-row` (anchored on Details), `the-simpler-today-keeps-every-door`,
`the-today-page-speaks-to-every-supplier`, `the-today-pin-never-bleeds-past-its-gutter`, `a-supplier-row-opens-beside-itself`,
`the-upcoming-row-opens-the-customer-card`, `a-count-you-can-tap-goes-somewhere`, `every-supplier-action-is-a-button`,
`every-supplier-top-row-is-one-selector` (+1 reasoned baseline line for Today's greeting row), `the-columns-are-the-system`,
`the-credit-warning-shows-on-today`, `the-supplier-app-lands-where-it-says`, `each-supplier-page-has-its-tour`,
`the-supplier-foundations-hold`, `lib/answers-desk`, `lib/the-chat-card-locks-in-place`, `lib/money-reads-are-honest`,
`lib/first-run-screens-carry-the-brand`, `lib/the-date-change-reaches-the-supplier`, `lib/the-four-small-lists-read-to-the-end`,
`lib/spotlight-anchors-exist`, `lib/every-palette-part-reaches-the-supplier-library`, `pinned-row/a-top-row-folds-on-scroll`,
budget: `the-skeleton-matches-the-page`, `money-wears-the-ledger-face`, `lib/budget-read-is-honest`.

⚠ Trap hit and handled: a bracketed path passed alone to `tsx --test` runs ZERO tests. Every `[eventId]` test here was
re-run through a quoted glob (`"app/dashboard/*/budget/…"`), and two real failures surfaced that way.

## Request counts
- **Today**: −2 rounds vs before (no `readSupplierEventLines`, no `forecastsForBookings` — nothing is answered in place);
  +1 batched round for the next event day (`event_schedule_blocks` `.in()` + `vendor_dayof_configs` `.in()` +
  `readEventCover` and `event_chat_hosts` × the next-day cards, usually 1–2); payday is now read on event days too (the
  Money stat is always on); +1 small read beside the shop row for the permit date (`vendor_profiles_self` — the table
  column is off a session's SELECT allowlist, so it cannot ride the shop-row read).
- **Payment**: 0 reads of its own (everything is handed in by the client page) — until L2 passes `money`, the shipped node.
- **Files**: 0 reads of its own (`buildSharedFiles` rows handed in).

## NEEDS FROM OTHER LANES
- **L2 (Clients — `clients/[eventId]/page.tsx` + `_pages/switch.tsx`)**
  1. Mount `<ClientDayAnswers eventId={eventId} vendorProfileId={…} coupleName={…} eventDate={…} />`
     (`app/vendor-dashboard/_components/client-day-answers.tsx`) in Details — it holds BOTH answers, their actions,
     the Undo holder and its own read; draws nothing when none is open. Then add to a Details guard:
     `assert.match(code('app/vendor-dashboard/clients/[eventId]/_pages/details.tsx'), /<ClientDayAnswers\b/)`.
  2. In `pickedPageBodies`, hand Payment its inputs (all already read by the page):
     `money={{ steps, clearedAt: planStepRows?.clearedAt ?? null, pending: pendingPayments, ledgerMoney, ledgerUnreadable, unreadableNote: <LedgerUnreadableNote /> }}`
     and `asks={askPanel}` (the shipped `PaymentAsksPanel` node). Until then Payment draws the shipped node.
  3. Integration: `_pages/payment.tsx` and `_pages/files.tsx` exist on both branches — **take C1's** (same exported names
     and props as L2's stubs; `ReservationLine` kept; `FilesPage` props identical). `_pages/context.ts` on this branch is
     byte-identical to L2's (merges clean).
  4. `the-customer-page-shows-money-received.test.ts` / `lib/chat-files-appear-in-the-files-tab.test.ts` read
     `clients/[eventId]/page.tsx`; point them at `_pages/payment.tsx` / `_pages/files.tsx` when FilesTab/money leave it.
  5. `customerCardHref(id, 'hub')` exists on L2's branch — swap `clientHubHref` in `lib/supplier-today-next-events.ts`
     for it at integration (same URL).
- **L1 (Foundation / shell)**
  1. Today's top on `CollapsingTop`: `cover={<TodayCover …/>}`, `row={<TodayPinnedRow …/>}` + the same `<TodaySettings />`
     (drop `cover` mode once it rides row 1), `second={{ full: <TodayStats/>, pinned: <TodayStatsPinned/> }}` — all in
     `today-cover.tsx` / `today-stats.tsx`. Until `-foundation` lands the cover scrolls with the page.
  2. `SnapCarousel` `dots={false}` on `today-next-events.tsx` once the prop exists (spec §9 #4).
  3. Files of L1's I had to touch (please keep at integration): `lib/tours.ts` (+`vendor_today_v3`; the app-wide supplier
     tour's two Today stops re-pointed; v2's retired "Three numbers" stop removed; #7369's `vendor_setup_tour_v1` and its
     bar sentence), `app/dev/supplier-lab/page.tsx` (#7369's lab wiring + `SupplierTodayScreen` props), `page-lab.tsx`
     (#7369). `lib/help.ts:375` and `vendor_today_v1`'s slide still say "Today, Customers, Shop and Hub" — L1's wording sweep.
- **C2 (Data)** — ✅ DONE on this branch after merging `-data`: "N hosts in chat" = `event_chat_hosts(event)` length, one
  service-role rpc per next-day card in `readNextEventFacts`; a refused call is no chip.
- **C3 (Forms) / base — reds INHERITED on this branch, measured identical on a clean worktree of `-forms-data`**:
  `lib/numbers-carry-commas.test.ts` (`lib/vendor-forms.ts:221` `items.length`), `lib/export-coverage-guardrail.test.ts`
  (vendor_profiles find_lock_* columns), `lib/shop-name-hold.test.ts`, `tests/db/exposure-freeze`, `gates-have-handles`,
  `ugat-concept-coverage`, `user-fk-behaviour`, and in `tests/db/ugat-both-ends` the forms tables with no writer yet
  (`vendor_forms`, `vendor_form_service_links`, `event_form_sends`, `form_templates`, `category_form_suggestions`), the
  `supplier_report` notice with no emitter, and `shop_name_is_held` with no caller. None is C1's to change.
- **C2 (Data) — inherited with `-data`**: `lib/erasure/coverage-guardrail.test.ts` (`chat_message_hearts` has no erasure
  decision — PURGED / DELIBERATE_EXCLUSIONS / KNOWN_GAPS) and `tests/db/ugat-both-ends` (`chat_message_hearts` has no
  writer yet — the heart tap is C2's chat work).
- **C4 (Shop/Portfolio)** — swap `getPortfolioCountStub` (`lib/supplier-today-portfolio.ts`) for
  `getPortfolioCount(vendorProfileId, supabase)` mapped `ok ? { used: photos, free } : null` once `lib/portfolio-count.ts`
  is on the integrated tree. Until then the Portfolio stat draws no figure ("your photos").
- **L2** also: `scripts/port-controls.mjs` now walks `_pages` (C1 added the one line — L2 needs the same; identical text).
- **Controller (generated files, never hand-edited here)**: `scripts/port-control-baseline.json` — the port lint lists
  exactly Today's retired parts (`<NextCard>`, `<TodayCounts>`, `<TodayFigure>`, `<TodayFilter>`, `<WhatsNewFeed>`,
  `<OpenedRow>`, `<SupplierOpenScope>`, `<ListDoor>`, `<MiniTour>`, `<Figure>`, `<Count>`, and the `?lane=waiting` list
  door — Inquiries/Booked/Money now jump to Clients); regenerate with `pnpm -C apps/web port:baseline`. `lib/ugat/screens.generated.json` (stale since the #7369 fold
  + new Today parts — `pnpm -C apps/web ugat:screens`), `scripts/port-control-baseline.json` (Today's in-place answer
  forms left Today — each still has a home: thread / client page / Details / website reviews), design/no-card baselines
  if they move. Corpus DECISION_LOG rows (c) and (d) — see the changelog fragment.

## Open questions / decisions taken (recorded, not asked — each follows a written ruling)
- Booked "this month" = events DATED this Manila month (owner Q2 default). Portfolio stat = "N of 50 · free photos"
  (Q3 default; figure waits on C4). Next-event photo = the live Hub hero, initials when none (Q4). Next card retired (Q5).
  Sections with no ruled place kept below Needs you (Q6). No "Access requests" row (Q7). Event-day chips (Q8). Tour v3 (Q10).
- The "programme time" on the next-event card is the day's first timed chapter (label + time) — the only programme
  fact in the shipped schedule; a pool booking (no `event_vendors` row) shows no call time rather than a guessed one.
- Next-event chips keep the shipped Badge tones by state (Hub ready / Balance paid = ok green; due / not set up = wait),
  where v113 draws all chips beige — the app's Badge rule wins (spec: "where the prototype and the app disagree… the app wins").
- The date-change / delete-request answers still redirect to Today with their outcome toast (the shipped actions'
  `redirect('/vendor-dashboard?…')`). A `return_to` back to Details would be a change to `clients/[eventId]/actions.ts`
  (owned by nobody in §3.2) — left for the controller/L2 to decide.
- Payment's thumb "Ask for payment" jumps to the shipped asks panel on the page (`#payment-asks`) rather than a sheet:
  the panel is a server form handed in by L2's page.
- The cover's ⚙ uses `MenuSettingsButton cover` (the Home cover's own mode) until it rides the pinned row.

## Where I stopped
(see the bottom-most entry)

### 2026-11-08 · checkpoint
- DONE: Today A1–A14, #7369 fold, Payment, Files, guards (sabotaged), lab moments, side-by-side proofs at 375.
- NEXT: full `node scripts/preflight.mjs --base origin/claude/supplier-1build-base` (whole-tree + DB) → fix any red →
  push; then merge `-foundation` / `-data` the moment they appear and wire `CollapsingTop`, `dots={false}`, `hosts`.
- WAITS ON: L1 `-foundation` (collapse + carousel dots), C2 `-data` (hosts), C4 `getPortfolioCount`, L2 mounts + `money`.

### 2026-11-08 · final full preflight (second run, after merging `-data`)
- PASS: 42 CI guards · eslint (90 files) · tsc (97 changed + 40 importers) · 278 woken unit files · 574 whole-tree
  guard files · migration-replay unit tests · 48 DB source/schema files.
- FAIL, not C1's to fix (each listed above with its owner): port baseline + screens map (generated — controller),
  `export-coverage-guardrail`, `numbers-carry-commas`, `shop-name-hold`, `exposure-freeze`, `gates-have-handles`,
  `ugat-concept-coverage`, `user-fk-behaviour`, `ugat-both-ends` (forms/report/shop-name — C3/base) and
  `erasure/coverage-guardrail` + the hearts writer (C2).
- NEXT for whoever continues C1: merge `-foundation` when it appears → mount Today's top on `CollapsingTop`
  (`TodayCover` / `TodayPinnedRow` / `TodayStats` / `TodayStatsPinned`), `dots={false}` on `today-next-events.tsx`;
  swap `getPortfolioCountStub` for C4's `getPortfolioCount` at integration; re-shoot the 375 proofs.
