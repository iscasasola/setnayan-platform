# Final check — AREA 1 · Front door & public pages (signed out), incl. the sign-in pages

> Checker 1 of 8. **Report only — nothing here was fixed.** Pinned check commit: `fb3f72d` (main, frozen).
> Kit: `build-sessions/FINAL-CHECK-KIT.md` §§ 3–6. Rules: `docs/brand.md`, corpus `HOUSE_DESIGN_STANDARD_2026-11-20.md` (Parts H, K, I).
> Phase A = code pass (`SOURCE: CODE`) + a read-only walk of LIVE https://setnayan.com signed out (`SOURCE: SEEN-LIVE`).
> Phase B = the staging walk (`SOURCE: SEEN`), when the controller sends the address. Anchors are strings, never line numbers.

## BLOCKERS

**A1-056** (full entry also in the findings list, sign-in group). Found in code; the staging walk confirms it first.

### A1-056 · "Secure my plan" never reaches the sign-up form for a host with no account
PAGE      /signup
BUTTON    "Secure my plan" (dashboard notice) · "Create a free account" (SaveToContinue)
STEPS     1. Start an event with no account (an anonymous session). 2. On the dashboard press "Secure my plan". 3. /signup?next=%2Fdashboard loads.
EXPECTED  The Create account card. Its `signUp` action has a branch that turns this same anonymous account into a real one (`existingUser?.is_anonymous` in signup/actions.ts).
ACTUAL    The page's signed-in bypass counts any session as signed in. `getCurrentUser()` returns anonymous users and the page never checks `is_anonymous` (/login does: `!user.is_anonymous`). So `if (user) { if (next !== '/') redirect(next) … }` sends the host straight back to /dashboard and the form never draws. Every door that links /signup for these hosts dead-ends the same way: secure-account-banner.tsx, anon-gate/save-to-continue.tsx and stay-registry accProfile. Anonymous onboarding is ON according to build-sessions/P0-b-SWITCHES.md (`NEXT_PUBLIC_ANON_ONBOARDING_ENABLED`). Checker re-read: `getCurrentUser()` (`apps/web/lib/auth.ts`) returns the anonymous user, and no version of `app/signup/page.tsx` ever checked `is_anonymous`. Not tried live (it needs a new anonymous host, which is a write). Phase B confirms first: on staging, start an event signed out, then press "Secure my plan".  (anchor: `apps/web/app/signup/page.tsx` · `Already-authenticated bypass`)
SHOTS     — (phase B)
RULE      North Star (a host starts with no account; the account is asked for at save) · design-and-wiring B5 (every press reaches a real destination)
SEVERITY  blocker
SOURCE    CODE

## Progress

Each line: page · OFFLINE mark · SHAPE today → should.

- [ ] /
- [ ] /about
- [ ] /acceptable-use
- [x] /alaala · OFFLINE: NOT NEEDED (signed-out marketing page) · SHAPE: today PAGE → should PAGE
- [ ] /api/v1
- [ ] /articles
- [ ] /articles/[slug]
- [ ] /articles/write
- [x] /budget · OFFLINE: NOT NEEDED (marketing page) · SHAPE: today PAGE → should PAGE (the signed-in "Add to an event" popup is wrong: see the popups finding)
- [ ] /cookies
- [x] /creators · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /download · OFFLINE: NOT NEEDED (marketing) · SHAPE: today PAGE → should PAGE
- [x] /explore/compare · OFFLINE: READ-ONLY IS ENOUGH (a couple at an expo may reopen a comparison by its link; Save and Ask need signal anyway) · SHAPE: today PAGE → should PAGE (people share it by its `?ids=` link)
- [ ] /features
- [ ] /features/[slug]
- [ ] /for-suppliers
- [x] /forgot-password · OFFLINE: NOT NEEDED · SHAPE: today a PAGE (`DoorShell`) → should SMALL POPUP (one field, a step of sign-in) (differs)
- [x] /guest-list · OFFLINE: NOT NEEDED (marketing page) · SHAPE: today PAGE → should PAGE (the signed-in "Add to an event" popup is wrong: see the popups finding)
- [ ] /help
- [ ] /help/[slug]
- [ ] /help/guides/[key]
- [ ] /help/topics
- [ ] /help/topics/[key]
- [x] /i/[slug] · OFFLINE: NOT NEEDED (joining needs the network) · SHAPE: today PAGE → should PAGE (shared by link and QR)
- [x] /login · OFFLINE: NOT NEEDED (signing in needs the network) · SHAPE: today a PAGE that draws its own centred popup (`.home-reskin-ov`, role=dialog) on every screen size → should SMALL POPUP (`Sheet`) (differs)
- [x] /marketplace · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /monogram · OFFLINE: NOT NEEDED (free design-and-download tool, used at home) · SHAPE: today PAGE → should PAGE
- [x] /mood-board · OFFLINE: NOT NEEDED (marketing page) · SHAPE: today PAGE → should PAGE (the signed-in "Add to an event" popup is wrong: see the popups finding)
- [ ] /our-story
- [x] /palogo · OFFLINE: NOT NEEDED (marketing page) · SHAPE: today PAGE → should PAGE (the signed-in "Add to an event" popup is wrong: see the popups finding)
- [x] /panood · OFFLINE: NOT NEEDED (marketing page) · SHAPE: today PAGE → should PAGE (its Live Watch demo popup is wrong: see the popups finding)
- [x] /panood/demo/[token] · OFFLINE: NOT NEEDED (a live peer-to-peer camera demo; nothing works without signal) · SHAPE: today PAGE → should PAGE (opened by scanning a QR on a phone)
- [x] /papic · OFFLINE: NOT NEEDED (marketing page; its live demo needs a connection) · SHAPE: today PAGE → should PAGE (/papic/try is its shareable address)
- [x] /pawebsite · OFFLINE: NOT NEEDED (marketing page) · SHAPE: today PAGE → should PAGE (the signed-in "Add to an event" popup is wrong: see the popups finding)
- [ ] /pricing
- [ ] /pricing/plan
- [ ] /privacy
- [ ] /privacy/google-access
- [ ] /refunds
- [x] /reset-password · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE (opened from an email link)
- [x] /samahan · OFFLINE: NOT NEEDED (marketing) · SHAPE: today PAGE → should PAGE
- [x] /samahan/chat/[threadId] · OFFLINE: NEEDED (at the venue on the day: the "Day-of crew" group is how the coordinator and suppliers talk there) · SHAPE: today PAGE → should PAGE (tray notices link here)
- [x] /samahan/chat/new · OFFLINE: NOT NEEDED (made while planning) · SHAPE: today PAGE → should FULL-SCREEN POPUP (differs)
- [x] /sample · OFFLINE: NOT NEEDED (a demo landing; it only opens when the sample switch is on) · SHAPE: today PAGE → should PAGE · LIVE: 404 (switch off)
- [x] /sample/[...rest] · OFFLINE: NOT NEEDED · SHAPE: today PAGE (always the 404) → should PAGE (the 404)
- [x] /sample/hub/[guestKey] · OFFLINE: NOT NEEDED (a demo of the guest Hub; the real Hub is the one used at the venue) · SHAPE: today PAGE → should PAGE · LIVE: 404 (switch off)
- [x] /schedule · OFFLINE: NOT NEEDED (marketing page) · SHAPE: today PAGE → should PAGE (the signed-in "Add to an event" popup is wrong: see the popups finding)
- [x] /seat-plan · OFFLINE: NOT NEEDED (marketing page) · SHAPE: today PAGE → should PAGE (the signed-in "Add to an event" popup is wrong: see the popups finding)
- [x] /setnayan-ai · OFFLINE: NOT NEEDED (marketing page) · SHAPE: today PAGE → should PAGE (the signed-in "Add to an event" popup is wrong: see the popups finding)
- [x] /signup · OFFLINE: NOT NEEDED · SHAPE: today a PAGE with the same centred card → should SMALL POPUP (`Sheet`, about 3 fields; keep the address for shared referral links) (differs)
- [x] /signup/you · OFFLINE: NOT NEEDED · SHAPE: today a PAGE (card on paper) → should FULL-SCREEN POPUP (`RiseScreen`: a photo upload, 8 or more fields, part of the first run) (differs)
- [ ] /start
- [x] /suppliers · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /suppliers/[event]/[category] · OFFLINE: NOT NEEDED (an indexed directory; at an expo the couple uses Suppliers › Find inside their event) · SHAPE: today PAGE → should PAGE
- [x] /suppliers/[event]/[category]/[city] · OFFLINE: NOT NEEDED (same reason) · SHAPE: today PAGE → should PAGE
- [ ] /terms
- [ ] /tl/about
- [ ] /tl/features
- [ ] /tl/features/[slug]
- [x] /tour · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /tour/budget · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /tour/gallery · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /tour/seating · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /tour/vendors · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /u/[userSlug] · OFFLINE: NOT NEEDED (a public page read online; nothing to do there at a venue) · SHAPE: today PAGE → should PAGE (shared by link)
- [x] /u/[userSlug]/c/[chapterId] · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE (shared by link; forwards to /articles/<slug> when one exists)
- [ ] /v/[slug]
- [ ] /v/[slug]/booth
- [ ] /v/[slug]/cached
- [ ] /v/[slug]/dates
- [ ] /v/[slug]/guest-review
- [ ] /v/[slug]/story/[eventSlug]
- [x] /waitlist · OFFLINE: NOT NEEDED (marketing) · SHAPE: today PAGE → should PAGE
- [x] /web-only · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
Forwards (kit: each must land):

- [ ] /pakanta → /features
- [ ] /patiktok → /features

## Findings

_Phase A in progress._

### Code pass · samples, tour, Samahan (11 pages)

#### A1-001 · The tour says the AI shortlist is free, but Setnayan AI is a paid feature
PAGE      /tour/vendors
BUTTON    "Start planning · free"
STEPS     1. Open /tour/vendors. 2. Read the hero and the closing panel.
EXPECTED  No "free" promise on Setnayan AI, which the corpus lists as "Setnayan AI: planner and supplier matching. Paid." If AI matching is shown, its price comes from the catalog.
ACTUAL    The closing panel says "let the AI shortlist for you — free, in minutes" above "Start planning · free". The hero says "Setnayan AI shortlisted a team…" and the AI switch is on by default. Nothing says it is paid. The only free AI carve-out is the FIRST reception-venue shortlist, once (`apps/web/lib/setnayan-ai-free-assist.ts` · `FIRST_VENUE_SHORTLIST_CAP`); a whole-team shortlist is behind the paid gate. (anchor: `apps/web/app/tour/vendors/page.tsx` · `let the AI shortlist for you — free, in minutes`)
SHOTS     — (phase B)
RULE      brand.md claims #3 (price promises) · corpus MARKETING_RESEARCH_BRIEF_2026-11-24.md ("Setnayan AI … Paid.")
SEVERITY  money-signin
SOURCE    CODE

