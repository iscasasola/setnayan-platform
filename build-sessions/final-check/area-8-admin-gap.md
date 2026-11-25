# Area 8 · Admin against the approved drawing (Add 9)

Report only, 25 Nov 2026 (checker 8, SOURCE: CODE + corpus; the browser walk confirms or strikes rows in `area-8.md`). Nothing was edited. Code read: `apps/web` on branch `final-check/area-8` (same app code as
`main`). Drawing read: specs corpus `prototypes/admin_pub/` (approved 13 Nov), `prototypes/admin_five_tabs_2026-11-13/`
(BUILDER-NOTES, SOLO-OPERATOR-AUDIT, inventory), `prototypes/admin_reorg_2026-11-16/` (the 17 Nov reorganisation, v7,
"Yes, all 5" twice; `merges.py` `MERGED` is its final page list) and the DECISION_LOG rows "ADMIN DRAWING APPROVED —
BUILD IT" (13 Nov), "ADMIN FOCUS | FULL — APPROVED (v6)" and "THE SIX CALLS ANSWERED" (14 Nov), "ADMIN REORGANIZATION
(P3 …)" and "ADMIN FOCUS PILES OPENED" (17 Nov), "ADMIN CLEAN PORT" (19 Nov).
Not read: `app/admin/secrets/` (this session may not read it).

## Summary

**The approved shape is mostly built.** `lib/admin/admin-pages.ts` (`ADMIN_MERGED_PAGES`) encodes the 17 Nov `merges.py`
table row for row. It has the same 18 pages: Focus; Work (Queue, Messages); Money (To approve, Records, Prices, Offers &
gifts); People (Look up, Papers, Ties); Catalogue (Services, Studio, How the app finds things); Insights; and Setup (Team,
Switches & delivery, Business keys & privacy, Help).

These parts of the shell all read that one file:
- the phone bar (`AdminBottomNav`);
- the desktop rail (`AdminRailContext`);
- the pinned `Page · View ▾` row (`AdminPinnedRow`);
- the avatar's Setup rows (`avatarRows`);
- the tab landings (`TabLanding`);
- the 48 old-address forwards (`adminMergedForward` in `middleware.ts`).

The Focus | Full switch is built (`AdminModeToggle`, opens in Focus).

**The phase-A claim is partly out of date.** It said "admin nav uses the older groups Today · People & shops · Studio ·
Root map · Numbers · Money". The six groups still exist in `ADMIN_NAV_GROUPS` (`admin-nav-groups.tsx`), but they no
longer draw the bar, the rail or the pinned row. They still feed these parts:
- the ⌘K / search-box results: group headers and item labels, through `buildDestinations` in `admin-destinations.ts`;
- the menu-name registry (`admin.sidebar.*` slots in `lib/nav-registry-defaults.ts`, edited at Menus & icons);
- `lib/admin/what-you-change.ts`;
- the dead "All surfaces" grid at `/admin/more`, which the middleware now forwards away.

**So the console speaks two vocabularies at once, and that is the main source of "the pages are so confusing".**
1. The bar and dropdown say one name ("Money · Prices ▾", "People · Look up ▾").
2. The mounted old page's own masthead and browser title say another ("Pricing & Catalog", "People & shops", "Verification
   queue", "Root map").
3. The search panel groups results under the six retired group names.

Two pages (Studio and How the app finds things) also still draw their own second in-page menu, which disagrees with the
dropdown.

**Counts of approved items** (sections 1–2; one row = one item; exact tallies in §5):

| Verdict | Count |
|---|---|
| built | 121 |
| partly | 15 |
| missing | 14 |
| lives somewhere else | 7 |
| not verified (could not confirm from code) | 5 |
| **Total** | **162** |

Of the shipped addresses, 71 pages and 36 forwards were checked (section 3):
- every one has a home in the approved shape;
- 2 have a home that differs from the drawing: `/admin/help/guides` and `/admin/ugat`;
- 3 keep their own address while the drawing makes them views: `/admin/verify`, `/admin/verification-docs` and
  `/admin/budget-planner`.

Approved items with no home in the 17 Nov shape: 5 "Design kit" items (NEW in the 13 Nov drawing; the reorganisation
dropped them).

---

## 1 · Shell

