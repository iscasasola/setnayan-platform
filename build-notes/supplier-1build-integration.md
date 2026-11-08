# Supplier ONE BUILD — integration notes (8 Nov 2026)

Branch `claude/supplier-1build` (worktree `~/Documents/Claude/Projects/wt-integrate`), cut from origin/main. Dummy env
only (`.env.local` never copied or sourced). **No PR opened, nothing merged to main, nothing deployed, no migration applied
anywhere** (PGlite replay only).

## 1 · Merge log (merge commits only, in the ordered sequence)

| # | Branch | Head merged | Merge commit |
|---|---|---|---|
| 1 | `claude/supplier-1build-data` (C2 data) | `19e22b15fb` | `7e60901fd3` |
| 2 | `claude/supplier-1build-forms-data` (C3 data) | `92170c1109` | `3a7e60afa8` |
| 3 | `claude/supplier-1build-foundation` (L1 foundation) | `0d9c7c4217` | `b0e9155018` |
| 4 | `claude/supplier-1build-l1` | `01e32e213b` | `0ba794b129` |
| 5 | `claude/supplier-1build-c1` (Today) | `0c1ab7cd89` | `6c9b5575b6` |
| 6 | `claude/supplier-1build-c2` (Chat / Quotation) | `973c5bfb5d` | `7a0b64e4af` |
| 7 | `claude/supplier-1build-c3` (Forms / Report) | `15677c6e41` | `6e23a0d0db` |
| 8 | `claude/supplier-1build-c4` (Shop / Portfolio) | `9387223124` | `f4752290bd` |
| 9 | `claude/supplier-1build-l2` (Clients) — last, at its latest head | `23d1b72151` | `42fe177d30` |
| 10 | `origin/main` (2 commits: prod schema snapshot) | `1f0772d393` | `eeec67442d` |
| 11 | `claude/supplier-1build-l2` again — L2 finished (coordinator, 8 Nov) | `19a68d9284` | `945425dae8` |

Re-checked before the final push: every lane branch has 0 commits this branch lacks (see §8).

## 2 · Conflicts and how each was resolved (both sides' intent kept)

- `app/vendor-dashboard/the-simpler-today-keeps-every-door.test.ts` — C1's version (the new Today), with "Event Hub" →
  "Hub" to match the base's wording.
- `apps/web/scripts/lint-server-action-budget.mjs` — both comment blocks kept; CEILING re-measured at the end (§5).
- `apps/web/scripts/port-controls.mjs` — HEAD's single `'_pages'` entry (both sides added the same folder).
- `lib/cleanup-delete-scope.ts` — both scopes kept (`venueCheckProbeScope` from main · `vendorFormMediaScope` from C3).
- `lib/menu-settings.ts` — type keeps `'portfolio' | 'client'`; C4's LIVE `portfolio` entry + L1's `client` entry (one each).
- L2 merge, `clients/[eventId]/_pages/{payment,files,forms,report}.tsx` — the owning lanes' bodies (C1 payment, C3
  forms/report, L2 files) over L2's placeholders.
- L2 merge, `_pages/{chat,quotation,hub}.tsx` — C2's bodies (chat, quotation) and L2's hub, all on L2's signature
  `({ ctx }: PickedPageProps)`.
- `today-is-rows.test.ts` (the known C1 × L2 collision) — both kept: C1's assertion that the day answers mount on the
  client (`client-day-answers.tsx`) and not on Today, with L2's half re-aimed at the one mount.
- Generated files in conflict took main's side and were regenerated once at the end (§5).
- L2's final head (merge 11): `customers-roster.tsx` group heading — L2's new class (`sticky z-[3] … uppercase`) with
  L1's bare `var(--sn-pin-h)` (the integration had already dropped L2's `57px` fallback); `the-clients-list-is-v113`
  test 4 follows the same line.

## 3 · Wiring done between lanes

- **C1 → L2**: `ANSWERED_ONLY_ON_TODAY = []`; Today's card rows open `customerCardHref(eventId, tab)` (Hub →
  `customerCardHref(eventId,'hub')`); `vendorAnswerDateChange` + both deletion actions honour `return_to` through
  `dayAnswerBack` (the shipped `lockAnswerReturnTo` allow-list) and revalidate the client page; the four answer forms
  post `return_to`. **Two mounts existed for the same two answers** (L2's `client-desk-answers.tsx`, C1's
  `client-day-answers.tsx`) — C1's kept (spec §9 #2), L2's deleted, `the-two-answers-reach-the-client.test.ts`
  re-aimed (sabotaged once: red).
