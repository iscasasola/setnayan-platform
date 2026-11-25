# Final check · ALL FINDINGS · one list, lanes A / B / C / R

**Date:** 25 Nov 2026 · merged by the controller's helper from the eight area reports (no code read or changed). Main frozen at bd86936 during the check.

**Sources** (`build-sessions/final-check/area-N.md` on each branch):

| Area | Branch | Commit | SEVERITY lines |
|---|---|---|---|
| 1 · Front door & public pages | `final-check/area-1` | `486a945804` | 173 |
| 2 · Couple: create & plan | `final-check/area-2` | `9de8c6c3a6` | 155 |
| 3 · Couple: Maker, Event Hub, Papic, Memories | `final-check/area-3` | `ca2a8c86a6` | 91 |
| 4 · Guest | `final-check/area-4` | `c652639641` | 96 |
| 5 · Supplier: shop, cards, Toolkit, plans | `final-check/area-5` | `d72c578c10` | 127 |
| 6 · Supplier: bookings, chat, payments | `final-check/area-6` | `d206a3e405` | 95 |
| 7 · Coordinator, Spaces, maps | `final-check/area-7` | `e531401583` | 36 |
| 8 · Admin | `final-check/area-8` | `d3be6d556e` | 296 |

**Counts.** 1069 SEVERITY lines → 1067 findings (A1-056 is filed twice in area 1; A6-63 is marked "—", not a finding). After de-dup: **638 entries** (30 cross-area sweeps) + **9 retired candidates** covering 17 findings. **LIVE** (seen on setnayan.com): 21.

| Lane | blocker | broken | money-signin | wrong | look | findings | entries after de-dup |
|---|---|---|---|---|---|---|---|
| A | 5→3 | 100→93 | 120→85 | 404→307 | 27→17 | 656 | 505 |
| B | 0→0 | 0→0 | 0→0 | 0→0 | 348→107 | 348 | 107 |
| C | 0→0 | 0→0 | 37→22 | 8→3 | 1→1 | 46 | 26 |
| R | 0 | 5 | 0 | 8 | 4 | 17 | 9 |

Cells read *findings → entries*. A sweep or cluster takes the worst severity of its members. Original IDs are kept; area 3 and area 8 IDs have no area prefix in their reports, so they show here as `A3·E-01`, `A8·D-4` (search the area file for `E-01`, `D-4`).

**Handoff rule.** A = no screen change, fix in batches. B = a look change, needs a Fable drawing first (sweeps marked SW follow the already-approved house standard: one reference drawing per sweep). C = function, rule or money: never built without the owner. R = delete, do not fix (Add 17); fixers skip these pages until the owner rules.

**Classification notes.** Lanes were set by rules over each finding's title, ACTUAL, EXPECTED and RULE, then checked by hand for every money-signin and every C item. Money items moved to A only when no number or rule changes: a hand-rolled peso formatter, a failed read that must show "couldn't read" instead of ₱0/Free/a lock, a missing guard that enforces a rule that already exists. Missing-guard items stay A even when tagged money-signin (e.g. A8·L-1, A8·G-4); call them out if you want them in C.

## Owner list (🟠) · every lane C item, one sentence each

**Money**

- From "Sign in to get Event Plus" to a logged payment is well over 4 taps and three priced rows have no button: add a buy door to each priced row? (A1-170)
- Event services shows Event Pro priced below Event Plus and Event Ultra "Couldn't read": confirm the ladder Plus < Pro < Ultra in the catalogue. (A2-P2)
- The order page says VAT is added on top while the list says "incl. VAT": which tax wording is right on every money screen? (A2-P3)
- About pages mark Save the Date and the animated logo "Free" above copy that sells their paid parts: what exactly is free? (A3·S-02)
- Admin referral copy says "set the reward below" but there is no reward control: add a setter, or point to where it is set? (A8·G-1)
- Pages and admin Plan contents disagree on what Event Plus / Pro / Ultra hold (Ultra missing in admin, keep-times differ, supplier plan ladder differs): confirm the one plan story. (A1-101 B5-23 A8·B-11 A8·B-12)
- The supplier booking fee is shown to hosts on public pages and on not-yet-verified shops: confirm it is never shown to hosts. (A1-102 A1-122)
- Owed, agreed and paid money is added up separately on orders, receipts, Home, Your team, the planning list, the supplier's client rows and admin revenue; confirm they all switch to the one money reader (the figures people see will change to the right ones). (A2-F2 A2-F9 A2-B5 A2-G3 A2-I2 A6-34 A8·A-4)
- Event Hub locks (hero photo, our story, prints) name Event Plus on the badge and Event Pro in the note with no price: which plan unlocks the Event Hub look, and show its price? (A3·E-04 A3·E-12 A3·M-04)

**Sign-in**

- /reset-password lets any signed-in device set a new password without the current one or the emailed link: require one of them? (A1-057)
- A supplier who goes sign-up → sign-in → back is filed as a couple: keep the supplier choice through the round trip? (A1-059)
- The sign-up referral banner promises a reward that may not exist: show it only when the programme is on and a reward is set? (A1-060)
- A no-account (anonymous) session gets past the article sign-in gate: treat it as signed out? (A1-080)
- Sign-in takes about a minute and creating an event over two on the copy: accept as copy health, or a sign-in speed job? (A1-156)
- The Get-together tile sends signed-out visitors to login before any question: allow the questions without an account (save asks)? (A2-A2)
- A rate-limited signed-out host cannot save and gets no way on: offer sign-in with the draft kept? (A2-A3)
- Securing an anonymous plan with Google or log-in loses the event: move it to the signed-in account? (A2-A4)
- A supplier opening a couple's lock link while signed in as themselves is told "Create your event first": what should a non-host account see? (A6-27)
- Signed-in people are sent back to sign-in when the session check is slow or several tabs refresh, and a right password can read as wrong: approve the sign-in fix (stay signed in, honest "couldn't reach sign-in"). (A2-P20 A3·N-01 B5-01 B5-05 B5-19 A6-B16)

**Rules (who can do what)**

- The privacy page contradicts itself and the code on which AI provider reads what: approve one corrected list (legal text). (A1-089)
- "Release this package" un-books suppliers already paid, with no check: should money that moved block it or go to the dispute path? (A2-G12)
- Supplier seat counts include paused and removed team members: should only active members use a seat? (A5-G5-01)
- A deposit-paid booking still shows "not confirmed on Setnayan yet" and locks the day-of tools: should a booking marked deposit_paid without the Setnayan handshake unlock them? (A6-B17)

**Setnayan AI**

- Suppliers shows "Unlock" Setnayan AI with no price: per Add 20 should it read "included in Event Pro and Ultra" with a door to Pricing? (A2-P24)
- The tour calls the AI shortlist free and /setnayan-ai says "0% … never what pays us" and lists a coming feature: approve rewriting to Add 20 (included in Event Pro and Ultra, only what works today). (A1-001 A1-022 A1-028)
- Setnayan AI shows three prices (₱265 on /pricing, ₱2,790 in the live catalogue, ₱1,499 you said) and admin falls back to typed prices: set the one catalogue value. (A1-155 A8·B-3)

Also waiting on the owner (from the brief, not area findings): Add 19/20 retire the AI buy page and the concierge settings page (R1, R2 below, already ruled); Add 21–24 which AI features to build (nothing is built until he picks); Add 10 offline levels beyond the five places.

## Lane A · no screen change (fix in batches)

### All areas · shared fixes (one batch each; full ID lists under "Sweeps" at the end)

- [A][blocker] SW-500 (4 IDs · areas 1,3,4,5) · shops + Event Hubs · HTTP 500 after ~24 s → render, or an honest error in 2 s (Add 14 caveat)
- [A][broken] SW-COMING (9 IDs · areas 1,2,4,5,8) · "Coming soon" · coming-soon rows and dead buttons a person can press → hidden until live, or working
- [A][broken] LIVE SW-URI (5 IDs · areas 1,3,5,8) · URL message params · a "%" or crafted ?error= crashes or prints URL text → safe decode, fixed message keys
- [A][broken] SW-HYDR (3 IDs · areas 2,6,8) · hydration · React #418 on load → server and client draw the same markup
- [A][broken] SW-TELE (2 IDs · areas 6,8) · `/api/telemetry/client-fault` · fault reporter answers 500 → records and answers 2xx
- [A][money-signin] SW-PHP (42 IDs · areas 1,2,3,4,5,6,7,8) · `lib/php.ts` · hand-made peso formatting (₱0 on missing, Math.abs) → formatPhp; missing reads "couldn't read"
- [A][money-signin] SW-BOOKED (17 IDs · areas 1,2,3,5,6,7) · booked status lists · own copies of "booked" statuses → `BOOKED_EVENT_VENDOR_STATUSES` only
- [A][money-signin] LIVE SW-PROMISE (11 IDs · areas 1,2,3,4,5,7) · promise words · "free forever", "for good", "for life", "no end date" → no promise words
- [A][money-signin] LIVE SW-COMM (4 IDs · areas 1,8) · commission line · variants of the 0% line → only "Hosts pay 0% commission."
- [A][wrong] LIVE SW-WORDS (29 IDs · areas 1,2,3,4,5,6,8) · house words · Monogram, Pabuya, vendor, Journal, site, Vendor AI → Logo Maker, E-Gifts, supplier, Articles, Event Hub
- [A][wrong] SW-RETNAME (8 IDs · areas 1,2,3,8) · retired names · Patiktok, reels, Real Stories, Animated Monogram, custom quote → never named
- [A][wrong] SW-RAWDB (8 IDs · areas 2,3,4,5) · form actions · raw database error text → a plain sentence that says what to do
- [A][wrong] SW-WEDDING (6 IDs · areas 1,2,4,5) · event-type words · wedding words on every event type → words from the event type
- [A][wrong] SW-NOPRICE (6 IDs · areas 3,5,6) · upgrade walls · lock or "See plans" with no plan or ₱ → plan name + catalogue price, one button (Add 4)
- [A][wrong] SW-SPEED (4 IDs · areas 1,5) · speed claims · "in seconds", "one minute", "a business day" → no speed promises
- [A][look] SW-PLACE (7 IDs · areas 1,2,4,5,6,8) · made-up data, raw codes · "EXAMPLE" people, Maria & Jose, "Time TBD", raw codes → real data or honest empty state
- [A][look] LIVE SW-PERF (3 IDs · areas 1) · public page speed · rendered per request, none usable in 0.7 s → cache static marketing pages at the edge

### Area 1 · Front door & public pages (78)