| # | Approved (drawing file · anchor) | Ships (code file · symbol) | Verdict | Delta |
|---|---|---|---|---|
| S1 | Five tabs on the phone bar, "Five tabs, no More" (`admin_five_tabs_2026-11-13/BUILDER-NOTES.md` "Five tabs, no More"; `admin_pub/admin.js` `ADMIN.TABS`) | `app/admin/_components/admin-bottom-nav.tsx` `ADMIN_BOTTOM_NAV_ITEMS` ← `lib/admin/admin-pages.ts` `ADMIN_BAR_TABS` | built | Drawn only in Full (`mode === 'full'` in `app/admin/layout.tsx`), as approved: Focus has no bottom nav. |
| S2 | Work badge honest, "—" on a failed count (BUILDER-NOTES "T28/T29 honest states") | `admin-bottom-nav.tsx` `workBadge` | built | None. |
| S3 | Desktop rail = the five tabs; only the open tab expands its pages (reorg README "the desktop rail expands only the open tab's groups", call 5) | `app/admin/_components/admin-rail-context.tsx` `ADMIN_BAR_TABS.map` + `pagesIn(tab.key)` under `active` | built | Rail heading "Setnayan HQ · the console" plus a "My Home" row (`AppRailShell` `focus` prop). These are not in the drawing but match the shared shell. |
| S4 | Top-bar Focus \| Full toggle; icons only on a phone; opens in Focus (DECISION_LOG "ADMIN FOCUS \| FULL — APPROVED (v6)" (1)) | `app/admin/_components/admin-mode-toggle.tsx` `HALVES`; `lib/admin/admin-mode.ts` `readAdminMode` | built | None. |
| S5 | Focus = "N things need you", Reply · Fix · Refresh, ask box at the thumb on a phone and at the top on a computer (v6 (2)) | `app/admin/_components/focus-home.tsx` `FocusHome`, `AdminAskPill place="top"` / `place="thumb"` | built | One list by urgency with ↩ / ! marks, per the later 19 Nov ruling ("TODAY CARDS CHANGE COLOUR BY URGENCY … APPLY TO THE ADMIN'S FOCUS TOO"). |
| S6 | Focus pins a money & papers strip first: Payments to confirm · Refunds · Payouts · Papers to check; a pile at 0 hides its chip (DECISION_LOG "ADMIN REORGANIZATION (P3 …)" (4); `admin_reorg_2026-11-16/piles.py`) | `focus-home.tsx` `orderFocusRows` (urgency only); `focus-received.tsx` `FocusReceived` ("From your BDO" piles) | partly | There is no pinned four-chip strip. Money and paper items sit in the one urgency list, and the BDO piles are their own block. A 19 Nov owner ruling may have replaced the strip; no row says so. **Owner call.** |
| S7 | Pinned row `Page · View ▾` on every page, one selector (BUILDER-NOTES "T2 pinned row", "The one selector") | `app/admin/_components/admin-tab-rows.tsx` `AdminPinnedRow` (mounted in `layout.tsx`) | built | None. |
| S8 | No chip strip, no second selector (BUILDER-NOTES "Never a chip strip"; DECISION_LOG "ADMIN CLEAN PORT" (3) "tab pills move into the pinned-row dropdown") | `app/admin/studio/page.tsx` `aria-label="Studio sections"` `RAIL`; `app/admin/ugat/page.tsx` `aria-label="Root map sections"` `TAB_STRIP` | partly | Studio and How the app finds things still draw their own in-page menus under the dropdown. Studio's lists 10 items with old names ("Moodboard library") and omits Front-door videos, Website media and Hub music. The Root map strip omits Search settings. |
| S9 | Each tab's ⚙ at the right of the pinned row opens that tab's settings sheet (BUILDER-NOTES "The ⚙ is at the right end"; `admin_pub/*.html` `P('work-gear'`, `P('money-gear'`, `P('people-gear'`, `P('catalogue-gear'`, `P('insights-gear'`) | `admin-pages.ts` `ADMIN_BAR_TABS` `settings:` (only `key === 'catalogue'` → "Export categories (CSV)") | partly | Only Catalogue has a ⚙. Work, People and Insights have none. Where their settings went is in section 2. |
| S10 | Thumb row: glass search plus one ＋ where the page creates (BUILDER-NOTES "T6 thumb row") | `admin-tab-rows.tsx` `AdminThumbRow`; `BAR.people.create` "Add a venue", `BAR.catalogue.create` "New category" | built | Phone and Full only. |
| S11 | Avatar = admin-of-admin (`admin_pub/work.html` `P('avatar'` "Running admin"; reorg `merges.py` `("setup", …)`) | `layout.tsx` `avatarRows` ← `ADMIN_SETUP_PAGES` → `AccountSwitcher adminRows` | built | Rows: Team · Switches & delivery · Business, keys & privacy · Help. |
| S12 | Setup is owner-only (DECISION_LOG "THE SIX CALLS ANSWERED" (f) "setup stays owner-only") | `avatarRows` (no owner check); `app/admin/switches/page.tsx` and `app/admin/business/page.tsx` `requireAdmin()` | partly | Every admin sees the Setup rows, and the pages check admin only, not owner. |
| S13 | One plain-words search; results jump to the right tab with View ▾ preset (`admin_pub/work.html` `P('search'` "plain-words search only, no chat AI") | `admin-search-box.tsx` `AdminSearchBox`, `admin-command-palette.tsx` `AdminCommandPalette`, `admin-ask-pill.tsx`, `AdminThumbRow` | partly | One panel with four doors. Results are grouped under the RETIRED `ADMIN_NAV_GROUPS` labels with old item names ("Users", "Pricing", "Entity map", "Search memory", "Settings"). Its own header says it "asks a model for phrasings", but owner call (b), plain words or AI, is still open. |
| S14 | "What can I ask?" = the ? in the ask box, with Download (A4) inside; also in the avatar (v6 (3)) | `app/admin/ask/page.tsx`; Setup › Help | built | None. |
| S15 | Each tab landing is a dashboard: a head card with 2–4 numbers, group cards with live counts, empty greyed (reorg README "the five tab dashboards (v5)"; `landings.py`) | `app/admin/_components/tab-landing.tsx` `TabLanding`, used by `work`, `money`, `directory`, `catalogue`, `app-performance` | built | Insights' head card has "Problems, last 24 h" as drawn. |
| S16 | Old addresses open the merged page with the view preselected (`merges.py` docstring "every old address redirects to the merged page with its view preselected") | `middleware.ts` → `admin-pages.ts` `adminMergedForward`, `ADMIN_MERGED_FORWARDS` (48 old paths) | built | It returns 307, not 308 (on purpose). Four kit forwards land elsewhere (phase-A L-9). |
| S17 | One name per place (BUILDER-NOTES "Words") | `ADMIN_NAV_GROUPS` labels; old pages' `metadata.title` and `PageMasthead`, read by `merged-view.ts` `viewTitle` | partly | Below the bar sits the old page's own masthead and browser title, which use a different name. See section 4. |
| S18 | Approvals: owner's own two-admin actions typed + 24 h (DECISION_LOG "THE OWNER APPROVES HIS OWN TWO-ADMIN ACTIONS") | `lib/admin/self-approval.ts` `typedWordMatches` | built | None. |
| S19 | Team areas × Basic/Escalated, who-did-it (DECISION_LOG "ADMIN TEAM: AREAS × LEVELS") | `app/admin/team/page.tsx`, `app/admin/admin-log/page.tsx`, `lib/admin/areas.ts` | built | Phase-A L-8: the Catalogue Escalated level is not enforced. |
| S20 | Dark pairing for every screen | admin is not on the dark ready-list (phase-A L-3) | missing | The console stays light in dark mode. |

## 2 · Per tab

### 2.1 Work

The approved page is `merges.py` `("work", "Queue", "/admin/work", "Kind ▾", …)` and `("work", "Messages", …)`. The
shipped page is `admin-pages.ts` `key: 'queue'` / `key: 'messages'`. Every Queue view mounts its old page body
(`app/admin/work/page.tsx` `mountView`).