- **L2 ← L1**: `picked-client-motion.ts` = `RISE_MS` / `RISE_EASE` / `RISE_REDUCED_MS`; overlay `zIndex:
  var(--sn-z-pop)`; Show & sort `z-sn-pop`; group headings `top: var(--sn-pin-h)`; `sn-pin-hair` replaces the cut lines
  (customers pin, client header, calendar strip, shop segments, supplier open row — `no-cut-line…` KNOWN now holds only
  canvas-maker); "Customers" → "Clients" in the pin and back link (`the-tab-is-called-clients` KNOWN now `{}`); main's
  samahan chat bar `z-[25]` → `z-sn-thumb` (the layer guard caught it on the merged tree).
- **L2 ← L1**: the picked client's ⚙ is `MenuSettingsButton menu="client"` (rows unchanged — the shipped auto-agree
  switch); `client` entry flipped `first-row-gear` + live (mounted once).
- **L2 ← C2**: `hostRows(brief.hosts)` through `chatHostsFrom` / `hostFirstName` / `hostInitials`; C2's thread body is
  `_pages/chat.tsx`.
- **L2 ← C1**: the Payment page gets `money` (steps · cleared · pending · ledger · unreadable note) and `asks` from what
  the client page already read.
- **C1 ← C4**: `readTodayPortfolioCount` = `getPortfolioCount` mapped to `{ used, free }` or null (stub gone).
- **C1 / C4 ← L1**: Today in `CollapsingTopStack` (cover + stats); `today-next-events` and Shop analytics carousels
  `dots={false} advanceMs={0}` (`CAROUSEL_STILL` stand-in removed).
- **C2 → C4**: the gift "capped at N%" on Services (`VendorServicesManager` → `AddServiceForm` → `SetnayanGiftField`) and
  in the service wizard reads `getGiftLimitPct`; both files leave `STILL_TYPED_ELSEWHERE`.
- **C4**: auto-reply mounts removed from Shop, Your page and the supplier lab (one home: Clients settings); ONE
  Portfolio menu entry.
- **L1 ← C4**: Shop tour `vendor_shop_v1` = How it is going (`shop-analytics`) · Your badges (`shop-badges`).
  `shop-details` is NOT repeated: the Today journey already lands on it and test 2 of
  `each-supplier-page-has-its-tour` forbids a repeated stop.
- **L1 ← L2**: G8 `the-hub-has-doors-without-a-tab` now requires the client card's Hub page as the second door
  (sabotaged once: red).
- **L1**: Ugat graph title "Today › Who’s here".
- **C4 → website**: `page-parts.tsx` shares through `shareShopLink` (one implementation).
- Labs: `CoordLabBar`'s dead `runsEvents` prop dropped.
- **"The tab says Clients" (spec S2, coordinator's check on L2's side-by-side):** L2's shots were taken on L2's branch
  alone. On this branch the Clients pinned row reads **"Clients · Dates ▾" / "Clients · Events ▾"** (`customers-pin.tsx`
  `buttonText={`Clients · ${CUSTOMER_SEGMENT_LABEL[seg]}`}`, aria `Clients`, label `Clients — show`), done in
  `d5dd5c0b51`. L1's ratchet `the-tab-is-called-clients` DID catch that row — `customers-pin.tsx` was on its KNOWN list
  and left it when fixed (KNOWN is now `{}`), so it was not widened. A scan of `lib/`, `app/_components`, `components/`
  and the labs finds "Customers" only in admin/legal copy (growth stats, data-subject register, export/privacy notes).
  Not checkable from here: a label override in the production nav registry table.
- Ugat: joints **J62** (Shop → its forms → the event's answers), **J63** (Category → suggested forms), **J64** (Shop →
  report → admin inbox), each with claims checked by `ugat-schema-claims`.