- [A][blocker] A1-056 · /signup `secure-account-banner.tsx` · "Secure my plan" never reaches the sign-up form for a host with no account → The Create account card.
- [A][wrong] A1-061 · /signup `actions.ts` · /signup promises a guest's photos will move to the new account; sign-up no longer does that → No promise, or a promise the sign-up keeps.
- [A][broken] LIVE A1-082 · /help/[slug] · The answer page's topic breadcrumb points at an anchor that does not exist → The topic opens ((code) → /help/topics/<key>).
- [A][broken] LIVE A1-081 · /help/guides/[key] · A shared guide or topic link is a 404 for anyone signed out, not a sign-in door → The guide or topic, or a "Sign in to see this" door.
- [A][broken] A1-172 · /login · The sign-in card's ✕ does nothing when the page was opened directly → The card closes to somewhere real: the page the person came for, or Home.
- [A][wrong] A1-160 · /login · Sign-in pages and walls are indexed; /api/v1 is indexed with no canonical → Utility and private pages stay out of search (Add 9 SEO): noindex on sign-in, sign-up and th…
- [A][broken] A1-045 · /marketplace `add-to-event-data.ts` · Marketplace "Add to an event" goes to the wrong places (signed in) → "Start a new event" starts an event, like the page's own "Start plann…
- [A][broken] LIVE A1-148 · /pricing · /pricing answered HTTP 502 once → 200 every time.
- [A][wrong] A1-159 · /pricing · "The best place to build your event." and "the Philippines-first … platform" → No rank claims (brand.md claim 11).
- [A][broken] A1-003 · /samahan · Signed in, /samahan's main button becomes "Add to an event", which sends people… → A group belongs to the account, not to an event (the page's own docblock says so).
- [A][broken] A1-005 · /samahan/chat/[threadId] `actions.ts` · Group chat Add, Leave and Join chat fail silently → A refusal shows a plain reason plus Try again.
- [A][wrong] A1-008 · /samahan/chat/[threadId] · Group chat turns failed reads into empty lists → A failed read says so. `readEventGroups` and `readGroupPeople` return `null` precisely so the page…
- [A][broken] A1-050 · /suppliers/[event]/[category] `_landing.tsx` · Landing pages' "Start planning free" asks for an account first → It starts an event with no account (the account is asked for at…
- [A][broken] A1-051 · /suppliers/[event]/[category] `_landing.tsx` · "See them all on the marketplace" drops the category and city → Discover's supplier view narrowed to this page's category, city a…
- [A][wrong] A1-052 · /suppliers/[event]/[category] `_landing.tsx` · Landing copy puts a fixed "a" before the event name → Correct English: "an anniversary", "Planning an event?".
- [A][broken] A1-124 · /v/[slug] `middleware.ts` · Every internal link breaks on a shop's own web address → Each link opens its screen.
- [A][broken] A1-125 · /v/[slug] `error.tsx` · One failed reviews or services read takes the whole shop page down → That one section says "Couldn't load"; the rest of the page still shows.
- [A][broken] A1-127 · /v/[slug] `share-button.tsx` · Share does nothing when the phone has no share sheet and copying fails → It shares or copies, or it says why it could not, with Try again.
- [A][money-signin] A1-123 · /v/[slug] `package-card.tsx` · A package saved at ₱0 shows "₱0" to couples → Same rule as the service cards: no figure, "Price on request", never ₱0.
- [A][wrong] A1-128 · /v/[slug] · A failed shop read shows "Page not found", and the copy kept for strangers holds it → "Couldn't open this shop, reload", never a 404.
- [A][wrong] A1-129 · /v/[slug] `reviews.ts` · A failed trusted-stats read says "none yet" → "Couldn't load the rating" or similar.
- [A][wrong] A1-130 · /v/[slug] · The review count includes reviews the page hides, and "Show more reviews" never… → The bars and "N reviews" count only what can be listed, and the pager stops when n…
- [A][wrong] A1-131 · /v/[slug] · A not-yet-verified shop's service cards still show reviews and stars → No review and no rating anywhere until the shop is verified (the page's own Reviews section sa…
- [A][wrong] A1-138 · /v/[slug] `shop-seals.ts` · Rank-claim award names on the shop page → No "first" / "#1" / "only" style rank claims.
- [A][wrong] A1-139 · /v/[slug] `trusted-by-carousel.tsx` · Every Trusted partner wears a check badge, verified or not → A check badge only on a verified partner.
- [A][wrong] LIVE A1-151 · /v/[slug] · Test shops are public and are the only shops in the sitemap → Only real, published shops are public and indexed; test shops are hidden (or marked DEMO ONLY and…
- [A][broken] A1-126 · /v/[slug]/booth `booth-showcase-client.tsx` · The 3D booth page has no way back to the shop → A way back to the shop (✕ or a back link), as the not-set-up page already has.
- [A][wrong] A1-136 · /v/[slug]/booth · The booth keeps working for a shop whose paid plan has expired → The expired plan collapses to Free, as the shop page does (`effectiveSeoTier`), so the "Pro fe…
- [A][money-signin] A1-100 · / `v2-catalog.ts` · A failed catalog read makes the paid plans disappear, as if nothing is for sa… → A "Couldn't read the prices" line where the paid plans and add-ons go.
- [A][wrong] LIVE A1-104 · / `front-door-landing.tsx` · "Trust" promises about suppliers → No "trusted" style marketing promise about suppliers.
- [A][money-signin] A1-023 · /papic · Papic price dial: a failed price read shows "You pay nothing" or vanishes → A failed price read shows "Couldn't read" plus a way to try again.
- [A][wrong] LIVE A1-149 · /papic `demo-sessions.ts` · /papic creates a demo session and opens a live connection for every vi… → A public page opens no live connection and writes nothing until a pers…
- [A][look] A1-036 · /papic `_papic-scan.tsx` · Demo failures give no Try again button → A plain reason plus a Try again button.
- [A][wrong] A1-157 · /?browse=1 · Signed-in supplier browsing says "No services listed yet" while ten verified sho… → The seeded verified shops and their service cards (Liwanag alone has 4), or an h…
- [A][wrong] A1-105 · /about `_about-motion.tsx` · Rank and comparison claims ("the first", "other wedding apps", "elsewhere") → No "first/#1/only" claims and no comparisons with other products.
- [A][wrong] A1-111 · /about `ai-answers.ts` · /about and /tl/about state stale or false product facts → The current facts.
- [A][wrong] A1-113 · /about `plan-b.ts` · "Browse suppliers" and "Try it" put a stranger on the sign-in page → A page the stranger can use (the public /suppliers directory exists and /features/marke…
- [A][wrong] A1-031 · /alaala `routes.ts` · Every "Start planning · free" opens wedding onboarding, skipping the event-… → Land on /start ("What kind of event are you planning?"), which the front doo…
- [A][wrong] A1-026 · /budget `product-pages-say-what-ships.test.ts` · Budget page's search and share text still sells the removed "s… → It describes the shipped Budget: Target · Agreed · Paid · Owed…
- [A][wrong] A1-033 · /budget `add-to-event-data.ts` · Signed in: "Add to an event" says "You don't have an event yet" when t… → "Couldn't read your events" plus Try again (the helper `userEventsRead…
- [A][wrong] A1-067 · /download · /download says "Trusted" → No "trusted" promise.
- [A][wrong] A1-068 · /download · /download sells the desktop app for planning, then says it is only for Live Watch → One story. Per the owner's 24 Nov fix, this download is the Live Watch encoder.
- [A][wrong] A1-041 · /explore/compare `reviews.ts` · Compare: a failed read shows as a real answer → A failed read says "Couldn't read" and offers Try again.
- [A][wrong] A1-042 · /explore/compare `every-listing-asks-findable.test.ts` · Compare works out "verified" and "listed" itself instead o… → The shop leaves every couple-facing list and loses its bad…
- [A][wrong] A1-043 · /explore/compare `actions.ts` · Compare uses a second rule to decide which event is "yours" → The saved state, the distance and the save itself all use the same event.
- [A][wrong] A1-110 · /features `features-page.ts` · /features supplier plans are typed by hand and wrong → Plan facts read from TIER_CAPS: live cards 1 · 3 · 15 · no limit · no limit; people beyond…
- [A][wrong] A1-112 · /features `_FinalCTA.tsx` · Host "start" buttons send a stranger to sign-up instead of /start → /start, so the host begins with no account and is asked for one at save.
- [A][wrong] A1-065 · /forgot-password · "Wait a minute" on /forgot-password, but the limit lasts 15 minutes → The wait it really needs.
- [A][wrong] A1-084 · /help `how-search.tsx` · A failed story read on a /help search is silently dropped → The page says the stories could not be read.
- [A][wrong] A1-166 · /help · With no signal, help and public pages show the browser's blank error, not even Set… → The help answers from a saved copy (phase A marked them READ-ONLY IS ENOUGH), or at…
- [A][wrong] A1-164 · /help/what-is-setnayan · Web search knows nothing about Setnayan today → The help answers above come back, or at least setnayan.com.
- [A][wrong] A1-069 · /i/[slug] `claim-parts.tsx` · The supplier invite contradicts itself on when partners show → One true rule about when a partner shows on the other's page.
- [A][wrong] A1-163 · /llms.txt · llms.txt tells AI things the site does not do, and uses banned words and promises → True and complete today (Add 9 GEO), in brand.md words.
- [A][wrong] LIVE A1-032 · /panood/demo/[token] · Live Watch demo dead-end sends people to a homepage tile that no longer… → Point to where the demo lives now (/panood → "Try the control room with tw…
- [A][wrong] A1-088 · /privacy `legacy-redirects.ts` · Privacy's "Public Event Summary" promises safeguards that are not built, on a retired address → The notice states only what runs.
- [A][wrong] A1-090 · /privacy · Privacy understates how long full-size originals are kept on paid plans → "Kept 3 months (6 on Event Pro, 12 on Event Ultra), then a 720p copy".
- [A][wrong] A1-091 · /refunds · iPhone-app purchases are described as live → The native iPhone app and Apple in-app purchases are not presented as live.
- [A][wrong] A1-015 · /sample/hub/[guestKey] · The sample guest Hub tells a guest "Opens on your wedding day" → Words for a guest, such as "Opens on the wedding day", built from `SAMPLE_WORDS`.
- [A][wrong] A1-016 · /sample/hub/[guestKey] · The sample ticket's "Copy link" copies a bare path, and its fallback points at a real-guest route → A full https://setnayan.com/sample/hub/… address.
- [A][wrong] A1-062 · /signup/you · The You card shows blanks when its read fails, and Done erases saved details → "Couldn't read" and nothing saved.
- [A][wrong] A1-162 · /sitemap.xml · Sitemaps: an empty weddings sitemap, sign-in pages listed, old words in help ad… → Every listed sitemap holds pages; only public, indexable pages; addresses in ho…
- [A][wrong] A1-010 · /tour · The sample is called "a real wedding" in titles and share text → It is clearly marked as a sample, as the ribbon says ("a sample wedding").
- [A][wrong] A1-002 · /tour/budget `budget.ts` · The tour's "Committed" total comes from a second money reader and counts… → Committed comes from the one reader, `resolveEventMoney(code)CONFIRMED.has…
- [A][wrong] A1-013 · /tour/budget · The planner's "typical range" is made up from a fixed ±15% band → A "typical range" comes from its home ((code)), or is not shown.
- [A][wrong] A1-014 · /tour/gallery · "Bring Memory lane to life" adds copies of photos already on the wall → New moments arrive, or the demo is clearly a replay.
- [A][wrong] A1-006 · /tour/seating `find-your-seat.tsx` · Find your seat shows the wrong guest's name for a shared table → "<picked name>, you're at <table>."
- [A][wrong] A1-007 · /tour/vendors · On the tour, failed reads look like an empty or zero sample → The read failure is said in words ("couldn't load, reload"), as /tour/seating and /tour/gallery alr…
- [A][wrong] A1-011 · /tour/vendors · "Ranked by distance" is claimed, but the tour never uses distance → The copy names only what the ranking uses.
- [A][wrong] A1-012 · /tour/vendors `tour-chat-thread.tsx` · The tour chat hard-codes a wedding date that will have passed by la… → The date comes from the sample event (`ev.event_date`), and the sam…
- [A][wrong] A1-070 · /u/[userSlug] `public-profile.ts` · A failed read shows a 404 or "Nothing public to show yet" on a real… → "Couldn't read", which is different from "no such profile" and from "n…
- [A][wrong] A1-071 · /u/[userSlug] · The owner's preview banner names a settings section that does not exist → The real path, Profile & settings › Privacy › Public profile (as the You card says), id…
- [A][wrong] A1-072 · /u/[userSlug] `follow-button.tsx` · Follow fails silently → A plain reason with Try again.
- [A][wrong] A1-073 · /u/[userSlug]/c/[chapterId] · The chapter page claims "Papic Memories" without checking, and names the person di… → Claims that are measured, and the same name the profile shows.
- [A][wrong] A1-133 · /v/[slug]/guest-review · The guest review page reveals a hidden shop's real name, for any shop addr… → The same rules as the shop page: a non-public shop gets the 404 that never…
- [A][wrong] A1-134 · /v/[slug]/guest-review · Guest review words break when a name is missing → Plain fallbacks ("this wedding", "Thank you").
- [A][wrong] A1-132 · /v/[slug]/story/[eventSlug] `ultra-story-pages.server.ts` · The story page can show a held (flagged) review → Only reviews a public page may list (`vendor_reviews_public`, as th…
- [A][wrong] A1-161 · see list · Titles, descriptions and share pictures: doubled brand, shared descriptions, no p… → Each page: a unique title ending once in "· Setnayan", its own description, a sha…
- [A][look] A1-121 · /start · /start has no `<main>` landmark → The page keeps its own `<main>`, because the doorway shell gives the landmark to the page.

### Area 2 · Couple: create & plan (61)

- [A][broken] A2-P8 · /d/[eventId]/clearance · "Close out the day" offered 89 days before the event → Before the day: the page says it opens after the event, the main button is not offered.
- [A][broken] A2-G17 · /d/[eventId]/clearance `actions.ts` · "Close out the day" reports success when the save failed → A plain reason plus Try again; the page stays.
- [A][broken] A2-G18 · /d/[eventId]/clearance · "Stop the livestream" opens the Event Hub Maker → Lands on the live controller where the broadcast is ended ((code), the same door `launch/page.tsx`…
- [A][look] A2-G19 · /d/[eventId]/clearance · Irreversible close-out has no confirm → The page itself says "It can’t be undone from here", so one confirm sheet asks first (confirm only…
- [A][broken] A2-H10 · /d/[eventId]/details · Helpers get "Put this away" on Details → The control is shown only to someone who may archive the event.
- [A][broken] A2-H11 · /d/[eventId]/details/field/[row] · Details field links drop the field → The Event Settings sheet opens ON that row (`?settings=1&row=date`; `date`, `names` and `venues` ar…
- [A][broken] A2-H16 · /d/[eventId]/find-date `find-your-date.tsx` · Find-your-date doors 404 for its own viewers → A door the viewer can open, in the event's own word.
- [A][wrong] A2-H15 · /d/[eventId]/find-date · A failed date read shows "Set your dates first" → "Couldn't read your date" with Try again.
- [A][broken] A2-P22 · /d/[eventId]/guests/checkin · With no signal, a dashboard page cannot be reopened — not even the chec… → Kit: check-in and Home have a saved copy (OFFLINE_COPY_SHAPES, DeskSave…
- [A][wrong] A2-D13 · /d/[eventId]/guests/checkin · Check-in desk shows "0 / 0 attending" on a failed read → The headcount says it could not be read ("—"), never a confident 0.
- [A][wrong] A2-D16 · /d/[eventId]/guests/checkin `checkin-desk.tsx` · Desk shows a raw reply word ("RSVP'd pending") → The reply in the house words (`RSVP_LABELS` / the list's reply words).
- [A][broken] A2-D1 · /d/[eventId]/guests?gview=seats `seating.ts` · A failed seat read crashes the whole Guests page → The List stays; the Seats view says it could not load the seat plan (the page's…
- [A][wrong] A2-E4 · /d/[eventId]/guests?gview=seats · Seat plan and entrance chart give different unseated counts → One unseated count, from one reader in `lib/seating.ts` (pending guests hold seats…
- [A][wrong] A2-D2 · /d/[eventId]/guests?gview=seats · Seats and Check-in count replies with their own filters → Each number comes from the one reader: `computeGuestStats` then (code) for "attending"…
- [A][broken] A2-H1 · /d/[eventId]/messages `chat-inbox.tsx` · "Suppliers" chip shows exactly the All list → Suppliers narrows the list (for example, hides the Groups section), or the chip is not off…
- [A][broken] A2-H3 · /d/[eventId]/messages/[threadId] · Book and "Amount to pay" shown to non-hosts in thread → Only a host books or pays.
- [A][money-signin] A2-H2 · /d/[eventId]/messages/[threadId] `event-vendor-money.ts` · Decisions show payment amounts to a money-hidden viewer → Every amount reads "₱ — hosts only", like the stream (…
- [A][look] A2-H4 · /d/[eventId]/messages/[threadId] `chat-send-form.tsx` · Chat box does not mark the phone key "Send" → `enterKeyHint="send"(code)shouldSendOnEnter`, "one rule for every device").
- [A][broken] A2-I19 · /d/[eventId]/nikah `nikah-actions.ts` · "Save Nikah details" ignores a failed save → The failure is said ("Didn't save · Try again"), and success gets a small toast.
- [A][broken] A2-F4 · /d/[eventId]/orders/[orderId] `actions.ts` · A refused "Cancel order" says nothing → The page says the order could not be cancelled and why.
- [A][broken] A2-G1 · /d/[eventId]/vendors `booked-row.tsx` · Build "Ask to book" and Compare "book" shown to the coordinator → A non-host sees no Book or Pay control (owner 21 Nov "no booking, no pa…
- [A][wrong] A2-G4 · /d/[eventId]/vendors `vendor-itemization-card.tsx` · Payment record says "Downpayment … awaiting vendor confirmation" → The person reads "reservation fee" and "supplier".
- [A][broken] A2-G11 · /d/[eventId]/vendors/categories?q=<shop `bench-marketplace-search.ts` · Find: a shop with no slug links to "#" → Every row reaches the shop, or is not a link.
- [A][broken] A2-P4 · /dashboard/samahan `people-segment.tsx` · "Groups" (/dashboard/samahan) lands on a blank screen → The People › Groups view: "No group yet" and a New group action.
- [A][broken] A2-F5 · /pay/[reference] · Maya "Checking your payment" is a dead end → A way back to the event and a press to try again, as the ordinary waiting state has ("THE WAITING P…
- [A][money-signin] A2-P1 · /d/[eventId] `home-control-row.tsx` · Home's paid and owing figures count up from ₱0 → The money line shows the real figures at once: "Paid ₱124,488 · still owing ₱165,782…
- [A][wrong] A2-P10 · /d/[eventId] · Event home disagrees with itself between loads → Same facts each load.
- [A][money-signin] A2-I5 · /d/[eventId]/documents `paperwork.ts` · Failed document and receipt reads show "No documents yet" → The section says it could not read ("Couldn't read" + Try again).
- [A][wrong] A2-E7 · /d/[eventId]/access-requests · Access requests says "Nothing waiting" when the check failed → Only the "could not check" line, never a claim that nothing is waiting.
- [A][wrong] A2-B9 · /d/[eventId]/activity `activity.ts` · Activity shows "Nothing has happened yet" on a failed read → A failed read says so (ReadFailed / "Couldn't read"), never the empty state; a…
- [A][wrong] A2-G14 · /d/[eventId]/contracts `contracts.ts` · A failed contracts read shows "No contracts yet" / 404 → "Couldn't load your contracts" + Try again; the detail says it could not be read…
- [A][wrong] A2-P9 · /d/[eventId]/date-selection · Date selection starts over on a locked date → The page shows the locked date and why, with no path to pick a new one.
- [A][wrong] A2-H12 · /d/[eventId]/date-selection `actions.ts` · Locking a date here skips the date's real writer → The same rules and fan-out as the date's writer `updateEventDate(code)afterDateAppl…
- [A][wrong] A2-H13 · /d/[eventId]/date-selection · "Long weekend" claimed for any date near a holiday → The long-weekend line only when the gap really touches a weekend.
- [A][wrong] A2-G15 · /d/[eventId]/disputes · A failed disputes read shows "No disputes on record" → "Couldn't load your disputes" + Try again, not an empty record.
- [A][wrong] A2-P6 · /d/[eventId]/guests `seed.sql` · Guest list shows the bride's name on the groom's row → "Bea Villanueva" and "Paolo Garcia", as the seat chart and the guest rows hold them.
- [A][wrong] A2-P5 · /d/[eventId]/guests/import · Import page says importing opens on 19 Dec, under working import steps → Either the import works (no notice) or it is closed (no steps).
- [A][wrong] A2-E1 · /d/[eventId]/guests/souvenirs `souvenir-desk.tsx` · Souvenir count counts declined and undecided guests as expect… → The total counts the guests expected at the door, read throug…
- [A][wrong] A2-E2 · /d/[eventId]/guests/souvenirs · Souvenir desk opens normally when the guest list fails to load → A refused guest read stops the desk and says it could not read the list.
- [A][wrong] A2-E3 · /d/[eventId]/guests/tea-ceremony · Tea serving order lists declined guests and calls everyone an elder → The serving order is the elders who are coming.
- [A][wrong] A2-H5 · /d/[eventId]/manpower · A failed gig read says "No open gigs" → "Couldn't read your gigs" with Try again, never the empty lines.
- [A][wrong] A2-I8 · /d/[eventId]/paperwork `paperwork.ts` · Failed paperwork read shows "Start your checklist" → The page says the paperwork could not be read.
- [A][wrong] A2-I9 · /d/[eventId]/paperwork · Paperwork is a blank page for non-wedding events → Either no door to Paperwork for an event with no statutory paperwork, or a page that says plainly t…
- [A][wrong] A2-I10 · /d/[eventId]/paperwork `actions.ts` · Paperwork save failures go to the error screen → An inline failure in plain words ("Didn't save · Try again" / "Didn't upload · Try again")…
- [A][wrong] A2-I11 · /d/[eventId]/paperwork `cleanup-delete.ts` · Replaced or unsaved paperwork scans are never removed → The old or abandoned object in the private bucket is deleted, or swept later.
- [A][wrong] A2-E8 · /d/[eventId]/people · Who is here: a failed read says "not shared with you" → "Couldn't read", with a retry.
- [A][wrong] A2-F10 · /d/[eventId]/refer `referral-actions.ts` · Failed referral read shows "No referrals yet" → "Couldn't load the couples you referred" (ReadFailed), never the empty state.
- [A][wrong] A2-I1 · /d/[eventId]/schedule · Failed supplier-requests read shows "Nothing waiting" → The requests sheet says it could not read the requests and offers Try again.
- [A][wrong] A2-I3 · /d/[eventId]/schedule?view=preparation `preparation.ts` · Planning list silently drops paperwork and meetings on a f… → The page says the paperwork deadlines or meetings could no…
- [A][wrong] A2-I13 · /d/[eventId]/sponsors · Failed sponsor read shows "0 of N slots filled" → The page says it could not read the sponsors.
- [A][wrong] A2-I14 · /d/[eventId]/sponsors `entourage.ts` · Sponsors page is a second sponsor list, not the guest list → Sponsors are counted from the one guest reader (`guests.role`), the source th…
- [A][wrong] A2-I15 · /d/[eventId]/sponsors `event-sponsors.ts` · Sponsors guesses ninong or ninang from the family side → Godfather or godmother is chosen by the couple, never inferred from side (ow…
- [A][wrong] A2-G10 · /d/[eventId]/vendors/categories?c=<tile> · Find: a failed category search reads "0 suppliers" → "Couldn't load suppliers" plus Try again, never "0 suppliers" / none listed.
- [A][wrong] A2-B2 · /dashboard `unihome-is-the-drawing.test.ts` · Home's Shop part says "none" when the shop read failed → "Couldn't read your shop" (or the part withheld), never a claim that you ha…
- [A][wrong] A2-C12 · /dashboard/people/[dependentId] · A refused read shows "page not found" (loved one, linked events) → "Couldn't read this — try again", never a 404 that says the record is gone.
- [A][wrong] A2-C7 · /dashboard/profile · Refused profile read shows blank forms that Save will overwrite → "Couldn't read your profile" and no editable form (or a locked one) — a refusal must not lo…
- [A][wrong] A2-C8 · /dashboard/profile · Account pane prints raw enum and internal section codes → Plain words: "Supplier"/"Host"; no internal jargon.
- [A][wrong] A2-C14 · /dashboard/samahan/[communityId] `communities.ts` · Group page turns refused reads into "none" and "rotate" → Each list says it could not be read.
- [A][wrong] A2-A10 · /host/accept/[token] · A failed invite read shows "not found" → "We couldn't read this invitation — try again", distinct from an invalid link.
- [A][wrong] A2-F7 · /receipts/order/[orderId] · Order slip names the wrong account and a gone step → The slip names where /pay will actually take the money, and the next step that exists.
- [A][wrong] A2-A7 · /signup/you · A failed profile read shows a blank "You" card → A failed read says it could not read, and never lets Done write blanks over saved values.

### Area 3 · Couple: Maker, Event Hub, Papic, Memories (46)

- [A][blocker] A3·B-01 · /d/[eventId]/alaala/assignments · Story Assignments can never assign anyone: the guest read filters on… → The attending guests are listed and a guest can be assigned to a mom…
- [A][broken] A3·M-05 · /d/[eventId]/alaala/assignments · Assignments: "Remove" never says it failed → The failure is shown.
- [A][broken] A3·P-07 · /d/[eventId]/apple-pro · Apple Pro: the button stays disabled forever when the App Store product is missing → A sentence saying the store is not answering.
- [A][broken] A3·I-05 · /d/[eventId]/event-qr · Event QR "Regenerate QR" throws its result away (no failure, no success, no co… → "Couldn't make a new QR"; success said; a confirm like the guest QR's.
- [A][broken] A3·I-04 · /d/[eventId]/invitation · Invitation sheet "Mark sent" failure is never shown; "Save monogram" reads a zero-row update as saved → "Couldn't save".
- [A][money-signin] A3·I-02 · /d/[eventId]/invitation · Custom Event Hub address: no lock or price before Save, and the refus… → A 🔒 with the catalogue price and a real checkout door; at least a plai…
- [A][broken] A3·E-01 · /d/[eventId]/launch · Saves that fail still land as saved (hero photo, Which version guests see, backdrop, last word) → The control goes back and says "That did not save.
- [A][money-signin] A3·E-03 · /d/[eventId]/launch · The Event Pro price vanishes when the catalogue read fails → "Couldn't read" where the price goes.
- [A][broken] A3·L-06 · /d/[eventId]/live · Memory lane: the Flash switch ignores a failed save → An error; the switch goes back.
- [A][wrong] A3·L-08 · /d/[eventId]/live · Failed reads read as real across the live pages (counts 0, "Auto", no cameras, nothing to print, not connected) → "Couldn't read".
- [A][wrong] A3·N-02 · /d/[eventId]/live · Memory lane prints an internal code and the event's raw id → A plain line: "Showing now: your photos (picked for you)".
- [A][broken] A3·L-05 · /d/[eventId]/studio/panood/setup · Live Watch setup: "Saved — guests see Watch Live" after a failed write; Go live / End report ok after fail… → An error; nothing marked saved.
- [A][broken] A3·P-01 · /d/[eventId]/studio/papic/challenges · Every challenge and run-of-show press reads as saved when the write failed → A plain failure line under the control.
- [A][broken] A3·P-06 · /d/[eventId]/studio/papic/crew `copy-button.tsx` · Crew "Copy link" does nothing when the clipboard is blocked (the link is not printed on… → The link shown, or a failure line.
- [A][wrong] A3·P-08 · /d/[eventId]/studio/papic/crew · Papic failed reads read as real (crew notice, moderation list, recap counts, photo-delivery state) → "Couldn't read".
- [A][broken] A3·P-05 · /d/[eventId]/studio/papic/recap · Recap "Publish" / "Make it private" fail without a word → A failure line.
- [A][broken] A3·P-03 · /d/[eventId]/studio/photo-delivery · Photo delivery "Disconnect" says disconnected after a failed write (the Google token may stay stored) → "Couldn't disconnect".
- [A][broken] A3·I-06 · /d/[eventId]/studio/save-the-date · Save the Date "Render": a failed read can blank the saved film; a d… → "Couldn't read" and no save offered; a failure line; a failed write…
- [A][money-signin] A3·I-03 · /d/[eventId]/studio/save-the-date · Save the Date prices: a failed read drops the price and claims the opening is bundle-only → "Couldn't read" by the price.
- [A][wrong] A3·N-04 · /d/[eventId]/studio/save-the-date · The song-file limit disagrees between two pages, and upload boxes sa… → One limit for "your song" (both say it becomes the site's song), in…
- [A][look] A3·N-10 · /d/[eventId]/studio/save-the-date · Save the Date reveal picker: text-only tiles, a lone tile, and at 37… → Add 18 (owner ruled): no second picker; a link "Choose your reveal in…
- [A][broken] A3·E-02 · /d/[eventId]/website/our-photos · Our photos (draft path) drops a blocked or unreadable photo without a word → "One photo couldn't be added…", as on the live path.
- [A][broken] A3·E-10 · /d/[eventId]/website/our-story · Saving the story words after a failed read wipes the couple's moments → The save refuses ("Couldn't read your story"); nothing is overwritten.
- [A][money-signin] A3·E-13 · /d/[eventId]/website/our-story · Our story: a failed price or plan read drops the price and offers Pro to a… → "Couldn't read" for the price; no upsell on an unread plan.
- [A][broken] A3·E-11 · /d/[eventId]/website/photo-moments · Photo moments and widget toggles say "Saved" when the write changed no row → A refused write says so.
- [A][broken] A3·L-01 · /panood/control/[eventId] · Live controller: about a dozen controls show success after a failed write (cut, ★ default, delete channel,… → An error banner; the state unchanged.
- [A][money-signin] A3·L-03 · /panood/control/[eventId] · Live controller: a paying host is sent to the buy page mid-show when the p… → An error; "Couldn't read" by the price; unlock opens a checkout.
- [A][wrong] A3·L-02 · /panood/control/[eventId] · Live controller reads "Off air" while live when its reads fail → "Couldn't check whether you're on air", never "Off air".
- [A][money-signin] A3·M-02 · /d/[eventId]/memories · "Keep full resolution" price: a failed catalogue read looks like "not… → "Couldn't read" by the row; the checkout replaces the sheet (one layer).
- [A][money-signin] A3·M-03 · /d/[eventId]/memories/thank-you · Thank-You film: a failed price read says "isn't on sale" (dormant while the SKU is free for all) → "Couldn't read".
- [A][money-signin] A3·I-01 · /d/[eventId]/pabuya · E-Gifts: a failed read of the money accounts shows "No e-gift methods yet" and an add form → "Couldn't read your E-Gift methods", no add form.
- [A][money-signin] A3·S-01 · /d/[eventId]/studio/about/[addon] · Add-on About pages: a failed price or order read hides the price… → "Couldn't read"; never offered to buy again; one price from one r…
- [A][money-signin] A3·L-04 · /panood/program/[eventId] `panood-watermark.ts` · Program window: a failed channel read skips the paid-channel gate (fal… → Fail closed: only the ★ channel can go to air.
- [A][wrong] A3·M-06 · /d/[eventId]/alaala · Three pages are all called "Memories"; Galleries and the Memories tab count photos differently → One page per name; one photo count from one reader.
- [A][wrong] A3·M-08 · /d/[eventId]/alaala · Memories failed reads vanish or read as empty (Alaala sections, assignments, library editorials) → "Couldn't read".
- [A][wrong] A3·F-01 · /d/[eventId]/event-page · The "event page" forward gives a coordinator, and a failed read, a 404 → The guest Event Hub `/[slug]` opens (it is public), or a failure says the rea…
- [A][wrong] A3·I-07 · /d/[eventId]/guests/send · Invitation failed reads read as facts (no address yet, House theme, free QR look, bounce, 404) → "Couldn't read".
- [A][wrong] A3·N-09 · /d/[eventId]/guests/send · Send run: an empty white picture frame, and the guest's phone number bes… → The invitation picture the guest will receive; the guest's email (Setnaya…
- [A][wrong] A3·S-05 · /d/[eventId]/studio/mood-board · Studio tools failed reads read as real (mood board, playlist, Setnayan AI, guest columns, Patiktok, creator) → "Couldn't read".
- [A][wrong] A3·L-09 · /d/[eventId]/studio/panood/cameras · Cameras page and print sheet disagree on what a guest camera joins (seat vs channel) → One description of what can be joined.
- [A][wrong] A3·E-05 · /d/[eventId]/website/editor · Failed reads draw as "nothing here" (scenes, chapters, our-photos) → A "Couldn't read" state.
- [A][wrong] A3·E-15 · /d/[eventId]/website/privacy · Privacy: tapping another visibility choice shows nothing until saved → The tapped choice shows as chosen.
- [A][wrong] A3·E-16 · /d/[eventId]/website/privacy · Failed reads read as real (privacy consent, story authors, page loads bounce to Home) → "Couldn't read".
- [A][wrong] A3·E-17 · /d/[eventId]/website/site-chrome · Site chrome: with both parts locked, "Save" still shows and says "Saved" → No Save shown.
- [A][wrong] A3·N-08 · /studio/papic/recap · Pages filed under two sections: the masthead says Today, the back link says Memories /… → One home for each page: the masthead, the lit tab and Back agree.
- [A][wrong] A3·N-11 · /studio/papic/recap · Small words: "1 PHOTOS", "Apply 0 changes" → see finding

### Area 4 · Guest (64)

- [A][broken] A4-24 · /[slug]/hub `route.ts` · The tile starts at (code). → The saved Event Hub opens (the bare /<slug> copy in DAYOF_CACHE).
- [A][broken] A4-52 · /[slug]/seat `guest-push-actions.ts` · (code) has a writer ((code)) and no reader or sender anywhere in `a… → "We'll let you know on this device if your table changes… even if y…
- [A][wrong] A4-50 · /[slug]/seat · (code) is followed by (code) without checking `tablesFailed(code)apps/web/app/[slug]/seat/page.tsx` `tablesFa… → "We couldn't load your seat pass".
- [A][wrong] A4-51 · /[slug]/seat · (code) (both calls, no `throwOnReadError(code)apps/web/app/[slug]/seat/page.tsx` (code). → The error boundary, as /find-seat and /find-my-table do ((code)).
- [A][look] A4-53 · /[slug]/seat · (code). Anchor: (code) header comment "CUSTOM_QR_GUEST SKU". → No price written into code or comments.
- [A][broken] A4-26 · /[slug]/welcome `actions.ts` · (code) … (code)/${slug}`);(code)apps/web/app/[slug]/welcome/actions.ts` (code). → The door says the save failed and keeps what was typed.
- [A][wrong] A4-25 · /[slug]/welcome · The error is ignored and a made-up name is drawn: (code) → "You are the +1 of the inviting guest", and `prima… → "Couldn't read", or the page fails honestly.
- [A][wrong] A4-27 · /[slug]/welcome · (code) draws any query text as an alert on the couple's page (the action itself puts a full sentence in the q… → Only known error keys draw a message.
- [A][broken] A4-B09 · /join/[eventId]/set-password · The link is /dashboard/<eventId> — the HOST's planning page. → The guest lands on the event they just joined: its Event Hub (/<slug>), or their o…
- [A][broken] A4-B02 · /join/crew/[token] · "This QR does not open anything / Ask the shop for their crew QR for this e… → A dead link says so and offers one way on (the wordmark home at least, like…
- [A][broken] A4-57 · /papic/demo/[token] `demo-join-flow.tsx` · Nothing happens and nothing is said: (code); a thrown `recordDemoShot` only reaches the… → It says the demo expired or the shot failed.
- [A][wrong] A4-56 · /papic/demo/[token] `papic-page-says-only-what-is-true.test.ts` · (code). (code) bans exactly this, but its `PAPIC_PAGE_… → No claim that Papic is unlimited (shots are metered by…
- [A][wrong] A4-58 · /papic/demo/[token] `demo-join-flow.tsx` · A hand-typed second copy: (code) and (code). → The count from the server cap `DEMO_SHOT_CAP` (`lib/demo-sessions.ts`).
- [A][broken] A4-60 · /papic/guest `public-event-day-bar.tsx` · The only way off is (code)/${backSlug}(code); with no `?from=(cod… → Every refusal has a way back to this event's Event Hub (the slug i…
- [A][broken] A4-70 · /papic/guest `hub-tabs.ts` · The exit link is `return (code);` with `&added=N` after shots (`hub-tabs.ts` `cameraExitHref(code)caches.matc… → Back to the Hub's saved copy.
- [A][wrong] A4-61 · /papic/guest `papic-guest-capture.tsx` · (code) folds the failure into empty; the sheet says "Your shots la… → "Couldn't read your earlier shots" (`getGuestOwnShots` returns null…
- [A][wrong] A4-65 · /papic/guest `papic-guest-capture.tsx` · (code) uses the last-resort fallback, not the owner-tunable (code)… → The threshold is the pool's live `softStopPct` read through (code).
- [A][wrong] A4-66 · /papic/guest `papic-guest.ts` · `used` stays 0 when `countError(code)remaining = … GUEST_CAPTURE_CREDIT… → An unknown count is not drawn as a full allowance (the function's own c…
- [A][wrong] A4-67 · /papic/guest · (code) ignores `error`, then `if (blockRow) {(code)apps/web/app/papic/guest/page.tsx` `event_blocked_users`. → A failed gate read does not hand out the camera.
- [A][look] A4-63 · /papic/guest `papic-guest-capture.tsx` · (code) leaves `shotsOpen` true, so (code) opens over the still-open (code). → Never a popup on top of a popup.
- [A][broken] A4-02 · every page (service workers) `offline-daemon-mount.tsx` · (code) registers `/sw-offline.js(code)/`, the same scope `app/layout.tsx` `sw-register… → One worker controls scope `/`.
- [A][money-signin] A4-04 · /claim/[token] `actions.ts` · Ownership moves, then (code) runs with its result unchecked and the… → Profile and its godparent records move together, or the person is told…
- [A][wrong] A4-03 · /claim/[token] `actions.ts` · The read error is dropped and the page says "This link isn't active." `actions.ts`… → "Couldn't read · Try again"; a valid link is never called dead.
- [A][look] A4-05 · /claim/[token] · Nothing reads `claimed` ((code) reads seg, hub, request_declined, inviter_muted, request_error). → A small success toast.
- [A][money-signin] A4-06 · /join/[eventId]/connect/confirm `route.ts` · The request-only guard (code) lives only in `connect/route.ts… → No seat is offered: a request is never a way in until the hos…
- [A][money-signin] A4-78 · /papic/order/[token] · (code) ignores `error`; → "Couldn't read your logged payments", so the guest does not log the same transfer twice.
- [A][wrong] A4-B13 · /[slug] · The card says "CEREMONY 1:30 PM" (venue time, no zone named) while THE PROGRAM right below says "Times sho… → One clock per screen, or each time labelled with its zone.
- [A][wrong] A4-21 · /[slug] `data.ts` · Three count queries of its own (a SQL copy of `countsTowardEvent(code)const {… → Counts from `lib/guests.ts` (`computeGuestStats` / `headcountForBasis`); a fa…
- [A][wrong] A4-22 · /[slug] `supplier-desk.server.ts` · `blocks: blocks ?? [],(code)/vendor-dashboard/on-the-day/live/[eventI… → "Couldn't read" (`fetchRunOfShowBlocks` answers null for a refused re…
- [A][wrong] A4-23 · /[slug] `day-of-banner.tsx` · `detail={(code)}(code)apps/web/app/[slug]/_components/day-of-banner.tsx` "they work offline if WiFi cuts out". → Offline words match what ships.
- [A][wrong] A4-28 · /[slug]/avatar · (code) … `if (!guest) redirect(`/${slug}`);(code)apps/web/app/[slug]/avatar/page.tsx` (code). → Honest failure (the event read on this page already throws).
- [A][wrong] A4-30 · /[slug]/everyone `actions.ts` · The list filters on `rsvp_status(code)entry_source`: (code). → Only people who count toward the event (`countsTowardEvent`); an unapproved request…
- [A][wrong] A4-31 · /[slug]/everyone · The error is dropped ((code)), the host is treated as a stranger and told "The rest of the guest list is for… → A failure state or the error boundary.
- [A][wrong] A4-B11 · /[slug]/find-my-table · Both say "Open this from your invitation — … Open your invitation link (or… → The signed-in seat holder sees their own table / pass, the same as the Hub'…
- [A][wrong] A4-33 · /[slug]/find-my-table · This page has its own `resolveEntrance` that reads only (code) ((code)), ne… → Both pages draw the same door through the one reader `fetchEntrance` ((code…
- [A][wrong] A4-34 · /[slug]/find-my-table · Three raw `event_tables(code).from('event_tables').select('table_id,public_… → Tables come from the couple's seat-plan reader `lib/seating.ts` `fetchTable…
- [A][wrong] A4-35 · /[slug]/find-seat `seat-frame.tsx` · `Confirm your Booking(code)lib/ugat/baselines/wrong-words.baseline.txt`. → "Open your invitation" (the door's words since 3 Nov).
- [A][wrong] A4-37 · /[slug]/find-seat · The error is dropped: (code) → "Show this at the door". `/seat` has the same shape ((code) in `PersonalPass(c… → It does not claim the guest is not checked in.
- [A][wrong] A4-38 · /[slug]/invite `join-flow.tsx` · All three errors are dropped ((code) / (code) / (code)): default questions are drawn, a member is shown the f… → A failure state.
- [A][wrong] A4-44 · /[slug]/pabuya `egift.ts` · `readEgiftMethods` returns (code) and `fetchEgiftMethods` drops the flag… → "Couldn't read", or the error boundary (the reader's own comment says a fa…
- [A][wrong] A4-45 · /[slug]/print · The error is dropped ((code)) and the page answers 404 for an event that exists. → The error boundary (siblings use `guestRead`).
- [A][wrong] A4-46 · /[slug]/print · (code) around `loadEditorialData(code).catch(() => [])` around `loadStoryPages(code)apps/web/app/[slug]/print… → A failure state.
- [A][wrong] A4-49 · /[slug]/request `request-key.server.ts` · (code) → `if (!key) redirect(`/${home}`);(code)apps/web/lib/request-key.server.ts` `readRequestKeyByToken`; → A failure state.
- [A][wrong] A4-08 · /live · "Type the code shown under Venue screens in the couple's Live Studio controller." and (code)… → The event's own words (`eventWordsForEvent`), as `panood/cam` already does.
- [A][wrong] A4-09 · /live/screen `live-studio-window-server.ts` · `checkOrderActive` throws, (code) catches it as not owned ((code… → Keep the last picture with "Reconnecting…" (the file's own rule:…
- [A][wrong] A4-01 · /offline.html · offline.html says "Any pages and event details you've already opened are still available — reconnect to load… → Words that match what the phone kept.
- [A][wrong] A4-B03 · /panood/cam/[token] · /papic/seat/zzz too ("Claim your photo-crew seat · Start shooting" → /papic… → A link that opens nothing says so on arrival, before asking for a sign-in or…
- [A][wrong] A4-10 · /panood/cam/[token] · Every failure goes to `?state=error(code)if (state === 'invalid' || state === 'error') {(code… → "Couldn't reach Setnayan · Try again" with Join still there.
- [A][wrong] A4-11 · /panood/cam/[token] `panood-camera-publish.tsx` · The pill says "Connected" with a pulsing green dot whenever the local camera ope… → The pill agrees with the footer's link state.
- [A][wrong] A4-54 · /papic/claim/[token] `actions.ts` · `redirect((code))` → (code) draws the terminal "This link isn't activ… → A retryable "we couldn't check just now · your link is fine", like th…
- [A][wrong] A4-71 · /papic/join/[token] · (code) and (code) fold a failure into "This link isn't active … Ask whoever… → "We couldn't check · your link is fine", as /papic/me and claim's `unreadable…
- [A][wrong] A4-74 · /papic/me/[token] `guest-live-gallery.ts` · `getGuestLiveGallery(code)if (tagsError) return null;`) and `GuestGallery` t… → "Couldn't read your photos", distinct from having none.
- [A][wrong] A4-75 · /papic/me/[token] `actions.ts` · (code) returns `taggedPhotoCount: 0(code)apps/web/app/papic/me/[token]/actions.ts` `prepareGuestStory`. → "Couldn't load your photos".
- [A][wrong] A4-B08 · /papic/pool · The site 404 page "This page doesn't exist on Setnayan … Take me home / Browse su… → The same door as /papic/guest and /papic/decorate: "Open your invitation first.
- [A][wrong] A4-79 · /papic/pool · (code) turns a failed read into a 404. → A "couldn't load" state (the page already has `initialUnreadable` for the tiles).
- [A][wrong] A4-80 · /papic/pool `pool-grid.tsx` · (code) makes the button vanish as if the list had ended; a thrown fetch hits an empty `cat… → "Couldn't load more · Try again", with the button kept.
- [A][wrong] A4-82 · /papic/seat/[token] · (code)/papic/claim/${token}`); }(code)apps/web/app/papic/seat/[token]/page.t… → "We couldn't check your seat · Try again" (the claim page has `?state=unread…
- [A][wrong] A4-83 · /papic/try `_papic-scan.tsx` · `` (code) `(code)apps/web/app/(shell)/papic/_papic-scan.tsx` "the demo… → No line that implies Papic does not cap shots (shots are metered by the e…
- [A][wrong] A4-12 · /samahan/join/[token] `communities.ts` · The error is dropped: (code) → "This invite link doesn't work." Anchor: (code) (code). → "Couldn't read · Try again".
- [A][wrong] A4-13 · /samahan/join/[token] `communities.ts` · (code) draws "0 members". → The count hidden or "—".
- [A][wrong] A4-B06 · /wall/[eventId] · "Enter the screen code from the couple's Setnayan dashboard." · "Type the code shown under… → Words that fit every event type (a debut, a birthday, a reunion).
- [A][wrong] A4-B07 · /wall/[eventId] `wall-claim.tsx` · The form is drawn for an event that does not exist, and the press ans… → "This screen link is wrong — open it again from the host's dashboard"…
- [A][wrong] A4-15 · /wall/[eventId] `live-wall.ts` · `getWallSnapshot(code)tiles: []`, `count: 0`, mode `coming_soon`; on t… → Freeze on the last collage with an amber dot (the file's own promise: "…
- [A][wrong] A4-16 · /wall/[eventId] `wall-claim.tsx` · "Enter the screen code from the couple's Setnayan dashboard.", "ask the couple to generate a fresh one", and… → The event's own words.

### Area 5 · Supplier: shop, cards, Toolkit, plans (48)

- [A][broken] B5-18 · /open-shop/invite · "Write to NFC" popup does not close with Escape → The popup closes (K3: closes the same way as every other popup).
- [A][wrong] A5-G1-06 · /open-shop/invite · "Only invite those you trust." is said twice → The owner's line once.
- [A][broken] A5-G2-04 · /vd/creators `creators-tools.tsx` · Creators: the Send lock has no 🔒 door, and its two sentences disagr… → 🔒 shown, then Problem → Solution → preview → price from the catalog…
- [A][money-signin] A5-G2-03 · /vd/creators `vendor-feature-gate.ts` · Creators: a refused plan read locks Send for a paying shop → A refused plan read is said; a Pro shop is never told to buy a plan.
- [A][wrong] A5-G2-05 · /vd/creators `creator-offers.ts` · Creators: a refused list read reads as "No creators match yet" and "no offers s… → "Couldn't load creators · Try again", distinct from empty.
- [A][broken] B5-21 · /vd/profile · The Shop settings layer, like the NFC popup, does not close with Escape → Closes (K3), the same way as other popups (the Account switcher and the Add sheets close…
- [A][money-signin] A5-G5-05 · /vd/profile `details-data.ts` · Your details tells a verified paid shop it is not on a paid plan,… → The card says it could not be read and offers no Save that would ov…
- [A][broken] A5-G3-01 · /vd/services/[serviceId] `service-card-maker.server.ts` · A refused card read shows "page doesn't exist" for the s… → "Couldn't load this card · Try again" — the card is stil…
- [A][broken] B5-22 · /vd/services/[serviceId] · A booked card's maker is entirely inert: its ⓘ notes and "About this card… → Locked fields read-only, but help and reading controls still work; or one…
- [A][money-signin] A5-G3-02 · /vd/services/[serviceId] · A refused plan read locks a venue's "Add the first space" for a Pro… → The plan read failing is said ("Couldn't check your plan · Try again")…
- [A][broken] A5-G3-07 · /vd/services/requests `actions.ts` · "That request is gone." is sent to the list, which never shows it → The list says "That request is gone."
- [A][broken] A5-G4-06 · /vd/shop/qrs · "Name your shop first" sends the supplier back to the Shop tab, not to where… → It lands on the field that sets the shop's web address (Your page / Your detail…
- [A][money-signin] A5-G2-01 · /vd/* `layout.tsx` · The rail's Plan row says "Free" when the plan read fails → A refused read says it could not be read ("—" or "Couldn't read"), never a plan name.
- [A][wrong] A5-G2-02 · /vd/* `layout.tsx` · The rail's plan word is a second tier reader (no promotion applied) → One reader for a shop's plan (`resolveVendorTier` / (code)), so every page agrees.
- [A][money-signin] A5-G6-13 · /vd/deep-search · Deep Search: a refused plan read shows a paying shop the Free lock → "Couldn't read your plan" — never the Free lock.
- [A][wrong] A5-G6-14 · /vd/deep-search · Deep Search history: a failed read hides the history; a failed dossier read says "Running" → "Couldn't read your searches".
- [A][look] B5-12 · /vd/deep-search · Deep Search: no visible title, and "Unused searches don't carry over" twice → A masthead ("Deep Search") and each fact once.
- [A][money-signin] A5-G6-10 · /vd/recommendations · Recommendations: every read is unbound — failures read as "none", raw c… → "Couldn't read …" for the failed part; a price either from the catalogu…
- [A][money-signin] A5-G4-01 · /vd/shop/promote `max-payment.ts` · "Most in one payment" shows a typed ₱ default when the setting r… → The cap is read from (code); if that read fails the line says it…
- [A][wrong] A5-G4-11 · /vd/shop/promote `share-your-work-data.ts` · Share your work: a refused plan read shows recaps as open; the… → "Couldn't load" for the part that depends on the plan; never a g…
- [A][wrong] B5-09 · /vd/shop/promote · Promote names a gift by its raw code `PAPIC_GUEST_150` → The gift's catalogue name ("Papic 150", as the badge-reward row below calls it).
- [A][money-signin] A5-G5-02 · /vd/team `vendor-seats.ts` · A refused read of bought extra seats is drawn as "0 added" and shri… → "Couldn't read your extra seats"; the cap is not lowered on a guess.
- [A][wrong] A5-G5-10 · /vd/team `helpers-view.tsx` · Hand-typed counts and plan names on Team, Roles, Your page and Theft W… → Counts and plan names come from their one source (`VENDOR_DUTIES.length…
- [A][money-signin] A5-G5-04 · /vd/theft-watch `vendor-feature-gate.ts` · Theft Watch shows "Portfolio protection is a Pro feature" to a… → "Couldn't read your plan" — never an upgrade ask to a payer.
- [A][money-signin] A5-G5-03 · /vd/website `page-data.ts` · Your page shows Plus / Pro / own-address plan asks to a paying shop when the… → The plan is said as unread; no plan ask is drawn on a guess.
- [A][wrong] A5-G2-12 · /vd/activities · Segments and Lines send a shop-less person through /verify → The same landing every other tool uses for "no shop" (`/vendor-dashboard`, which tells a team mem…
- [A][wrong] A5-G2-10 · /vd/attributes `attributes-view.tsx` · Attributes: "attribute payload" and an unproven ranking claim → Plain words; no claim the app cannot back.
- [A][wrong] B5-25 · /vd/attributes · Attributes says "No services yet" to a shop with a live service and four cards → The shop's service (Photo & Video) listed with its fields to fill.
- [A][wrong] A5-G6-01 · /vd/collections/albums · Albums by event says "No booked events yet" when the bookings read failed → "Couldn't read your bookings" with Try again; never the empty sentence.
- [A][wrong] A5-X-05 · /vd/customers `voice-match-card.tsx` · A hand-typed example price in the auto-reply voice preview → No price is typed in code: the preview reads the shop's own card prices, or…
- [A][wrong] B5-10 · /vd/packages/new · Bundle maker shows ₱0 before anything is picked, and "above ₱0 and below ₱0" → Totals hidden or "—" until two cards are picked; the discount hint reads a real…
- [A][wrong] A5-G6-05 · /vd/partnerships · Partnerships section counts read "(0)" when the partnerships read failed → No count (or "—") beside the "couldn't load" notice.
- [A][wrong] A5-G6-06 · /vd/partnerships · A partner's name falls back to the raw shop id when the names read fails → "Couldn't read this shop's name" or a neutral word.
- [A][wrong] A5-G6-11 · /vd/repertoire `songs.ts` · Repertoire: a failed set-list or library read draws as empty → "Couldn't read your set list" with Try again.
- [A][wrong] A5-G3-12 · /vd/services/their-work · "Their work" says "this card" on a shop-wide page and hand-types its tit… → A line that matches the page (every booked event's photos across the shop…
- [A][wrong] B5-07 · /vd/shop · Shop hero prints the raw shop address with its tracking tail → "Shop · setnayan.com/liwanagphotoandfilm" (or just the shop name); never query codes.
- [A][wrong] B5-08 · /vd/shop · Analytics draws a made-up "Example" zigzag over a real zero → A flat or empty chart that says "Nobody opened your page in the last 30 days" with one action (Shar…
- [A][wrong] B5-20 · /vd/shop · Shop says "Add a starting price" to a shop whose four cards all have one; the shop page's "from" prices co… → The price-position block reads the cards' starting prices.
- [A][wrong] A5-G5-07 · /vd/team/roles `vendor-team.ts` · A refused team read shows a role lock (Roles, Inquiries) or a silent bounce (Team) to a Shop Manager → "Couldn't load your team · Try again".
- [A][wrong] A5-G5-08 · /vd/team/roles/inquiries · Who gets new inquiries says "No live cards on this branch yet." on a faile… → Only the failure ("Part of this couldn't load…"); no empty-state claim.
- [A][wrong] A5-G5-06 · /vd/track-record · Track record says "Set up your supplier profile first" to a shop that has on… → "Couldn't read your shop just now · Try again" (the profile page itself boun…
- [A][wrong] A5-G1-09 · /vendor-invite/[slug] `vendor-couple-invite.ts` · A failed read says the supplier link is gone, or that the coupl… → A refused read says it could not read and offers Try again.
- [A][wrong] A5-G1-11 · /vendor/claim/[token] · Claim dead ends say "contact support" with no way to do it → A dead end states the fact and offers one action (support / help door, or sign in).
- [A][wrong] A5-G1-13 · /vendor/claim/[token]/finalize · A failed card-count read sends a claimed shop to "make your first card" → A refused read is not "no cards".
- [A][wrong] A5-G1-14 · /vendor/fit/[ref] · Fit check calls a supplier available when the calendar could not be read → The date row says it could not check (neither ✓ nor ✗), and the verdict is not "…
- [A][look] A5-G2-06 · /vd · Today: the failure screen has no Try again → The shared `ErrorState`: what broke → what survived → one Try again.
- [A][look] B5-27 · /vd · Today: "You're done for today" twice, directly above "Tomorrow 3" → One line that says the day is clear; the snoozed tasks below it.
- [A][look] A5-G6-04 · /vd/packages/[packageId] · Bundle Maker ✕ never returns to where it was opened → A full-screen popup that falls back to the same place (Your packages, scroll kept).

### Area 6 · Supplier: bookings, chat, payments (49)

- [A][broken] A6-52 · /vd/clients/[eventId]/their-event/[part] `their-event-part-body.tsx` · their-event-part-body.tsx (code) inside a plain `<li>` — looks pressable, does nothing (PLAU… → see finding
- [A][wrong] A6-56 · /vd/clients/[eventId]/their-event/[part] `their-event.ts` · a failed brief read: (code) — silent; → see finding
- [A][wrong] A6-57 · /vd/clients/[eventId]/their-event/[part] `20271357741892_the_their_event_door.sql` · The group count is `group.guests.length(code… → The headcount comes from the ONE reader's rul…
- [A][broken] A6-65 · /vd/contracts/[contractId] · `redirect('/login')` with no return address on all three pages — the person lands on the dash… → Back on the contract ((code), as booking-fees does).
- [A][wrong] A6-66 · /vd/contracts/[contractId] · Publish and Cancel (code) — a redirect stub — but not the hub where the contracts list is drawn ((code)) nor… → see finding
- [A][broken] A6-64 · /vd/contracts/new `actions.ts` · contracts/actions.ts answers every bad input with `throw new Error('…'… → The reason next to the field, in plain words, the form kept (Add 5 "Cl…
- [A][broken] A6-B13 · /vd/contracts/new · "You need to be in conversation with a couple before uploading a contract. → The event picker lists the 7 couples.
- [A][broken] A6-68 · /vd/disputes · `submitDisputeContest` throws that sentence; production hides it → the error screen,… → "This dispute has already been reviewed …" next to the box, the words kept.
- [A][broken] A6-17 · /vd/on-the-day · page.tsx (code) drops the `complete` flag that (code) gives (and the events-you-run read drops `measured`) →… → "Couldn't read your events".
- [A][broken] A6-18 · /vd/on-the-day · `completionRes.data`, (code), `(mediaRes.data ?? [])` — errors never checked; draws "0% done · Not started ye… → "Couldn't load".
- [A][wrong] A6-19 · /vd/on-the-day · (code) (a second copy) and (code) typed in UI; typed routes (code), (code). → see finding
- [A][wrong] A6-B22 · /vd/on-the-day · Without a reload the open page stays and shows "You're offline". → The saved copy, or Setnayan's own offline page that says what still works.
- [A][broken] A6-21 · /vd/on-the-day/live/[eventId] · (code) (no error) → (code) / `attending ?? 0` → "0 / 0" on the venue flo… → "—" / couldn't load (as the count tile on the same page already does).
- [A][broken] A6-22 · /vd/on-the-day/live/[eventId] ·  → A read failure says so (the Papic sub-page already does).
- [A][money-signin] A6-59 · /vd/booking-fees · (code) returns `[]` for a missing id, so the section is simply absent — it reads as "you had no free boo… → "We couldn't load your waived fees just now."
- [A][wrong] A6-61 · /vd/booking-fees · page.tsx's docblock types the fee rate and peso bounds ("5% … 3% beyond ₱…, never more than ₱…, minimum ₱…")… → see finding
- [A][look] A6-B14 · /vd/booking-fees · Words: "Be the first to bring the event — your booking is free. → see finding
- [A][money-signin] A6-43 · /vd/clients/[eventId] · page.tsx `{ data: evRow }` (error unbound) → (code) → change orders become (code) (counted as measured), asks… → "Couldn't load".
- [A][money-signin] A6-44 · /vd/clients/[eventId] · (code) (same for waived) → (code) — a fee owed for this couple disappears silently. → "Couldn't read your fees".
- [A][money-signin] A6-45 · /vd/clients/[eventId] · "No payments to confirm yet…" / "Nothing waiting on you…" over a payment the couple really logged. → see finding
- [A][wrong] A6-47 · /vd/clients/[eventId] · A failed brief read: (code) — looks like "not your client"; → see finding
- [A][wrong] A6-48 · /vd/clients/[eventId] · The headcount card shows (code) (and invited before booking), not the count by (code) the supplier's pax foll… → see finding
- [A][money-signin] A6-31 · /vd/customers?seg=money `money-segment.tsx` · money-segment.tsx (code) → lib/vendor-money.ts (code) → money-log.tsx "No booked customer yet. → "Couldn't load — try again".
- [A][money-signin] A6-B07 · /vd/customers?seg=money · Money says "Nothing due this month", "0 overdue", "This year · Nothing… → The money hub says "3 payments logged — confirm them" and links to eac…
- [A][wrong] A6-B06 · /vd/customers?seg=money · "₱0 received · ₱239K to come in · 0 overdue" and "0% of ₱239,400 booked". → see finding
- [A][money-signin] A6-01 · /vd/messages/[threadId] `vendor-service-payment-schedules.server.ts` · (code) (lib/vendor-service-payment-schedules.ser… → "Couldn't read payments" — the reader's own docb…
- [A][money-signin] A6-02 · /vd/messages/[threadId] `vendor-service-payment-schedules.server.ts` · The two reads in lib/vendor-service-payment-schedules.server.ts (… → "Couldn't read logged payments".
- [A][money-signin] A6-03 · /vd/messages/[threadId] `pax.ts` · lib/pax.ts `liveHeadcount(code)const { count } = await q; return c… → The live count comes from the ONE headcount reader (`headcountForB…
- [A][wrong] A6-05 · /vd/messages/[threadId] · page.tsx logs (code) and leaves `quoteRevision` null — the builder opens blank. → "Couldn't load your last quotation".
- [A][wrong] A6-07 · /vd/messages/[threadId] · The `vendor_service_links(code)(linkRows …).data ?? []`); a failure shows cards with nothing included. → see finding
- [A][wrong] A6-08 · /vd/messages/[threadId] `pay-confirm-actions.ts` · pay-confirm-actions.ts and pax-actions.ts write `relatedUrl: \(code)` and (code) as typed strings. → see finding
- [A][money-signin] A6-24 · /vd/on-the-day/live/[eventId]/papic `vendor-papic-grants.ts` · lib/vendor-papic-grants.ts (code) and (code) → the card… → No number, import not refused on a guess, no sale.
- [A][money-signin] A6-26 · /vendor/lock/[token] · (code) (same for `vendor_profiles`) → a 404, so a real QR looks fake. → "Couldn't read this lock link — try again".
- [A][wrong] A6-29 · /vendor/lock/[token] `chat-lock-booking.server.ts` · The date-option (`events`) and shortlist (`event_vendors(code)vendor_claim_locked_qr` (its own RPC), not lib/… → see finding
- [A][wrong] A6-B23 · /vendor/lock/[token] · The generic 404: "This page doesn't exist on Setnayan." A couple who scans… → The page's own words for a code that does not work ("This Locked QR is no lo…
- [A][wrong] A6-60 · /vd/booking-fees/[orderId] · `fetchPaymentsForOrder` throws inside `Promise.all` with no catch → the… → The page's own "We couldn't load this fee right now" (BookingFeeReadFailed…
- [A][wrong] A6-54 · /vd/clients/[eventId]/editorial-media · "Not available for this event yet … Once you're the couple's confirmed pick here" — a false claim; the same r… → "Couldn't read".
- [A][wrong] A6-55 · /vd/clients/[eventId]/mood-board · a failed board read: (code) — silent bounce; → see finding
- [A][wrong] A6-B19 · /vd/clients/[eventId]/their-event/numbers · "Invited 55 · Coming 35 · Maybe 5 · No reply 10" — the four numbers add to 50 of 55; the 5 who said no are no… → see finding
- [A][wrong] A6-B10 · /vd/clients/[eventId]?tab=chat · A booked client still shows the inquiry card "An inquiry · Your turn · Reply with an offer", and the quick re… → see finding
- [A][wrong] A6-35 · /vd/customers · (code): the tile says couldn't load (monthCount null) while the list under it says "No events booked this mon… → see finding
- [A][wrong] A6-38 · /vd/customers `routes.ts` · toast "Booking from outside added — free." (a price word in UI; → see finding
- [A][wrong] A6-71 · /vd/customers `actions.ts` · `issueLockedQr(code)vendor_claim_locked_qr` (latest: migration …_booked_… → The second scan is told the date is no longer open; the supplier is told…
- [A][wrong] A6-36 · /vd/customers?seg=dates&day=YYYY-MM-DD · Uses `fetchVendorPools` (`?? []`), (code), `fetchVendorWaitlist` →… → A "couldn't load" line, as the same day already draws for blocks an…
- [A][wrong] A6-13 · /vd/messages `chat.ts` · lib/chat.ts fallback after (code) maps every row to `archived: false` — ar… → Archived chats stay archived, or the list says the archive state didn't loa…
- [A][wrong] A6-B01 · /vd/messages · /api/health answers in 0.6 s, but signed-in pages take 3 s to 110 s: /vendor-dashboard/messages first byte 10… → Usable in about 0.7 s; never over 2 s.
- [A][wrong] A6-B03 · /vd/messages · Clients: "Lolo Ben at 80 · Birthday", "ÑAÑEZ-O'BRIEN CLAN REUNION 2026 (all branches!!)"; → One event, one name everywhere.
- [A][wrong] A6-B21 · /vd/recaps · Lands on Promote with `#share` drawn but NOT scrolled into view at 375 (the page opens at its top). → see finding
- [A][look] A6-15 · /vd/notifications `notifications.ts` · lib/notifications.ts returns `[](code)<h1 className="text-[22px] …">Notifications</h1>(code)PageMasthead`. → see finding

### Area 7 · Coordinator, Spaces, maps (19)

- [A][broken] A7-27 · /d/[eventId]/vendors/[vendorId]/workspace?tab=bu `actions.ts` · A failed "Save costs" or "Save crew" throws the whole screen away → The row stays, with "That did not save.
- [A][money-signin] A7-32 · /d/[eventId]/vendors/[vendorId]/workspace?tab=bu · The hosts' workspace counts an unconfirmed payment as paid… → One paid figure for one booking on both sides, from one re…
- [A][wrong] A7-33 · /d/[eventId]/vendors/[vendorId]/workspace?tab=bu · "Amount to pay: Next payment" with no amount, and a raw metho… → The amount still owed (₱ from the one reader) or no "Amount to…
- [A][broken] A7-22 · /d/[eventId]/vendors/[vendorId]/workspace?tab=de `actions.ts` · A failed contact read shows a blank card, and "Save" t… → "Couldn't load their details" and no save over data the…
- [A][broken] A7-30 · /vd/spaces · Spaces: a helper fills the whole New hall sheet, "Add the hall" is refused, and… → Either a helper cannot start (the page says who can change spaces), or the refusa…
- [A][wrong] A7-31 · /vd/spaces · Spaces' empty state points to "the box below", which is a search icon → The empty state states the fact and offers one action (kit check 9): an "Add a space" button.
- [A][wrong] A7-13 · /vd/spaces · A failed date change keeps the old day's tiles under the new day's name, and say… → The tiles say nothing about a day they could not read (the page's own rule for a…
- [A][wrong] A7-14 · /vd/spaces `space-sheet.tsx` · The two Spaces locks never show the price → Problem → solution → preview → the plan's price from the catalogue → one button.
- [A][wrong] A7-03 · /3d_plan/demo/[token] `_doorway.tsx` · The 3D demo's dead end points at a homepage tile that no longer exists → A way forward to where codes are made today (/pa3d/try).
- [A][wrong] A7-04 · /3d_plan/demo/[token] · The 3D demo promises the walk to "every real Setnayan guest" → A true line, e.g. that guests get this when their hosts share the seat plan.
- [A][wrong] A7-01 · /[slug]/venue?t=<a `use-live-scene.ts` · The venue walk's live refresh throws away what the server joined → The room changes only when a seat, table or booth really moved, and ke…
- [A][wrong] A7-02 · /[slug]/venue?t=<token> `room-links.ts` · "Try again" on the venue walk forgets whose walk it was → The same walk again, with the guest's own gold seat and tablemates.
- [A][wrong] A7-10 · /d/[eventId]/plan3d · The seat plan and the 3D room draw a failed floor-plan read as the couple's… → "Couldn't read your floor plan" — never a default room, never the switch draw…
- [A][wrong] A7-23 · /d/[eventId]/vendors/[vendorId]/workspace · Failed reads on the workspace are drawn as "nothing there" → "Couldn't load …" with Try again, never an empty or zero state.
- [A][wrong] A7-28 · /pa3d · /pa3d calls the sample room "A real reception, not a mock-up" → A sample said to be a sample, once.
- [A][wrong] A7-06 · /pa3d · "Tap any seated guest": a failed code just vanishes → "Couldn't make their code" with Try again.
- [A][wrong] A7-29 · /vd/clients/[eventId]/seat-plan `event-access-stage.ts` · The coordinator's seat plan: a lock with no way forward, s… → The lock names the one thing to do and gives ONE button to…
- [A][wrong] A7-16 · /vd/clients/[eventId]/seat-plan `seat-plan-body.tsx` · The supplier's seat plan is a second drawing of the plan, n… → DECISION_LOG 2026-11-20, "ONE SEAT-PLAN ENGINE FOR THE COUPL…
- [A][wrong] A7-17 · /vd/clients/[eventId]/seat-plan · The supplier's "N of M seated" counts removed chairs, and the covers d… → The same "seated of seats" the hosts see; covers that add up to the se…

### Area 8 · Admin (123)

- [A][broken] A8·C-4 · /admin `admin-destinations.ts` · "Answered on Focus" search rows open the Work list in Full mode → The in-place answer for that question.
- [A][money-signin] A8·C-1 · /admin `focus-home.tsx` · Asking "payments to confirm" in Focus answers "0" when the payments count failed, and counts rows inste… → "Couldn't count" when the read failed.
- [A][broken] A8·D-8 · /admin/accounts · A comma in the Users or Venues search breaks the read and shows "Couldn't read" → Results. The Events tab already sanitises this (`eventWordFilters`, F-W2-37).
- [A][money-signin] A8·D-4 · /admin/accounts `actions.ts` · The supplier invite gives a free paid plan without the Plans or Gif… → The same gate as `setVendorTier` ((code)) or `issueVendorSkuComp` (g…
- [A][money-signin] A8·D-6 · /admin/accounts `v2-catalog.ts` · Comp-grant service picker shows a failed catalog read as "No catalog SKUs found." → "Couldn't read" (the `services === null` path).
- [A][wrong] A8·D-10 · /admin/accounts · The face-tagging switch on the Events tab never says whether it worked → "The database refused the face-tagging change", as (code) shows.
- [A][wrong] A8·D-11 · /admin/accounts `vendor-earnings.ts` · Rollups are silently cut at 1,000 rows on the Events and Demo tabs → Paged reads, or a disclosure when a read is capped.
- [A][wrong] A8·D-12 · /admin/accounts · The Delete and Blacklist confirms promise a hard-delete cascade that no longe… → The true erasure words, like account-deletions' `ERASURE_WORDS` ("Orders and…
- [A][wrong] A8·D-13 · /admin/accounts `next.config.ts` · The Demo tab contradicts itself and points to retired addresses → One true statement, and links whose labels match where they go.
- [A][broken] A8·I-6 · /admin/business `settings-surface.tsx` · The owner's numbers lost their only editor in the Settings → Busi… → They stay editable: `saveBusinessIdentity(code)formData.has('deep_…
- [A][money-signin] A8·I-3 · /admin/business · A failed settings read prints a VAT of 0, a 1970 "Last updated" and the de… → Every field says "Couldn't read" and every save is off, as the banner prom…
- [A][broken] A8·F-8 · /admin/colours `app-colours.ts` · The Liveliness switches and Icon tile colours save but change nothing ("applies in the next update") → No pressable "not yet" control.
- [A][wrong] A8·F-25 · /admin/colours `colours-editor.tsx` · "Reset to current" replaces the live colour set at once, though it… → A discard of the draft, or a clear label and confirm for an app-wide…
- [A][broken] A8·F-6 · /admin/editorial-review `actions.ts` · Editorial unlock, resolve and re-scan ignore write failures, and a failed unlo… → The failure is shown, and nothing is sent to the couple.
- [A][wrong] A8·F-20 · /admin/editorial-review · A refused editorial read shows as "not found" → "Couldn't read this editorial".
- [A][broken] A8·D-9 · /admin/event-deletions · "Keep it" can fail to record yet still notifies the couple → A failure is shown and nothing is sent.
- [A][money-signin] A8·D-3 · /admin/event-deletions `actions.ts` · Removing an event never checks Deletions · Escalated → "remove an event" is Deletions · Escalated (`ADMIN_AREA_LIST`), so it should…
- [A][money-signin] A8·D-5 · /admin/event-deletions · A failed cancel of unpaid bills is swallowed and the event is removed anyway → Stop with a failure.
- [A][broken] A8·C-5 · /admin/help/guides · "Message us" in the team Help only scrolls the page → A real way to message someone, or a label that says what it does.
- [A][broken] A8·F-5 · /admin/live-studio-channels `admin-pages.ts` · The "Live Watch channels" menu item opens a 404 while the Live… → The view is hidden while the flag is off (the page's own commen…
- [A][wrong] A8·F-16 · /admin/live-studio-channels `live-studio-channel-grants.ts` · A refused grants read shows every channel as "Not connected" → "Couldn't read the connections".
- [A][wrong] A8·F-17 · /admin/live-studio-channels `actions.ts` · The "don't disconnect a checked-out channel" guard is skipped when its read fails → Refuse (fail closed).
- [A][wrong] A8·F-18 · /admin/live-studio-channels · OAuth error codes and raw status values are shown to the admin → Plain words.
- [A][broken] A8·A-18 · /admin/payments `actions.ts` · "Read it" throws the admin out of the payment it was reading → It returns to the same opened payment, where the read card shows the result.
- [A][broken] A8·A-19 · /admin/payments `received.ts` · "Set aside" with nothing picked does nothing → The button is disabled or says "Pick a reason" (as "Not received" does).
- [A][money-signin] A8·A-1 · /admin/payments `actions.ts` · The duplicate-reference check is skipped when the payment's own row can't be read → The approval is refused with "couldn't check".
- [A][money-signin] A8·A-2 · /admin/payments `error.tsx` · Refund refusals and the two-admin request show up as a crash, with th… → An inline notice: "needs a second admin, request open in Approvals".
- [A][money-signin] A8·A-3 · /admin/payments · The shortfall notice says "₱0 received" when the payments read fails → "Couldn't check what was received", with no peso figure.
- [A][money-signin] A8·A-10 · /admin/payments `actions.ts` · A failed receipt write is silent on approve → The desk says the receipt didn't issue.
- [A][money-signin] A8·A-11 · /admin/payments `desk.tsx` · The desk says "Nothing to reconcile." and hides unmatched BDO money → The From-your-BDO block, its failure line and the drop tile still show.
- [A][wrong] A8·A-20 · /admin/payments · "Event today 0" and "Nobody has read this picture yet" appear on failed reads → "Couldn't read" in place of the number or the card text.
- [A][broken] A8·G-5 · /admin/studio `std-video-moderation.tsx` · "Open couple page ↗" goes to /{public_id}, which is not an Event Hub address → The couple's Event Hub (`publicEventPath(slug)`).
- [A][broken] A8·G-6 · /admin/studio `studio.tsx` · The "Show the reveal on couple sites" switch saves a value nothing reads → The switch changes something, or it is removed.
- [A][broken] A8·G-7 · /admin/studio `widget-list.tsx` · On a phone, homepage widgets cannot be reordered → The Move buttons, which the file's own docblock promises for touch users.
- [A][money-signin] A8·G-3 · /admin/studio · On Journal Spotlights, failed reads show as empty, "not for sale" or "no approval pending" → "Couldn't read" for each read that failed.
- [A][wrong] A8·G-8 · /admin/studio `reveal-config.ts` · When the Reveal Studio read fails, the locked defaults are shown as the live house settings → "Couldn't read", with the editor withheld.
- [A][wrong] A8·G-9 · /admin/studio `spotlight-awards.ts` · When the Spotlight Awards read fails, it shows "No awards for this month yet" and zeroes → "Couldn't read".
- [A][wrong] A8·G-10 · /admin/studio `moodboard-library-surface.tsx` · Moodboard colour tags look empty when their read fails, and "S… → "Couldn't read" for the tags, and no save over an unread state.
- [A][wrong] A8·G-11 · /admin/studio · Social queue: a failed evergreen read says "No evergreen items yet", and the autopilot form… → "Couldn't read", and the settings form withheld (as on Referrals).
- [A][broken] A8·F-7 · /admin/user-reports `actions.ts` · "Block uploader" can block nobody and still record "Uploader blocked" → The failure is shown and the report stays open.
- [A][wrong] A8·F-15 · /admin/user-reports `actions.ts` · An escalated user report shows as "Resolved" and drops out of every view → It stays visible as escalated until a person settles it.
- [A][broken] A8·E-8 · /admin/verification-docs `actions.ts` · "Download" sends a team-member admin to the public home page with… → The page is hidden from people who can't use it, or the press says…
- [A][money-signin] A8·L-1 · /admin/verification-docs `verification-docs-server.ts` · Government-ID shelf is read with the service role behi… → The page calls `requireAdmin()(code)lib/admin/require-a…
- [A][wrong] A8·E-11 · /admin/verification-docs · A storage failure still draws "Nothing here." on both shelves → Only the TemplateFail.
- [A][broken] A8·E-9 · /admin/verify · Verify actions land on the wrong surface or tab → Come back to the same surface, tab or shop with the result.
- [A][wrong] A8·E-10 · /admin/verify · Three verify queues show "empty" copy when the read failed → Only the "couldn't load" line.
- [A][money-signin] A8·D-1 · /admin/account-deletions `actions.ts` · Approving a deletion marks it "approved" before any area, self… → Deletions · Escalated ("approve a deletion", `lib/admin/areas.ts…
- [A][money-signin] A8·D-2 · /admin/account-deletions `actions.ts` · The internal-account guard on erasure lets the erase run when its read fails → An unread target refuses the erase.
- [A][money-signin] A8·H-1 · /admin/app-performance · A failed sales read shows ₱0 and flat bars under a "Live" pill → The sales card says "Couldn't read" or "—" where the peso figures would be.
- [A][wrong] A8·H-6 · /admin/app-performance · A refused Resolve, Ignore or Archive save says "Saved ✓"; Archive also leaves t… → A plain failure reason plus Try again, and the rows go back to Active.
- [A][wrong] A8·H-7 · /admin/app-performance · Overview prints zeros and "nothing yet" copy when non-money reads fail → "—" or "Couldn't read" in each affected card.
- [A][wrong] A8·H-8 · /admin/app-performance · "Fastest movers" says "not enough data" for every entity row, and its footnote is false → An entity row is either measured, or says it is not computed.
- [A][wrong] A8·H-9 · /admin/app-performance · Operations says it is "Live" over a view that never refreshes; failed reads… → Stale numbers are labelled stale, and a failed read says "Couldn't read".
- [A][wrong] A8·H-10 · /admin/app-performance `smoke-test-panel.tsx` · The Sentry smoke test reports success on a network failure → It says the test did not reach the server.
- [A][wrong] A8·H-11 · /admin/app-performance `route.ts` · Growth "Export CSV" writes 0 where a read failed → The CSV marks unread values, or carries an errors row.
- [A][wrong] A8·H-16 · /admin/app-performance `charts.tsx` · Comparisons don't name their period → Each comparison says what it compares against ("vs last month", "of previous step").
- [A][money-signin] A8·C-3 · /admin/approvals `actions.ts` · Approve, Reject and Mark handled read with the service-role client before the a… → The admin gate runs before any createAdminClient() read.
- [A][money-signin] A8·G-4 · /admin/background-videos `route.ts` · Any signed-in account can upload into the homepage background-vi… → An admin check on the server for the site's own `homepage-bg/(co…
- [A][wrong] A8·G-12 · /admin/background-videos `background-videos.ts` · When the background-videos read fails, the page shows an empty editor with no message → "Couldn't read".
- [A][money-signin] A8·B-6 · /admin/budget-planner · Budget planner saves hide every failure, and a typo clears a price → A refusal shows a plain reason.
- [A][money-signin] A8·L-8 · /admin/categories `areas.ts` · "Catalogue · Escalated" is never enforced → `lib/admin/areas.ts` `ADMIN_AREA_LIST` row `catalogue`: Escalated = "hide for everyone · combin…
- [A][wrong] A8·B-14 · /admin/categories · Categories counts and lists say "0" and "none waiting" when a read fails → "—", which the page's own banner promises ("anything that reads '—' below is unkn…
- [A][money-signin] A8·A-9 · /admin/discount-codes/new `v2-catalog.ts` · A failed catalog read shows "No active services in the catalog right n… → "Couldn't read the catalog", and Create is held back.
- [A][money-signin] A8·E-1 · /admin/disputes · A settlement the database refused, or one that succeeded, is never shown to the admin → B is told it was already settled.
- [A][money-signin] A8·E-3 · /admin/disputes `booking-fee-disputes-section.tsx` · Booking fee dispute shows "Fee ₱0" and a confident "no chat / no save" when i… → "Couldn't read" for each failed read.
- [A][money-signin] A8·E-4 · /admin/disputes `payment-disputes-section.tsx` · Dispute evidence silently disappears on a failed read → "Couldn't read" on the row, as QuoteVersionsEvidence already says…
- [A][wrong] A8·E-13 · /admin/disputes `error.tsx` · Refusals arrive as the crash page instead of a plain reason → A plain reason plus Try again, on the same screen.
- [A][money-signin] A8·E-2 · /admin/force-majeure/[flagId] `actions.ts` · A resolved force-majeure flag can be re-resolved, overwritin… → A resolved flag is closed to re-resolution, like resolveDispu…
- [A][money-signin] A8·E-5 · /admin/force-majeure/[flagId] · A failed booking lookup makes a flag read "Whole event" and hides the deposit → Say the booking and deposit could not be read.
- [A][money-signin] A8·A-6 · /admin/founder-seats `actions.ts` · Founder seat grant matches emails with a wildcard; failed reads read as "no account" / "already empty" → An exact email match.
- [A][money-signin] A8·F-1 · /admin/gifts `gift-limit-settings.server.ts` · Gift limit shows the built-in default as the live setting w… → "Couldn't read" where the % sits, and no Save over a value n…
- [A][money-signin] A8·F-3 · /admin/gifts `v2-catalog.ts` · A refused catalogue read empties the deal and free-window price pic… → "Couldn't read the catalogue" in the What's free / Services rows, an…
- [A][wrong] A8·F-23 · /admin/gifts · A failed supplier or user search says "No suppliers match" → "Couldn't search".
- [A][money-signin] A8·I-1 · /admin/integrations `actions.ts` · Config saves ignore a failed platform_settings write and still sa… → A failed write shows a failure, like `saveOAuthField` / `savePayer…
- [A][money-signin] A8·I-2 · /admin/integrations · "Clear saved key(s)" always reports cleared, and the message always talk… → A failure says so. On success the notice names the integration that was…
- [A][money-signin] A8·A-8 · /admin/money `transactions-ledger.tsx` · Totals over a 200-row cap are shown as whole totals → Totals cover every row, or the tile says "newest 200".
- [A][money-signin] A8·B-1 · /admin/pricing `price-control-actions.ts` · A failed sign-up discount read counts as 0%: it is shown, and… → A refused discount read says "Couldn't read" and blocks the s…
- [A][money-signin] A8·B-2 · /admin/pricing `actions.ts` · Most price writes skip the "Prices & promos · Escalated" check that… → Every price change checks (code). `lib/admin/areas.ts` says Escalated…
- [A][money-signin] A8·B-4 · /admin/pricing `pricing-surface.tsx` · Booking fee form fills in code values when the settings read fails, and still offers Save → "Couldn't read" with saving off.
- [A][money-signin] A8·B-7 · /admin/pricing `v2-catalog.ts` · Free windows says there are no services when the catalogue read fails → "Couldn't read the services" with Create turned off.
- [A][money-signin] A8·B-8 · /admin/pricing `pricing-surface.tsx` · Under a failed catalogue read, empty-state copy still shows beneath the banner → Nothing below the banner claims an empty state.
- [A][wrong] A8·B-9 · /admin/pricing `free-windows-surface.tsx` · Supplier free windows print the plan's code key ("Solo" / "Enterprise") → "Plus" / "Ultra".
- [A][wrong] A8·B-10 · /admin/pricing `pricing-surface.tsx` · Supplier add-on rows say "(Supplier Ultra)" → "Ultra". The owner ruled on 14 Nov "NO 'SUPPLIER'" (`TIER_LABEL` comment in (code)).
- [A][wrong] A8·B-16 · /admin/pricing `catalog-editor.tsx` · Picking a kind with no prices says 'Nothing matches "".' → An empty state that says nothing of that kind is on sale.
- [A][money-signin] A8·A-7 · /admin/receipts · The receipt month filter uses the server's UTC month, labelled as a Manila month → The Manila calendar month, which BIR reconciliation needs.
- [A][wrong] A8·A-22 · /admin/receipts · The month picker offers only the months already on screen → Every month that has receipts.
- [A][money-signin] A8·A-5 · /admin/settings/payment-methods · Prices and peso amounts are typed into the Payment methods copy → No peso figure typed in code.
- [A][money-signin] A8·H-3 · /admin/ugat/map `data.ts` · On the entity map, every failed count reads 0 and "live", orders and billing included → "Couldn't read" or "—", never 0.
- [A][wrong] A8·C-11 · /admin/admin-log · Admin log prints raw action and table names ("vendor tier set · vendor_profiles") → Plain words that say "supplier", and no table names.
- [A][wrong] A8·P-B-22 · /admin/app-performance?tab=papic-storage · A one-press job with no confirm, labelled like a fix → see finding
- [A][wrong] A8·P-B-12 · /admin/catalogue · Catalogue › Templates & media names Hub music and Songs but has no chip for them → see finding
- [A][wrong] A8·B-15 · /admin/categories/requests `list-view.tsx` · Service requests state guesses as facts when reads fail → "Couldn't read" for each fact that failed.
- [A][wrong] A8·L-2 · /admin/demand · Three more pages lean on the layout gate alone → Every /admin page checks for an admin server-side itself.
- [A][wrong] A8·I-12 · /admin/demand `demand-radar-card.tsx` · Admin radar copy promises a floor control that does not exist → The copy matches the page: no control writes radar_min_n_floor.
- [A][wrong] A8·L-9 · /admin/discount-codes `middleware.ts` · Four forwards land somewhere other than the kit says; the kit reads the dead redirect → Kit § 4: (code), (code), (code), `/admin/work`.
- [A][wrong] A8·E-12 · /admin/fraud `wipe-ban-dialog.tsx` · Wipe + ban request gives no sign it was opened; a second press cras… → The dialog closes with "sent — waiting for a second admin", and the…
- [A][wrong] A8·F-24 · /admin/integrity-watch · A refused open-count read hides the tab badge, which looks the same as "none open" → "—" on that tab.
- [A][wrong] A8·A-24 · /admin/offers · Gifts search: a failed read says "No suppliers match" → "Couldn't search".
- [A][wrong] A8·G-16 · /admin/pakanta `pakanta-deliver.tsx` · The Music Maker delivery copy says "couple's site" → Event Hub, as the next line of the same file already says.
- [A][wrong] A8·F-21 · /admin/papic-storage · Storage totals can be quietly cut off at the database's row limit and still shown as measur… → The totals are paged to the end or marked as a lower bound.
- [A][wrong] A8·F-22 · /admin/papic-storage `backfill-tiles-button.tsx` · "Made 2 copys" → "Made 2 copies".
- [A][wrong] A8·P-B-3 · /admin/payments?view=fees · Fees owed: "Nothing waiting" over a list of 9 suppliers with fee owed ₱0 → One clear story: who owes what, and why a supplier is listed for review.
- [A][wrong] A8·P-B-14 · /admin/payments?view=fees · Page titles: missing on four views, doubled on two → see finding
- [A][wrong] A8·A-23 · /admin/payouts · Payout times show in UTC → Manila time, as Subscriptions and Payment options use.
- [A][wrong] A8·F-19 · /admin/repost-watch · Failed reads show "No QR flags" and "No shop holds an allowance" → "Couldn't read" in place of the empty line.
- [A][wrong] A8·F-13 · /admin/reviews `actions.ts` · Escalating an appeal closes it; no "two-admin queue" exists to receive it → The appeal lands in a queue someone works, as the notice promises.
- [A][wrong] A8·F-14 · /admin/reviews `actions.ts` · Reject or Escalate from a stale page overwrites an appeal that was already decided → "Already decided", nothing changed.
- [A][wrong] A8·A-21 · /admin/subscriptions · Subscriptions: "Unknown supplier" when the names read fails → "Couldn't read the supplier".
- [A][wrong] A8·I-10 · /admin/switches `sample-event-switch.tsx` · Sample switch states "Default — off" as fact while the default f… → The default row says what the env says, as the AI paywall row do…
- [A][wrong] A8·I-11 · /admin/switches `demo-mode-surface.tsx` · Demo-mode row is labelled "View /vendors" → Supplier wording, naming the real destination (the marketplace on Discover).
- [A][wrong] A8·D-14 · /admin/team `team-ops.server.ts` · Team "Add" and "Save" give no sign anything happened, and a second p… → "Waiting on a second admin in Approvals", and one pending request per…
- [A][wrong] A8·D-15 · /admin/team · A failed owner check shows the owner as an ordinary admin with "No areas yet" → "Couldn't check the owner", never an unlocked row.
- [A][wrong] A8·H-14 · /admin/ugat `brain-surface.tsx` · A failed brain-chunk read shows 0 counts and "No chunks authored yet" in all eight topics → "—" in the KPI cards and no empty-state copy.
- [A][wrong] A8·H-15 · /admin/ugat `actions.ts` · Menu edits report success when the database refuses them → A failure with its reason, and no audit row.
- [A][wrong] A8·I-8 · /admin/vendor-partnerships · Open proposals header says "(0)" and "No proposals awaiting" on a failed r… → The heading says "not measured", as the Live partnerships heading does.
- [A][wrong] A8·I-7 · /admin/vendor-recommendations · Recommendation map and supplier-flag queue show 0 and "nothing pending" when the reads fail → "Couldn't read", never zero or empty.
- [A][wrong] A8·L-5 · /admin/work `loading.tsx` · Nine pages, behind 39 of the area's 71 addresses, load with the overview… → The skeleton draws only what that page draws (HOUSE_DESIGN_STANDARD F1: "…
- [A][wrong] A8·C-6 · /admin/work `queues-triage-feed.tsx` · Work › All lane chips add the watch-only trails into "All N" → The chip agrees with the Next card's "N need you" (totalOpen leaves the tra…
- [A][wrong] A8·C-7 · /admin/work `tab-landing.tsx` · Work landing's "Waiting · across every queue" counts a watch trail and leaves out queues the Work… → The same total the Work list and Focus show.
- [A][wrong] A8·C-8 · /admin/work `supplier-inbox.tsx` · "From suppliers" filter shows "Documents 0" when that read failed → "—" or "couldn't read" beside that kind, and an "All" count that says it i…
- [A][wrong] A8·C-9 · /admin/work · Event-type read error is dropped, so the "It is this event type" picker is just empty → "Couldn't read the event types".
- [A][wrong] A8·C-10 · /admin/work `supplier-work.server.ts` · Verification checks that fail to run show up as "no checks" on a Documents row → A line saying the checks could not run, before Approve.
- [A][look] A8·P-B-18 · any admin address opened or re-opened wi · Offline, every new admin address is the browser's own error page → see finding

## Lane B · a look change (Fable drawing first)

### All areas · shared fixes (one batch each; full ID lists under "Sweeps" at the end)

- [B][look] SW-K2 (77 IDs · areas 2,3,4,5,6,8) · tokens (K2) · typed px, half-pixel text, Tailwind palette, hex, light-only white → house tokens and type scale
- [B][look] LIVE SW-K1 (66 IDs · areas 1,2,3,4,5,6,7,8) · one main button (K1) · 2+ filled or accent buttons per scope → one main, others neutral or text links
- [B][look] SW-DIALOG (33 IDs · areas 1,2,3,4,5,6,7,8) · hand-built layers · own dialogs/sheets/overlays (own scrim, no dim/blur/lock) → shared Sheet / RiseScreen
- [B][look] SW-SKEL (17 IDs · areas 1,2,3,4,6,8) · skeleton shapes · skeletons draw tables/grids the page never draws → skeleton matches the page
- [B][look] SW-POPPOP (13 IDs · areas 2,4,5,7,8) · popup on popup · a popup opens over a popup → one layer (Add 1)
- [B][look] SW-DARK (10 IDs · areas 1,2,3,5,6,7,8) · DARK_READY · dark missing or partial on most signed-in pages → every page dark, one dark design for 4 roles
- [B][look] SW-SHADOW (9 IDs · areas 1,2,5,8) · card shadows · static cards float on a shadow → flat house cards
- [B][look] SW-CONFIRM (8 IDs · areas 2,3,8) · confirms · window.confirm/alert/native dialogs → the house confirm sheet
- [B][look] SW-SELECT (7 IDs · areas 8) · native selects · native <select> with 3+ options → PickMenu
- [B][look] SW-TAP (6 IDs · areas 1,2,4,6,7,8) · tap targets · 16 px ⓘ and sub-44 px controls → 44 px on touch
- [B][look] SW-LOADNULL (4 IDs · areas 1) · `loading.tsx` null · blank content area while reading → Ghost skeleton of the page
- [B][look] SW-SPIN (3 IDs · areas 5,8) · busy states · spinners and pulsing blocks → house press + Ghost skeleton
- [B][look] SW-GLOW (1 IDs · areas 2) · dark top block · no glowing top block in dark → the shared top-block glow
- [B][look] Add 15 (owner) · one source for the Setnayan mark · login mark, loader, QR, print, wallet pass, reveal, desktop icon copy or link the mark → all read Admin › Business "Default brand icon"
- [B][look] Add 16 (owner, drawing APPROVED) · loading logo · particle SDLoader → the approved looping ring loader, reading the mark from Add 15

### Area 1 · Front door & public pages (14)

- [B][look] A1-167 · / · Desktop rail: a coloured stripe on the active row and two "Sign in" buttons → Part H: never a coloured side stripe.
- [B][look] A1-096 · /articles/write `write-sheet.tsx` · Write a post is a separate page, not a full-screen popup → A FULL-SCREEN POPUP (`RiseScreen`) over the feed, where ✕ returns to the same place.
- [B][look] A1-165 · /budget · Product pages open with a slogan, not a plain answer → Add 9 AEO: each page opens with a plain answer ("Setnayan Budget is a free budget tracker in pesos……
- [B][look] A1-097 · /help `message-us.tsx` · The Message us form is five fields in a half-height sheet → A Sheet holds about 3 fields or fewer.
- [B][look] A1-098 · /help/[slug] · Two pages sit outside the house shell → The page sits inside the one shell, like /help/topics/[key].
- [B][look] A1-038 · /papic `_papic-sections.tsx` · Coloured side stripe on a row in the Papic Event Hub mock → Never a coloured `border-left` accent on a card or row.
- [B][look] A1-118 · /pricing · /pricing and /features do not follow the Part H page order; /pricing spreads the… → - /pricing (H4): hero (short, so the first prices show without a swipe) → event pla…
- [B][look] A1-158 · /pricing · /pricing opens a 3-step tour over the page for a first-time visitor → The page itself: show it working, remove the fear, then the plans (brand.md page order).
- [B][look] A1-120 · /pricing/plan `_plan-quiz.tsx` · Multi-step flows are pages, not full-screen popups → - The quiz: a RiseScreen over /pricing; ✕ returns to the same place (it is a multi-screen fl…
- [B][look] A1-021 · /samahan/chat/new · New group should be a full-screen popup over Chats → A `RiseScreen` over Chats; ✕ returns to the same place.
- [B][look] A1-075 · /signup/you `you-card.tsx` · The You card should be a full-screen popup → A FULL-SCREEN POPUP (`RiseScreen`).
- [B][look] A1-142 · /v/[slug] `portfolio-photo-tiles.tsx` · Portfolio photos open in a half sheet, not the full-screen photo vi… → The full-screen photo viewer the hero already uses (✕, "3 of 12", ‹…
- [B][look] A1-144 · /v/[slug] `pinned-review-card.tsx` · Coloured side stripes on review blocks → No accent side stripe.
- [B][look] A1-145 · /v/[slug] `services-gallery.tsx` · Service filter chips: an accent-filled selected chip and a hand-made row of… → A PillSelector or PickMenu, neutral beside the one main Inquire.

### Area 2 · Couple: create & plan (12)

- [B][look] A2-P21 · /d/[eventId] · 1280: the event date is cut off in the left column → "WEDDING · FEBRUARY 23, 2027" in full.
- [B][look] A2-H14 · /d/[eventId]/find-date `find-your-date.tsx` · Icon tiles and a self-made title → No icon in a pastel box; typography leads.
- [B][look] A2-D8 · /d/[eventId]/guests/new · Four guest pages hand-roll their title → `PageMasthead` on every page (CLAUDE.md §3), as /guests and /claims do.
- [B][look] A2-D9 · /d/[eventId]/guests/new `add-guest-sheet.tsx` · The add forms are pages, not full-screen popups → SHAPE tests: nobody shares or returns to an add form by link (test 1 fails); each…
- [B][look] A2-I12 · /d/[eventId]/paperwork · Paperwork summary is four equal KPI tiles → One hero number, with the rest quieter in one hairline row.
- [B][look] A2-P23 · /d/[eventId]/schedule · Schedule on desktop: the run of show is crushed into a 300 px column → The timeline uses the page: times and moments on one line each, nothing cut.
- [B][look] A2-I4 · /d/[eventId]/schedule?view=preparation `preparation-agenda.tsx` · Planning rows use pastel icon tiles and numbered colou… → No coloured icon boxes (Part I rule 2), and token colou…
- [B][look] A2-E12 · /d/[eventId]/seating/chart `seating-editor.tsx` · Chart and walkthrough are pages, should be full-screen popups → By the SHAPE tests, neither is shared or come back to by link.
- [B][look] A2-X3 · /dashboard · Opening Create over the account home may darken the unswept home behind it → Nobody meets a half-dark screen (appearance.ts call 3): either the home and the popup are…
- [B][look] A2-C15 · /dashboard/samahan/new · "Create a group" is a whole page for two fields → SHAPE test 3: not shared by link, one short screen, 2 fields → SMALL POPUP (`Sheet`) over People ›…
- [B][look] A2-P15 · /guests/claims · Guest sub-pages: four kinds of Back, three kinds of title → One Back look and one title look (Add 5 "same everywhere").
- [B][look] A2-A1 · /onboarding/[type] `create-event-panel.tsx` · Create-an-event is a bare page, not a full-screen popup → The whole create flow rises as ONE RiseScreen over the page it was started…

### Area 3 · Couple: Maker, Event Hub, Papic, Memories (12)

- [B][look] A3·M-11 · /d/[eventId]/alaala/assignments · Assignments is its own address; it should rise over Alaala → FULL-SCREEN POPUP over Alaala; ✕ returns.
- [B][look] A3·N-03 · /d/[eventId]/galleries · Memories › More from your day squeezes the Papic card into a one-word colu… → Title, state and line on one row; the button under them or at the right wi…
- [B][look] A3·I-11 · /d/[eventId]/guests/send · Send run and wax-seal maker are addresses; they should rise over the page you came from → FULL-SCREEN POPUP (RiseScreen): ✕ returns to the same place.
- [B][look] A3·N-05 · /d/[eventId]/memories · Memories opens a six-step tour that blocks every control until Skip → The page works at once; a first-timer can tell what to press (Add 5: a step that ne…
- [B][look] A3·N-06 · /d/[eventId]/memories · Dark: the bottom bar loses the active tab on Memories → The active tab marked as in light (the terracotta pill on "Memories").
- [B][look] A3·E-08 · /d/[eventId]/story · Motion and legacy pieces: switches slide `left`, autoplay video ignores reduced motion, leg… → transform/opacity only; autoplay loops respect reduced motion;
- [B][look] A3·P-11 · /d/[eventId]/studio/papic/crew `one-code.tsx` · Crew and moderation pages should not be pages → Crew: a SMALL POPUP (the one code already lives on Event Details › How guests get…
- [B][look] A3·S-10 · /d/[eventId]/studio/patiktok/[templateId] · Patiktok template pick and booth camera should be full-screen layers → FULL-SCREEN POPUP (one-step pick; a camera).
- [B][look] A3·E-09 · /d/[eventId]/website/hero-photo · Editor sub-pages are their own addresses; they should rise over the M… → FULL-SCREEN POPUP (photo/video, nobody shares it): rises over the Make…
- [B][look] A3·E-20 · /d/[eventId]/website/our-story · Six editor sub-pages are addresses; they should rise over the Maker (t… → FULL-SCREEN POPUP over the Maker (long, not shared); ✕ returns to the…
- [B][look] A3·L-12 · /panood/control/[eventId] · Live controller Setup (~740 lines, seven sections) opens in a half sheet → FULL-SCREEN POPUP (many screens long).
- [B][look] A3·N-07 · every event page at 768 and 1280 (event: · The event's badge in the side rail spills out of its ring → "C & M" inside its ring, on one line.

### Area 4 · Guest (7)

- [B][look] A4-B05 · /[slug] · At 1280 the cover still says "SWIPE UP FOR THE EVENT" — there is no swipe with a mouse; it should read "Scrol… → Desktop words for desktop; one frame per block.
- [B][look] A4-32 · /[slug]/everyone · It navigates to its own page with "Back to the invitation" (`href={`/${slug}`}… → SHAPE tests: nobody shares or bookmarks this list (test 1 no); it is more than…
- [B][look] A4-41 · /[slug]/invite/reply · A full page navigation to `/{slug}/invite/reply` (`inviteReplyPath(code)Repl… → SHAPE tests: nobody shares this address (test 1 no); with meal, dietary, mob…
- [B][look] A4-B04 · /live · The button stays exactly as it was (not disabled, no busy state, same word) and not… → The button looks pressed at once (pending), then "that code doesn't work" (`/live?e…
- [B][look] A4-55 · /papic/decorate `route.ts` · A two-hop navigation ((code) `NEXT_DESTINATIONS` (code)) to a standalone… → SHAPE tests: a photo editor, not shared or revisited by link → FULL-SCREEN…
- [B][look] A4-69 · /papic/guest `site-body.tsx` · Two navigations ((code) in `site-body.tsx`) to a page with (code); its ✕… → SHAPE tests: the URL carries no identity and QR scans land on /papic/me…
- [B][look] A4-81 · /papic/pool · A two-hop navigation to a standalone (code). → SHAPE tests: a photo gallery, not shared (the URL carries no identity) → FULL-SCREEN POPUP over /pa…

### Area 5 · Supplier: shop, cards, Toolkit, plans (20)

- [B][look] A5-G1-01 · /open-shop `open-shop-wizard.tsx` · Opening a shop is a page, not a full-screen popup → A multi-step fill-in rises as a FULL-SCREEN POPUP (`RiseScreen`) with its own full entry…
- [B][look] A5-G1-07 · /open-shop/invite · "Invite shops you trust" is a page, not a step of the open-shop popup → The closing step of the /open-shop FULL-SCREEN POPUP (not shared or revisited by lin…
- [B][look] A5-G1-08 · /open-shop/logo `add-your-logo.tsx` · "Add your logo" is a page, not a step of the open-shop popup → A step inside the /open-shop FULL-SCREEN POPUP (photo work → full screen).
- [B][look] B5-15 · /open-shop/logo · The open-shop steps change colour, and they open again for an established shop → One look across the open-shop steps; a shop that is open goes to Shop (as /open-…
- [B][look] B5-11 · /vd · Today on desktop: tiles clipped at the right edge, the same counts twice, the task b… → The count row fits its column; one set of counts; the "Needs you today" band sits ins…
- [B][look] A5-G6-16 · /vd/deep-search · Deep Search: numbered palette pills and an orange icon tile → Token colours (dot + coloured word on a dark tint); no icon tile.
- [B][look] A5-G2-14 · /vd/help · SHAPE: Help is a page of five links → SMALL POPUP (`Sheet`, half height on a phone): one short screen of five doors, not shared by link.
- [B][look] B5-16 · /vd/services/[serviceId] · Card maker: a locked card still draws edit controls; the Name box hides th… → A locked card shows read-only fields (no pencil, no add-photo tile); a nam…
- [B][look] A5-G3-05 · /vd/services/new · Making or editing a card is a page, not a full-screen popup → A multi-step fill-in rises as a `RiseScreen` over Shop; ✕ returns to the same scroll place; lar…
- [B][look] A5-G3-06 · /vd/services/requests/new `tell-us-view.tsx` · "Tell us what you do" is three addresses, not one full-screen… → A 3-step fill-in rises as one `RiseScreen` over the maker; ✕ ret…
- [B][look] A5-G4-04 · /vd/shop `shop-cover.tsx` · Logo, Cover photo and Storage open full screen on a phone though each is… → SMALL POPUP: `Sheet` at half height (See · Upload · Adjust / See · Uploa…
- [B][look] B5-06 · /vd/shop · Shop on desktop: service-card titles break letter by letter in a narrow column → Card name on one or two lines beside the thumbnail; the right column wide enough, or th…
- [B][look] B5-17 · /vd/shop/store · Toolkit: one lone card per shelf on tablet and desktop; search button covers Install at 375 → Shelves fill a row; nothing floats over a card's button.
- [B][look] A5-G5-17 · /vd/team/roles `helpers-view.tsx` · SHAPE: Roles is a separate page; it should rise over Team → FULL-SCREEN POPUP over Team (more than one short screen; nobody shares it), ✕ ba…
- [B][look] A5-G5-16 · /vd/team/roles/inquiries · Who gets new inquiries: the branch choice is a row of pill links, not one dropdown → "Where you are" is one `PickMenu` dropdown.
- [B][look] A5-G5-18 · /vd/team/roles/inquiries · SHAPE: Who gets new inquiries is a page two levels under Team → FULL-SCREEN POPUP (a section of Roles opening in place; never a popup on a popup).
- [B][look] A5-G5-19 · /vd/theft-watch `shop-tool-shelves.ts` · SHAPE: Theft Watch is a page; it should be a full-screen popup fr… → FULL-SCREEN POPUP (a list longer than one screen; no email or noti…
- [B][look] A5-G5-20 · /vd/track-record `shop-tool-shelves.ts` · SHAPE: Track record is a page; it should be a full-screen popup from… → FULL-SCREEN POPUP (no shared or notification link reaches it).
- [B][look] A5-G1-15 · /vendor/fit/[ref] · Fit check's event choice is a pill row with an ink-filled selected pill → 3+ choices are one `PickMenu` dropdown; colours by token so dark stays readable.
- [B][look] B5-26 · across the area · Five different back buttons, and seven pages with no visible title → One back control and a PageMasthead title on every page (lint:masthead holds the component,…

### Area 6 · Supplier: bookings, chat, payments (8)

- [B][look] A6-53 · /vd/clients/[eventId]/challenge-photos · Today a page; a photo/video grid that nothing links to by address → should be a FULL-SCREEN POPUP. → see finding
- [B][look] A6-70 · /vd/contracts/new · Shape (Add 1): today its own page; four fields plus a file pick, reached from a client or Contracts → should… → see finding
- [B][look] A6-41 · /vd/customers `outside-client-add.tsx` · A half `Sheet` (outside-client-add.tsx) with 7 rows (Name · Schedule/Halls · Date · Time · To · Contact… → FULL-SCREEN POPUP (RiseScreen).
- [B][look] A6-B24 · /vd/customers · The open days on the month grid are pastel-green tiles on the navy page — a light surface on a dark page (Add… → see finding
- [B][look] A6-42 · /vd/customers?wallet=1 · A `Sheet(code)SHOP_WALLET_HREF`). → Test 1 (returned to by link) → its own PAGE.
- [B][look] A6-B15 · /vd/disputes · Two back buttons: disputes and manpower use a white circle with "<"; contracts/new and booking-fees use a tin… → see finding
- [B][look] A6-11 · /vd/messages/[threadId] `vendor-thread-tools.ts` · Opens full screen (`rise: true` in lib/vendor-thread-tools.ts) but is one short screen (fee line + Agree… → SMALL POPUP (Sheet).
- [B][look] A6-12 · /vd/messages/[threadId] `thread-tool-panel.tsx` · No `rise`: they open as a `<details>` tray under the composer (app/_c… → FULL-SCREEN POPUP (RiseScreen); a proposal is multi-step.

### Area 7 · Coordinator, Spaces, maps (4)

- [B][look] A7-35 · /d/[eventId]/plan3d · At 375 the 3D seat plan's count row is cut off under a button → The row fits or wraps; no control sits on top of another.
- [B][look] A7-20 · /d/[eventId]/studio/panood/setup/venue-check · Venue check: a failed event read is a 404; the bar animates its… → A refused read says so; motion is transform and opacity only; one…
- [B][look] A7-05 · /pa3d `plan3d-scene.tsx` · On a phone the 3D room traps the page's scroll → The page scrolls; the room turns only on a deliberate gesture (or a visible tap path).
- [B][look] A7-15 · /vd/spaces · Spaces skips the house title, toast, Undo and empty state → `PageMasthead(code)EmptyState`.

### Area 8 · Admin (17)

- [B][look] A8·P-B-7 · /admin · Two search boxes on one screen → One search per screen; search is an icon until tapped (Add 5 "Same everywhere").
- [B][look] A8·P-B-8 · /admin · Focus "Completions" card: a coloured side stripe, and it leaves the content column → see finding
- [B][look] A8·D-29 · /admin/accounts · The long comp-grant form opens at the foot of the list, out of sight → FULL-SCREEN POPUP (RiseScreen, ✕ back to the list) for a 5-part form: scope, service che…
- [B][look] A8·C-20 · /admin/approvals · The 3-field New request form sits open above the queue → The queue first, and New request as a SMALL POPUP (Sheet, 3 fields).
- [B][look] A8·P-B-11 · /admin/catalogue · A card with nothing waiting is drawn grey, so its working chips look switched off → see finding
- [B][look] A8·A-29 · /admin/discount-codes/new · Create discount code is a page, but should be a full-screen popup → FULL-SCREEN POPUP over the list (a long create form nobody bookmarks; ✕ returns).
- [B][look] A8·E-17 · /admin/disputes · Resolve forms open inline inside a wide table's last column → SMALL POPUP (Sheet, 1–2 fields) opened from the row.
- [B][look] A8·F-30 · /admin/editorial-review · The "● Vulgar" chip is white text on a pale pink background → A readable chip.
- [B][look] A8·C-15 · /admin/help/guides · The team Help page has no PageMasthead (no page title) → (code), as every page has.
- [B][look] A8·P-B-4 · /admin/settings/payment-methods · Payment methods: the pinned title runs off the screen at 375 → see finding
- [B][look] A8·D-30 · /admin/venues/new · The one-off venue create form is its own page → FULL-SCREEN POPUP over the Venues tab (long form: 8 fields and 17 ceremony checkboxes; nobody bookm…
- [B][look] A8·P-B-10 · /admin/work · Tab dashboards repeat each card's buttons as a sentence first → see finding
- [B][look] A8·P-B-17 · any admin page with the signal off (375) · The offline bar covers the top bar → see finding
- [B][look] A8·P-B-5 · every admin page (top bar) · The overdue chip is cut off: "1 ove…" (1280) and "1…" (375) → see finding
- [B][look] A8·P-B-6 · every admin page (top bar, 768 and 1280) · "SETNAYAN TEAM" chip: tiny two-line text in a grey pill → see finding
- [B][look] A8·P-B-9 · every admin page at 1280 (rail) · The admin rail carries the public site's footer → see finding
- [B][look] A8·P-B-20 · every admin page, Focus mode, 375 and 76 `layout.tsx` · Focus on a phone has no tab bar; the five tabs hide behind ☰ → see finding

## Lane C · function, rule or money (owner first)

### Several areas · one cause

- [C][money-signin] A1-155 A8·B-3 · Setnayan AI price · three prices (₱265 / ₱2,790 / ₱1,499) and admin falls back to typed prices → one catalogue value the owner sets
- [C][money-signin] A2-P20 A3·N-01 B5-01 B5-05 B5-19 A6-B16 · signed-in people sent to sign-in · A signed-in person is sometimes sent back to sign in… → stay signed in, honest "couldn't reach sign-in"
- [C][money-signin] A2-F2 A2-F9 A2-B5 A2-G3 A2-I2 A6-34 A8·A-4 · one money reader · order, receipt, home, team, planning, supplier rows and admin rev… → all read `resolveEventMoney` / `orderGrossOwed`
- [C][wrong] A1-101 B5-23 A8·B-11 A8·B-12 · plan contents story · pages and admin Plan contents disagree on what each plan holds (no Event Ultra, keep-times) → one story read from `EVENT_PLANS`

### Area 1 · Front door & public pages (9)

- [C][money-signin] A1-080 · /articles/write `articles.server.ts` · A no-account (anonymous) session gets past the article sign-in gate → A session with no account is treated as signed out.
- [C][money-signin] A1-156 · /login · Signing in takes about a minute, and creating an event over two minutes → A press looks pressed at once; sign-in lands in a few seconds (kit § 5 item 10).
- [C][money-signin] A1-057 · /reset-password · /reset-password lets any signed-in device set a new password without the c… → Only the recovery session from the emailed link may change the password, o…
- [C][money-signin] A1-059 · /signup `oauth-actions.ts` · A supplier who goes from sign-up to sign-in and back is filed as a c… → The supplier choice survives the round trip. login-data.ts already pu…
- [C][money-signin] A1-060 · /signup `referrals.ts` · The referral banner promises a reward that may not exist, for the wron… → A reward line only when the programme is on and a reward is set, in wor…
- [C][money-signin] A1-001 A1-022 A1-028 · Setnayan AI public copy · tour says AI is free; /setnayan-ai says "0% … never what pays us", l… → Add 20 copy: included in Event Pro/Ultra, only what is true
- [C][money-signin] A1-102 A1-122 · booking fee shown to hosts · the supplier booking fee appears on host-facing pages and unverified shops → never shown to hosts
- [C][wrong] A1-170 · /pricing · From "Sign in to get Event Plus" to a payment is well over 4 taps, and three pric… → Add 4: price before pressing (ok), the wall-to-"payment logged" path in 4 taps or…
- [C][wrong] A1-089 · /privacy · Privacy contradicts itself and the code on which AI provider reads what → One consistent, current list.

### Area 2 · Couple: create & plan (7)

- [C][money-signin] A2-P3 · /d/[eventId]/orders/[orderId] `php.ts` · Order page says VAT is added on top; the list says "incl. VAT";… → One wording for tax on every money screen, and pesos printed as…
- [C][money-signin] A2-P2 · /d/[eventId]/orders/new · Event services: Event Pro priced below Event Plus; Event Ultra "Couldn… → Each pack shows its catalogue price, ladder rising Plus < Pro < Ultra,…
- [C][money-signin] A2-G12 · /d/[eventId]/vendors/packages/[bookingId] `actions.ts` · "Release this package" un-books paid suppliers with no… → The same rule as cancelling a booking: money that moved…
- [C][money-signin] A2-A3 · /onboarding/[type] `commit-event.ts` · A rate-limited signed-out host cannot save, no way on → A plain reason and a way forward (sign in / create an account, the draft kep…
- [C][money-signin] A2-A2 · /onboarding/simple `event-types.ts` · Get-together tile sends signed-out visitors to login → Zero friction: the questions run with no account; the account is asked only at…
- [C][money-signin] A2-A4 · /signup `actions.ts` · Securing an anonymous plan with Google or log-in loses it → The event made in step 1 is on the account the person ends up signed into.
- [C][look] A2-P24 · /d/[eventId]/vendors · Suppliers: "Unlock" Setnayan AI with no price → The ₱ price (read) and the plan name before the button (Add 4 EVIDENT).

### Area 3 · Couple: Maker, Event Hub, Papic, Memories (2)

- [C][money-signin] A3·S-02 · /d/[eventId]/studio/about/save-the-date · About pages mark Save the Date and the animated logo "Free" o… → Free parts said free, paid parts named with their plan; one bu…
- [C][money-signin] A3·E-04 A3·E-12 A3·M-04 · Event Hub locks (plan name) · locks say Event Plus on the badge and Event Pro in the note, no price → one plan name + price read from the catalogue

### Area 5 · Supplier: shop, cards, Toolkit, plans (1)

- [C][money-signin] A5-G5-01 · /vd/team `vendor-free-helper.ts` · Seats count paused and removed team members against the plan → Plans limit ACTIVE members: a paused or deactivated member does not us…

### Area 6 · Supplier: bookings, chat, payments (2)

- [C][money-signin] A6-B17 · /vd/clients/[eventId]/production-sheet · A lock card: "This booking is not confirmed on Setnayan yet —… → The sheet opens: the booking is Booked, and Booking fees says "N…
- [C][money-signin] A6-27 · /vendor/lock/[token] · "Create your event first". → Couldn't read your events.

### Area 8 · Admin (1)

- [C][money-signin] A8·G-1 · /admin/studio `referrals-surface.tsx` · The referral reward has no setter, but the copy says "set the r… → A control that sets the reward amount, or a door to the page th…

## Lane R · retired candidates (Add 17: delete, do not fix)

9 pages. Their 17 findings are **covered by retirement** and are not listed in A/B/C. R1 and R2 are ruled by the owner (Add 19); the rest wait for his ruling. The deletion is one batch with forwards.

| # | Route | What | Why | What links there | Findings covered |
|---|---|---|---|---|---|
| R1 | `/dashboard/profile/concierge` | Setnayan AI settings page | no door: both rows behind CONCIERGE_ENABLED = false for good; owner RULED retire (Add 19) | nothing live (gated profile rows, one admin action) | A2-P18 A2-C11 |
| R2 | `/dashboard/[eventId]/studio/setnayan-ai` | Setnayan AI buy page (₱1,499 stand-alone) | AI is no longer sold alone (Event Pro/Ultra); owner RULED retire, old address forwards to the Event Hub offer (Add 19/20) | home planner card, home first screen, Suppliers banner + search overlay, onboarding value card, lib/routes.ts setnayanAi | — (owner ruling; doors filed under C/A) |
| R3 | `/dashboard/clusters (+ /[clusterId])` | Linked events | no door: nothing outside the folder links to it (Ugat no-door) | its own child page only | A2-P16 A2-C13 |
| R4 | `/dashboard/[eventId]/guests/quick` | Quick add guests | no door (Ugat status no-door); its job moved to the search box and "Paste many names" (owner 27 Oct) | unused lib/routes.ts builder only | A2-D10 |
| R5 | `/dashboard/[eventId]/seating/lab` | 3D seating lab "(prototype)" | prototype page outside the Guests shell; the 3D room lives in Guests › Seats since R4 | mood-board editor link | A2-E6 |
| R6 | `/dashboard/[eventId]/studio/papic/challenges + /run-of-show` | Papic challenges & run-of-show pages | no pressable door (links sit in a branch never drawn); challenges already live inside camera settings | none a person can press | A3·P-02 A3·N-13 |
| R7 | `/admin/concierge-abuse` | Concierge enforcement desk | the concierge is retired (own ⓘ says so) yet the desk still writes strikes; fold or delete | admin menu | A8·F-10 A8·F-11 A8·F-12 A8·F-34 |
| R8 | `/dashboard/api-keys + /api/v1 page` | Public API keys and docs | public API is switched off (public-api-flag), yet every couple is offered keys (LIVE: /api/v1 answers 404) | account menu; /api/v1 is in search results | A1-085 A2-C3 A2-C4 A2-C5 |
| R9 | `/papic/lightcheck` | Papic light check (measurement page) | its own code says "DELETE THIS ROUTE once the numbers are recorded" | none for guests (baselined in Ugat only) | A4-73 |

Not retired, but noted: the `/dashboard/[eventId]/orders/new` page is already a forward (A2-F3 is about the empty-state words). A3·S-03 also names the R2 buy page; only its Pakanta part stays in SW-PHP.

## LIVE faults (seen on setnayan.com during the check)

- A1-027 · A · "Monogram" in words a person reads; the product is Logo Maker
- A1-032 · A · Live Watch demo dead-end sends people to a homepage tile that no longer exists
- A1-047 · A · The commission line is not the ruled sentence
- A1-048 · A · Creators page promises "free, forever" and types ₱0
- A1-058 · A · Text from the URL is printed inside sign-in and sign-up cards, and a stray "%" breaks the page
- A1-081 · A · A shared guide or topic link is a 404 for anyone signed out, not a sign-in door
- A1-082 · A · The answer page's topic breadcrumb points at an anchor that does not exist
- A1-083 · A · A failed Message us send hides its reason, loses the typed message, and a crafted link crashes /help
- A1-085 · R · /api/v1 advertises a public API that is switched off
- A1-103 · A · Price promises ("free to stay", "for good", "forever")
- A1-104 · A · "Trust" promises about suppliers
- A1-108 · A · "Pabuya" and "Safe" on the /features E-Gifts rows
- A1-115 · B · Two accent buttons in one scope
- A1-116 · B · Heroes and closes do not carry the one terracotta button
- A1-146 · A · Every public page is rendered per request and never cached at the edge
- A1-147 · A · Speed: no page is usable within 0.7 s from here; the slow ones
- A1-148 · A · /pricing answered HTTP 502 once
- A1-149 · A · /papic creates a demo session and opens a live connection for every visitor, on load
- A1-150 · B · The shop page has two terracotta-filled buttons on one phone screen
- A1-151 · A · Test shops are public and are the only shops in the sitemap
- A1-152 · A · The shared website footer says "Monogram maker"

## Fix batches (sketch)

A-lane batches hold 10–15 fixes. Cross-area sweeps are their own batches. B counts screens that need a new Fable drawing (shape changes and one-off layouts); B sweeps need one reference drawing each.

| Area | A entries (own) | A batches | A sweep members | B screens needing drawings | B sweep members | C items |
|---|---|---|---|---|---|---|
| 1 | 78 | 6 | 36 | 11 | 29 | 14 |
| 2 | 61 | 5 | 27 | 11 | 33 | 13 |
| 3 | 46 | 4 | 17 | 11 | 9 | 5 |
| 4 | 64 | 5 | 11 | 7 | 13 | 0 |
| 5 | 48 | 4 | 19 | 17 | 35 | 5 |
| 6 | 49 | 4 | 18 | 6 | 15 | 4 |
| 7 | 19 | 2 | 4 | 4 | 9 | 0 |
| 8 | 123 | 10 | 36 | 16 | 111 | 5 |

Plus 17 A sweeps (about 13 batches by size; SW-PHP and SW-WORDS are the biggest) and 13 B sweeps (SW-K2 and SW-K1 are the biggest; SW-DARK is one owner-visible batch across five roles), plus Add 15/16.

## Sweeps · every ID each shared fix covers

- **SW-PHP** (A, 42): area 1: A1-034 A1-114 A1-140 · area 2: A2-F6 A2-B10 A2-A5 A2-G2 A2-H6 · area 3: A3·E-14 A3·L-07 A3·S-03 · area 4: A4-64 A4-77 · area 5: A5-G1-03 A5-G1-04 A5-G2-08 B5-04 · area 6: A6-04 A6-16 A6-25 A6-28 A6-33 A6-46 · area 7: A7-18 A7-24 · area 8: A8·A-12 A8·A-13 A8·A-14 A8·A-15 A8·A-16 A8·A-17 A8·B-5 A8·C-2 A8·D-7 A8·E-6 A8·E-7 A8·F-2 A8·F-4 A8·G-2 A8·H-2 A8·I-4 A8·I-5
- **SW-WORDS** (A, 29): area 1: A1-027(LIVE) A1-086 A1-107 A1-108(LIVE) A1-152(LIVE) · area 2: A2-G13 A2-H9 A2-I6 · area 3: A3·E-06 A3·E-18 A3·L-10 A3·M-07 A3·I-08 · area 4: A4-42 A4-43 · area 5: A5-X-03 · area 6: A6-49 · area 8: A8·P-B-15 A8·B-13 A8·C-12 A8·D-16 A8·D-17 A8·E-14 A8·G-13 A8·G-14 A8·G-15 A8·H-12 A8·H-13 A8·I-9
- **SW-BOOKED** (A, 17): area 1: A1-135 · area 2: A2-P7 A2-E5 A2-D14 A2-G5 A2-G9 A2-G16 A2-H8 · area 3: A3·S-06 · area 5: B5-02 · area 6: A6-06 A6-32 A6-37 A6-B05 A6-B12 A6-B20 · area 7: A7-21
- **SW-PROMISE** (A, 11): area 1: A1-024 A1-030 A1-048(LIVE) A1-093 A1-103(LIVE) · area 2: A2-A6 · area 3: A3·M-01 A3·P-04 · area 4: A4-B12 · area 5: B5-24 · area 7: A7-19
- **SW-COMING** (A, 9): area 1: A1-004 A1-109 · area 2: A2-P19 A2-C9 A2-I16 · area 4: A4-72 · area 5: A5-X-04 A5-G6-03 · area 8: A8·H-5
- **SW-RETNAME** (A, 8): area 1: A1-025 A1-049 A1-063 A1-087 A1-106 · area 2: A2-F3 · area 3: A3·S-08 · area 8: A8·P-B-13
- **SW-RAWDB** (A, 8): area 2: A2-A9 A2-C6 A2-D7 A2-I18 · area 3: A3·P-09 A3·S-07 · area 4: A4-14 · area 5: A5-G1-12
- **SW-PLACE** (A, 7): area 1: A1-168 · area 2: A2-P12 · area 4: A4-B10 · area 5: B5-13 · area 6: A6-67 A6-B11 · area 8: A8·P-B-16
- **SW-WEDDING** (A, 6): area 1: A1-055 A1-137 · area 2: A2-A8 · area 4: A4-47 A4-48 · area 5: A5-G3-11
- **SW-NOPRICE** (A, 6): area 3: A3·I-09 · area 5: A5-G4-07 A5-G5-09 A5-G6-12 A5-G6-15 · area 6: A6-B18
- **SW-URI** (A, 5): area 1: A1-058(LIVE) A1-083(LIVE) · area 3: A3·S-04 · area 5: A5-G6-22 · area 8: A8·F-9
- **SW-500** (A, 4): area 1: A1-154 · area 3: A3·B-02 · area 4: A4-B01 · area 5: B5-03
- **SW-SPEED** (A, 4): area 1: A1-009 A1-029 A1-064 · area 5: A5-G2-09
- **SW-COMM** (A, 4): area 1: A1-047(LIVE) A1-066 A1-092 · area 8: A8·H-4
- **SW-PERF** (A, 3): area 1: A1-146(LIVE) A1-147(LIVE) A1-169
- **SW-HYDR** (A, 3): area 2: A2-P11 · area 6: A6-B09 · area 8: A8·P-B-1
- **SW-TELE** (A, 2): area 6: A6-B04 · area 8: A8·P-B-2
- **SW-K2** (B, 77): area 2: A2-F8 A2-B8 A2-E14 A2-D5 A2-G8 A2-I20 · area 3: A3·L-11 · area 4: A4-59 · area 5: A5-G4-03 A5-G5-15 A5-G6-09 · area 6: A6-10 A6-14 A6-23 A6-40 A6-51 A6-58 A6-62 A6-69 · area 8: A8·A-30 A8·A-31 A8·A-32 A8·A-33 A8·A-34 A8·A-35 A8·A-36 A8·A-37 A8·A-38 A8·A-39 A8·B-24 A8·B-25 A8·B-26 A8·B-27 A8·C-21 A8·C-22 A8·C-23 A8·C-24 A8·C-25 A8·C-26 A8·C-27 A8·C-28 A8·C-29 A8·D-21 A8·D-22 A8·D-23 A8·D-24 A8·D-25 A8·E-19 A8·E-20 A8·E-21 A8·E-22 A8·E-23 A8·F-31 A8·F-32 A8·F-33 A8·F-35 A8·F-36 A8·F-37 A8·F-38 A8·F-39 A8·F-40 A8·F-41 A8·F-42 A8·G-20 A8·G-23 A8·G-25 A8·G-26 A8·H-22 A8·H-23 A8·H-24 A8·I-17 A8·I-18 A8·I-19 A8·I-20 A8·I-21 A8·I-22 A8·I-23
- **SW-K1** (B, 66): area 1: A1-018 A1-019 A1-039 A1-044 A1-076 A1-094 A1-115(LIVE) A1-116(LIVE) A1-143 A1-150(LIVE) · area 2: A2-P13 A2-P17 A2-F1 A2-B3 A2-B6 A2-B7 A2-E9 A2-E10 A2-D11 A2-D12 A2-D15 A2-I7 A2-I17 · area 3: A3·P-10 A3·S-09 · area 4: A4-39 A4-76 · area 5: A5-G1-05 A5-G1-10 A5-G2-11 A5-G2-13 A5-G3-08 A5-G3-09 A5-G3-10 A5-G4-02 A5-G5-12 A5-G5-13 A5-G5-14 A5-G6-02 A5-G6-07 A5-G6-08 A5-G6-17 A5-G6-18 B5-14 · area 6: A6-09 A6-50 · area 7: A7-07 A7-09 A7-12 A7-25 · area 8: A8·A-26 A8·A-27 A8·B-17 A8·B-18 A8·D-18 A8·D-19 A8·D-20 A8·F-26 A8·F-27 A8·F-28 A8·F-29 A8·G-17 A8·H-17 A8·I-13 A8·I-14 A8·I-15
- **SW-DIALOG** (B, 33): area 1: A1-017 A1-035 A1-046 A1-074 A1-077 A1-095 A1-117 A1-141 A1-153 · area 2: A2-B4 A2-D3 · area 3: A3·E-07 · area 4: A4-18 A4-19 A4-20 A4-29 A4-36 A4-40 A4-62 · area 5: A5-G1-02 A5-G3-03 A5-G4-08 A5-G4-10 A5-G6-19 · area 6: A6-20 A6-30 · area 7: A7-26 · area 8: A8·C-16 A8·C-17 A8·E-15 A8·E-16 A8·H-18 A8·H-19
- **SW-SKEL** (B, 17): area 1: A1-078 · area 2: A2-E13 A2-C1 · area 3: A3·E-19 A3·M-10 · area 4: A4-68 · area 6: A6-39 · area 8: A8·A-25 A8·B-22 A8·B-23 A8·C-13 A8·C-14 A8·D-31 A8·D-32 A8·E-18 A8·G-21 A8·H-21
- **SW-POPPOP** (B, 13): area 2: A2-D4 A2-G6 A2-G7 · area 4: A4-17 · area 5: A5-G3-04 A5-G4-05 A5-G5-11 A5-G6-20 · area 7: A7-08 A7-11 · area 8: A8·A-28 A8·B-20 A8·D-28
- **SW-DARK** (B, 10): area 1: A1-079 · area 2: A2-X2 · area 3: A3·A-01 A3·M-09 · area 5: A5-X-02 B5-00 · area 6: A6-B02 · area 7: A7-34 · area 8: A8·P-B-19 A8·L-3
- **SW-SHADOW** (B, 9): area 1: A1-037 A1-053 A1-119 · area 2: A2-X1 A2-C10 A2-H7 · area 5: A5-X-01 A5-G2-07 · area 8: A8·L-4
- **SW-CONFIRM** (B, 8): area 2: A2-E11 · area 3: A3·I-10 · area 8: A8·L-7 A8·B-19 A8·C-18 A8·G-18 A8·G-22 A8·G-24
- **SW-SELECT** (B, 7): area 8: A8·B-21 A8·C-19 A8·D-26 A8·D-27 A8·G-19 A8·H-20 A8·I-16
- **SW-TAP** (B, 6): area 1: A1-171 · area 2: A2-P14 · area 4: A4-07 · area 6: A6-B08 · area 7: A7-36 · area 8: A8·P-B-21
- **SW-LOADNULL** (B, 4): area 1: A1-020 A1-040 A1-054 A1-099
- **SW-SPIN** (B, 3): area 5: A5-G4-09 A5-G6-21 · area 8: A8·L-6
- **SW-GLOW** (B, 1): area 2: A2-X4