#### A1-002 · The tour's "Committed" total comes from a second money reader and counts every supplier row
PAGE      /tour/budget
BUTTON    —
STEPS     1. Open /tour/budget. 2. Read the "Committed" tile ("across every booked supplier") and "Left to pay … due in 30 days".
EXPECTED  Committed comes from the one reader, `resolveEventMoney`, which counts only confirmed bookings (`CONFIRMED.has(v.status)`). Suppliers the couple is still considering or has shortlisted count as estimates.
ACTUAL    `fetchBudgetSnapshot` adds up `itemizedTotal` for every `event_vendors` row, whatever its status. "Due in 30 days" adds up every line item due in the next 30 days, whether paid or not. (anchor: `apps/web/lib/budget.ts` · `budget: summaries.reduce((acc, s) => acc + s.itemizedTotal, 0)`; `apps/web/app/tour/budget/page.tsx` · `across every booked supplier`). (Needs the browser to confirm the sample holds a non-booked supplier with a price. Rule C8 makes the second reader a defect either way.)
SHOTS     — (phase B)
RULE      CLAUDE.md §4 (Budget: one reader `resolveEventMoney`) · design-and-wiring C8
SEVERITY  wrong  (sample data — no person's money; the second reader is the defect)
SOURCE    CODE

#### A1-003 · Signed in, /samahan's main button becomes "Add to an event", which sends people to an event dashboard
PAGE      /samahan
BUTTON    "Add to an event" (signed out it reads "Create a group")
STEPS     1. Sign in as a host with an upcoming event. 2. Open /samahan. 3. Press the hero button.
EXPECTED  A group belongs to the account, not to an event (the page's own docblock says so). The hero stays "Create a group" → /dashboard/samahan/new.
ACTUAL    `studioKey="samahan"` turns the hero into the add-to-event picker. It reads "Add Groups to…", lists the host's events, and each row links to `/dashboard/<eventId>`, a page with no group on it. The create door is moved down to a "Start a new event" row. The picker is also a hand-built `fixed inset-0` overlay with `role="dialog"` `aria-modal` instead of `Sheet` (K3). (anchor: `apps/web/app/(shell)/samahan/page.tsx` · `studioKey="samahan"`; `apps/web/app/_components/marketing/add-to-event-data.ts` · `` `/dashboard/${e.eventId}` ``; `add-to-event.tsx` · `Add {serviceName} to…`) (needs the browser to confirm)
SHOTS     — (phase B)
RULE      design-and-wiring B5 (every press reaches the real destination) · HOUSE_DESIGN_STANDARD Part K3
SEVERITY  broken
SOURCE    CODE

#### A1-004 · /sample offers three people to look around as, but none of them can be opened
PAGE      /sample, /sample/hub/[guestKey]
BUTTON    — (the three persona rows)
STEPS     1. With the sample switch on (or as an internal account), open /sample. 2. Try to open "The bride's cousin", "The bride's sister" or "Maria and Jose".
EXPECTED  Each persona row opens its view. /sample/hub/sample-guest-bride-cousin and /sample/hub/sample-guest-maid-of-honor are already built.
ACTUAL    Each row is static text tagged "Opening soon", under "Look around as one of three people". Nothing is pressable, and the built hub has no door from the landing. The only way out is "Start your own event". "Opening soon" also advertises a feature that is not live. (anchor: `apps/web/app/sample/page.tsx` · `Opening soon`)
SHOTS     — (phase B)
RULE      design-and-wiring A3 (registered and reachable) · brand.md claims #9 (coming features)
SEVERITY  broken
SOURCE    CODE

#### A1-005 · Group chat Add, Leave and Join chat fail silently
PAGE      /samahan/chat/[threadId], /samahan/chat/new
BUTTON    "Join chat" · ＋ Add · Leave · "Make the group"
STEPS     1. In an event group, add a person, leave, or re-join, and have the database refuse it.
EXPECTED  A refusal shows a plain reason plus Try again.
ACTUAL    `addToGroup`, `leaveGroup` and `rejoinGroup` only log the error, then refresh the page. The press looks like it worked and nothing changes; "Join chat" just reloads "Join this chat again?". When `createGroup` is refused for any reason, it always says "Give it a name and try again." (anchor: `apps/web/app/samahan/chat/actions.ts` · `logQueryError('addToGroup (chat_group_add)'` · `rejoinGroup` · `The group was not made. Give it a name and try again.`)
SHOTS     — (phase B)
RULE      design-and-wiring B6 (a failure must render as a failure)
SEVERITY  broken
SOURCE    CODE

#### A1-006 · Find your seat shows the wrong guest's name for a shared table
PAGE      /tour/seating
BUTTON    a name in "Matching guests"
STEPS     1. Type a name. 2. Pick a guest who shares a table with someone whose name sorts earlier.
EXPECTED  "<picked name>, you're at <table>."
ACTUAL    `selected` is the first seat at the picked table, not the seat that was picked. The line greets the other guest. (anchor: `apps/web/app/tour/seating/_components/find-your-seat.tsx` · `seats.find((s) => s.tableId === targetTableId)`)
SHOTS     — (phase B)
RULE      design-and-wiring B6
SEVERITY  wrong
SOURCE    CODE

#### A1-007 · On the tour, failed reads look like an empty or zero sample
PAGE      /tour/vendors, /tour/gallery, /tour/seating
BUTTON    —
STEPS     1. Have the read fail (refused query or RPC). 2. Open each page.
EXPECTED  The read failure is said in words ("couldn't load, reload"), as /tour/seating and /tour/gallery already do for guests and inspirations.
ACTUAL    /tour/vendors passes no `onReadRefused`, so each category shows "0 found", "No sample suppliers in this category yet." and "Setnayan AI ranked 0 suppliers by fit". A failed counterparty read falls back to the typed name `'Liwanag Studios'`. /tour/gallery: `getWallSnapshot` ignores the `wall_visible_photos` error and the wall says "Memory lane is warming up". /tour/seating: when the guest read is refused, the header still prints "N tables for 0 guests". (anchors: `apps/web/app/tour/vendors/page.tsx` · `fetchWizardVendorRecommendations(admin, {` · `'Liwanag Studios'`; `apps/web/lib/live-wall.ts` · `const [{ data: feedData }`; `apps/web/app/tour/seating/page.tsx` · `formatCount(seatedCount)`)
SHOTS     — (phase B)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE

#### A1-008 · Group chat turns failed reads into empty lists
PAGE      /samahan/chat/[threadId], /samahan/chat/new
BUTTON    the group name ▾ · "Make the group"
STEPS     1. Have `chat_group_list` or `chat_group_people` fail. 2. Open the ▾ sheet, or open New group.
EXPECTED  A failed read says so. `readEventGroups` and `readGroupPeople` return `null` precisely so the page can say so.
ACTUAL    The thread page flattens a failed groups read with `(groups ?? [])`, so ▾ opens an empty "Your groups" sheet. New group flattens a failed people read with `?? []`, so "Who is in it" is empty and looks the same as an event with nobody else (there are no empty-state words). A failed `chat_group_my_kind` read renders a 404. When everyone is already in a group, the shared ＋ list says "Every host of this event is already in this chat.", which is wrong for groups that hold guests and suppliers. (anchors: `apps/web/app/samahan/chat/[threadId]/page.tsx` · `(groups ?? []).map`; `apps/web/app/samahan/chat/new/page.tsx` · `((await readGroupPeople(supabase, eventId)) ?? [])`; `apps/web/app/_components/chat/chat-host-strip.tsx` · `Every host of this event is already in this chat.`)
SHOTS     — (phase B)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE

#### A1-009 · Speed and count claims in the tour copy
PAGE      /tour, /tour/vendors, /tour/seating, /tour/gallery
BUTTON    —
STEPS     1. Read the closing panels and the gallery copy.
EXPECTED  No speed claims and no hand-typed counts.
ACTUAL    "free, in minutes" appears on all four pages. /tour/gallery says "On a real wedding day these appear the instant they're taken" and "photos appear here the moment they're taken". /tour/vendors says "didn't scroll through hundreds of suppliers". (anchors: `apps/web/app/tour/page.tsx` · `free, in minutes`; `apps/web/app/tour/gallery/page.tsx` · `appear the instant they`; `apps/web/app/tour/gallery/_components/tour-live-wall.tsx` · `the moment they`; `apps/web/app/tour/vendors/page.tsx` · `hundreds of suppliers`)
SHOTS     — (phase B)
RULE      brand.md claims #5, #6 · "Never hand-type a price, a count or a promise"
SEVERITY  wrong
SOURCE    CODE

#### A1-010 · The sample is called "a real wedding" in titles and share text
PAGE      /tour, /tour/vendors, /tour/seating, /tour/budget, /tour/gallery
BUTTON    —
STEPS     1. Read the tab titles and share text.
EXPECTED  It is clearly marked as a sample, as the ribbon says ("a sample wedding").
ACTUAL    The titles read "Walk through a real wedding" and "The suppliers · A real wedding on Setnayan" (seating is the same). The share text reads "explore a real wedding budget" and "explore a real wedding's Memory lane". (anchors: `apps/web/app/tour/page.tsx` · `Walk through a real wedding`; `apps/web/app/tour/budget/page.tsx` · `explore a real wedding budget`)
SHOTS     — (phase B)
RULE      Group F brief (sample must be marked as an example) · brand.md
SEVERITY  wrong
SOURCE    CODE

#### A1-011 · "Ranked by distance" is claimed, but the tour never uses distance
PAGE      /tour/vendors
BUTTON    the "% match" pill (tooltip)
STEPS     1. Read the hero, the description and the match tooltip.
EXPECTED  The copy names only what the ranking uses.
ACTUAL    The hero and description say "ranked by distance, reviews, and verification". The tooltip says "based on distance…". The code passes `distanceKm: null` (it notes "distance is unknown on the tour"). (anchors: `apps/web/app/tour/vendors/page.tsx` · `distanceKm: null` · `ranked by distance, reviews, and`; `tour-shortlist.tsx` · `based on distance, reviews, and verification`)
SHOTS     — (phase B)
RULE      brand.md (no claims that are not true)
SEVERITY  wrong
SOURCE    CODE

#### A1-012 · The tour chat hard-codes a wedding date that will have passed by launch
PAGE      /tour/vendors
BUTTON    "Hi! Are you available for our wedding on December 12, 2026?"
STEPS     1. Open /tour/vendors on or after 13 Dec 2026 (launch is 18 Dec). 2. Tap the suggested line.
EXPECTED  The date comes from the sample event (`ev.event_date`), and the sample stays future-dated.
ACTUAL    The script types "December 12, 2026" and the supplier answers "is still open on our calendar". The seed migration's comment dates the sample 2026-12-12, so at launch the chat asks about a past date and the whole tour shows a finished wedding. (anchor: `apps/web/app/tour/_components/tour-chat-thread.tsx` · `VISITOR_PROMPTS` · `December 12, 2026 is still open`) (needs the browser to confirm the sample's live event_date)
SHOTS     — (phase B)
RULE      design-and-wiring D15 (no hard-coded data in UI)
SEVERITY  wrong
SOURCE    CODE

#### A1-013 · The planner's "typical range" is made up from a fixed ±15% band
PAGE      /tour/budget
BUTTON    any service row → "Adjust this service"
STEPS     1. Tap a service in "Try the budget planner".
EXPECTED  A "typical range" comes from its home (`budget_leaf_benchmarks`), or is not shown.
ACTUAL    The sheet says "typical range ₱X–₱Y". The range is the sample's own spend multiplied by hand-typed 0.85 and 1.15. (anchor: `apps/web/app/tour/budget/page.tsx` · `p25Php: Math.round(amount * 0.85)`)
SHOTS     — (phase B)
RULE      CLAUDE.md §5 rule 3 (never guess a number that governs money)
SEVERITY  wrong
SOURCE    CODE

#### A1-014 · "Bring Memory lane to life" adds copies of photos already on the wall
PAGE      /tour/gallery
BUTTON    "Bring Memory lane to life"
STEPS     1. Press it on a wall that already has tiles.
EXPECTED  New moments arrive, or the demo is clearly a replay.
ACTUAL    The "new" tiles are clones of the first four tiles already shown, with new ids. The same photos appear twice and "N moments and counting" rises by 4. (anchor: `apps/web/app/tour/gallery/page.tsx` · `initialTiles.slice(0, 4).map`)
SHOTS     — (phase B)
RULE      Group F brief (sample numbers honest)
SEVERITY  wrong
SOURCE    CODE

#### A1-015 · The sample guest Hub tells a guest "Opens on your wedding day"
PAGE      /sample/hub/[guestKey]
BUTTON    —
STEPS     1. Open the bride's cousin's hub. 2. Scroll to "The Day".
EXPECTED  Words for a guest, such as "Opens on the wedding day", built from `SAMPLE_WORDS`.
ACTUAL    Every day-only row says "Opens on your wedding day" to a guest. (anchor: `apps/web/app/sample/hub/[guestKey]/page.tsx` · `Opens on your wedding day`)
SHOTS     — (phase B)
RULE      brand.md (words) · wrong word
SEVERITY  wrong
SOURCE    CODE

#### A1-016 · The sample ticket's "Copy link" copies a bare path, and its fallback points at a real-guest route
PAGE      /sample/hub/[guestKey]
BUTTON    "Copy link"
STEPS     1. Press "Copy link" under the ticket. 2. Paste it anywhere.
EXPECTED  A full https://setnayan.com/sample/hub/… address. If the picture fails, the fallback makes sense for a sample.
ACTUAL    It copies `/sample/hub/<key>`, which is not a link once pasted. If the pass PNG fails, the shared fallback draws `/api/guest/qr`, a route that needs a real guest's cookie, and says "this code still works at the door". (anchors: `apps/web/app/sample/hub/[guestKey]/page.tsx` · `` invitationUrl={`/sample/hub/${guest.guestKey}`} ``; `apps/web/app/[slug]/_components/guest-ticket.tsx` · `src="/api/guest/qr"`)
SHOTS     — (phase B)
RULE      design-and-wiring B5
SEVERITY  wrong
SOURCE    CODE

#### A1-017 · The budget planner's adjust sheet is a hand-built dialog
PAGE      /tour/budget
BUTTON    a service row → "Done" / "Reset to suggested"
STEPS     1. Tap a service in the planner.
EXPECTED  The shared `Sheet`: half height on a phone, centred dialog on desktop.
ACTUAL    A page-built `fixed inset-0` overlay with `role="dialog"` `aria-modal="true"` and its own panel. (anchor: `apps/web/app/tour/budget/_components/tour-budget-planner.tsx` · `aria-labelledby="tour-tilt-editor-headline"`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part K3
SEVERITY  look
SOURCE    CODE

#### A1-018 · Two accent buttons in the tour chat card
PAGE      /tour/vendors
BUTTON    "Send" · the suggested-line chip
STEPS     1. Look at the chat card.
EXPECTED  One accent-filled main button; everything else neutral.
ACTUAL    "Send" is filled `bg-mulberry` (the CTA colour) and the suggestion chip is mulberry-tinted with a mulberry outline, both in one card. (anchor: `apps/web/app/tour/_components/tour-chat-thread.tsx` · `border-mulberry/30 bg-mulberry/[0.06]`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### A1-019 · The tour pages use bordered cards and hand-made dark main buttons
PAGE      /tour, /tour/budget, /tour/gallery, /tour/seating, /tour/vendors
BUTTON    "Start the tour →" · "Start planning · free" · "Next: Memories"
STEPS     1. Open any tour page.
EXPECTED  Part H: one terracotta main button (`ActionButton`) per hero and per close, shelves with no border and no shadow, and examples listed as rows with hairlines.
ACTUAL    The stops are listed as bordered cards. Every page closes on a bordered, tinted panel. The main buttons are hand-built `bg-[#1B1A17]` dark pills, not the house main button. (anchors: `apps/web/app/tour/page.tsx` · `rounded-2xl border p-5`; every tour page · `rounded-3xl border border-[#A9834B]/40 bg-[#FBF6EA]`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part H · Part K1
SEVERITY  look
SOURCE    CODE

#### A1-020 · /samahan's loading screen is blank
PAGE      /samahan
BUTTON    —
STEPS     1. Navigate to /samahan from the rail.
EXPECTED  The loading screen mirrors the page, so loading and empty don't look alike.
ACTUAL    `loading.tsx` returns `null` on purpose (its docblock gives the reason), so the content area is blank until the page arrives. The page is dynamic because the hero button reads the session. (anchor: `apps/web/app/(shell)/samahan/loading.tsx` · `return null`)
SHOTS     — (phase B)
RULE      CLAUDE.md §5 rule 4 · Code-pass brief §2 (loading must not blank the page)
SEVERITY  look
SOURCE    CODE

#### A1-021 · New group should be a full-screen popup over Chats
PAGE      /samahan/chat/new
BUTTON    "+ New group" (from the event's Chats)
STEPS     1. As a host, open Chats and press "+ New group".
EXPECTED  A `RiseScreen` over Chats; ✕ returns to the same place. It is not shared by link, and its list of everyone on the event runs past one screen.
ACTUAL    A separate page with a BackButton to `/dashboard/<id>/messages`. (anchor: `apps/web/app/samahan/chat/new/page.tsx` · `data-new-group`)
SHOTS     — (phase B)
RULE      SHAPE (owner, 25 Nov)
SEVERITY  look
SOURCE    CODE

> NOTES: Code only, so four things are unconfirmed: whether the sample switch (`platform_settings.sample_event_enabled`) is on in prod, so /sample may be a 404 for everyone; the live `event_date` of maria-and-jose; its `event_vendors` statuses; and whether its wall has tiles. Shared parts (DoorwayPage, SpotlightSection, ChatMessageStream, ChatSendForm, the Hub widgets) were checked only for the parts these pages use. Stop 1 (/maria-and-jose, the guest Event Hub) is outside this group and was not audited, including whether it has a door back to the tour.

### Code pass · product pages (13 pages)

#### A1-022 · Setnayan AI page tells hosts "0% supplier commission … never what pays us"
PAGE      /setnayan-ai
BUTTON    —  (closing panel text, above "Start planning · free")
STEPS     1. Open /setnayan-ai signed out. 2. Scroll to the closing panel "Let it watch your back".
EXPECTED  The only allowed 0% line is exactly "Hosts pay 0% commission." No claim that Setnayan earns nothing from what the AI recommends.
ACTUAL    The closing body says "Add it when you want it; 0% supplier commission, so it recommends what fits you, never what pays us." Suppliers do pay a booking fee on clients Setnayan brings, and an AI match is one of those clients. So the line is not allowed by brand.md, and it is false about money.  (anchor: `apps/web/app/(shell)/setnayan-ai/page.tsx` · `0% supplier commission, so it recommends what fits you, never what pays us`)
SHOTS     — (phase B)
RULE      brand.md claims #2 (booking fee / "Hosts pay 0% commission." only) · lib/commission-promise.ts (one place that says 0%)
SEVERITY  money-signin
SOURCE    CODE

#### A1-023 · Papic price dial: a failed price read shows "You pay nothing" or vanishes
PAGE      /papic
BUTTON    "More credits" / "Fewer credits"
STEPS     1. Open /papic when the catalog read or the Papic tier read fails (both return [] on error). 2. Scroll to "What it costs".
EXPECTED  A failed price read shows "Couldn't read" plus a way to try again. It never shows only the free option, and never disappears.
ACTUAL    `resolvePapicAnchor` turns failed rows into no paid options. If the free-credit read worked, the dial shows only the free option: "Start free. Move the dial only if you run out.", "You pay nothing", and + is disabled, so Papic looks free with no prices. If that read failed too, the whole "What it costs" section drops out without a word.  (anchor: `apps/web/app/(shell)/papic/page.tsx` · `if (priced.length === 0 && freeCredits <= 0) return null;` · `apps/web/lib/v2-catalog.ts` · `if (error || !data) return [];` · `apps/web/lib/papic-tier-config-read.ts` · `readPapicPassTiers` `return [];`)
SHOTS     — (phase B)
RULE      CLAUDE.md §5 rule 4 (honest states) · §1 "A failed read shows 'Couldn't read', never ₱0, 'Free' or empty"
SEVERITY  money-signin
SOURCE    CODE

#### A1-024 · Papic page suggests full-size photos are kept forever
PAGE      /papic
BUTTON    —
STEPS     1. Open /papic. 2. Read the FAQ "What happens to the photos after the event?", the spotlight "For good", the Event Hub mock, and the closing line. 3. Open /papic/try and read its last line.
EXPECTED  Originals are kept 3, 6 or 12 months by plan, then a 720p copy is kept for life (brand.md; lib/llms-txt.ts "kept for a period set by the plan"). No "nothing expires" wording about the photos.
ACTUAL    The FAQ says flatly "three months after the event’s last day the original file is replaced by a 720p copy", which is wrong for Event Pro and Ultra and is a typed number. The spotlight title "Nothing here expires", the mock "These are yours to keep. Nothing here expires.", the closing "There is nothing separate to buy, and nothing that expires." and /papic/try "never expires" all suggest the originals last forever. "Nothing separate to buy" also clashes with the credit dial a few sections above.  (anchor: `apps/web/app/(shell)/papic/page.tsx` · `three months after the event’s last day the original file is replaced by a 720p copy` · `There is nothing separate to buy, and nothing that expires.` · `apps/web/app/(shell)/papic/_papic-sections.tsx` · `t: 'Nothing here expires'` · `These are yours to keep. Nothing here expires.` · `apps/web/app/(shell)/papic/try/page.tsx` · `never expires`)
SHOTS     — (phase B)
RULE      brand.md claims #3 (never imply full-size originals last forever)
SEVERITY  wrong
SOURCE    CODE

#### A1-025 · Logo Maker page sells the retired "Animated Monogram" and an off-sale "Logo & QR part"
PAGE      /palogo
BUTTON    —
STEPS     1. Open /palogo. 2. Read the browser tab and share-card title. 3. Read the FAQ "Can I try one first?", the "Try it free" spotlight and the closing panel.
EXPECTED  No retired product named (corpus MARKETING_RESEARCH_BRIEF §3 RETIRED: "Animated Monogram"). The animation is described as what it is today, part of Event Pro, without an off-sale part.
ACTUAL    The title, OG and Twitter text read "Logo Maker — Your Animated Wedding Monogram"; the JSON-LD name is "Logo Maker — Animated Wedding Monogram"; the OG alt is "your animated wedding monogram". Three places send buyers to "Event Pro’s Logo & QR part", but migrations `the_animated_monogram_reads_as_logo_and_qr` and `event_hub_pro_parts_are_retired_from_sale` set both of those SKUs to is_active = FALSE. The page's own docblock says it "never sells it by name".  (anchor: `apps/web/app/(shell)/palogo/page.tsx` · `Logo Maker — Your Animated Wedding Monogram` · `Event Pro’s Logo & QR part` · `animate your mark with Event Pro’s Logo & QR`)
SHOTS     — (phase B)
RULE      Brief: no retired product advertised · brand.md claims #9 · DECISION_LOG "EVENT HUB PRO IS SOLD WHOLE AGAIN"
SEVERITY  wrong
SOURCE    CODE

#### A1-026 · Budget page's search and share text still sells the removed "suggested split"
PAGE      /budget
BUTTON    —
STEPS     1. Look at /budget's meta description, OG/Twitter description or JSON-LD description (for example, share the link in Messenger).
EXPECTED  It describes the shipped Budget: Target · Agreed · Paid · Owed, the Next line, and one list. The page's own docblock and its guard say the split planner was removed.
ACTUAL    The description comes from `studioDescription('budget')` and reads "take a suggested split from typical Filipino wedding costs". `product-pages-say-what-ships.test.ts` bans "suggested split" but only scans `app/(shell)`, so the string in `lib/studio-apps.ts` gets past it.  (anchor: `apps/web/lib/studio-apps.ts` · `take a suggested split from typical Filipino wedding costs`)
SHOTS     — (phase B)
RULE      brand.md claims #9 (say only what ships) · Brief §3 metadata words
SEVERITY  wrong
SOURCE    CODE

#### A1-027 · "Monogram" in words a person reads; the product is Logo Maker
PAGE      /monogram, /palogo, /alaala, /mood-board
BUTTON    —
STEPS     1. Open each page and read the title, h1, FAQ, spotlights and studio text.
EXPECTED  "Logo Maker", or "logo"/"mark"; never "Monogram" (brand.md word rules).
ACTUAL    /monogram: title "Free Monogram Maker", h1 "Make your wedding monogram", JSON-LD "Setnayan Free Monogram Maker", aria "Monogram studio", studio card "pick it up in the Monogram Maker" (a retired name for the Logo Maker), and studio markup "Monogram studio · vector". /palogo: "drawn into a monogram that comes alive", "A monogram of your own", "A monogram that comes alive". /alaala: description and FAQ "your monogram (Logo Maker)", pillar "Your monogram, drawn to life". /mood-board: description, FAQ and steps "your monogram".  (anchor: `apps/web/app/(shell)/monogram/page.tsx` · `Free Monogram Maker · Setnayan` · `apps/web/app/monogram/public-monogram-studio.tsx` · `pick it up in the Monogram Maker` · `apps/web/lib/monogram-studio/markup.ts` · `Monogram studio · vector` · `apps/web/lib/studio-apps.ts` · `drawn into a monogram that comes alive` · `apps/web/app/(shell)/alaala/page.tsx` · `Your monogram, drawn to life`)
SHOTS     — (phase B) · SEEN-LIVE on /monogram, /palogo, /alaala, /mood-board (375 px)
RULE      brand.md word rules (Logo Maker, never Monogram)
SEVERITY  wrong
SOURCE    CODE

#### A1-028 · Setnayan AI page: a COMING feature, a "no other AI does this" claim, and the privacy law as a slogan
PAGE      /setnayan-ai
BUTTON    —
STEPS     1. Open /setnayan-ai. 2. Read the FAQ "Does it learn my taste…" and "Is my information private?". 3. Read the meta/share description.
EXPECTED  No feature that is not live yet. No claim about every other product. No Data Privacy Act line used as marketing.
ACTUAL    The FAQ says "Those personalized and “couples like you” insights are coming, once our privacy sign-off is complete." The description, used for meta, OG and the rail, opens "Every other wedding AI waits for you to ask", a sweeping claim about all competitors. The FAQ also says "Setnayan runs on a privacy-first model under the Philippine Data Privacy Act (RA 10173)."  (anchor: `apps/web/app/(shell)/setnayan-ai/page.tsx` · `insights are coming, once our privacy sign-off is complete` · `privacy-first model under the Philippine Data Privacy Act` · `apps/web/lib/studio-apps.ts` · `Every other wedding AI waits for you to ask`)
SHOTS     — (phase B)
RULE      brand.md claims #9 (COMING), #11/#12 (rank / competitor claims), #13 (Data Privacy Act as a slogan)
SEVERITY  wrong
SOURCE    CODE

#### A1-029 · Speed claims ("in seconds", "one minute")
PAGE      /pawebsite, /papic
BUTTON    —
STEPS     1. Read /pawebsite's JSON-LD feature list. 2. On /papic, read the dial's "Not enough? Add more any time." line. 3. Open /papic/try and read its title, description and lede.
EXPECTED  No speed claims until measured (brand.md #6; HOUSE_DESIGN_STANDARD H5).
ACTUAL    "RSVP your guests answer in seconds"; "the new credits land in seconds"; "Two codes, two phones, one minute." (meta and share card) and "about a minute" (body).  (anchor: `apps/web/app/(shell)/pawebsite/page.tsx` · `RSVP your guests answer in seconds` · `apps/web/app/(shell)/papic/_papic-dial.tsx` · `the new credits land in seconds` · `apps/web/app/(shell)/papic/try/page.tsx` · `Two codes, two phones, one minute.`)
SHOTS     — (phase B)
RULE      brand.md claims #6 (speed claims)
SEVERITY  wrong
SOURCE    CODE

#### A1-030 · Mood Board promises "nothing that expires" (a free-forever promise)
PAGE      /mood-board
BUTTON    —
STEPS     1. Open /mood-board. 2. Read the FAQ "Is it really free?" and the "Free" spotlight.
EXPECTED  No price promises ("always free", "free for life" or the same idea in other words).
ACTUAL    "There is nothing to buy and nothing that expires." and the spotlight title "Nothing to buy, nothing that expires".  (anchor: `apps/web/app/(shell)/mood-board/page.tsx` · `nothing that expires`)
SHOTS     — (phase B)
RULE      brand.md claims #3 (price promises)
SEVERITY  wrong
SOURCE    CODE

#### A1-031 · Every "Start planning · free" opens wedding onboarding, skipping the event-type picker
PAGE      /alaala, /budget, /guest-list, /monogram, /mood-board, /palogo, /panood, /pawebsite, /schedule, /seat-plan, /setnayan-ai
BUTTON    "Start planning · free"
STEPS     1. Open /alaala (copy: "Works for every kind of event, not just weddings"), or a free tool ("Free with every Setnayan account"). 2. Press "Start planning · free".
EXPECTED  Land on /start ("What kind of event are you planning?"), which the front door and /pricing use, so a debut or christening host is not put into a wedding flow.
ACTUAL    Every hero and closing button is a typed `/onboarding/wedding?from=<page>`. The route exists, but a non-wedding host starts a wedding. Also a typed string, not a `lib/routes.ts` builder.  (anchor: `apps/web/app/(shell)/alaala/page.tsx` · `href="/onboarding/wedding?from=alaala"` · `apps/web/app/(shell)/budget/page.tsx` · `'/onboarding/wedding?from=budget'` · front door `apps/web/app/_components/frontdoor/front-door-landing.tsx` · `href="/start"`)
SHOTS     — (phase B)
RULE      design-and-wiring.md A4 / B6 (every press reaches the right destination)
SEVERITY  wrong
SOURCE    CODE

#### A1-032 · Live Watch demo dead-end sends people to a homepage tile that no longer exists
PAGE      /panood/demo/[token]
BUTTON    —  (none: the "full" and "expired" states have no button at all)
STEPS     1. Scan an old or used Live Watch demo QR, or a third phone scans a session that already has two cameras. 2. Read the message.
EXPECTED  Point to where the demo lives now (/panood → "Try the control room with two phones"), with a button to get there.
ACTUAL    "open a new one from the Live Watch tile on the Setnayan homepage" and "Open a fresh demo from the Live Watch tile on the homepage". The only opener today is `TryTheDemoButton` on the doorway pages; `/` mounts no demo. The in-flow "full" and "expired" states have no link at all. A failed token read (`resolveDemoToken` catch → null) also shows as "This demo link expired."  (SEEN-LIVE: a made-up token at https://setnayan.com/panood/demo/… shows exactly this, HTTP 200.) (anchor: `apps/web/app/panood/demo/[token]/page.tsx` · `open a new one from the Live Watch tile on the Setnayan homepage` · `apps/web/app/panood/demo/[token]/_components/cam-join-flow.tsx` · `Open a fresh demo from\n          the Live Watch tile on the homepage` · `apps/web/lib/demo-sessions.ts` · `resolveDemoToken`)
SHOTS     — (phase B)
RULE      design-and-wiring.md A4 (every way in moves with it) · CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE

#### A1-033 · Signed in: "Add to an event" says "You don't have an event yet" when the events read fails
PAGE      /budget, /guest-list, /mood-board, /palogo, /panood, /pawebsite, /schedule, /seat-plan, /setnayan-ai
BUTTON    "Add to an event"
STEPS     1. Sign in as a host with events. 2. Open one of these pages while the events read errors (not a short blip). 3. Press "Add to an event".
EXPECTED  "Couldn't read your events" plus Try again (the helper `userEventsReadRefused` exists for this).
ACTUAL    `fetchUserEvents` falls back to [] on a non-blip error, so the dialog says "You don’t have an event yet. Start one and this can go straight into it." Any thrown error makes `resolveAddToEvent` return the signed-out view instead.  (anchor: `apps/web/app/_components/marketing/add-to-event-data.ts` · `fetchUserEvents(supabase, user.id, 'couple')` · `catch {\n      return signedOut;` · `apps/web/lib/events-for-studio-app.ts` · `You don’t have an event yet`)
SHOTS     — (phase B)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE

#### A1-034 · Papic money shown with a local "₱" formatter, not lib/php.ts
PAGE      /papic
BUTTON    "More credits"
STEPS     1. Open /papic and move the dial to a paid option.
EXPECTED  Pesos formatted only through `formatPhp` / `formatPhpRounded`.
ACTUAL    The dial uses its own `const peso = (n: number) => '₱' + n.toLocaleString('en-PH');`.  (anchor: `apps/web/app/(shell)/papic/_papic-dial.tsx` · `const peso = (n: number) => '₱' + n.toLocaleString('en-PH');`)
SHOTS     — (phase B)
RULE      CLAUDE.md §1 Money (format only through lib/php.ts)
SEVERITY  wrong
SOURCE    CODE

#### A1-035 · Popups on the product pages are hand-built, not Sheet / RiseScreen
PAGE      /budget, /guest-list, /mood-board, /palogo, /panood, /pawebsite, /schedule, /seat-plan, /setnayan-ai (signed in); /panood (demo)
BUTTON    "Add to an event" · "Try the control room with two phones"
STEPS     1. Signed in, press "Add to an event" on any of these pages. 2. On /panood, press "Try the control room with two phones".
EXPECTED  Shared parts with the one dim-and-blur backdrop. The event picker is a SMALL POPUP (Sheet, half height on a phone). The camera and video demo is a FULL-SCREEN POPUP (RiseScreen).
ACTUAL    The picker is `fixed inset-0 z-50` with its own `bg-[var(--m-ink)]/30` scrim, no blur, and a hand-made `role="dialog"` centred card. The Live Watch demo is `OverlayShell`, a separate hand-made `role="dialog" aria-modal="true"` portal: a centred 460–680 px card holding live video, not RiseScreen.  (anchor: `apps/web/app/_components/marketing/add-to-event.tsx` · `fixed inset-0 z-50 flex items-center justify-center p-4` · `apps/web/app/_components/home/HomeOverlays.tsx` · `export function OverlayShell` · `apps/web/app/_components/home/panood-demo-overlay.tsx` · `label="Live Watch live demo"`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part K3 · SHAPE (owner, 25 Nov)
SEVERITY  look
SOURCE    CODE

#### A1-036 · Demo failures give no Try again button
PAGE      /papic, /panood
BUTTON    —
STEPS     1. On /papic (or /papic/try), let the demo session fail to start. 2. On /panood, open the demo when it cannot start.
EXPECTED  A plain reason plus a Try again button.
ACTUAL    /papic: "The live codes could not be created just now…" with no button (the page must be reloaded). /panood demo: "Couldn’t start the demo right now. Close this and try again in a moment." with no Try again.  (anchor: `apps/web/app/(shell)/papic/_papic-scan.tsx` · `The live codes could not be created just now.` · `apps/web/app/_components/home/panood-demo-overlay.tsx` · `Couldn’t start the demo right now`)
SHOTS     — (phase B)
RULE      CLAUDE.md §3 (failure gives a plain reason plus Try again)
SEVERITY  look
SOURCE    CODE

#### A1-037 · Doorway kit lists steps and comparisons in bordered, shadowed cards
PAGE      /alaala, /budget, /guest-list, /mood-board, /palogo, /panood, /pawebsite, /schedule, /seat-plan, /setnayan-ai
BUTTON    —
STEPS     1. Open any doorway page. 2. Look at the "How it works" steps, the "without / with" list and the closing panel (/alaala: the five pillar cards).
EXPECTED  Part H: no bordered card used to list examples; lists are plan rows with hairlines; shelves have no border and no shadow; the close is h2 → one terracotta button → fine print.
ACTUAL    Steps and pillars use `DOORWAY_TONE.card` (border + shadow). The differentiator list is a bordered, shadowed box. The closing panel has a gold border.  (anchor: `apps/web/app/_components/marketing/_doorway-tone.ts` · `card: 'rounded-2xl border border-[var(--m-line)] bg-[var(--m-paper)] shadow-[var(--m-shadow-sm)]'` · `closingPanel:` · `apps/web/app/_components/marketing/_doorway.tsx` · `overflow-hidden rounded-2xl border border-[var(--m-line)] shadow-[var(--m-shadow-sm)]`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part H3 (never a bordered card to list examples; shelves no border, no shadow)
SEVERITY  look
SOURCE    CODE

#### A1-038 · Coloured side stripe on a row in the Papic Event Hub mock
PAGE      /papic
BUTTON    —
STEPS     1. Open /papic. 2. Scroll to "On your own page, not on ours" and the last line of the dark panel.
EXPECTED  Never a coloured `border-left` accent on a card or row.
ACTUAL    "These are yours to keep. Nothing here expires." is drawn with `border-l-2 border-[var(--sn-ob-gold)]`.  (anchor: `apps/web/app/(shell)/papic/_papic-sections.tsx` · `border-l-2 border-[var(--sn-ob-gold)]`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part H3 (never a coloured side stripe)
SEVERITY  look
SOURCE    CODE

#### A1-039 · /monogram: several filled buttons in one screen, and the same "Start planning · free" in two colours
PAGE      /monogram
BUTTON    "Download SVG" · "Start planning · free" · "Download vector"
STEPS     1. Open /monogram signed out. 2. Look at the studio's buttons, the "Make it your wedding’s monogram" card, and the closing panel.
EXPECTED  One main button per scope; the rest neutral or a text link. One terracotta button per hero and one per close.
ACTUAL    "Download SVG", the card's "Start planning · free" and "Download vector" are all solid ink-filled (`bg-[#1E2229]`). The closing "Start planning · free" is a terracotta main. So the same action appears twice, in two different fills.  (anchor: `apps/web/app/monogram/public-monogram-studio.tsx` · `rounded-full bg-[#1E2229] px-5 py-3` · `href="/onboarding/wedding?from=monogram"` · `apps/web/app/(shell)/monogram/page.tsx` · `actionButtonClass('brand', { main: true, extra: 'mt-5 !h-11' })`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part K1 · Part H3
SEVERITY  look
SOURCE    CODE

#### A1-040 · Every page's loading.tsx returns null, so the content area goes blank
PAGE      /alaala, /budget, /guest-list, /monogram, /mood-board, /palogo, /panood, /papic, /pawebsite, /schedule, /seat-plan, /setnayan-ai
BUTTON    —  (any rail row that opens these pages)
STEPS     1. Signed out, press a Studio row in the rail. 2. Watch the area under the shell while the page loads.
EXPECTED  The loading state looks like the page (Ghost skeleton for the parts that load later), so loading never looks like an empty page.
ACTUAL    All twelve `loading.tsx` files `return null;`. The shell stays, but the page area is blank until the page arrives. The docblock says this is on purpose, to avoid a second set of chrome.  (anchor: `apps/web/app/(shell)/papic/loading.tsx` · `export default function DoorwayLoading()` · `return null;`)
SHOTS     — (phase B)
RULE      CLAUDE.md §3 Loading (skeleton draws what the page draws) · HOUSE_DESIGN_STANDARD H5
SEVERITY  look
SOURCE    CODE

> NOTES: I did not open the demo stills (`/add-ons/demo/stills/*.jpg`) to look for prices or tier pills inside the pictures. I could not confirm whether "a personal video reel set to music" and "Life flash … set to music" on /papic still have a music source now that Music Maker is retired (`lib/reel-render.ts` names the Pakanta song as the source). /panood's "See pricing" may land on a /pricing page with no Live Watch line: `fetchV2CustomerCatalog` hides `LIVE_STUDIO` while `liveStudioRoamEnabled()` is off, and that is a production env setting I cannot see. I could not confirm in code that the Logo Maker lets you "describe the feel" (/palogo steps and FAQ), or that "glows on the screen at the reception" is live (needs the browser to confirm). I checked the signed-in branches (AddToEvent) in code only. I ran nothing and fetched nothing live.

### Code pass · finding suppliers (6 pages)

#### A1-041 · Compare: a failed read shows as a real answer
PAGE      /explore/compare
BUTTON    —  (the Rating, Distance and Save cells, and the page itself)
STEPS     1. Open /explore/compare?ids=<two verified shops>. 2. Make any one of its reads fail (the shops, the trusted review stats, the saved list or the event venue).
EXPECTED  A failed read says "Couldn't read" and offers Try again. It never looks like a real answer. Discover already does this for the same rating read.
ACTUAL    Four reads ignore their error:
          (a) The shops read `const { data: rowsRaw } = await admin` returns no rows on error, and the page silently does `redirect('/?browse=1')`. The comparison disappears with no message.
          (b) `fetchTrustedReviewStatsForMany` returns an empty map on error (`lib/reviews.ts` · `if (error) return m;`), so every shop reads "New to Setnayan". This is the exact defect Discover fixed (`app/(shell)/explore/_lib/marketplace-view.tsx` · "A failed read therefore told couples that every established supplier on the page was brand new").
          (c) `const { data: saved } = await supabase` falls back to `saved ?? []`, so a shop that is already saved shows "Save".
          (d) `const { data: ev } = await admin` ignores its error, so the cell says "Set your reception venue to see distance" even when a venue is set.
          (anchor: `apps/web/app/(shell)/explore/compare/page.tsx` · `NEW_TO_SETNAYAN_LABEL` · `const { data: rowsRaw } = await admin`)
SHOTS     — (phase B)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE

#### A1-042 · Compare works out "verified" and "listed" itself instead of using the one reader
PAGE      /explore/compare
BUTTON    "✓ Verified" pill · "Ask about your date"
STEPS     1. A verified shop is paused, or its papers lapse (its renewal day passes). 2. Open a comparison that includes it, from a saved link or ?ids=.
EXPECTED  The shop leaves every couple-facing list and loses its badge. Both decisions come from the one rule: `isShopFindable` / `findableShopGate` (lib/findable-shop.ts) and `hasVerifiedBadge` (lib/verified-badge.ts).
ACTUAL    Rows are kept by `.in('public_visibility', PUBLIC_SURFACE_VISIBILITIES …)` + `.or('verification_state.eq.verified,is_demo.eq.true')`, with no findable gate (`paused_at` and `papers_current` are never read). The pill is `visibility === 'verified'`. A paused or papers-lapsed shop still shows "✓ Verified" and an "Ask about your date" button. This page is not on the `lib/every-listing-asks-findable.test.ts` registry, so nothing catches it. (anchor: `apps/web/app/(shell)/explore/compare/page.tsx` · `.or('verification_state.eq.verified,is_demo.eq.true')`)
SHOTS     — (phase B)
RULE      design-and-wiring §C rule 8 (one reader)
SEVERITY  wrong
SOURCE    CODE

#### A1-043 · Compare uses a second rule to decide which event is "yours"
PAGE      /explore/compare
BUTTON    "Save"
STEPS     1. Sign in as a host with two or more events. 2. Open a comparison. 3. Press Save.
EXPECTED  The saved state, the distance and the save itself all use the same event. Like Discover's card, a host with several events gets to choose ("Save to…").
ACTUAL    The page reads the saved state and the venue from `fetchUserEvents(supabase, user.id, 'couple')` and takes `userEvents[0]`. That list includes archived events and ignores is_primary. The save action uses `resolvePrimaryHostEvent` instead (`app/(shell)/explore/actions.ts` · `saveVendorToPicks`). So the cell can say "Saved" for one event while Save writes into another, and the distance can be measured from the wrong venue. The `<SaveVendorButton` here gets no `events=`, so the "Save to…" PickMenu that Discover shows (`events={saveChoices}`) never appears. (anchor: `apps/web/app/(shell)/explore/compare/page.tsx` · `coupleEventId = userEvents[0]?.event_id`)
SHOTS     — (phase B)
RULE      design-and-wiring §C rule 8 (one reader)
SEVERITY  wrong
SOURCE    CODE

#### A1-044 · Two filled accent buttons in the comparison table
PAGE      /explore/compare
BUTTON    "Ask about your date" (twice)
STEPS     1. Open any two-shop comparison.
EXPECTED  One main button per screen. The other actions are neutral, and every button is an ActionButton (or `actionButtonClass()` for a link).
ACTUAL    Each column has a hand-built link painted `bg-terracotta-700 … text-cream`, so one table shows two accent-filled buttons side by side. Neither is an ActionButton. (anchor: `apps/web/app/(shell)/explore/compare/page.tsx` · `bg-terracotta-700 px-4 text-sm font-medium text-cream`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part K1 · CLAUDE.md §3 (Button)
SEVERITY  look
SOURCE    CODE

#### A1-045 · Marketplace "Add to an event" goes to the wrong places (signed in)
PAGE      /marketplace
BUTTON    "Add to an event" → "Start a new event" · each event row
STEPS     1. Sign in as a host who has an event. 2. Open /marketplace. 3. Press "Add to an event". 4. Press "Start a new event", or press one of the events.
EXPECTED  "Start a new event" starts an event, like the page's own "Start planning · free" door. An event row opens that event's supplier desk (`eventHref` → `/dashboard/{id}/vendors` in lib/studio-apps.ts).
ACTUAL    The create row takes `createHref={primary.href}` and `createLabel={primary.label}`. On this page the primary is `{ href: '/?browse=1', label: 'Browse the marketplace' }`, so "Start a new event" (with "Browse the marketplace" under it) opens Discover. Event rows use `` `/dashboard/${e.eventId}` `` and never read `eventHref`, so they land on the event home. (anchor: `apps/web/app/_components/marketing/add-to-event-data.ts` · `` `/dashboard/${e.eventId}` `` · `apps/web/app/_components/marketing/add-to-event-cta.tsx` · `createHref={primary.href}`)
SHOTS     — (phase B)
RULE      design-and-wiring §B rule 5 (every press reaches a real destination)
SEVERITY  broken
SOURCE    CODE

#### A1-046 · "Add to an event" is a hand-built dialog
PAGE      /marketplace (signed in; the same component sits on every service doorway page)
BUTTON    "Add to an event"
STEPS     1. Signed in, open /marketplace. 2. Press "Add to an event".
EXPECTED  A small popup built from `Sheet`: half height on a phone, centred on desktop, with the one shared dim-and-blur backdrop.
ACTUAL    A `fixed inset-0 z-50` wrapper with its own `bg-[var(--m-ink)]/30` scrim button and a hand-rolled `role="dialog" aria-modal="true"` panel. (anchor: `apps/web/app/_components/marketing/add-to-event.tsx` · `fixed inset-0 z-50 flex items-center justify-center p-4`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part K3
SEVERITY  look
SOURCE    CODE

#### A1-047 · The commission line is not the ruled sentence
PAGE      /, /marketplace, /suppliers, /suppliers/[event]/[category], /suppliers/[event]/[category]/[city], /creators
BUTTON    —
STEPS     1. Read the page text, the search snippet and the share card.
EXPECTED  The one allowed line, word for word: "Hosts pay 0% commission." The root layout already uses it and says "never a bare '0% commission'" (`app/layout.tsx`).
ACTUAL    Bare forms and variants instead:
          - /marketplace: lede "Free to browse. 0% commission on bookings."; table row "0% commission — Setnayan never takes a cut"; closing "with 0% commission on bookings"; FAQ "Setnayan takes 0% commission on bookings"; spotlight "0% commission, so what fits you is never what pays us"; meta description from `lib/studio-apps.ts`, "free, with 0% commission on bookings".
          - /suppliers: meta description "… with the prices they publish themselves. 0% commission."
          - Landing pages: meta description "0% commission — you pay them directly."; FAQ answer `COUPLE_COMMISSION_PROMISE`, "No commission on your bookings — …".
          - /creators: "0% commission, as always."
          - Home `/` (SEEN-LIVE): "You pay them directly. 0% commission." under "Suppliers you can trust."
          (anchors: `apps/web/app/(shell)/marketplace/page.tsx` · `0% commission on bookings` · `apps/web/app/(shell)/suppliers/(index)/page.tsx` · `DESCRIPTION` · `apps/web/app/(shell)/suppliers/_landing.tsx` · `0% commission — you pay them directly.` · `apps/web/app/creators/_components/creator-story-sections.tsx` · `0% commission, as always.`)
SHOTS     — (phase B)
RULE      brand.md claims rule 2 — ⚠ RULE CONFLICT for the controller: corpus `MARKETING_RESEARCH_BRIEF_2026-11-24.md` ("Host pages may say '0% commission'") vs brand.md's exact sentence; brand.md says it wins on wording. Fix the loser first.
SEVERITY  wrong
SOURCE    CODE

#### A1-048 · Creators page promises "free, forever" and types ₱0
PAGE      /creators
BUTTON    —
STEPS     1. Open /creators and read the hero, the dark strip, the closing section and the share card.
EXPECTED  No price promise and no hand-typed ₱ figure.
ACTUAL    (SEEN-LIVE too: "₱0 to publish, forever — storytellers never pay" on https://setnayan.com/creators.)
          - Hero: "Free, forever." (`creator-story-hero.tsx`).
          - Dark strip: "₱0" with "to publish, forever — storytellers never pay Setnayan a peso".
          - Closing: eyebrow "Free, forever"; footnote "Free for storytellers, always".
          - Twitter card: "Chapters are free for storytellers, forever".
          (anchor: `apps/web/app/creators/_components/creator-story-sections.tsx` · `to publish, forever — storytellers never pay Setnayan a peso` · `apps/web/app/creators/_components/creator-story-hero.tsx` · `Free, forever.`)
SHOTS     — (phase B)
RULE      brand.md claims rule 3 (price promises) · rule 1 (hand-typed price)
SEVERITY  money-signin
SOURCE    CODE

#### A1-049 · Creators page names the retired Stories page and makes an "only" claim
PAGE      /creators
BUTTON    —
STEPS     1. Read the "Anatomy of a Chapter" list and the "Why publish here" cards.
EXPECTED  The retired Real Stories page is never named; featured stories now live on Discover. No rank or "only" claims.
ACTUAL    - "Standout Chapters get featured on Setnayan’s Stories page."
          - The card "Featured on Stories" says "Setnayan's Stories showcase".
          The stories hub is retired and forwards to Discover (`next.config.ts` · "the stories hub is retired"). The page's own closing button already says "See stories on Discover".
          - "the substrate nothing else on the internet carries" is an "only" claim.
          (anchor: `apps/web/app/creators/_components/creator-story-sections.tsx` · `Featured on Stories` · `nothing else on the internet carries`)
SHOTS     — (phase B)
RULE      corpus MARKETING_RESEARCH_BRIEF_2026-11-24 §3 RETIRED ("Real Stories", never mention) · brand.md claims rule 11 (rank claims)
SEVERITY  wrong
SOURCE    CODE

#### A1-050 · Landing pages' "Start planning free" asks for an account first
PAGE      /suppliers/[event]/[category], /suppliers/[event]/[category]/[city]
BUTTON    "Start planning free"
STEPS     1. Open any landing page, e.g. /suppliers/debut/coordinator. 2. Press "Start planning free" under "Planning a …?".
EXPECTED  It starts an event with no account (the account is asked for at save), through the `/onboarding/…` door that every other "Start planning" link uses, ideally for the page's own event type.
ACTUAL    `<Link href="/signup"` opens the account form. It is the only "Start planning" door under (shell) that goes to /signup, and it drops the page's event type. (anchor: `apps/web/app/(shell)/suppliers/_landing.tsx` · `Start planning free`)
SHOTS     — (phase B)
RULE      CLAUDE.md §1 (zero friction: a host starts an event with no account)
SEVERITY  broken
SOURCE    CODE

#### A1-051 · "See them all on the marketplace" drops the category and city
PAGE      /suppliers/[event]/[category], /suppliers/[event]/[category]/[city]
BUTTON    "See them all on the marketplace"
STEPS     1. Open a landing page with more than 48 services. 2. Press the link after "Showing 48 of N."
EXPECTED  Discover's supplier view narrowed to this page's category, city and event. It already accepts `tile`, `city` and `event_type` (`lib/discover-suppliers.ts` · `DISCOVER_SUPPLIER_PARAM_KEYS`).
ACTUAL    `<Link href="/?browse=1"` opens the unfiltered supplier view, so "them all" are not what the person sees. (anchor: `apps/web/app/(shell)/suppliers/_landing.tsx` · `See them all on the marketplace`) (needs the browser to confirm the exact filter values)
SHOTS     — (phase B)
RULE      design-and-wiring §B rule 5 (real destination)
SEVERITY  broken
SOURCE    CODE

#### A1-052 · Landing copy puts a fixed "a" before the event name
PAGE      /suppliers/[event]/[category], /suppliers/[event]/[category]/[city]
BUTTON    —
STEPS     1. Open a landing page for an event type whose label starts with a vowel or is not a noun, e.g. Anniversary, Corporate or Travel.
EXPECTED  Correct English: "an anniversary", "Planning an event?".
ACTUAL    The text is built as `Planning a {eventLower}?`, `for a ${r.eventLabel.toLowerCase()}` and `for a ${eventLower} in ${place}`. That produces "Planning a anniversary?" and "Planning a corporate?". The labels come from the live `event_type_vocab`. (anchor: `apps/web/app/(shell)/suppliers/_landing.tsx` · `Planning a {eventLower}?`) (needs the browser to confirm which event types have a page today)
SHOTS     — (phase B)
RULE      brand.md tone (plain words)
SEVERITY  wrong
SOURCE    CODE

#### A1-053 · Bordered, shadowed cards are used to list examples
PAGE      /marketplace, /creators
BUTTON    —
STEPS     1. Scroll /marketplace to "How it works" and the "Free to browse…" table. 2. Scroll /creators to "Why publish here" and "Who it's for".
EXPECTED  Shelves have no border and no shadow, and examples are listed as plan rows with hairlines.
ACTUAL    - /marketplace: the steps use `DOORWAY_TONE.card` (`rounded-2xl border … shadow-[var(--m-shadow-sm)]`). The differentiator list is a bordered, shadowed frame (`_doorway.tsx` · `rounded-2xl border border-[var(--m-line)] shadow-[var(--m-shadow-sm)]`). Both are in the shared DoorwayPage, so every doorway page has them.
          - /creators: `GridCard` is `m-card m-card-lift` (a border, a shadow and a hover lift on cards that cannot be pressed).
          (anchor: `apps/web/app/_components/marketing/_doorway-tone.ts` · `card:` · `apps/web/app/creators/_components/creator-story-sections.tsx` · `m-card m-card-lift`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part H
SEVERITY  look
SOURCE    CODE

#### A1-054 · Loading boundaries leave the page area blank
PAGE      /suppliers, /explore/compare (also /marketplace, /creators)
BUTTON    —
STEPS     1. From the rail or a link, open /suppliers or a comparison on a slow connection.
EXPECTED  The loading state draws what the page draws (`Sk` / `Ghost`), so loading, empty and failure never look alike.
ACTUAL    Each loading file is `return null;`: `(index)/loading.tsx`, `explore/loading.tsx` (`ExploreLoading`, which covers compare), `MarketplaceLoading`, and the creators `Loading`. While /suppliers reads every live card (`loadLandingCards`) and compare runs four to six reads, the area under the shell is empty and looks like an empty page. This is deliberate per `the-press-commits-now.test.ts`, but it breaks the loading rule. It matters little on /marketplace and /creators, which read nothing. (anchor: `apps/web/app/(shell)/explore/loading.tsx` · `ExploreLoading`)
SHOTS     — (phase B)
RULE      CLAUDE.md §3 (Loading) · brief check 2 (honest states)
SEVERITY  look
SOURCE    CODE

#### A1-055 · Marketplace and compare copy speaks only to weddings
PAGE      /marketplace, /explore/compare
BUTTON    "Start planning · free"
STEPS     1. Read /marketplace as someone planning a debut or a birthday.
EXPECTED  Copy for every event type. /suppliers describes the same suppliers as for "weddings, debuts, christenings, birthdays and every other event".
ACTUAL    - /marketplace meta and rail description: "Browse verified Filipino wedding suppliers" (`lib/studio-apps.ts`).
          - /marketplace FAQ and steps: "tied to your wedding", "once you have added your wedding", "when you start your wedding on Setnayan".
          - /marketplace's second door: `/onboarding/wedding?from=marketplace`.
          - Compare: "Compare Filipino wedding suppliers" and "your wedding shortlist".
          (anchor: `apps/web/app/(shell)/marketplace/page.tsx` · `tied to your wedding` · `apps/web/lib/studio-apps.ts` · `Browse verified Filipino wedding suppliers`)
SHOTS     — (phase B)
RULE      CLAUDE.md §1 North Star (the home of every Filipino celebration)
SEVERITY  wrong
SOURCE    CODE

> NOTES:
> - **Demo label path:** it exists. Discover cards carry `isDemo` (`lib/marketplace-service-cards.ts`) and `service-face.tsx` renders `DemoOnlyMarker` "(DEMO ONLY)". The compare column header renders `DemoOnlyMarker`. The /suppliers pages leave demo shops out on purpose (`shop.is_demo !== true`, since they are indexed). Whether the seeded pair is actually live needs the browser.
> - **Filters, sort, search:** none of the six pages has its own filter, sort or search control or dropdown; those live on Discover (`/?browse=1`), which is outside this group.
> - **Counts on /suppliers:** they are honest. `loadLandingCards` throws on a failed read, and the root `app/error.tsx` shows Try again.
> - **Booked state, money and ratings:** no page here shows booked state. Compare shows money only to an admin in demo mode, through `formatPhpRounded`. Ratings use `fetchTrustedReviewStatsForMany`, the same reader as the service cards. The `tierCaps(...).reviewStarsCounted` gate on compare is true for every tier, so it hides nothing.
> - **Rule conflict to settle first:** the corpus `MARKETING_RESEARCH_BRIEF_2026-11-24` §8 says "Host pages may say '0% commission'", which contradicts brand.md's exact-sentence rule. An owner ruling from 2026-09-22, quoted in `lib/one-commission-promise.test.ts`, also keeps bare "0% commission" for couples. The owner should confirm before the commission finding is fixed.
> - **Signed-in states:** the marketplace dialog and the compare save behaviour were read from code only.
> - **Could not verify:** the /creators illustration names suppliers ("The Glasshouse, Tagaytay", "Hiraya Films", "Flora & Fern Studio") that may be real businesses, and its "View supplier" pills look pressable but are aria-hidden spans.

### Code pass · sign-in, sign-up, profiles (11 pages)

#### A1-056 · "Secure my plan" never reaches the sign-up form for a host with no account
PAGE      /signup
BUTTON    "Secure my plan" (dashboard notice) · "Create a free account" (SaveToContinue)
STEPS     1. Start an event with no account (an anonymous session). 2. On the dashboard press "Secure my plan". 3. /signup?next=%2Fdashboard loads.
EXPECTED  The Create account card. Its `signUp` action has a branch that turns this same anonymous account into a real one (`existingUser?.is_anonymous` in signup/actions.ts).
ACTUAL    The page's signed-in bypass counts any session as signed in. `getCurrentUser()` returns anonymous users and the page never checks `is_anonymous` (/login does: `!user.is_anonymous`). So `if (user) { if (next !== '/') redirect(next) … }` sends the host straight back to /dashboard and the form never draws. Every door that links /signup for these hosts dead-ends the same way: secure-account-banner.tsx, anon-gate/save-to-continue.tsx and stay-registry accProfile. Anonymous onboarding is ON according to build-sessions/P0-b-SWITCHES.md (`NEXT_PUBLIC_ANON_ONBOARDING_ENABLED`). Checker re-read: `getCurrentUser()` (`apps/web/lib/auth.ts`) returns the anonymous user, and no version of `app/signup/page.tsx` ever checked `is_anonymous`. Not tried live (it needs a new anonymous host, which is a write). Phase B confirms first: on staging, start an event signed out, then press "Secure my plan".  (anchor: `apps/web/app/signup/page.tsx` · `Already-authenticated bypass`)
SHOTS     — (phase B)
RULE      North Star (a host starts with no account; the account is asked for at save) · design-and-wiring B5 (every press reaches a real destination)
SEVERITY  blocker
SOURCE    CODE

#### A1-057 · /reset-password lets any signed-in device set a new password without the current one
PAGE      /reset-password
BUTTON    "Save new password"
STEPS     1. On a phone or laptop that is still signed in (sessions last up to a year), open setnayan.com/reset-password directly. 2. Type a new password twice and press Save new password.
EXPECTED  Only the recovery session from the emailed link may change the password, or the current password is asked for again, as Profile › Security does (`current_password` in lib/account-security-actions.ts).
ACTUAL    The page checks only `getCurrentUser()` and the action only `auth.getUser()`, so any live session sees "Choose a new password." and the action runs `updateUser({ password })`. It then runs `signOut({ scope: 'others' })`, which signs the real owner out everywhere else. Someone holding a borrowed, signed-in device can take the account. This holds unless Supabase's "Secure password change" setting is on, which needs the dashboard to confirm. An anonymous host is shown the same form.  (anchor: `apps/web/app/reset-password/page.tsx` · `const user = await getCurrentUser();` · `apps/web/app/reset-password/actions.ts` · `updateUser({ password: newPassword })`)
SHOTS     — (phase B)
RULE      brief: money-signin (signing into the wrong account)
SEVERITY  money-signin
SOURCE    CODE

#### A1-058 · Text from the URL is printed inside sign-in and sign-up cards, and a stray "%" breaks the page
PAGE      /signup, /signup/you, /reset-password, /i/[slug], /login
BUTTON    —
STEPS     1. Open `/signup?error=Your account is locked. Call 0917… to restore it.` The same works on /signup/you, /reset-password, /i/<slug>, or as `/login?check_email=…` and `/login?ready=…`.
EXPECTED  Only the site's own fixed sentences can appear, the way /login already handles `?error=` (`loginErrorFromParam`, "NEVER THE URL'S OWN WORDS"). An unknown code shows one plain sentence.
ACTUAL    Each page prints the URL's own words as given:
          - /signup: `ERROR_COPY[rawError] ?? rawError`.
          - /signup/you and /reset-password: `decodeURIComponent(params.error)` goes straight into the alert.
          - /i/[slug]: `decodeURIComponent(sp.error).slice(0, 200)`.
          - /login: `check_email` → "Account created. We sent a confirmation link to <URL text>"; `ready` → "Your account is ready. Sign in below with <URL text>".
          Real error paths leak machine text the same way. The anonymous-convert branch redirects with `server_config_error`, which is not in ERROR_COPY, so the bare code shows. Raw Supabase `error.message` also reaches the person: a captcha refusal, "Auth session missing!", and database errors from `saveYou`.
          Each of these also calls `decodeURIComponent` on a value Next has already decoded, so a lone `%` (`/login?ready=100%25`, `/signup?error=%25`) throws URIError and the page errors.
          SEEN-LIVE (plain page loads, no form touched): https://setnayan.com/login?ready=100%25 → HTTP 500; /reset-password?error=%25 → HTTP 500; /signup?error=Call%20us%20at%200917 prints "Call us at 0917" inside the card.
          (anchor: `apps/web/app/signup/page.tsx` · `ERROR_COPY[rawError] ?? rawError` · `apps/web/app/signup/you/page.tsx` · `decodeURIComponent(params.error)` · `apps/web/app/reset-password/page.tsx` · `decodeURIComponent(params.error)` · `apps/web/app/i/[slug]/page.tsx` · `decodeURIComponent(sp.error).slice(0, 200)` · `apps/web/app/login/_components/login-data.ts` · `decodeURIComponent(params.check_email)`)
SHOTS     — (phase B)
RULE      CLAUDE.md §5 rule 4 (honest states) · design-and-wiring B6 (a failure shows a plain reason) · the 2026-09-30 phishing rule in lib/human-auth-error.ts
SEVERITY  money-signin
SOURCE    CODE

#### A1-059 · A supplier who goes from sign-up to sign-in and back is filed as a couple
PAGE      /signup
BUTTON    "Sign in", then "Create account"
STEPS     1. Open /signup?as=vendor. 2. Press "Have an account? Sign in". 3. On the card press "New here? Create account". 4. Create the account with email.
EXPECTED  The supplier choice survives the round trip. login-data.ts already puts `as=vendor` back on its sign-up link when it receives it.
ACTUAL    `loginHref` carries only `next` (`/login${next !== '/' ? …}`) and never `as=vendor`. /login's "Create account" therefore opens plain /signup and the account is made as a couple. A Google or Apple start error from /signup also lands on `/login?error=…&next=…` without `as` (app/auth/oauth-actions.ts).  (anchor: `apps/web/app/signup/page.tsx` · `const loginHref =`)
SHOTS     — (phase B)
RULE      same principle as a-refused-supplier-signup-stays-a-supplier.test.ts · brief: money-signin (landing in the wrong account)
SEVERITY  money-signin
SOURCE    CODE

#### A1-060 · The referral banner promises a reward that may not exist, for the wrong action
PAGE      /signup
BUTTON    ⓘ "About the invite"
STEPS     1. Open /signup?refc=S89R-XXXXXXXXXX (any code of the right shape). 2. Tap the ⓘ.
EXPECTED  A reward line only when the programme is on and a reward is set, in words that match what actually earns it.
ACTUAL    "A couple invited you to Setnayan." and "you'll both get a little something when you book your first service" show for any well-formed code. The page never reads `isReferralProgramEnabled()` or `platform_settings.referral_reward_php`. That setting defaults to 0, and at 0 the system records the referral but gives no reward (lib/referrals.ts: it "mints NOTHING"). What earns the reward is the first paid order on Setnayan (`qualifyReferralOnFirstPaidOrder`), not booking a supplier.  (anchor: `apps/web/app/signup/page.tsx` · `you’ll both get a little something when you book your first service`)
SHOTS     — (phase B)
RULE      brand.md claim 3 (price promises) · CLAUDE.md §5 rule 3 (never guess a number that governs money)
SEVERITY  money-signin
SOURCE    CODE

#### A1-061 · /signup promises a guest's photos will move to the new account; sign-up no longer does that
PAGE      /signup
BUTTON    —
STEPS     1. Open any Event Hub invitation, which leaves a guest pass in the browser. 2. Open /signup.
EXPECTED  No promise, or a promise the sign-up keeps.
ACTUAL    The banner "Your event photos will be saved to your new account." shows whenever `readGuestSession()` finds a pass. Since 2026-09-30 `signUp` links no seat and no photos ("SIGNING UP BINDS NO SEAT" in actions.ts); only `/join/{id}/connect` does, and only on its own Yes. The page's comment ("the action will link the guest's tagged photos") is out of date.  (anchor: `apps/web/app/signup/page.tsx` · `Your event photos will be saved to your new account.`)
SHOTS     — (phase B)
RULE      design-and-wiring B6 · brand.md (no claim the product does not keep)
SEVERITY  wrong
SOURCE    CODE

#### A1-062 · The You card shows blanks when its read fails, and Done erases saved details
PAGE      /signup/you
BUTTON    "Done"
STEPS     1. A returning account opens /signup/you. The page still opens later ("a signed-in one who types the URL later simply sees their current values"). 2. The `users` read fails. 3. Type a display name and press Done.
EXPECTED  "Couldn't read" and nothing saved.
ACTUAL    The read's error is ignored and `me = (profile ?? {})` draws a blank card: no photo, phone or full name, and the @name field and Stories question as if the account were new. Done posts the blanks, and `planPersonalInfoPatch` writes `phone: null`, empty name parts and `profile_photo_url: null` (the photo's presence marker is always posted). The saved values are erased. If `saveYou`'s own `mine` read also fails, a posted @name replaces the existing one and skips the rename limit.  (anchor: `apps/web/app/signup/you/page.tsx` · `const me = (profile ?? {}) as YouCardMe;`)
SHOTS     — (phase B)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE

#### A1-063 · The You card's consent box names Real Stories, which is retired
PAGE      /signup/you
BUTTON    the unticked Stories consent box
STEPS     1. Open /signup/you on a couple account with no consent on record.
EXPECTED  No retired feature is named.
ACTUAL    The box reads "Include my events in Setnayan's Stories showcase. 30 days after each event, its editorial page becomes publicly searchable on setnayan.com/realstories…". Real Stories was retired 16 Nov 2026 (PR #7847), and /realstories now forwards to Discover (`legacyRedirectTarget`). The corpus MARKETING_RESEARCH_BRIEF §3 lists Real Stories as RETIRED ("never mention").  (anchor: `apps/web/app/signup/you/_components/you-card.tsx` · `setnayan.com/realstories`)
SHOTS     — (phase B)
RULE      brand.md claim 9 / corpus RETIRED list
SEVERITY  wrong
SOURCE    CODE

#### A1-064 · /signup page description makes a speed claim
PAGE      /signup
BUTTON    —
STEPS     1. Read the page's metadata description (the search and share snippet).
EXPECTED  No speed claim.
ACTUAL    "Create a Setnayan account in seconds."  (anchor: `apps/web/app/signup/page.tsx` · `Create a Setnayan account in seconds.`)
SHOTS     — (phase B)
RULE      brand.md claim 6 (speed claims)
SEVERITY  wrong
SOURCE    CODE

#### A1-065 · "Wait a minute" on /forgot-password, but the limit lasts 15 minutes
PAGE      /forgot-password
BUTTON    "Email me a reset link"
STEPS     1. Ask for a reset 4 times for one address within 15 minutes. 2. Wait a minute as told and press again.
EXPECTED  The wait it really needs.
ACTUAL    The message says "Too many reset requests in a row — please wait a minute, then try again." The limits are 3 per address and 10 per IP per 15 minutes (`PER_EMAIL_WINDOW_MS = 15 * 60_000`), so a minute later it refuses again. The sign-in card's version of the same refusal says "wait a few minutes".  (anchor: `apps/web/app/forgot-password/page.tsx` · `please wait a minute, then try again`)
SHOTS     — (phase B)
RULE      design-and-wiring B6 (a failure gives the true reason)
SEVERITY  wrong
SOURCE    CODE

#### A1-066 · /waitlist words: commission lines and "Pre-register"
PAGE      /waitlist
BUTTON    "Pre-register your business today"
STEPS     1. Read the hero, the list and the metadata description.
EXPECTED  Only "Hosts pay 0% commission.", and no waitlist wording for suppliers, who can open a shop today.
ACTUAL    Three other commission wordings: "…verified supplier marketplace with 0% commission on bookings." (description), "No waitlist, no commission on bookings." and "Zero commission on supplier bookings — couples pay suppliers directly." The footer says "Supplier? Pre-register your business today", which reads as a waitlist although /open-shop is live.  (anchor: `apps/web/app/(shell)/waitlist/page.tsx` · `Zero commission on supplier bookings` · `Pre-register your business today`)
SHOTS     — (phase B)
RULE      brand.md claim 2 (only "Hosts pay 0% commission.")
SEVERITY  wrong
SOURCE    CODE

#### A1-067 · /download says "Trusted"
PAGE      /download
BUTTON    —
STEPS     1. Scroll to "The same Setnayan, closer to hand."
EXPECTED  No "trusted" promise.
ACTUAL    The value heading reads "Trusted & always signed in".  (anchor: `apps/web/app/(shell)/download/page.tsx` · `Trusted & always signed in`)
SHOTS     — (phase B)
RULE      brand.md claim 10 ("safe/scam-free/guaranteed/trusted")
SEVERITY  wrong
SOURCE    CODE

#### A1-068 · /download sells the desktop app for planning, then says it is only for Live Watch
PAGE      /download
BUTTON    "Download for Mac"
STEPS     1. Read the hero and the metadata, then the "For Live Watch only" note.
EXPECTED  One story. Per the owner's 24 Nov fix, this download is the Live Watch encoder.
ACTUAL    The hero says "your guest list, invitations, planner and seating, one launch away". The metadata says "Install Setnayan as a native desktop app… your guest list, invitations, planner and seating in their own window", and the window drawing shows "Your wedding plan". Lower down the page says "Only for streaming with Live Watch. Planning needs no install." The compatibility banner also says the Setnayan app "doesn't support" Intel Macs.  (anchor: `apps/web/app/(shell)/download/page.tsx` · `Only for streaming with Live Watch. Planning needs no install.`)
SHOTS     — (phase B)
RULE      brand.md (no claim the product does not keep) · design-and-wiring C8 (one fact, one answer)
SEVERITY  wrong
SOURCE    CODE

#### A1-069 · The supplier invite contradicts itself on when partners show
PAGE      /i/[slug]
BUTTON    "I already have a shop"
STEPS     1. Open another supplier's /i/<slug> signed in with a shop.
EXPECTED  One true rule about when a partner shows on the other's page.
ACTUAL    The sub-line says "You'll show on their page as a trusted partner." and the card says "Joining makes you partners at once". The note under the buttons says "…shows on your Trusted partners, and you on theirs, once you have served an event together." Signed-out visitors see only the first two. (needs the browser to confirm which is true)  (anchor: `apps/web/app/vendor/claim/[token]/_components/claim-parts.tsx` · `Joining makes you partners at once` · `apps/web/app/i/[slug]/page.tsx` · `once you have served an event together`)
SHOTS     — (phase B)
RULE      design-and-wiring C8 (one fact, one answer)
SEVERITY  wrong
SOURCE    CODE

#### A1-070 · A failed read shows a 404 or "Nothing public to show yet" on a real public profile
PAGE      /u/[userSlug], /u/[userSlug]/c/[chapterId]
BUTTON    —
STEPS     1. Open a public profile while the `users`, `event_members` or `events` read fails.
EXPECTED  "Couldn't read", which is different from "no such profile" and from "nothing public yet".
ACTUAL    `resolvePublicProfile` ignores every error. A failed user read returns null and the page shows a 404 (the chapter page too). A failed memberships or events read becomes `[]`, so the page shows "Nothing public to show yet" or skips the one-event redirect. Both pages are cached for 60 seconds (`revalidate = 60`), so the wrong state can be served to others.  (anchor: `apps/web/lib/public-profile.ts` · `const { data: userRow } = await admin` · `const { data: memberships } = await admin`)
SHOTS     — (phase B)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE

#### A1-071 · The owner's preview banner names a settings section that does not exist
PAGE      /u/[userSlug]
BUTTON    —
STEPS     1. With your public profile switched off, open your own /u/<slug>.
EXPECTED  The real path, Profile & settings › Privacy › Public profile (as the You card says), ideally as a link.
ACTUAL    The banner reads "Turn it on in Profile & settings → URL & handle to share it." "URL & handle" exists only as a code comment; the section a person sees is "Privacy › Public profile". The banner has no link.  (anchor: `apps/web/app/u/[userSlug]/page.tsx` · `uprof-preview`)
SHOTS     — (phase B)
RULE      design-and-wiring A4 (every way in moves with the page)
SEVERITY  wrong
SOURCE    CODE

#### A1-072 · Follow fails silently
PAGE      /u/[userSlug]
BUTTON    "Follow"
STEPS     1. Signed in, press Follow on someone's profile while the follow is refused (an RLS or database error).
EXPECTED  A plain reason with Try again.
ACTUAL    The button flips to "Following", then `setState((s) => ({ ...s, following: res.following }))` flips it back with no message. `res.ok` is never read, and the action returns `{ ok: false, following: false }` on every refusal.  (anchor: `apps/web/app/u/_components/follow-button.tsx` · `following: res.following`)
SHOTS     — (phase B)
RULE      design-and-wiring B6 (a failure must look like a failure)
SEVERITY  wrong
SOURCE    CODE

#### A1-073 · The chapter page claims "Papic Memories" without checking, and names the person differently
PAGE      /u/[userSlug]/c/[chapterId]
BUTTON    —
STEPS     1. Open a chapter that names an event. 2. Open the same person's profile for comparison.
EXPECTED  Claims that are measured, and the same name the profile shows.
ACTUAL    "Papic Memories of candid photos + clips sit behind this chapter." shows whenever a chapter names an event. It is never checked against real Papic photos and is not a link. The byline uses `user.display_name?.trim() || 'A Setnayan creator'`, while /u uses `profileShownName` (display name, else first and last name), so a person without a display name is named on their profile and "A Setnayan creator" on their own chapter.  (anchor: `apps/web/app/u/[userSlug]/c/[chapterId]/page.tsx` · `Papic Memories of candid photos + clips sit behind this` · `'A Setnayan creator'`)
SHOTS     — (phase B)
RULE      CLAUDE.md §5 rule 4 · design-and-wiring C8 (one reader)
SEVERITY  wrong
SOURCE    CODE

#### A1-074 · Sign-in, sign-up and forgot-password are self-built centred cards, not the small popup
PAGE      /login, /signup, /forgot-password
BUTTON    —
STEPS     1. Open /login, /signup and /forgot-password on a 375 px phone.
EXPECTED  The owner's ruling: sign-in is a SMALL POPUP, the shared `Sheet` (half height on a phone, centred on desktop) over the shared backdrop.
ACTUAL    /login draws its own dialog: `SignInCardModal` is a `.home-reskin-ov` div with role="dialog", aria-modal="true" and a backdrop it handles itself. The CSS keeps it a centred card at every width (`align-items: flex-start; … margin: auto`). /signup draws the same card as a whole page, and /forgot-password is a full `DoorShell` page you leave the sign-in card to reach.  (anchor: `apps/web/app/login/_components/sign-in-card-modal.tsx` · `className="home-reskin-ov sn-signin-simple sn-signin-scene"`)
SHOTS     — (phase B)
RULE      SHAPE (owner, 25 Nov) · HOUSE_DESIGN_STANDARD Part K3
SEVERITY  look
SOURCE    CODE

#### A1-075 · The You card should be a full-screen popup
PAGE      /signup/you
BUTTON    —
STEPS     1. Create an account with email.
EXPECTED  A FULL-SCREEN POPUP (`RiseScreen`). It has a photo upload and 8 or more fields, and it is part of the first run.
ACTUAL    A plain page holding a card on paper (`home-reskin-ov` › `hr-ov-card` inside a `<main>`).  (anchor: `apps/web/app/signup/you/_components/you-card.tsx` · `How should we call you?`)
SHOTS     — (phase B)
RULE      SHAPE (owner, 25 Nov)
SEVERITY  look
SOURCE    CODE

#### A1-076 · Two terracotta buttons in one sign-in card
PAGE      /login
BUTTON    "Email me a link to set a password" / "Send a new link" + "Continue"
STEPS     1. Sign in with a password on an account that uses only Google or Apple, with an address that is not gmail. Or open an expired email link while an address is remembered, or with Google and Apple turned off.
EXPECTED  One main button per card.
ACTUAL    The provider-refusal form and the dead-link form each draw `SubmitButton className="hr-si-submit"`, which is `#c24e25` inside `.sn-signin-terra`. The email form's "Continue" is the same class, and it is visible because the email part opens whenever there is an error or a typed address. Two filled terracotta buttons show together. (needs the browser to confirm)  (anchor: `apps/web/app/login/_components/sign-in-card.tsx` · `{reset.error ? SET_PASSWORD_WORDS.retry : SET_PASSWORD_WORDS.button}`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### A1-077 · "Report this page" opens a self-built dialog
PAGE      /u/[userSlug], /u/[userSlug]/c/[chapterId]
BUTTON    "Report this page"
STEPS     1. Press Report this page on a public profile or chapter.
EXPECTED  The shared `Sheet`.
ACTUAL    A div built by hand with `role="dialog"`, `aria-modal="true"` and `fixed inset-0 z-[60]`, plus its own panel, over `OverlayBackdrop`.  (anchor: `apps/web/app/_components/report-page-button.tsx` · `fixed inset-0 z-[60] flex items-end justify-center`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part K3
SEVERITY  look
SOURCE    CODE

#### A1-078 · /signup's loading skeleton draws the retired two-panel layout
PAGE      /signup, /signup/you
BUTTON    —
STEPS     1. Cold-load /signup on a desktop.
EXPECTED  A skeleton of the one small card the page draws.
ACTUAL    A 960 px, two-column "brand panel + form" skeleton (`max-w-[960px] … lg:grid-cols-2`). It is the layout retired 2026-09-22, and it also covers /signup/you.  (anchor: `apps/web/app/signup/loading.tsx` · `mirrors the centered .m-signup-card layout`)
SHOTS     — (phase B)
RULE      CLAUDE.md §3 Loading (the skeleton draws only what the page draws)
SEVERITY  look
SOURCE    CODE

#### A1-079 · Two colours stay light-only in the dark sign-in and sign-up cards
PAGE      /signup, /login
BUTTON    "Create account" / "Continue" (keyboard focus) · "Tick the Terms first."
STEPS     1. Set the phone to dark mode and open /signup. 2. Press Google before ticking the box. 3. Tab to the main button.
EXPECTED  Dark pairs from the colour tokens, readable on the dark card.
ACTUAL    The terms hint keeps `color: #b04722`, about 2.6:1 on the dark card, with no dark rule. The main button's focus ring keeps `outline: 2px solid #2c2a29`, nearly the dark card's own colour, so keyboard focus disappears in dark. The rest of the card (fields, ✕, banners, Google/Apple) has its dark pairs.  (anchor: `apps/web/app/_components/home/home-reskin.css` · `.home-reskin-ov .sn-signin-terra .hr-si-terms-hint` · `outline: 2px solid #2c2a29`)
SHOTS     — (phase B)
RULE      DARK_MODE_STANDARD (SIGNED_OUT_FOLLOWS_PHONE on /login and /signup)
SEVERITY  look
SOURCE    CODE

> NOTES: Settings I could not see from code: anonymous onboarding is ON according to build-sessions/P0-b-SWITCHES.md. `NEXT_PUBLIC_IOS_APP_STORE_URL` is described as unset, so /download honestly shows no "iPhone app" line and no store links today. Supabase's "Secure password change" setting decides how exposed /reset-password is. Dark rendering needs the browser. Out of my pages but on a door into /signup: app/host/accept/[token] links `/signup?…&email=`, but /signup reads only `prefill_email`, so that email is never filled in. The in-page sign-in pop-up (`sign-in-here-panel.tsx`) was not audited beyond the shared `SignInCard`. Checked and fine: Google and Apple go to real provider routes (`app/auth/oauth-actions.ts` → Supabase → `/auth/callback`), Facebook is hard-off, and every `next` goes through `safeNext`, which blocks redirects to other sites (`//`, backslash, control characters, encoded forms).
