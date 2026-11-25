# Final check · PLAN · Area 1 · Front door & public pages

**Date:** 25 Nov 2026 · planner: Fable (plan and drawings only; no app code changed) · main read at `bd869365ca` · findings from `ALL-FINDINGS.md` on `final-check/brief` and `area-1.md` on `final-check/area-1`.

**Counts.** Lane A: 114 findings in 9 batches (78 area-1 entries + 36 area-1 members of the 13 shared A sweeps). Lane B: 40 screens covering all 43 lane B findings (14 area-1 entries + 29 members of the 7 shared B sweeps), each with a drawing section. Drawings: `prototypes/final-check-area-1_2026-11-25/final-check-area-1_2026-11-25.html` in the specs repo (https://github.com/iscasasola/Setnayan-specs/blob/main/prototypes/final-check-area-1_2026-11-25/final-check-area-1_2026-11-25.html).

**Not in this plan.** Lane C (owner first): A1-001 A1-022 A1-028 A1-057 A1-059 A1-060 A1-080 A1-089 A1-101 A1-102 A1-122 A1-155 A1-156 A1-170. Lane R: A1-085 (/api/v1, R8): fixers skip it; where a lane A row touches `app/api/v1/page.tsx` it is marked "goes with R8".

## How the lane A batches work

- One batch = one PR from its own worktree of `origin/main`. Batches run in the order below; inside a batch, rows are fixed top to bottom.
- Every row names the test that holds its claim. A guard must test the claim itself (the rendered string or the real href), use `lib/strip-comments.ts` for source scans, and be shown failing before the fix.
- Sweep members (tagged SW-…) are listed here so nothing is lost. If the controller runs a sweep as one cross-area batch, strike its rows here and keep the test.
- No row in lane A changes how a screen looks. Where a fix needs a "Couldn't read" line or a Try again, it uses the shipped `ErrorState` / `EmptyState` as they are.
- Paths are under `apps/web/` unless they start with `lib/` (= `apps/web/lib/`) or `middleware.ts`.


### Batch `a1-live` (14)

Everything seen broken or untrue on setnayan.com that is words, doors or URL handling. Ships first.

**IDs, in order:** A1-058 · A1-083 · A1-081 · A1-082 · A1-032 · A1-149 · A1-151 · A1-104 · A1-047 · A1-048 · A1-103 · A1-027 · A1-108 · A1-152

| # | ID | Fix | Files | Test that holds the claim |
|---|---|---|---|---|
| 1 | A1-058 (LIVE · SW-URI) | URL message params are decoded safely and mapped to fixed message keys; URL text is never printed; a stray "%" cannot crash the page. | app/login/_components/login-data.ts · app/signup/page.tsx · app/reset-password/page.tsx · app/i/[slug]/page.tsx | New `lib/url-messages-are-keys.test.ts`: each page given `?error=%` and `?error=<b>x` renders and shows only a sentence from the key list. |
| 2 | A1-083 (LIVE · SW-URI) | A failed Message us send shows its reason and keeps what was typed; a crafted link cannot crash /help. | app/(shell)/help/page.tsx · app/help/actions.ts | Action test: a failed send returns the reason plus the typed values. Page test: /help renders with `?sent=%`. |
| 3 | A1-081 (LIVE) | A signed-out guide or topic link opens the guide, or a "Sign in to see this" door. Never a 404. | app/(shell)/(help-pages)/help/guides/[key]/page.tsx · …/help/topics/[key]/page.tsx · lib/help-ask-core.ts | Route test: signed-out GET of every key in the help index answers 200 with content or the door. |
| 4 | A1-082 (LIVE) | The answer page breadcrumb opens /help/topics/<key>. | app/help/[slug]/page.tsx | Test: for every slug, the breadcrumb href is an existing topic key (no `#anchor`). |
| 5 | A1-032 (LIVE) | The Live Watch demo dead-end points to where the demo lives now (/panood → "Try the control room with two phones"). | app/panood/demo/[token]/page.tsx · …/_components/cam-join-flow.tsx · lib/demo-sessions.ts | Test: the dead-end href is a real route, and the string it names exists on /panood. |
| 6 | A1-149 (LIVE) | /papic writes no demo session and opens no live connection until a person presses. | app/(shell)/papic/_papic-scan.tsx · lib/demo-sessions.ts | Test: rendering /papic calls the demo-session create 0 times. Browser proof: no WebSocket in the network list on load. |
| 7 | A1-151 (LIVE) | Test shops are not public and not in the sitemap; only real published shops are listed. | the vendors sitemap route · the public shop reader used by app/v/[slug]/page.tsx (locate with `git grep sitemap-vendors`) | Test: the sitemap query excludes test/demo shops; a test shop slug answers the 404 for a signed-out visitor. |
| 8 | A1-104 (LIVE) | No "trusted"-style promise about suppliers. | app/_components/frontdoor/front-door-landing.tsx · lib/features-page.ts | Extend the public-copy word guard: "trusted" fails in marketing copy. |
| 9 | A1-047 (LIVE · SW-COMM) | The commission line is exactly "Hosts pay 0% commission." | app/layout.tsx · app/(shell)/marketplace/page.tsx · app/(shell)/suppliers/(index)/page.tsx · app/(shell)/suppliers/_landing.tsx | New guard `lib/the-commission-line-is-one-sentence.test.ts`: every public sentence holding "commission" equals the ruled one. |
| 10 | A1-048 (LIVE · SW-PROMISE) | Creators page: no "free, forever" and no typed ₱0. | app/creators/_components/creator-story-hero.tsx · creator-story-sections.tsx | Promise-words guard ("forever", "for good", "for life", "no end date") over app/creators; typed-peso guard. |
| 11 | A1-103 (LIVE · SW-PROMISE) | No "free to stay", "for good", "forever". | app/for-suppliers/_components/supplier-front-page.tsx · lib/feature-pages/suppliers-b.ts · app/(shell)/tl/about/page.tsx · lib/help/topics-existing.ts | Same promise-words guard over these files. |
| 12 | A1-027 (LIVE · SW-WORDS) | "Monogram" reads "Logo Maker" wherever a person reads it. | app/(shell)/monogram/page.tsx · app/monogram/public-monogram-studio.tsx · app/(shell)/alaala/page.tsx · lib/monogram-studio/markup.ts | House-words guard (Monogram, Pabuya, vendor, Journal, site) over rendered strings of these files. |
| 13 | A1-108 (LIVE · SW-WORDS) | /features E-Gifts rows say "E-Gifts", not "Pabuya" / "Safe". | lib/features-page.ts | House-words guard. |
| 14 | A1-152 (LIVE · SW-WORDS) | The website footer says "Logo Maker". | app/_components/marketing/reskin-footer.tsx | House-words guard plus a footer render test. |

### Batch `a1-live-perf` (10)

Pages that do not open, or open slowly. Three are LIVE (A1-146, A1-147, A1-148) and lead; the rest share the cause or the proof. The blockers A1-154 and A1-056 ride here so they ship in the second PR.

**IDs, in order:** A1-146 · A1-147 · A1-148 · A1-169 · A1-154 · A1-125 · A1-128 · A1-124 · A1-056 · A1-166

| # | ID | Fix | Files | Test that holds the claim |
|---|---|---|---|---|
| 1 | A1-146 (LIVE · SW-PERF) | Static marketing pages are cached at the edge instead of rendered per request. | app/(shell)/layout.tsx · app/(hub)/page.tsx · each static page's `revalidate` | Build output shows the listed routes as static/ISR; two curls of each show a cache HIT on the second. |
| 2 | A1-147 (LIVE · SW-PERF) | Public pages are usable inside 0.7 s; the session read for the hero button no longer makes the page dynamic. | same files · the session-dependent buttons move to a client island | Timing script over the named pages (/, /features, /papic, /login, /signup, /for-suppliers, /help); result recorded against the 0.7 s target. |
| 3 | A1-148 (LIVE) | /pricing answers 200 every time; a slow or failed catalogue read gives an honest state, not a 502. | app/(shell)/pricing/page.tsx | 50 sequential GETs all 200; unit test: the catalogue read throwing still renders the page. |
| 4 | A1-169 (SW-PERF) | No page over 2 s on the copy. | the pages in the finding's list | Same timing script; none over budget. |
| 5 | A1-154 (blocker · SW-500) | Shop pages render, or show an honest error within 2 s, instead of HTTP 500 after ~24 s. | app/v/[slug]/page.tsx · lib/reviews.ts · lib/vendor-services.ts (find the read that hangs; bound it) | All 10 seeded shops answer 200 in under 2 s, three runs each; unit test with one read hanging. |
| 6 | A1-125 | One failed reviews or services read shows "Couldn't load" in that section; the rest of the shop page still shows. | app/v/[slug]/page.tsx · lib/reviews.ts · lib/vendor-services.ts | Unit: reviews read rejects → the page renders with the section-level message. |
| 7 | A1-128 | A failed shop read says "Couldn't open this shop, reload". Never "Page not found", and never cached for strangers. | app/v/[slug]/page.tsx · lib/ultra-story-pages.server.ts | Unit: read error → the couldn't-open state, not `notFound()`, and no cache write. |
| 8 | A1-124 | Internal links work on a shop's own web address. | middleware.ts | Middleware unit: with a shop host, every internal href on the page resolves to a real setnayan.com route. |
| 9 | A1-056 (blocker) | "Secure my plan" reaches the Create account card for a host with no account. | app/signup/page.tsx · lib/auth.ts | Unit: an anonymous session with `next=/dashboard` renders the form (no redirect). Walk: /start → event → Secure my plan → card. |
| 10 | A1-166 | With no signal, help answers come from the saved copy, or a Setnayan offline page shows. Never the browser's blank error. | the service worker and offline page (locate under apps/web/public and app/) | Browser test offline on /help and /help/[slug]. |

### Batch `a1-a3-shop` (15)

The public shop page and its sub-pages.

**IDs, in order:** A1-127 · A1-123 · A1-129 · A1-130 · A1-131 · A1-138 · A1-139 · A1-126 · A1-136 · A1-133 · A1-134 · A1-132 · A1-135 · A1-140 · A1-137

| # | ID | Fix | Files | Test that holds the claim |
|---|---|---|---|---|
| 1 | A1-127 | Share shares or copies, or says why it could not, with Try again. | app/v/[slug]/_components/share-button.tsx | Unit: no `navigator.share` and a rejected clipboard → the message and Try again render. |
| 2 | A1-123 (money) | A package saved at ₱0 shows "Price on request", never "₱0". | app/_components/vendor-packages/package-card.tsx | Unit: price 0 and null → "Price on request". |
| 3 | A1-129 | A failed trusted-stats read says "Couldn't load the rating", not "none yet". | lib/reviews.ts · app/v/[slug]/page.tsx | Unit: read returns null on failure; the page shows the couldn't-load line. |
| 4 | A1-130 | The review count and bars count only reviews that can be listed; "Show more reviews" stops when none are left. | app/v/[slug]/page.tsx | Unit: with hidden reviews, count = listable; pager hides at the end. |
| 5 | A1-131 | No review and no stars anywhere on a shop that is not yet verified. | app/v/[slug]/page.tsx · _components/service-details-sheet.tsx | Unit: unverified shop → no rating nodes on cards or in the grown card. |
| 6 | A1-138 | No rank-claim award names ("first", "#1", "only"). | lib/shop-seals.ts · lib/shop-award-fact.ts | Rank-claim guard over the seal names. |
| 7 | A1-139 | A check badge only on a verified Trusted partner. | app/v/[slug]/_components/trusted-by-carousel.tsx · lib/vendor-trusted-by.ts | Unit: unverified partner → no badge. |
| 8 | A1-126 | The 3D booth page has a way back to the shop. | app/v/[slug]/booth/booth-showcase-client.tsx | Render test: a back control with the shop href exists. (Reuses the back link the not-set-up state already has; no new look.) |
| 9 | A1-136 | The booth collapses to Free when the shop's paid plan has expired. | app/v/[slug]/booth/page.tsx (use `effectiveSeoTier`) | Unit: expired plan → the booth gate. |
| 10 | A1-133 | The guest review page gives a hidden shop the same 404 the shop page gives; it never shows its name. | app/v/[slug]/guest-review/page.tsx · _components/guest-review-states.tsx | Unit: a non-public shop → 404 with no shop name in the HTML. |
| 11 | A1-134 | Guest review words have plain fallbacks when a name is missing. | app/v/[slug]/guest-review/page.tsx · guest-review/actions.ts | Unit: missing names → "this wedding", "Thank you". |
| 12 | A1-132 | The story page lists only reviews a public page may list. | lib/ultra-story-pages.server.ts (read `vendor_reviews_public`) | Unit: a held review is absent. |
| 13 | A1-135 (SW-BOOKED) | The guest review page uses `BOOKED_EVENT_VENDOR_STATUSES`. | app/v/[slug]/guest-review/page.tsx | The booked-status guard (no local status list) covers this file. |
| 14 | A1-140 (SW-PHP) | Peso amounts on the shop page go through `formatPhp`. | lib/verified-median.ts | The peso-formatter guard covers this file. |
| 15 | A1-137 (SW-WEDDING) | Review words come from the event type, not "wedding". | app/v/[slug]/_components/venue-matched-events.tsx | Unit: a debut review shows no wedding word. |

### Batch `a1-a4-account` (11)

Sign-up, the You card, public profiles and group chat. No sign-in rule changes (those are lane C).

**IDs, in order:** A1-061 · A1-065 · A1-062 · A1-064 · A1-063 · A1-070 · A1-071 · A1-072 · A1-073 · A1-005 · A1-008

| # | ID | Fix | Files | Test that holds the claim |
|---|---|---|---|---|
| 1 | A1-061 | /signup makes no promise about moving a guest's photos (sign-up no longer does it). | app/signup/page.tsx · app/signup/actions.ts | Copy test: the promise string is gone. |
| 2 | A1-065 | /forgot-password names the wait the limit really needs (15 minutes). | app/forgot-password/page.tsx | Unit: the message minutes equal the limiter's window constant. |
| 3 | A1-062 | The You card says "Couldn't read" when its read fails, and Done does not erase saved details. | app/signup/you/page.tsx | Unit: read error → the couldn't-read state; Done with untouched fields writes nothing. |
| 4 | A1-064 (SW-SPEED) | The /signup page description makes no speed claim. | app/signup/page.tsx | Speed-claim guard ("in seconds", "one minute", "in minutes") over metadata. |
| 5 | A1-063 (SW-RETNAME) | The You card consent box does not name Real Stories. | app/signup/you/_components/you-card.tsx | Retired-names guard. |
| 6 | A1-070 | A failed public-profile read says "Couldn't read"; it is not a 404 and not "Nothing public to show yet". | lib/public-profile.ts · app/u/[userSlug]/page.tsx | Unit: three distinct states for error, missing and empty. |
| 7 | A1-071 | The owner's preview banner names the real path: Profile & settings › Privacy › Public profile. | app/u/[userSlug]/page.tsx | Copy test against the You card's path string (one constant). |
| 8 | A1-072 | A failed Follow shows a plain reason with Try again. | app/u/_components/follow-button.tsx | Unit: the action rejecting renders the reason and restores the old state. |
| 9 | A1-073 | The chapter page claims "Papic Memories" only when measured, and uses the profile's name. | app/u/[userSlug]/c/[chapterId]/page.tsx | Unit: no Papic photos → no claim; name equals the profile name. |
| 10 | A1-005 | Group chat Add, Leave and Join show a plain reason plus Try again when refused. | app/samahan/chat/actions.ts · app/samahan/chat/[threadId]/page.tsx | Action tests return a reason; the page renders it. |
| 11 | A1-008 | A failed group read says so; it is not an empty list. | app/_components/chat/chat-host-strip.tsx · app/samahan/chat/[threadId]/page.tsx · app/samahan/chat/new/page.tsx | Unit: `readEventGroups` / `readGroupPeople` returning null → the couldn't-read state. |

### Batch `a1-a5-money` (11)

Failed reads that show as a real answer, and peso formatting. No price, number or rule changes.

**IDs, in order:** A1-100 · A1-023 · A1-034 · A1-114 · A1-036 · A1-033 · A1-045 · A1-041 · A1-042 · A1-043 · A1-157

| # | ID | Fix | Files | Test that holds the claim |
|---|---|---|---|---|
| 1 | A1-100 (money) | A failed catalogue read shows "Couldn't read the prices" where the paid plans and add-ons go. | app/(shell)/pricing/page.tsx · app/(shell)/pricing/plan/page.tsx · app/_components/frontdoor/front-door-landing.tsx · lib/v2-catalog.ts | Unit per page: catalogue read fails → the line renders; no group silently vanishes. |
| 2 | A1-023 (money) | Papic price dial: a failed price read shows "Couldn't read" with a way to try again, never "You pay nothing". | app/(shell)/papic/page.tsx · lib/papic-tier-config-read.ts · lib/v2-catalog.ts | Unit: read null → the couldn't-read state. |
| 3 | A1-034 (SW-PHP) | Papic money uses `formatPhp`. | app/(shell)/papic/_papic-dial.tsx | Peso-formatter guard. |
| 4 | A1-114 (SW-PHP) | Peso amounts on /, /pricing, the quiz and /features use `formatPhp`; a missing price reads "couldn't read". | app/(shell)/pricing/page.tsx · app/(shell)/pricing/plan/_plan-quiz.tsx · front-door-landing.tsx · lib/feature-pages/price.ts | Peso-formatter guard. |
| 5 | A1-036 (look) | Demo failures on /papic and /panood give a plain reason plus Try again. | app/(shell)/papic/_papic-scan.tsx · app/_components/home/panood-demo-overlay.tsx | Unit: failure state renders the shared Try again button (existing ErrorState; no new look). |
| 6 | A1-033 | Signed in, "Add to an event" says "Couldn't read your events" plus Try again when the read fails. | app/_components/marketing/add-to-event-data.ts · lib/events-for-studio-app.ts | Unit: read error ≠ empty list. |
| 7 | A1-045 | Marketplace "Add to an event": "Start a new event" starts an event; each row goes to the right place. | app/_components/marketing/add-to-event-cta.tsx · add-to-event-data.ts | Unit: every href the dialog builds is asserted against the route list. |
| 8 | A1-041 | Compare: a failed read says "Couldn't read" and offers Try again. | app/(shell)/explore/compare/page.tsx · app/(shell)/explore/_lib/marketplace-view.tsx · lib/reviews.ts | Unit: each of the page's reads failing shows the state in its cell. |
| 9 | A1-042 | Compare uses the one reader for "verified" and "listed". | app/(shell)/explore/compare/page.tsx | `lib/every-listing-asks-findable.test.ts` extended to this page. |
| 10 | A1-043 | Compare uses one rule for which event is "yours" (saved state, distance and the save). | app/(shell)/explore/compare/page.tsx · app/(shell)/explore/actions.ts | Unit: the three read the same event id. |
| 11 | A1-157 | Signed-in supplier browsing shows the seeded verified shops, or an honest reason. | the /?browse=1 view (app/(hub)/page.tsx and its supplier list reader) | Walk on the copy as a supplier: cards show. Unit: reader does not filter on the viewer's role. |

### Batch `a1-a6-doors` (10)

Buttons that land a stranger in the wrong place, plus search hygiene for utility pages.

**IDs, in order:** A1-050 · A1-051 · A1-052 · A1-031 · A1-112 · A1-113 · A1-003 · A1-121 · A1-160 · A1-172

| # | ID | Fix | Files | Test that holds the claim |
|---|---|---|---|---|
| 1 | A1-050 | Landing pages' "Start planning free" starts an event with no account. | app/(shell)/suppliers/_landing.tsx | Unit: href = /start (with the event type). |
| 2 | A1-051 | "See them all on the marketplace" keeps the category and city. | app/(shell)/suppliers/_landing.tsx · lib/discover-suppliers.ts | Unit: the href carries both params and Discover reads them. |
| 3 | A1-052 | Landing copy uses the right article ("an anniversary"). | app/(shell)/suppliers/_landing.tsx | Unit over every event type name. |
| 4 | A1-031 | Every "Start planning · free" lands on /start, not wedding onboarding. | lib/routes.ts · app/(shell)/alaala/page.tsx · app/(shell)/budget/page.tsx · front-door-landing.tsx (and the other doorway pages) | Guard: no public page links `/onboarding/wedding` directly. |
| 5 | A1-112 | Host "start" buttons on /features go to /start. | app/features/_sections/_FinalCTA.tsx · app/features/_feature-page.tsx · app/features/_row-sheet.tsx · app/(shell)/about/page.tsx | Same guard: host start hrefs = /start. |
| 6 | A1-113 | "Browse suppliers" and "Try it" open a page a stranger can use (/suppliers, /features/marketplace). | app/(shell)/about/page.tsx · lib/discover-six-parts.ts · lib/feature-pages/plan-b.ts | Unit: each href is a public route (answers 200 signed out). |
| 7 | A1-003 | Signed in, /samahan's main button creates or opens a group; it does not offer "Add to an event". | app/(shell)/samahan/page.tsx | Unit: signed-in render has the group action href. |
| 8 | A1-121 (look) | /start keeps its own `<main>` landmark. | app/(shell)/start/page.tsx · app/_components/frontdoor/front-door-shell.tsx | Render test: exactly one `<main>`. |
| 9 | A1-160 | Sign-in, sign-up and wall pages are `noindex`; /api/v1 has a canonical (or goes with R8). | the `metadata` of app/login, app/signup, app/signup/you, app/forgot-password, app/reset-password | Unit: each exports robots noindex. |
| 10 | A1-172 | The sign-in card's ✕ closes to the page the person came for, or Home, when /login was opened directly. | app/login/_components/sign-in-card-modal.tsx | Unit: with no history, ✕ goes to `next` or `/`. |

### Batch `a1-a7-tour` (13)

The tour and the sample event.

**IDs, in order:** A1-010 · A1-002 · A1-013 · A1-014 · A1-006 · A1-007 · A1-011 · A1-012 · A1-009 · A1-015 · A1-016 · A1-004 · A1-168

| # | ID | Fix | Files | Test that holds the claim |
|---|---|---|---|---|
| 1 | A1-010 | The sample is called a sample wedding in titles and share text. | app/tour/page.tsx · app/tour/budget/page.tsx (and the other tour pages' metadata) | Copy guard: "real wedding" absent under app/tour. |
| 2 | A1-002 | The tour's "Committed" total comes from the one money reader. | app/tour/budget/page.tsx · lib/budget.ts | Unit: the figure equals `resolveEventMoney` for the sample event. |
| 3 | A1-013 | A "typical range" comes from its home, or is not shown. | app/tour/budget/page.tsx | Unit: no ±15 % constant; with no source the range is absent. |
| 4 | A1-014 | "Bring Memory lane to life" adds new moments, or is clearly a replay. | app/tour/gallery/page.tsx | Unit: no photo id appears twice on the wall. |
| 5 | A1-006 | Find your seat shows the picked guest's name. | app/tour/seating/_components/find-your-seat.tsx | Unit: two guests at one table each see their own name. |
| 6 | A1-007 | On the tour a failed read says "couldn't load, reload". | app/tour/vendors/page.tsx · app/tour/seating/page.tsx · lib/live-wall.ts | Unit per page: read error ≠ empty sample. |
| 7 | A1-011 | The tour copy names only what the ranking uses (no "ranked by distance"). | app/tour/vendors/page.tsx · _components/tour-shortlist.tsx | Copy test. |
| 8 | A1-012 | The tour chat date comes from the sample event. | app/tour/_components/tour-chat-thread.tsx | Unit: the date string is built from `ev.event_date`. |
| 9 | A1-009 (SW-SPEED) | No speed or count claims in tour copy. | app/tour/page.tsx · app/tour/vendors/page.tsx · app/tour/gallery/page.tsx · …/tour-live-wall.tsx | Speed-claim guard over app/tour. |
| 10 | A1-015 | The sample guest Hub speaks to a guest ("Opens on the wedding day"). | app/sample/hub/[guestKey]/page.tsx | Copy test from `SAMPLE_WORDS`. |
| 11 | A1-016 | The sample ticket's "Copy link" copies a full https address on /sample/hub/…. | app/[slug]/_components/guest-ticket.tsx · app/sample/hub/[guestKey]/page.tsx | Unit: copied text starts with https://setnayan.com/sample/hub/. |
| 12 | A1-004 (SW-COMING) | The three people on /sample can be opened, or are not offered. | app/sample/page.tsx | Route test: each offered href answers 200. |
| 13 | A1-168 (SW-PLACE) | No made-up couple as a real example on Home and /pricing. | front-door-landing.tsx · app/(shell)/pricing/page.tsx | Placeholder guard: the made-up names appear only inside something marked as a sample. |

### Batch `a1-a8-words` (15)

Marketing copy that claims rank, speed, a forever promise, a retired product or a stale fact. Words only.

**IDs, in order:** A1-159 · A1-105 · A1-111 · A1-110 · A1-109 · A1-106 · A1-025 · A1-049 · A1-024 · A1-030 · A1-029 · A1-026 · A1-067 · A1-068 · A1-055

| # | ID | Fix | Files | Test that holds the claim |
|---|---|---|---|---|
| 1 | A1-159 | No rank claims in the /pricing H1 or the /about title. | app/(shell)/pricing/page.tsx · app/(shell)/about/page.tsx · app/(shell)/tl/about/page.tsx | Rank-claim guard ("best", "first", "#1", "only"). |
| 2 | A1-105 | No "the first", "other wedding apps", "elsewhere". | app/(shell)/about/_about-motion.tsx · about/page.tsx · tl/about/page.tsx · app/features/_sections/_WhySetnayan.tsx | Rank-claim and comparison guard. |
| 3 | A1-111 | /about and /tl/about state current facts. | app/(shell)/about/_about-motion.tsx · tl/about/page.tsx · lib/help/topics-existing.ts | Facts read from their constants (plans, counts), asserted in a test. |
| 4 | A1-110 | /features supplier plan facts are read from `TIER_CAPS`. | lib/features-page.ts · lib/feature-pages/suppliers-b.ts · lib/vendor-tier-caps.ts | Unit: rendered caps equal `TIER_CAPS`. |
| 5 | A1-109 (SW-COMING) | /features shows no "Coming" rows a person can press and no internal build-lane names. | lib/features-page.ts · app/features/_row-sheet.tsx | `the-public-page-shows-no-internals.test.ts` extended. |
| 6 | A1-106 (SW-RETNAME) | Retired reels are not sold as live. | app/(shell)/our-story/page.tsx · app/_components/marketing/OurStory.tsx · app/features/_sections/_WhySetnayan.tsx | Retired-names guard from `lib/retired-products.ts`. |
| 7 | A1-025 (SW-RETNAME) | The Logo Maker page does not sell the retired animated product or an off-sale add-on. | app/(shell)/palogo/page.tsx | Retired-names guard. |
| 8 | A1-049 (SW-RETNAME) | Creators page: no retired Stories page, no "only" claim. | app/creators/_components/creator-story-sections.tsx · next.config.ts | Retired-names and rank-claim guards. |
| 9 | A1-024 (SW-PROMISE) | Papic does not suggest full-size photos are kept forever. | app/(shell)/papic/_papic-sections.tsx · papic/page.tsx · papic/try/page.tsx | Promise-words guard ("expires", "forever", "keep" claims checked against the catalogue keep-times). |
| 10 | A1-030 (SW-PROMISE) | Mood Board does not promise "nothing that expires". | app/(shell)/mood-board/page.tsx | Promise-words guard. |
| 11 | A1-029 (SW-SPEED) | No "in seconds" / "one minute". | app/(shell)/pawebsite/page.tsx · app/(shell)/papic/_papic-dial.tsx · papic/try/page.tsx | Speed-claim guard. |
| 12 | A1-026 | The Budget page's search and share text describes the shipped Budget (Target · Agreed · Paid · Owed). | lib/studio-apps.ts | `product-pages-say-what-ships.test.ts` extended to metadata. |
| 13 | A1-067 | /download does not say "Trusted". | app/(shell)/download/page.tsx | Public-copy word guard. |
| 14 | A1-068 | /download tells one story: this download is the Live Watch encoder. | app/(shell)/download/page.tsx | Copy test: no planning-app sentence. |
| 15 | A1-055 (SW-WEDDING) | Marketplace and compare copy speaks to every event type. | app/(shell)/marketplace/page.tsx · lib/studio-apps.ts · lib/marketplace-service-cards.ts · app/(shell)/explore/compare/page.tsx | Event-words guard on these files. |

### Batch `a1-a9-help-legal-seo` (15)

Help answers, legal pages and what search engines and AI read. Legal text states only what runs; A1-089 (the provider list) stays lane C.

**IDs, in order:** A1-084 · A1-093 · A1-092 · A1-086 · A1-107 · A1-066 · A1-069 · A1-088 · A1-090 · A1-091 · A1-087 · A1-163 · A1-164 · A1-162 · A1-161

| # | ID | Fix | Files | Test that holds the claim |
|---|---|---|---|---|
| 1 | A1-084 | A failed story read on a /help search says the stories could not be read. | app/_components/how-search/how-search.tsx | Unit: read error renders the line. |
| 2 | A1-093 (SW-PROMISE) | Help answers make no banned promises. | lib/help/topics-existing.ts · app/_components/help-ask/help-ask-places.ts | Promise-words guard over the help corpus. |
| 3 | A1-092 (SW-COMM) | Help uses only "Hosts pay 0% commission." | lib/help/topics-existing.ts (app/api/v1/page.tsx goes with R8) | The commission-line guard. |
| 4 | A1-086 (SW-WORDS) | Help and privacy use house words. | lib/help/topics-existing.ts · app/(shell)/privacy/page.tsx | House-words guard. |
| 5 | A1-107 (SW-WORDS) | "Logo Maker" on /features/logo-maker and /about. | lib/feature-pages/invite.ts · app/(shell)/about/page.tsx | House-words guard. |
| 6 | A1-066 (SW-COMM) | /waitlist uses the ruled commission line and no "Pre-register". | app/(shell)/waitlist/page.tsx | Commission-line guard plus copy test. |
| 7 | A1-069 | The supplier invite states one true rule about when a partner shows. | app/i/[slug]/page.tsx · app/vendor/claim/[token]/_components/claim-parts.tsx | Copy test: one shared constant used by both. |
| 8 | A1-088 | Privacy's "Public Event Summary" states only what runs, on a live address. | app/(shell)/privacy/page.tsx · lib/legacy-redirects.ts | Link test: every address named in /privacy answers 200. |
| 9 | A1-090 | Privacy states the real keep-times for full-size originals per plan. | app/(shell)/privacy/page.tsx · lib/event-ultra.ts | Unit: the months are read from the plan constants, not typed. |
| 10 | A1-091 | iPhone-app purchases are not presented as live. | app/(shell)/refunds/page.tsx · app/(shell)/privacy/page.tsx · lib/help/topics-existing.ts | Copy guard on "App Store" / "in-app purchase". |
| 11 | A1-087 (SW-RETNAME) | Privacy does not describe retired products as live. | app/(shell)/privacy/page.tsx · lib/retired-products.ts | Retired-names guard. |
| 12 | A1-163 | llms.txt is true and complete today, in house words. | the /llms.txt route | The word, promise and retired-name guards run over its output; every route it names exists. |
| 13 | A1-164 | Search can find Setnayan: the help answers and home are indexable and listed. | robots, sitemap index, the /help/[slug] metadata | Test: robots allows them; each is in a sitemap; canonical present. |
| 14 | A1-162 | Every listed sitemap holds pages; only public, indexable pages; addresses in house words. | the sitemap routes | Test: no empty child sitemap; no sign-in URL; every URL answers 200 signed out. |
| 15 | A1-161 | Each page has a unique title ending once in "· Setnayan", its own description and a share picture. | the `metadata` exports of the pages in the finding's list | New guard `lib/public-metadata-is-unique.test.ts`. |

## Lane B · one line per screen

Each drawing section shows Now beside Proposed at 375 px and 1280 px, light and dark; only the change differs from shipped. Nothing here is built until the controller fills the approval.

| # | Screen to change | Findings | Drawing section | Approval |
|---|---|---|---|---|
| 1 | Signed-out shell, desktop rail (every shelled page) | A1-167 | §01 (`#s01`) | APPROVAL: pending controller |
| 2 | / first screen (hero) | A1-116 | §02 (`#s02`) | APPROVAL: pending controller |
| 3 | / close and sticky bar | A1-115 LIVE | §03 (`#s03`) | APPROVAL: pending controller |
| 4 | /features and /tl/features hero | A1-116 | §04 (`#s04`) | APPROVAL: pending controller |
| 5 | /about and /tl/about button pairs | A1-115 LIVE | §05 (`#s05`) | APPROVAL: pending controller |
| 6 | Doorway kit lists and close: /alaala /budget /guest-list /mood-board /palogo /panood /pawebsite /schedule /seat-plan /setnayan-ai /marketplace /samahan | A1-037 A1-053 | §06 (`#s06`) | APPROVAL: pending controller |
| 7 | Product-page plain answer line: /budget /seat-plan /schedule /setnayan-ai /creators /our-story /pricing /about | A1-165 | §07 (`#s07`) | APPROVAL: pending controller |
| 8 | Loading (Ghost) on the 12 doorway pages, /samahan, /suppliers, /explore/compare, /marketplace, /creators, /help, /help/topics, /articles, /articles/write and the six legal pages | A1-020 A1-040 A1-054 A1-099 | §08 (`#s08`) | APPROVAL: pending controller |
| 9 | /features lists ("Why Setnayan", "Who's who") | A1-119 | §09 (`#s09`) | APPROVAL: pending controller |
| 10 | /creators grids | A1-053 | §10 (`#s10`) | APPROVAL: pending controller |
| 11 | /papic Event Hub mock | A1-038 | §11 (`#s11`) | APPROVAL: pending controller |
| 12 | /monogram studio buttons | A1-039 | §12 (`#s12`) | APPROVAL: pending controller |
| 13 | /tour and the four tour stops (buttons, stop list, close) | A1-019 | §13 (`#s13`) | APPROVAL: pending controller |
| 14 | /tour/vendors sample chat | A1-018 | §14 (`#s14`) | APPROVAL: pending controller |
| 15 | /tour/budget adjust popup | A1-017 | §15 (`#s15`) | APPROVAL: pending controller |
| 16 | /explore/compare buttons | A1-044 | §16 (`#s16`) | APPROVAL: pending controller |
| 17 | /login, provider-refusal and dead-link states | A1-076 | §17 (`#s17`) | APPROVAL: pending controller |
| 18 | Sign in as the small popup: top-bar Sign in, /login, /signup | A1-074 A1-153 | §18 (`#s18`) | APPROVAL: pending controller |
| 19 | /signup, /login, /forgot-password tap targets, field errors, dark focus | A1-171 A1-079 | §19 (`#s19`) | APPROVAL: pending controller |
| 20 | /signup and /signup/you loading skeleton | A1-078 | §20 (`#s20`) | APPROVAL: pending controller |
| 21 | /signup/you (the You card) | A1-075 | §21 (`#s21`) | APPROVAL: pending controller |
| 22 | Report popup: /u/[userSlug], /u/[userSlug]/c/[chapterId], /articles/[slug], /v/[slug] | A1-077 A1-095 A1-141 | §22 (`#s22`) | APPROVAL: pending controller |
| 23 | /samahan/chat/new | A1-021 | §23 (`#s23`) | APPROVAL: pending controller |
| 24 | /pricing page order and accent (and /features, /tl/features order) | A1-118 | §24 (`#s24`) | APPROVAL: pending controller |
| 25 | /pricing first-visit tour | A1-158 | §25 (`#s25`) | APPROVAL: pending controller |
| 26 | /pricing and /pricing/plan ⓘ notes | A1-117 | §26 (`#s26`) | APPROVAL: pending controller |
| 27 | /pricing/plan (the quiz) | A1-120 | §27 (`#s27`) | APPROVAL: pending controller |
| 28 | /start | A1-120 | §28 (`#s28`) | APPROVAL: pending controller |
| 29 | /help "Message us" | A1-097 | §29 (`#s29`) | APPROVAL: pending controller |
| 30 | /help/[slug] | A1-098 | §30 (`#s30`) | APPROVAL: pending controller |
| 31 | /help search results, /help/topics/[key], /help/guides/[key] buttons | A1-094 | §31 (`#s31`) | APPROVAL: pending controller |
| 32 | /articles/write | A1-096 | §32 (`#s32`) | APPROVAL: pending controller |
| 33 | "Add to an event" popup (signed in, /pricing, /marketplace and the doorway pages) | A1-035 A1-046 A1-117 | §33 (`#s33`) | APPROVAL: pending controller |
| 34 | /panood Live Watch demo | A1-035 | §34 (`#s34`) | APPROVAL: pending controller |
| 35 | /v/[slug] portfolio photo and "Photos by service" | A1-142 | §35 (`#s35`) | APPROVAL: pending controller |
| 36 | /v/[slug] pinned review and supplier reply | A1-144 | §36 (`#s36`) | APPROVAL: pending controller |
| 37 | /v/[slug] service filter | A1-145 | §37 (`#s37`) | APPROVAL: pending controller |
| 38 | /v/[slug] "Get directions" and waitlist button | A1-150 LIVE A1-143 | §38 (`#s38`) | APPROVAL: pending controller |
| 39 | /v/[slug] Inquire popup and /v/[slug]/dates start + send | A1-143 | §39 (`#s39`) | APPROVAL: pending controller |
| 40 | /v/[slug] Book this package, full service card, Check a date, award screen | A1-141 | §40 (`#s40`) | APPROVAL: pending controller |

### Notes for the controller on lane B

- **Desktop shape of the shared parts (sections 15, 18, 21, 23, 27–29, 32–34, 40).** Add 1 words a small popup as "a centred dialog on desktop" and a full-screen popup as "a large centred dialog on desktop". The shipped `Sheet` is a right-hand drawer from 1024 px and the shipped `RiseScreen` fills the window. The drawings use the shipped parts. One ruling settles all of them; if the parts change, that is one shared build, not eleven.
- **Really lane C, in my reading:**
  - **A1-118 (/pricing order, §24).** It removes two sections from /pricing and moves where each plan is offered, and Add 4 ("plans come last") and Part H4 ("the first prices show without a swipe") disagree. The owner should choose before a build.
  - **A1-120, the /start half (§28).** /start is an address other pages and search link to. Making it a popup changes Back, refresh and deep links: a function change unless the address keeps opening it.
  - **A1-098 (/help/[slug] into the shell, §30).** The page is outside the shell on purpose so it can be pre-built and cached. Moving it must not make it dynamic; if it does, it trades against SW-PERF.
  - **A1-158 (remove the /pricing tour, §25).** Small, but it retires a shipped first-visit feature.
- **Likely lane A, no drawing needed:** the third bullet of A1-116 (`.m-btn-primary` / `--m-mulberry` "instead of terracotta"). Both resolve to `#C24E25` today, so swapping the token changes no pixel.
- **Needs a browser look before building:** the /features close (A1-115): in code the second button is already a quiet outline on the dark band. The dark Terms hint on /signup (A1-079): the code's dark rule may already win.
- **Copy the owner must approve:** the plain-answer line for each of the eight product pages (§07); only /budget is drafted.
- **Out of scope here:** SW-K2 has no area-1 members. Add 15/16 (the one mark, the ring loader) are owner-approved and cross-area; area 1 touches them only on the sign-in card's mark.