| Approved item | Ships | Verdict | Delta |
|---|---|---|---|
| Queue · All (`/admin/work`, `/admin/queues`, `/admin/more`) | `/admin/work?view=all`; `/admin` in Full | built | `/admin/more`'s old "All surfaces" grid is unreachable now (the address forwards). |
| Kind groups: Requests to decide · Reports & safety · Reviews & writing · Removals | `kindGroup` on each view | built | Replaces the 13 Nov "By job" grouping (`work.html` `{grp:'By job'}`), as the reorg drew. |
| Approvals | `?view=approvals` | built | — |
| Completions | `?view=completions` | built | — |
| Pax changes | `?view=pax-changes` | built | "Pax" is jargon (§4). |
| Profile corrections | `?view=corrections` | built | — |
| Force majeure (+ open one `/[flagId]`) | `?view=force-majeure` | built | — |
| Music Maker | `?view=music-maker` | built | The masthead reads "Music Maker queue". |
| User reports | `?view=user-reports` | built | — |
| Disputes | `?view=disputes` | built | — |
| Fraud | `?view=fraud` | built | The masthead and title read "Fraud queue". |
| Chat flags | `?view=chat-flags` | built | The masthead reads "Chat contact flags". |
| Repost watch | `?view=repost` | built | Jargon (§4). |
| Integrity watch | `?view=integrity` | built | Jargon (§4). |
| AI abuse | `?view=ai-abuse` | built | The title reads "Setnayan AI enforcement". |
| Review appeals | `?view=reviews` | built | The masthead reads "Review moderation". |
| Editorial (+ open one) | `?view=editorial` | built | — |
| Account deletions | `?view=account-deletions` | built | — |
| Event removals | `?view=event-removals` | built | — |
| Messages · Help messages | `/admin/help` | built | — |
| Messages · Demo-shop inquiries (+ open one) | `/admin/help?view=demo-inquiries` | built | — |
| "Approve all N green" batch (DECISION_LOG "ADMIN DRAWING APPROVED" "Approve all N green") | `app/admin/queues/_components/green-batch.tsx`, `lib/admin/green-payments.ts` | built | Built for payments. Not confirmed for papers. |
| AI draft first on every row (`work.html` `aiDraft(` "✦ AI drafted"; DECISION_LOG "AI DRAFTS, THE OWNER APPROVES") | drafts only in service requests and the social queue (`categories/_components/request-controls.tsx`, `social-queue/actions.ts`) | partly | No "✦ AI drafted · Edit · Use" on queue rows or cases. |
| Escalate ▸ on rows and cases (`work.html` `escLine(`) | `reviews/actions.ts`, `user-reports/actions.ts`, `team/page.tsx` | built | Not every queue was checked. |
| ⚙ Alerts to my phone (`P('work-gear'` `fr('Alerts to my phone'`) | not found in `app/admin` | missing | — |
| ⚙ Morning digest + Digest time | `app/admin/switches/page.tsx` `title="Morning digest"` (`settings/_components/morning-digest-card.tsx`) | lives somewhere else | It sits in Setup › Switches & delivery, so a non-owner looks in Work and does not find it. |
| ⚙ Today's events in Work (`fr('Today’s events in Work'`; view `work-today`) | not found | missing | — |
| ⚙ Problems in Work (`work-problems` view) | Problems lives in Insights; the `problems` queue feeds the Work badge (`admin-pages.ts` `queue: 'problems'`) | partly | There is no Work › Problems view. |
| ⚙ AI suggestions in rows (switch) | not found | missing | It follows the missing AI drafts. |
| ⚙ Email delivery row | `app/admin/_email-delivery-strip.tsx` at the head of the Work list; Setup › Email delivery | built | — |

### 2.2 Money

| Approved item | Ships | Verdict | Delta |
|---|---|---|---|
| To approve · Payments to confirm | `/admin/payments` | built | The title reads "Payments". |
| To approve · Refunds | `/admin/payments?view=refunds` | built | — |
| To approve · Payouts | `?view=payouts` | built | The title reads "Supplier payouts". |
| To approve · Fees owed | `?view=fees` | built | The title reads "Booking fees". |
| To approve · Payment options | `?view=payment-options` | built | Sounds like Setup's "Receiving accounts" (§4). |
| To approve · Subscriptions | `?view=subscriptions` | built | — |
| Records · Everything | `/admin/money?view=everything` (also the Money landing) | built | — |
| Records · Receipts | `?view=receipts` | built | The masthead reads "Transaction receipts". |
| Prices · Prices | `/admin/pricing` | built | The masthead reads "Pricing & Catalog". `waitsOn` #8018/#7874. |
| Prices · AI prices | `?tab=setnayan-ai` | built | — |
| Prices · Papic shots | `?tab=papic-shots` | built | The masthead reads "Papic credit prices". |
| Prices · Bands | `?tab=price-bands` | built | — |
| Prices · Free windows | `?tab=free-windows` | built | — |
| Prices · Plan contents (DECISION_LOG "ADMIN GAINS … EDITABLE PLAN CONTENTS") | `?tab=plan-contents` | built | Added to the dropdown 19 Nov. |
| Offers & gifts · Launch offer | `/admin/offers` | built | — |
| Offers & gifts · Discount codes (+ new / edit) | `?view=discount-codes` | built | `/new` is a full-screen popup (phase-A A-29). |
| Offers & gifts · Referrals | `?view=referrals` | built | — |
| Offers & gifts · Gifts & comps | `?view=gifts` | built | The title reads "Gifts". |
| Offers & gifts · Founder seats | `?view=founder-seats` | built | — |
| Offers & gifts · Badges & seals (Spotlight Awards folded in) | `?view=badges` | built | — |
| Payment card: each read field "Matches ✓" / "Doesn't match" (reorg README "Payments to confirm"; DECISION_LOG "PAYMENTS: THE ADMIN VERIFIES THE MATCH") | `lib/admin/receipt-match-lines.ts`, `payments/_components/desk.tsx` | built | — |
| "Nothing auto-confirms" | `layout.tsx` `maybeReleaseReceivedHolds(approvePaymentCore)` ("Hold 30 min, then pay", owner 17 Nov) | partly | A later owner ruling lets a BDO match approve itself after a 30-minute hold. That differs from the reorg README line. |
| Refund card: send to the account on the payer's slip; screenshot proof (DECISION_LOG "ADMIN FOCUS PILES OPENED" (6)(7)) | `payments/supplier-refunds/supplier-refunds-view.tsx` "Photo attached" / "Proof attached" (`proof_url` and `proof_r2_key` both read) | partly | Both a link column and a photo column are still read. The slip account was not found. |
| Refund two-admin rule (DECISION_LOG "THE … TWO-ADMIN RULE STAYS") | `REFUND_TWO_ADMIN_THRESHOLD_PHP` (`lib/two-admin-promise`) | built | — |
| Payout card: Mark paid with proof (call 9) | `app/admin/payouts/page.tsx` "Mark paid" | not verified | Whether proof is required on Mark paid was not confirmed. |
| Old Money ⚙ · Receiving accounts | Setup › Business, keys & privacy › Receiving accounts | lives somewhere else | As the reorg approved (owner call 11). |
| Old Money ⚙ · Booking-fee rule, Sign-up discount | expected in Prices (DECISION_LOG "ADMIN CLEAN PORT" (3) "sign-up discount becomes one row") | not verified | The row inside `pricing/_surfaces/pricing-surface.tsx` was not confirmed. |
| Old Money ⚙ · Bookings Open switch (`fr('Bookings','Open'`) | not found by name | not verified | — |