- **L2 ← main's modal contract**: the picked-client overlay is `aria-modal`, so it now uses `useModalA11y({ open,
  onClose: close, containerRef: rootRef, lockScroll: false })` instead of its own window Escape listener — the shared
  modal stack, so Esc closes only the topmost layer (a sheet over the client closes first). `lockScroll: false` keeps
  the list underneath scrollable state intact. Caught by `lib/modal-a11y-adoption.test.ts` on the merged tree.
- **L2 ← main's skeleton rule**: the `@client/(..)clients/[eventId]` slot had no loading boundary, so it borrowed
  `vendor-dashboard/loading.tsx` (the supplier-home skeleton with a title bar) over the still-mounted list. It now has
  its own `loading.tsx` that renders null — the list stays put until the client's sheet lands. A hard load keeps
  `clients/loading.tsx`. Caught by `the-skeleton-promises-only-what-the-page-draws` (INHERITS rule).

## 4 · Guards updated honestly on the merged tree

`the-two-answers-reach-the-client` (re-aimed) · `the-date-change-reaches-the-supplier` + `today-is-rows` (return_to) ·
`the-picked-client-opens-over-the-list` + `the-clients-list-is-v113` (tokens) · `the-gift-limit-is-one-setting`
(STILL_TYPED shrinks) · `how-it-is-going-is-a-shop-segment` (Services/Gallery are tabs, reasoned exemption) ·
`each-supplier-page-has-its-tour` + `spotlight-anchors-exist` (Shop tour) · `the-hub-has-doors-without-a-tab` (client
door) · `every-supplier-top-row-is-one-selector` (Clients word) · `the-chats-page-is-full-screen` (Chat fallback is a
link) · `my-shop-doors-keep-every-control` (auto-reply's one home) · `the-chat-card-locks-in-place` (4th
`lockAnswerReturnTo`: `dayAnswerBack`) · `the-four-small-lists-read-to-the-end` (Payment page's note, 3 mounts) ·
`dates-is-one-calendar` T8 (Promote's code moved to `promote-body.tsx`) · `modal-a11y-adoption` (fixed by adopting the hook, not by exempting the shell) · `the-skeleton-promises-only-what-the-page-draws` (fixed by a route-local null loader, not by exempting the slot).

## 5 · Regenerated on the merged tree

`scripts/port-control-baseline.json` · `lib/ugat/screens.generated.json` · `supabase/security/exposure-surface.baseline.txt`
· `lib/admin-map/admin-jobs.generated.ts` · `supabase/migrations.manifest.txt` · `scripts/lint-no-card` baseline ·
`tests/db/user-fk-behaviour.generated.txt` · `lib/ugat/baselines/no-door.baseline.txt` (+2 dev labs) and 8 "fixed"
root-map lines dropped. `ugat:code-map` is local + git-excluded (not regenerated). field-template: exactly at baseline.

**Port "lost a control" — every line checked against a lane's notes:** `/vendor-dashboard` Today's retired parts (C1
notes) · `/vendor-dashboard/clients/[eventId]` FilesTab / RelationshipTabShell / `?tab=payments` (L2) ·
`/vendor-dashboard/customers` CustomersDoorKey (L2) · `/dashboard/[eventId]/guests` TopicHead (L2: moved to
`show-sort-sheet.tsx`) · `/dashboard/[eventId]` Papic* (L1: Papic Today → Memories) · `/vendor-dashboard/shop`
CompletenessRing / HeroCard / ShopDoorSection / ShopSegments (C4) · `/vendor-dashboard/collections` OpenFoldButton /
ShopSegments (C4) · `/vendor-dashboard/moodboard-library` back → `/vendor-dashboard/collections` (L1: lights Portfolio)
· `/vendor-dashboard/website` + `/dev/supplier-lab` AutoReply* (integration: one home, Clients settings) ·
`/vendor-dashboard/shop` "can no longer reach /vendor-dashboard/website" is a scanner limit — the Your page row links
`href={PAGE_HREF}` (a constant). No control was restored: none was lost by accident.

**Exposure baseline (+69 facts), read line by line:** the five forms tables + `chat_message_hearts` (authenticated,
RLS-gated), `platform_settings.gift_limit_pct` (authenticated SELECT), `help_messages.origin_*` (anon = SIU — inherited
from the shipped `help_messages_anyone_insert`; the C3 trigger `help_messages_origin_guard` is the guard, see J64), new
`vendor_questions` columns, and `chat_pair_is_blocked` (SECURITY DEFINER, authenticated).

**Server-action ceiling 1233 → 1237**, measured with the script on origin/main (1233) and on this tree (1237). The four:
`saveGiftLimitPct` (C2), `formsAction` · `submitSupplierReport` · `formSuggestionsAction` (C3) — each imported by its
caller, two of them dispatchers. No fresh `vercel build` route count (the 2026-11-07 build measured 1835 of 2000); the
SUM stays gated by `check-vercel-route-count` on the PR's build.

## 6 · Check results

All measured on this machine, on the merged tree, DUMMY env only (no `.env.local`), heavy work under `heavy-lock.sh`.

| Check | Result |
|---|---|
| `pnpm typecheck` (full, under the lock) | **green** — rc 0, no output |
| **Full unit suite** — `tsx --test "lib/**/*.test.ts" "app/**/*.test.ts"` | **30,982 tests · 30,971 pass · 7 fail · 4 skipped · 0 cancelled** (45 min, load ≈ 8–14) |
| …the 7, each fixed honestly and re-run (7 files + `lib/ugat/*`) | **206 / 206 pass** — list below |
| Ugat DB tests (schema-claims · concept-coverage · both-ends · user-fk-behaviour · user-delete-fk-surface) | **21 / 21 pass** (PGlite replay; no migration applied anywhere) |
| DB files the preflight ran before the box timed it out | 73 files / 598 tests, all pass — the rest of `*.db.test.ts` is left to CI |
| `lint:port-controls` | ✅ 519 routes / 1,627 controls / 8,610 blocks — nothing lost |
| `ugat:screens:check` (ratchet ON, strict) | current; warnings only (§7 #18) |
| `next lint` on every file the fixes touched | no warnings or errors |
| Server-action budget | 1237 = CEILING (§5) |

**The 7 unit reds and their honest fixes** (no guard weakened, no exemption added; each changed guard sabotaged once → red,
restored → green):

1. `the-skeleton-promises-only-what-the-page-draws` (INHERITS) — L2's `@client` slot borrowed the supplier-home skeleton
   → its own null `loading.tsx` (§3).
2. `canvas-field-parity` "same six props" — the wizard gained `giftLimitPct` from the C2→C4 wiring; the expected list is
   now seven with the reason (wizard arm only; the canvas has no gift field, so its drop-in list is unchanged).
3. `couple-face-choice` THE HANDLE — L1 moved the Papic card to Memories; the guard now reads `memories/page.tsx`, where
   `<PapicCameraSettings>` mounts.
4. `forms-send-on-booking-from-every-door` — my J62 `how` text wrote `sendLinkedFormsForBooking (` and the call-site
   regex counted `graph.ts` as a caller. Reworded the Ugat text; the test is untouched.
5. `papic-pool-buyable` — same L1 move: `PAPIC_PAGE` = `memories/page.tsx`, `buy: cardBuy,`, plus a new assertion that the
   page DRAWS the card it built (`<PapicCard key="papic" card={card} />`).
6. `the-badge-has-a-deadline` — C4's `lib/shop-permit-line.ts` reads `verification_state === 'verified'` once, to pick
   the permit line's COPY inside `badgeDeadline`'s "none" branch; no badge renders from it → one reasoned bill line.
7. `the-hub-settings-sheet-holds-the-rest` — L1's "Home → Today (word only)" changed the Hub sheet line to "Today › Event
   settings"; the assertion follows the word.

3, 5 and 7 were L1's moves that its own preflight did not reach; 2, 4 and 6 came from joining lanes.

## 7 · Listed, not done (new product behaviour, an owner call, or Build 2)

1. **Form Maker route** — `ShopMakers formsHref={null}`: no `/vendor-dashboard/forms` page exists (only actions +
   components); a new route is new product behaviour (C3/C4 asked who builds it).
2. **CoupleAnswers drawn on BOTH Forms (C3, "v113") and Details (L2, "v113 `det`")** — the two lanes read v113
   differently; and for a host the Script fold shows the answers too. Owner/controller decides the one place.
3. **Decisions on Details** (L2 question: ~6 more reads, or wait for C2's in-place thread facts).
4. **The picked client's ⚙ rows** — live with its one shipped row (auto-agree); any other row is unruled (L1 question).
5. **Today's pinned row has no ⚙** — the ⚙ stays on the cover only (`the-today-page-speaks-to-every-supplier` allows one).
6. **CollapsingTop on Shop / Portfolio** — C4 ships a working scroll-measured stand-in (`shop-cover.tsx`,
   `portfolio-view.tsx`). Not converted: both move their ONE ⚙ between the cover and the pinned row by React state on
   scroll, and `CollapsingTop` deliberately never re-renders on scroll (attributes only) — converting needs a ruling on
   where the ⚙ lives (cover, row, or both with one mount). Portfolio's Show viewer did move to `z-sn-modal`.
7. **`gallery` still in `SHOP_SEGMENT_ORDER`** (Portfolio is its own tab) — dropping it moves a shipped door.
8. **canvas-maker's cut line** — the one KNOWN left in `no-cut-line-under-a-pinned-row` (a maker surface, not a list).
9. **An answer's outcome flag is not toasted on the client page** (`?tab=details&date_change=…` lands, nothing reads it).
10. **⚠ Money: Booked Loop pays real Event Plus grants** once merged (C4, spec §9 #11) — flagged for review.
11. **Security finding (C2): the shipped `chat_messages_block_guard` is defeated by the caller's RLS** (a couple who
    blocked an unpublished shop can still insert into its thread). Hearts use `chat_pair_is_blocked`; re-pointing the
    chat_messages guard is its own migration + db test.
12. **`lib/gift-pick.ts` and `lib/package-gift.ts` still type "40%"** (client copy consts; still in STILL_TYPED_ELSEWHERE).
    Reading the setting needs a server read threaded into two client makers.
13. **`/dashboard/[eventId]/refer`** — reachable inside Help meanwhile; retire the page? (L1 question).
14. **"Your next move" card** kept on Details (`hidden lg:block`) — owner: keep or retire? (L2 question).
15. **Owner questions from C2**: the card gift pre-filling the quote (unruled money); host names before the fee.
16. **§10 #27–#35 — BUILD 2.** L2 built #26 (in scope). §10 #31 (Shop ⚙ "Your page" first) was built and reverted by
    L1 (`git revert 4f0a72c258` re-applies it). Nothing from #27 on was found built on any lane.
17. `vendor_forms.from_template_key` is written and never read (root-map never-read warning; recorded in J63).
18. Root-map **warnings** (not errors) left as found: wrong-words on the new Shop cover sheet ("Pick from Portfolio" →
    Your page, "Upload" → Portfolio) and on main's front-door data; retarget lines in `calendar/actions.ts` and
    `nav-registry-defaults.ts` (old addresses forwarding to Promote / Your page).

## 8 · Request counts for the changed screens

- **Today** (`/vendor-dashboard`): +2 parallel reads (`vendor_profiles` row + portfolio allowance, via
  `getPortfolioCount`), started beside the renewal read. The collapsing top and carousels add 0.
- **Client card** (`/vendor-dashboard/clients/[eventId]`): Details +2 parallel paged reads for a BOOKED client (Today's
  own `readDateChangeAsks` / `readDeletionRequests`, narrowed to this event); hosts 0 (in the brief); Payment page 0
  (the page's own reads handed in); ⚙ 0.
- **Services** (`/vendor-dashboard/services`): +1 (`platform_settings.gift_limit_pct`, remembered across requests),
  parallel with the list.
- **New service** (`/vendor-dashboard/services/new/[category]`): +1 (same remembered read) only when the wizard renders.
- **Shop / Your page**: −1 mount (auto-reply card's reads leave both).

## 9 · Final head

Code head: **`9ffe418a9b`** (the seven unit-red fixes). This note and `changelog.d/supplier-1build.md` land in the one
commit on top of it; that commit's SHA is the branch head reported with the push (a file cannot name its own commit).
No lane branch or origin/main had moved when this was written (`git rev-list --count HEAD..origin/<each>` = 0 for main
and all ten `supplier-1build*` branches).

## 10 · Build 2 merge (8 Nov)

Base `1af050b236`. Three lanes merged with `--no-ff`, in order: **C** `4b25df09f6` → **B** `047ea2fbbf` → **A**
`607e037fa9`.

### Conflicts
- **Textual: none.** The three lanes touched disjoint files (checked with `git diff --name-only` per lane, outside
  `build-notes/shots`); each merge was clean.
- **Semantic (found by the guards, all from lane A's code, fixed by root cause, no guard weakened, no baseline raised):**
  1. `lint-radius` (strict) — 4 ad-hoc radii: `rounded-[10px]` in `calendar-day-box.tsx`, `calendar.tsx`,
     `customers-calendar.tsx` → `rounded-md` (the `--m-r-sm` token, 8px — nearest step on the scale); the 7px confetti
     piece's `borderRadius: '2px'` → `'28%'` (same ≈2px, relative to its own fixed size; the guard allows %).
     `calendar-day-box.test.ts` pinned the literal `rounded-[10px]`; re-pinned to `rounded-md` (same assertion: a
     rounded box, not a circle).
  2. `lint:no-card` — `locked-qr-generator.tsx` 11 card lines vs 10 allowed: the #34 Quotation was its own bordered box.
     It now sits INSIDE the Services box under a divider (its lines are the picks above, priced) — 10 again.
  3. `lint:field-template` — same file, 8 raw boxes vs 6: the two cells of a quotation line get `// field-ok:` with
     the precedent's reason (`payment-plan-rows.tsx` / `new-manual-vendor-modal.tsx`: a two-cell line a one-line Form row
     cannot draw). Count is exactly the baseline.

### Generated files (regenerated, never hand-merged)
- `scripts/port-control-baseline.json` — the lint first listed exactly the removals lane A's notes call deliberate
  (`/vendor-dashboard/customers`: `<CheckADate>`, `<CustomersDates>` (#43), `/vendor-dashboard/clients/[seg]?tab=details`
  (#38); `/dev/clients-lab`: `?v=pick&page=details`, runs `null`). Regenerated.
- `lib/ugat/screens.generated.json` — regenerated (`ugat:screens`; `check-ugat-screens` green).
- `supabase/migrations.manifest.txt` — +2 rows: `20271327929301` (lane A) **and `20271327631190`**, which was already
  missing on the Build 1 head (chat-block migration from `9c467d0eb9`).
- `supabase/security/exposure-surface.baseline.txt` — **accepted, ruled #34**: `+col vendor_locked_qr_tokens.quote_line_items`
  and `+col …voided_at` (same `anon=SIU authenticated=SIU` as every sibling column; rows still gated by the shop's
  `vendor_locked_qr_vendor_all` RLS) and `+func vendor_void_locked_qr(text) secdef=no exec=authenticated` (invoker
  rights, PUBLIC revoked). No unruled widening.
- `ugat:fields`, `ugat:code-map`, `admin:jobs` — no content change (admin-jobs differed only in its "as of" ref; left as is).

### Budgets
- Server actions: **1237 / 1237** after all three merges — not over; ceiling unchanged (the owner's 8 Nov "Ok to raise
  it" was not needed). #34's delete stays the `void_token` mode of `issueLockedQr`, as built.

### Checks run locally
- Every `node …/lint-*.mjs` step in `ci.yml` green (page-masthead is `continue-on-error` and green from `apps/web`).
- Unit (`tsx --test`): 64 files — every changed/added test plus the guards touching the edited files — 591 tests, 0 fail
  after the re-pin.
- DB: `exposure-freeze`, `ugat-schema-claims`, `ugat-concept-coverage`, `ugat-both-ends`,
  `booked-qr-quote-lines-and-void`, `a-supplier-reads-only-its-own-billing`, `locked-qr-date-precision` — 34/34.
- tsc: not run locally (CI on #7399 is the typecheck). Lane A's one tsc error (`dates-lab.tsx` `openHref`) was fixed on
  its lane and never re-run — CI is its first full run.

### Request counts (from the lanes' measurements)
- **Billing & receipts (C):** couple 3–4 requests in ≤2 round trips, unchanged; supplier +7 reads in ONE `Promise.all`
  beside the purchases read (≈13 requests, 2 round trips, never one per list).
- **Shop (B):** tab load 3; scanner open/close 0; Forms Maker open 1; no added server read on load (the inspiration
  access read moved to Portfolio). **Portfolio (B):** one `Promise.all` wave adds pool bookings (1) → featured stories
  (1, chained), approved looks (1), Papic capture flag (1); album open/close 0.
- **Clients (A):** the list's reads unchanged + the month's 5 reads in parallel + 1 asks-events read (fewer than Events +
  Dates together); Schedule month still 1 request; #27/#28/#29/#36/#37/#38 add 0. **Booked QR (A):** ledger read gains 4
  columns (0 new requests); `?edit=` adds 1 read inside the generator's existing `Promise.all`.