### 2.3 People

| Approved item | Ships | Verdict | Delta |
|---|---|---|---|
| People landing: everyone listed, Show & sort beside search (`people.py`; owner 17 Nov in `directory/page.tsx` header) | `/admin/directory` `PeopleShowSort`, `TabLanding` | built | The Show choice says "Suppliers", but Look up says "Shops". |
| Look up · Everyone | `/admin/accounts` | built | The title reads "People & shops". |
| Look up · People (+ one person, Suspend/Unsuspend) | `?tab=users`; `users/[userId]/_components/account-hold-section.tsx` | built | — |
| Look up · Shops (+ shop, edit, plan, team) | `?tab=vendors` | built | Here a supplier is called a "Shop"; elsewhere "Supplier". |
| Look up · Events (+ one event) | `?tab=events` | built | — |
| Look up · Venues (+ one, ＋ Add a venue) | `?tab=venues`; `/admin/venues/new` | built | `/new` is a full-screen popup (phase-A D-30). |
| Look up · Demo shops | `?tab=demo-vendors` | built | — |
| Papers · Three papers (shops) | `/admin/verify` (own address) | partly | It is not merged: the dropdown links to the old page (`waitsOn` #7875 #7793 #7890). The title reads "Verification queue". |
| Papers · ID documents | `/admin/verification-docs` (own address) | partly | Same delta. The masthead reads "Supplier verification documents". |
| Ties · Partnerships | `/admin/vendor-partnerships` | built | The title reads "Supplier partnerships". |
| Ties · Recommendations | `?view=recommendations` | built | — |
| Address search, records only (call d) | not found in `lib/admin-map/focus-search.ts` | missing | — |
| AI paper check green / amber / red (DECISION_LOG "ADMIN DRAWING APPROVED") | not confirmed on `/admin/verify` | not verified | — |
| ⚙ Verification rules (`P('people-gear'` "automatic checks · document slots · one free first booking per business") | `verify/_components/free-booking-match-note.tsx` (a note only) | partly | No settings place for the automatic checks or document slots. |
| ⚙ Demo suppliers | Look up · Demo shops | built | — |
| ⚙ Demo mode | Setup › Switches · Demo mode | lives somewhere else | The reorg moved it, which reverses the 13 Nov pick (3) "Demo mode lives under People ⚙". |
| ⚙ Badge rewards table | Money › Offers & gifts › Badges & seals | lives somewhere else | As the reorg approved. |

### 2.4 Catalogue

| Approved item | Ships | Verdict | Delta |
|---|---|---|---|
| Catalogue landing | `/admin/catalogue` `TabLanding` | built | — |
| Services · Categories | `/admin/categories` | built | The title reads "Categories & event types". |
| Services · Event types | `?list=event-types` | built | — |
| Services · Religions | `?list=religions` | built | — |
| Services · Hub tools | `?list=hub-tools` | built | — |
| Services · Requests (+ one) | `/admin/categories/requests` | built | — |
| Services · Budget benchmarks | `/admin/budget-planner` (own address, `waitsOn` #7874) | partly | Not merged. The title reads "Budget planner". |
| ⚙ Export categories (CSV) | `ADMIN_BAR_TABS` `settings` → `/admin/categories/export` | built | The drawing also had a printable tree (PDF); not found. |
| Studio · Website | `/admin/studio?tab=website` | built | "Website" breaks the word rule (should be Event Hub) (§4). |
| Studio · Reveal Studio | `?tab=reveal-studio` | built | — |
| Studio · Patiktok | `?tab=patiktok` | built | — |
| Studio · Inspiration | `?tab=moodboard-library` | built | The in-page menu and masthead read "Moodboard library". |
| Studio · Front-door videos | `?tab=background-videos` | built | The masthead reads "Homepage background videos". Missing from the in-page menu. |
| Studio · Website media | `?tab=website-media` | built | Missing from the in-page menu. |
| Studio · Hub music | `?tab=hub-music` | built | Missing from the in-page menu. The masthead reads "Event Hub music". |
| Studio · Songs | `?tab=songs` | built | The masthead reads "Master song catalogue". |
| Studio · Real Stories (retired) | `?tab=real-stories` | built | The in-page menu does not say retired. |
| Studio · Storytellers | `?tab=storytellers` | built | — |
| Studio · Recaps | `?tab=recaps` | built | — |
| Studio · Journal Spotlights | `?tab=journal-spotlights` | built | "Journal" breaks the word rule (Articles). |
| Studio · Social queue | `?tab=social-queue` | built | — |
| How the app finds things · Root map (`/admin/ugat`) | `/admin/ugat` opens Menus & icons | partly | The "Root map" view no longer exists as a view, but every page here is still titled "… · Root map · Admin" (`ugat/page.tsx` `generateMetadata`). |
| How the app finds things · Screens map | `/admin/ugat?tab=screens` and `/admin/ugat/map` | built | These are two different screens under one name: "Root map · Screens" and "Entity map" (§4). |
| How the app finds things · Onboarding questions | `?tab=onboarding` | built | The in-page menu reads "Onboarding". |
| How the app finds things · Search settings | `?tab=search` | built | The masthead reads "Search memory". Missing from the in-page menu. |
| How the app finds things · AI brain (old) | `?tab=brain` | built | — |
| How the app finds things · Menus & icons | `?tab=menus` | built | These rows still rename the RETIRED `admin.sidebar.*` items, which now show only in search. |
| Design kit · Colours (`catalogue.html` `S('dk-colours'`) | Setup › Switches & delivery › Colours | lives somewhere else | As the reorg approved. |
| Design kit · Fonts (NEW) (`S('dk-fonts'`) | — | missing | No home in the 17 Nov shape. |
| Design kit · Palettes (NEW) (`S('dk-palettes'`) | — | missing | No home in the 17 Nov shape. |
| Design kit · Card motifs (NEW) (`S('dk-motifs'`) | — | missing | No home in the 17 Nov shape. |
| Design kit · Backgrounds, one list (NEW) (`S('dk-backgrounds'`) | Front-door videos only | missing | No home in the 17 Nov shape. |
| Design kit · Icon per service (NEW column) (`S('dk-icons'`) | category icon only (`setCategoryIcon`) | missing | No home in the 17 Nov shape. |

### 2.5 Insights

| Approved item | Ships | Verdict | Delta |
|---|---|---|---|
| Insights landing, head card with "Problems, last 24 h" | `/admin/app-performance` `TabLanding` | built | — |
| Overview (+ old `/admin/insights`) | `?tab=overview` | built | — |
| Visits | `?tab=visits` | built | — |
| Sign-ups & growth | `?tab=growth` | built | — |
| Funnels | `?tab=funnels` | built | — |
| Intelligence | `?tab=intelligence` | built | The name is vague (§4). |
| SEO & GEO | `?tab=seo` | built | — |
| Demand | `?tab=demand` | built | The masthead reads "Demand Radar". |
| Problems | `?tab=connection-logs` | built | — |
| Slow loads · Browser blocks | `?tab=slow-loads`, `?tab=browser-blocks` | built | The drawing merged these into one view; the code has two. That is fine. |
| Interconnections | `?tab=interconnections` | built | Jargon (§4). |
| Offline daemon | `?tab=offline` | built | Jargon (§4). |
| Expenses & hiring | `?tab=operations` | built | — |
| Papic storage | `?tab=papic-storage` | built | Jargon (§4). |
| Top shops (NEW) (`insights.html` `view('top-shops'`) | not found | missing | — |
| "Events held", split told / untold stories (call c) | not found | missing | — |
| ⚙ Load-time target (`P('insights-gear'`) | `app-performance/actions.ts`, `_surfaces/slow-loads-surface.tsx` | lives somewhere else | It is in Slow loads, not under a ⚙. |
| ⚙ Which numbers show first | not found | missing | — |
| ⚙ Demo data | Setup › Switches · Demo mode | lives somewhere else | — |
| ⚙ Date range default | not found | missing | — |

### 2.6 Avatar · Setup (admin-of-admin)

| Approved item | Ships | Verdict | Delta |
|---|---|---|---|
| Team · Team & permissions | `/admin/team` | built | — |
| Team · Admin log | `/admin/admin-log` | built | — |
| Switches & delivery · Switches · Demo mode | `/admin/switches` | built | It also holds the Morning digest. |
| Switches & delivery · Email delivery (+ `/admin/notifications`) | `?view=email` | built | The bell in the top bar links to `/admin/settings?tab=notifications`, which lands here. A bell for an admin's own alerts opens mail delivery settings. |
| Switches & delivery · Live Watch channels | `?view=live-watch` | built | The masthead reads "Setnayan channel pool". |
| Switches & delivery · Colours | `?view=colours` | built | — |
| Business · Business & compliance (+ `/admin/settings`, `/admin/compliance`) | `/admin/business` | built | The masthead reads "Platform settings". |
| Business · Receiving accounts (GCash · BDO QR) | `?view=accounts` | built | The masthead reads "Payment methods". |
| Business · Secrets | `?view=secrets` | not verified | `app/admin/secrets/` was not read. The address forwards correctly. |
| Business · Integrations | `?view=integrations` | built | — |
| Business · Privacy & NPC filing (+ `/admin/npc-readiness`) | `?view=privacy` | built | — |
| Business · Data sheet | `?view=data-sheet` | built | The title reads "NPC data sheet". |
| Help · What can I ask? + A4 | `/admin/ask` | built | — |
| "You": Appearance · My account · Billing & receipts · Sign out (`admin_pub/work.html` `P('avatar'` `sec('You')`) | `AccountSwitcher` (shared) | built | Sign out is only here, as ruled. |

---

## 3 · Nothing lost: every shipped address and its home

The "Today" column was computed by running `adminShellPlaceFor` from `lib/admin/admin-pages.ts` on each address, after
`adminMergedForward`. "307 →" means the middleware moves the address. The "Approved" column follows `merges.py` `MERGED`.
✓ = today's home is the approved home.

### 3.1 The 71 pages

| Address | Today | Approved home | ✓ |
|---|---|---|---|
| `/admin` | Focus (Full: the Work list) | Focus | ✓ |
| `/admin/work` | Work landing (dashboard + list) | Work › Queue › All | ✓ |
| `/admin/more` | 307 → `/admin/work?view=all` | Work › Queue › All | ✓ (its "All surfaces" grid is now dead code) |
| `/admin/approvals` | 307 → Work › Queue › Approvals | same | ✓ |
| `/admin/completions` | 307 → Work › Queue › Completions | same | ✓ |
| `/admin/pax-changes` | 307 → Work › Queue › Pax changes | same | ✓ |
| `/admin/corrections` | 307 → Work › Queue › Profile corrections | same | ✓ |
| `/admin/force-majeure` | 307 → Work › Queue › Force majeure | same | ✓ |
| `/admin/pakanta` | 307 → Work › Queue › Music Maker | same | ✓ |
| `/admin/user-reports` | 307 → Work › Queue › User reports | same | ✓ |
| `/admin/disputes` | 307 → Work › Queue › Disputes | same | ✓ |
| `/admin/fraud` | 307 → Work › Queue › Fraud | same | ✓ |
| `/admin/chat-flags` | 307 → Work › Queue › Chat flags | same | ✓ |
| `/admin/repost-watch` | 307 → Work › Queue › Repost watch | same | ✓ |
| `/admin/integrity-watch` | 307 → Work › Queue › Integrity watch | same | ✓ |
| `/admin/concierge-abuse` | 307 → Work › Queue › AI abuse | same | ✓ |
| `/admin/reviews` | 307 → Work › Queue › Review appeals | same | ✓ |
| `/admin/editorial-review` | 307 → Work › Queue › Editorial | same | ✓ |
| `/admin/account-deletions` | 307 → Work › Queue › Account deletions | same | ✓ |
| `/admin/event-deletions` | 307 → Work › Queue › Event removals | same | ✓ |
| `/admin/help` | Work › Messages › Help messages | same | ✓ |
| `/admin/demo-vendors/inquiries` | 307 → Work › Messages › Demo-shop inquiries | same | ✓ |
| `/admin/help/guides` | lights Work › Messages (path prefix) | **not in the drawing** (made 13 Nov "Three helps", after the reorg list) | ✗ It is the team's own help. It belongs beside Setup › Help (`/admin/ask`), not under Messages. |
| `/admin/money` | Money landing + Records › Everything | Money › Records › Everything | ✓ |
| `/admin/payments` | Money › To approve › Payments to confirm | same | ✓ |
| `/admin/payments/supplier-refunds` | 307 → Money › To approve › Refunds | same | ✓ |
| `/admin/payouts` | 307 → Money › To approve › Payouts | same | ✓ |
| `/admin/booking-fees` | 307 → Money › To approve › Fees owed | same | ✓ |
| `/admin/payment-options` | 307 → Money › To approve › Payment options | same | ✓ |
| `/admin/subscriptions` | 307 → Money › To approve › Subscriptions | same | ✓ |
| `/admin/receipts` | 307 → Money › Records › Receipts | same | ✓ |
| `/admin/pricing` | Money › Prices | same | ✓ |
| `/admin/offers` | Money › Offers & gifts › Launch offer | same (NEW address) | ✓ |
| `/admin/launch-offer` | 307 → Money › Offers & gifts › Launch offer | same | ✓ |
| `/admin/discount-codes/new` | Money › Offers & gifts › Discount codes (open one) | same | ✓ |
| `/admin/gifts` | 307 → Money › Offers & gifts › Gifts & comps | same | ✓ |
| `/admin/founder-seats` | 307 → Money › Offers & gifts › Founder seats | same | ✓ |
| `/admin/directory` | People landing | People › Look up (the reorg called it "old card grid"; v10 made it the landing) | ✓ |
| `/admin/accounts` | People › Look up › Everyone | same | ✓ |
| `/admin/venues/new` | People › Look up › Venues (open one) | same | ✓ |
| `/admin/verify` | People › Papers › Three papers (own address) | People › Papers, one page with Which ▾ | partly: not merged (`waitsOn`) |
| `/admin/verification-docs` | People › Papers › ID documents (own address) | same, as a view | partly: not merged |
| `/admin/vendor-partnerships` | People › Ties › Partnerships | same | ✓ |
| `/admin/vendor-recommendations` | 307 → People › Ties › Recommendations | same | ✓ |
| `/admin/catalogue` | Catalogue landing | (landing, v5) | ✓ |
| `/admin/categories` | Catalogue › Services › Categories | same | ✓ |
| `/admin/categories/requests` | Catalogue › Services › Requests | same | ✓ |
| `/admin/budget-planner` | Catalogue › Services › Budget benchmarks (own address) | same, as a view | partly: not merged (`waitsOn`) |
| `/admin/studio` | Catalogue › Studio › Website | same | ✓ |
| `/admin/background-videos` | 307 → Catalogue › Studio › Front-door videos | same | ✓ |
| `/admin/website-media` | 307 → Catalogue › Studio › Website media | same | ✓ |
| `/admin/hub-music` | 307 → Catalogue › Studio › Hub music | same | ✓ |
| `/admin/ugat` | Catalogue › How the app finds things › Menus & icons | …› Root map | ✗ The address now opens Menus & icons; "Root map" is only in titles. |
| `/admin/ugat/map` | Catalogue › How the app finds things › Screens map ("Entity map") | …› Screens map | ✓ (name differs) |
| `/admin/search-memory` | 307 → Catalogue › How the app finds things › Search settings | same | ✓ |
| `/admin/app-performance` | Insights landing (+ Overview) | Insights › Overview | ✓ |
| `/admin/demand` | 307 → Insights › Demand | same | ✓ |
| `/admin/papic-storage` | 307 → Insights › Papic storage | same | ✓ |
| `/admin/team` | Setup › Team & permissions | same | ✓ |
| `/admin/admin-log` | Setup › Admin log | same | ✓ |
| `/admin/switches` | Setup › Switches · Demo mode | same | ✓ |
| `/admin/email-delivery` | 307 → Setup › Email delivery | same | ✓ |
| `/admin/live-studio-channels` | 307 → Setup › Live Watch channels | same | ✓ |
| `/admin/colours` | 307 → Setup › Colours | same | ✓ |
| `/admin/business` | Setup › Business & compliance | same | ✓ |
| `/admin/settings/payment-methods` | 307 → Setup › Receiving accounts | same | ✓ |
| `/admin/secrets` | 307 → Setup › Secrets | same | ✓ (body not read) |
| `/admin/integrations` | 307 → Setup › Integrations | same | ✓ |
| `/admin/data-privacy` | 307 → Setup › Privacy & NPC filing | same | ✓ |
| `/admin/compliance/data-sheet` | 307 → Setup › Data sheet | same | ✓ |
| `/admin/ask` | Setup › Help | same | ✓ |

(Opening one shop, person, event, force-majeure flag, editorial piece, service request, demo inquiry or venue keeps its
own page and opens from its list. Each is placed by `openOne` in `admin-pages.ts`, as `merges.py` places them.)

### 3.2 The 36 forwards (kit list) and where they land today

All 36 land on an approved home.

| Old address | Kit target | Today's home | ✓ |
|---|---|---|---|
| `/admin/addons` | `/admin/pricing` | Money › Prices | ✓ |
| `/admin/price-bands` | `/admin/pricing?tab=price-bands` | Money › Prices › Bands | ✓ |
| `/admin/discount-codes` | `/admin/studio?tab=discount-codes` | 307 → Money › Offers & gifts › Discount codes | ✓ (kit target is stale, L-9) |
| `/admin/referrals` | `/admin/studio?tab=referrals` | 307 → Money › Offers & gifts › Referrals | ✓ (L-9) |
| `/admin/spotlight-awards` | `/admin/studio?tab=spotlight-awards` | 307 → Money › Offers & gifts › Badges & seals | ✓ (L-9) |
| `/admin/queues` | `/admin/work` | 307 → Work › Queue › All | ✓ (L-9) |
| `/admin/users` | `/admin/accounts?tab=users` | People › Look up › People | ✓ |
| `/admin/vendors` | `?tab=vendors` | People › Look up › Shops | ✓ |
| `/admin/events` | `?tab=events` | People › Look up › Events | ✓ |
| `/admin/venues` | `?tab=venues` | People › Look up › Venues | ✓ |
| `/admin/demo-vendors` | `?tab=demo-vendors` | People › Look up › Demo shops | ✓ |
| `/admin/website` | `/admin/studio?tab=website` | Catalogue › Studio › Website | ✓ |
| `/admin/reveal-studio` | `…?tab=reveal-studio` | Catalogue › Studio › Reveal Studio | ✓ |
| `/admin/patiktok` | `…?tab=patiktok` | Catalogue › Studio › Patiktok | ✓ |
| `/admin/moodboard-library` | `…?tab=moodboard-library` | Catalogue › Studio › Inspiration | ✓ |
| `/admin/songs` | `…?tab=songs` | Catalogue › Studio › Songs | ✓ |
| `/admin/real-stories` | `…?tab=real-stories` | Catalogue › Studio › Real Stories (retired) | ✓ |
| `/admin/recaps` | `…?tab=recaps` | Catalogue › Studio › Recaps | ✓ |
| `/admin/journal-spotlights` | `…?tab=journal-spotlights` | Catalogue › Studio › Journal Spotlights | ✓ |
| `/admin/social-queue` | `…?tab=social-queue` | Catalogue › Studio › Social queue | ✓ |
| `/admin/menus` | `/admin/ugat?tab=menus` | Catalogue › How the app finds things › Menus & icons | ✓ |
| `/admin/onboarding` | `/admin/ugat?tab=onboarding` | …› Onboarding questions | ✓ |
| `/admin/brain` | `/admin/ugat?tab=brain` | …› AI brain (old) | ✓ |
| `/admin/insights` | `/admin/app-performance` | Insights › Overview | ✓ |
| `/admin/growth` | `?tab=growth` | Insights › Sign-ups & growth | ✓ |
| `/admin/funnels` | `?tab=funnels` | Insights › Funnels | ✓ |
| `/admin/intelligence` | `?tab=intelligence` | Insights › Intelligence | ✓ |
| `/admin/seo` | `?tab=seo` | Insights › SEO & GEO | ✓ |
| `/admin/connection-logs` | `?tab=connection-logs` | Insights › Problems | ✓ |
| `/admin/offline` | `?tab=offline` | Insights › Offline daemon | ✓ |
| `/admin/operations-hiring` | `?tab=operations` | Insights › Expenses & hiring | ✓ |
| `/admin/settings` | `/admin/business` | Setup › Business & compliance | ✓ |
| `/admin/compliance` | `/admin/business` | Setup › Business & compliance | ✓ |
| `/admin/settings/demo-mode` | `/admin/switches` | Setup › Switches · Demo mode | ✓ |
| `/admin/notifications` | `/admin/email-delivery` | 307 again → Setup › Email delivery | ✓ (two hops) |
| `/admin/npc-readiness` | `/admin/data-privacy?tab=checklist` | 307 again → Setup › Privacy & NPC filing | ✓ (two hops; whether `tab=checklist` survives the second hop was not verified) |

### 3.3 Settings and jobs with no home, or a weak one

1. **Design kit: Fonts, Palettes, Card motifs, one Backgrounds list, icon per service.** Approved as NEW on 13 Nov
   (`catalogue.html` `S('dk-fonts'` …). The 17 Nov `merges.py` has no row for them, so there is **no home**. This needs an
   owner call: drop them, or add a Catalogue › Studio "Design kit" view.
2. **Insights ⚙: Which numbers show first, Date range default.** Approved under `P('insights-gear'`. They were not found
   in code, and there is no ⚙ on Insights, so there is **no home today**.
3. **Work ⚙: Alerts to my phone, AI suggestions switch, Today's events view.** Approved under `P('work-gear'`. None are
   in code, and there is **no ⚙ on Work**.
4. **People ⚙: Verification rules.** The automatic checks and document slots have no settings place (only a note on
   `/admin/verify`).
5. **Morning digest.** It is a Work setting in the drawing but sits in owner-only Setup today, so a non-owner admin
   cannot find their own digest switch.
6. **`/admin/help/guides`** (the team's help answers). Not in the drawing. Today it lights Work › Messages by accident.
7. **`ADMIN_NAV_GROUPS` "My account" (`/dashboard/profile`) and "Budget Planner", "Papic storage" under "Root map".**
   These only show in search results under the wrong group. It is harmless but confusing (see §4).

---

## 4 · "Would an admin know what it is for?"

This list has two kinds of entry: **a name nobody outside the build knows**, and **one thing with two names on one
screen**. The pinned row shows the approved name, and the old page's own masthead and browser title, shown just under it,
show a different one (`merged-view.ts` `viewTitle` reads the old `metadata.title`). Each line ends with a plain-words
suggestion.

**Names that only the build knows**

| Shown today | Where | Plain-words suggestion |
|---|---|---|
| "Root map" (every `/admin/ugat` title: "… · Root map · Admin"; in-page menu "Root map sections"; search group "Root map") | `ugat/page.tsx` `generateMetadata`, `TAB_STRIP`; `ADMIN_NAV_GROUPS` `key: 'ugat'` | Use the approved "How the app finds things" everywhere, and drop "Root map". |
| "Ugat" (the address `/admin/ugat`) | address only | Fine as an address, but never show it as a word. |
| "Entity map" vs "Root map · Screens" vs "Screens map" | `ugat/map/page.tsx` metadata; `ugat` `TAB_STRIP` "Screens" | These are two read-only maps under three names. Call them "Pages and their doors" (screens) and "Data map" (entities), or keep one. |
| "AI brain (old)" | Catalogue › How the app finds things | "What Setnayan AI has read (read-only)". If it is truly old, mark it retired like Real Stories. |
| "Search memory" (masthead) / "Search settings" (dropdown) | `search-memory` | "Search words the console has learned". |
| "Papic storage" | Insights › Costs | "Guest-camera photo storage cost". |
| "Papic shots" / "Papic credit prices" | Money › Prices | "Guest-camera photo prices". |
| "Repost watch" | Work › Queue | "Photos reposted without permission". |
| "Integrity watch" | Work › Queue | "Suspicious reviews and bookings to check". Confirm the queue's real job first. |
| "AI abuse" / "Setnayan AI enforcement" / "Setnayan AI abuse" | `concierge-abuse` | "Misuse of Setnayan AI". One name. |
| "Chat flags" / "Chat contact flags" | Work › Queue | "Chats sharing phone numbers or emails". |
| "Pax changes" | Work › Queue | "Guest-count changes". |
| "Completions" | Work › Queue | "Bookings to mark done". |
| "Force majeure" | Work › Queue | "Events stopped by emergencies". |
| "Music Maker" / "Music Maker queue" (address `pakanta`) | Work › Queue | "Custom songs to review". |
| "Patiktok" | Catalogue › Studio | "Short event videos (renders)". |
| "Reveal Studio" | Catalogue › Studio | "Reveal videos and their templates". |
| "Offline daemon" | Insights | "Desktop app offline sync". |
| "Interconnections" | Insights | "Outside services status". |
| "Intelligence" | Insights | "Booking patterns" (or whatever its surface reads). It sits beside "Insights", which is a different thing. |
| "Demand" / "Demand Radar" | Insights | "What hosts search for". |
| "Live Watch channels" / "Setnayan channel pool" | Setup | "Live stream channels". One name. |
| "Ties" | People | "Supplier links (partners and recommendations)". |
| "Hub tools", "Budget benchmarks" / "Budget planner" | Catalogue › Services | "Event Hub tools"; "Typical budgets per service". One name. |
| "Bands" / "Price bands" / "Market bands" | Money › Prices | "Typical price ranges". |
| "Free windows" | Money › Prices | "Free-access periods". |
| "Founder seats" | Money › Offers & gifts | "Founding supplier spots". |
| "Data sheet" / "NPC data sheet" | Setup | "Data we keep (for the NPC)". |
| "Three papers (shops)" / "Verification queue" | People › Papers | "Supplier papers to check". |

**One thing, two or more names**

| Item | Names a person reads | Suggestion |
|---|---|---|
| Look up | "Look up" (dropdown) · "People & shops" (title) · "Directory" (search) | "Look up". |
| A supplier | "Shops" (Look up) · "Suppliers" (People Show ▾, search) · "Supplier" (one shop's masthead) | "Suppliers", per the brand word rule. "Shop" is the supplier's storefront, not the person. |
| Prices | "Prices" (dropdown) · "Pricing & Catalog" (masthead) · "Pricing" (search) | "Prices". |
| Fees owed | "Fees owed" · "Booking fees" (title) | "Fees owed". The brand rule forbids showing the booking fee to hosts; inside admin it is allowed, but pick one name. |
| Payouts | "Payouts" · "Supplier payouts" | "Payouts". |
| Receipts | "Receipts" · "Transaction receipts" | "Receipts". |
| Receiving accounts | "Receiving accounts (GCash · BDO QR)" · "Payment methods" (masthead, search) | "Where our money lands". |
| Payment options vs Receiving accounts | These are different jobs (a supplier's accounts to screen vs Setnayan's own) with near-identical names | "Supplier payment accounts to check" vs "Where our money lands". |
| To approve (Money) vs Approvals (Work) | Both say approve: one is money waiting, the other is two-admin requests | Rename Work's to "Second-admin sign-offs". |
| Messages vs Help | `/admin/help` is **Messages**, `/admin/ask` is **Help**, `/admin/help/guides` is the team's help | Rename the address mentally. In words: "Messages" · "What can I ask?" · "Team guides" (under the avatar). |
| Insights | the tab, the page, the view "Overview", and the old `/admin/insights` | Only the tab is "Insights"; the first view is "Overview". |
| Business & compliance | "Business & compliance" · "Platform settings" (masthead) · "Settings" (search) | "Business & compliance". |
| Front-door videos | "Front-door videos" · "Homepage background videos" · "Background videos" | "Homepage videos". |
| Inspiration | "Inspiration" · "Moodboard library" | "Inspiration photos". |
| Songs vs Hub music | "Songs" ("Master song catalogue") and "Hub music" ("Event Hub music") are two song lists | Name the difference: "Song list (for hosts to pick)" vs "Event Hub background music". |
| Real Stories vs Storytellers vs Recaps vs Journal Spotlights | four story-ish views | Keep "Real Stories (retired)". Rename "Journal Spotlights" to "Articles spotlights" (word rule). Give each of the other two one line. |
| Website / Website media (Studio) | "Website" is the Event Hub designer | "Event Hub designs" and "Event Hub media" (word rule: Event Hub, not website). |
| Demo shops vs Demo mode vs Demo-shop inquiries | three places with "demo" | Keep them, but put one line in each ⓘ saying what it is for. |
| Email delivery opened from the bell | the top-bar bell links to `/admin/settings?tab=notifications` → Email delivery | The bell should open the admin's own alerts. Mail health stays in Setup. |

**Search shows the old map.** The ⌘K and search-box panel draws group headers "Today", "People & shops", "Studio", "Root
map", "Numbers" and "Money", using item names from `ADMIN_NAV_GROUPS`. Under "Root map" it lists Settings, Secrets,
Colours, Budget Planner, Papic storage, Demo suppliers and My account. An admin who searches is shown a different map
from the one on the bar. Suggestion: build `buildDestinations` from `ADMIN_MERGED_PAGES` (tab › page › view), and keep
`ADMIN_NAV_GROUPS` only as search aliases until it is deleted.

---

## 5 · Counts and what was not verified

| Section | built | partly | missing | elsewhere | not verified |
|---|---|---|---|---|---|
| 1 Shell (S1–S20) | 13 | 6 | 1 | 0 | 0 |
| 2.1 Work | 24 | 2 | 3 | 1 | 0 |
| 2.2 Money | 22 | 2 | 0 | 1 | 3 |
| 2.3 People | 10 | 3 | 1 | 2 | 1 |
| 2.4 Catalogue | 25 | 2 | 5 | 1 | 0 |
| 2.5 Insights | 14 | 0 | 4 | 2 | 0 |
| 2.6 Setup | 13 | 0 | 0 | 0 | 1 |
| **Total (162)** | **121** | **15** | **14** | **7** | **5** |

These are the exact tallies of the verdict columns above. The "partly" rows that matter most are S6, S8, S9, S12, S13
and S17.

**Not verified, said plainly:**
- Nothing was opened in a browser. Every row is from code and the drawing.
- `app/admin/secrets/` was not read.
- Whether each mounted view's body draws without a second masthead under the pinned row was not checked on screen.
- The Payout "Mark paid with proof", the Prices sign-up-discount row, the Bookings Open switch and the papers AI check
  were not confirmed.
- Whether `/admin/npc-readiness` keeps `tab=checklist` through its two hops was not confirmed.
- Production data was not read, so no count shown on a landing was checked.

**For the fix builder, in order:**
1. One vocabulary: titles, mastheads and search groups take the dropdown's names (sections 4 and S17).
2. Drop the Studio and Root-map in-page menus (S8).
3. Add the ⚙ sheets for Work, People and Insights, or make an owner call to retire their rows (§3.3).
4. Owner calls: Focus strip vs one list (S6); Setup owner-only (S12); Design kit's home (§3.3 1); AI in the ask box (S13).
