# Final check — AREA 1 · Front door & public pages (signed out), incl. the sign-in pages

> Checker 1 of 8. **Report only — nothing here was fixed.** Pinned check commit: `fb3f72d` (main, frozen).
> Kit: `build-sessions/FINAL-CHECK-KIT.md` §§ 3–6. Rules: `docs/brand.md`, corpus `HOUSE_DESIGN_STANDARD_2026-11-20.md` (Parts H, K, I).
> Phase A = code pass (`SOURCE: CODE`) + a read-only walk of LIVE https://setnayan.com signed out (`SOURCE: SEEN-LIVE`).
> Phase B = the staging walk (`SOURCE: SEEN`), when the controller sends the address. Anchors are strings, never line numbers.

## BLOCKERS

**A1-056** (full entry also in the findings list, sign-in group). Found in code; **CONFIRMED on the staging copy 25 Nov (phase B, `SOURCE: SEEN`)**.

### A1-056 · "Secure my plan" never reaches the sign-up form for a host with no account
```text
PAGE      /signup
BUTTON    "Secure my plan" (dashboard notice) · "Create a free account" (SaveToContinue)
STEPS     1. Start an event with no account (an anonymous session). 2. On the dashboard press "Secure my plan". 3. /signup?next=%2Fdashboard loads.
EXPECTED  The Create account card. Its `signUp` action has a branch that turns this same anonymous account into a real one (`existingUser?.is_anonymous` in signup/actions.ts).
ACTUAL    The page's signed-in bypass counts any session as signed in. `getCurrentUser()` returns anonymous users and the page never checks `is_anonymous` (/login does: `!user.is_anonymous`). So `if (user) { if (next !== '/') redirect(next) … }` sends the host straight back to /dashboard and the form never draws. Every door that links /signup for these hosts dead-ends the same way: secure-account-banner.tsx, anon-gate/save-to-continue.tsx and stay-registry accProfile. Anonymous onboarding is ON according to build-sessions/P0-b-SWITCHES.md (`NEXT_PUBLIC_ANON_ONBOARDING_ENABLED`). Checker re-read: `getCurrentUser()` (`apps/web/lib/auth.ts`) returns the anonymous user, and no version of `app/signup/page.tsx` ever checked `is_anonymous`. Not tried live (it needs a new anonymous host, which is a write). Phase B confirms first: on staging, start an event signed out, then press "Secure my plan".  (anchor: `apps/web/app/signup/page.tsx` · `Already-authenticated bypass`)
SEEN      Phase B, staging copy (commit bd86936), 375 px, signed out: /start → Birthday → 7 steps → "Create my birthday" made the event "FC Area1 anon test" with no account (the checker's own test event). On its dashboard the button "Secure my plan" links `/signup?next=%2Fdashboard`. Opening it lands back on `/dashboard/<that event>` at once; the Create account card never draws. Same on a second try. A host with no account has no way to save their event.
SHOTS     375 px light: dashboard with "Secure my plan" · the /signup press landing back on the dashboard (checker's scratchpad)
RULE      North Star (a host starts with no account; the account is asked for at save) · design-and-wiring B5 (every press reaches a real destination)
SEVERITY  blocker
SOURCE    CODE + SEEN
```

### A1-154 · Every shop page answers HTTP 500 after about 24 seconds, signed in or out
```text
PAGE      /v/[slug] (served at /{shop}) · /v/[slug]/dates (→ /{shop}?dates=1)   (shops: all 10 seeded, e.g. liwanagphotoandfilm)
BUTTON    — (page load)
STEPS     1. Open /liwanagphotoandfilm on the staging copy, signed out. 2. Wait. 3. Repeat signed in (`front`). 4. Repeat for every shop in sitemap-vendors.xml.
EXPECTED  The shop page: cover, service cards with ₱ prices from the catalogue, portfolio, reviews, Check a date.
ACTUAL    HTTP 500 after 22–24 s, every time, for all 10 seeded shops (liwanagphotoandfilm, kusinanialingnenacatering, hardinngtagaytayeventsplace, talaeventscoordination, gandaglamstudio, hostkuyajun, mamonandcocakes, sampaguitaflorals, tugtugansounds, pelikulaweddingfilms) and for /liwanagphotoandfilm?dates=1. Console: "An error occurred in the Server Components render". The steady ~24 s points at a server read that times out, not a missing shop (a made-up shop gives an honest 404). The error screen a couple sees reads "Still opening your invitation… This is taking a little longer than usual. One moment. Opening…" with a REFERENCE number: the Event Hub's words on a shop page, and it never opens. Guest Event Hubs on the same copy open (e.g. /stg-carla-miguel 200), so it is the shop route. Areas 5, 6 and 7 cannot see their own public shop either. Copy-only cause not ruled out (lock d blocks stored pictures), but a picture should never take the page down (see A1-125, A1-128).
SHOTS     375 px light, signed out and signed in (checker's scratchpad)
RULE      kit § 5 item 1 (opens, no 5xx) · CLAUDE.md §5 rule 4 (honest states) · brand.md (the error names the wrong thing)
SEVERITY  blocker
SOURCE    SEEN
```

## Summary (phase A, done 25 Nov 2026)

- **Pages:** 74 of 74 + the 2 forwards (`/pakanta`, `/patiktok` → `/features`, both land live). Code pass on every page; live walk of setnayan.com signed out on every static page plus every dynamic page with a live example.
- **Findings: 153** — blocker **1** · money-signin **12** · broken **14** · wrong **83** · look **43**. Source: 146 code (14 of them also confirmed on the live site) · 7 seen live.
- **OFFLINE marks (76 lines):** NOT NEEDED **65** · READ-ONLY IS ENOUGH **6** (the five help pages, `/explore/compare`) · NEEDED **5** (`/v/[slug]`, `/v/[slug]/cached`, `/v/[slug]/dates` — a couple at an expo; `/v/[slug]/guest-review` and `/samahan/chat/[threadId]` — at the venue on the day). Disagreement with the plan: the shop page is where a couple at an expo lands, and today only an accidental last-copy rule (`isDayOfGuestNavigation` in `public/sw.js`) keeps it; `/v/[slug]/cached` is a server copy, not a phone copy.
- **SHAPE marks (76 lines):** should be PAGE **65** · FULL-SCREEN POPUP **6** · SMALL POPUP **3** · forward **2**. **8 differ today:** `/login`, `/signup`, `/forgot-password` (should be SMALL POPUP) · `/signup/you`, `/start`, `/pricing/plan`, `/articles/write`, `/samahan/chat/new` (should be FULL-SCREEN POPUP).
- **Money-signin, in one line each:** A1-001 tour calls the paid AI shortlist free · A1-022 /setnayan-ai "0% supplier commission … never what pays us" · A1-023 Papic dial says "You pay nothing" on a failed price read · A1-048 /creators "₱0 … forever" · A1-057 /reset-password changes a password from any signed-in device · A1-058 URL text printed in the sign-in cards, and a lone `%` gives HTTP 500 live · A1-059 a supplier sign-up round trip lands as a couple · A1-060 referral reward promised when none may exist · A1-080 an anonymous session can publish Articles · A1-100 a failed catalog read hides every paid plan · A1-122 the booking fee is shown to couples on an unverified shop · A1-123 a ₱0 package shows "₱0".

### Same problem in several places — fix each as one job

| Theme | Findings |
|---|---|
| Commission wording other than "Hosts pay 0% commission." ⚠ brand.md vs corpus `MARKETING_RESEARCH_BRIEF_2026-11-24.md` ("Host pages may say '0% commission'") — the controller settles the rule first | A1-022 · A1-047 · A1-066 · A1-092 · A1-102 |
| Price promises ("forever", "nothing expires", "always free", "free, for good") | A1-024 · A1-030 · A1-048 · A1-093 · A1-103 |
| "Monogram", Pabuya and retired names (Patiktok, reels, Real Stories, Animated Monogram) in words a person reads | A1-025 · A1-027 · A1-049 · A1-063 · A1-086 · A1-087 · A1-106 · A1-107 · A1-108 · A1-152 |
| Hand-built popups instead of `Sheet` / `RiseScreen` (K3; the shared "Add to an event" and "Report this page" dialogs recur) | A1-017 · A1-035 · A1-046 · A1-074 · A1-077 · A1-095 · A1-117 · A1-141 · A1-153 |
| Two accent buttons in one scope (K1) | A1-018 · A1-039 · A1-044 · A1-076 · A1-094 · A1-115 · A1-143 · A1-145 · A1-150 |
| Blank `loading.tsx` (`return null`) on public pages | A1-020 · A1-040 · A1-054 · A1-099 |
| Failed reads shown as real (honest states) | A1-007 · A1-008 · A1-023 · A1-033 · A1-041 · A1-062 · A1-070 · A1-084 · A1-100 · A1-125 · A1-128 · A1-129 |
| "Start" doors that skip `/start` or ask for an account first | A1-031 · A1-050 · A1-112 · A1-113 |
| Bordered / shadowed cards listing examples, side stripes (Part H) | A1-019 · A1-037 · A1-038 · A1-053 · A1-119 · A1-144 |
| Money formatted outside `lib/php.ts` | A1-034 · A1-114 · A1-140 |

### Checker's notes (read before phase B)

- **How phase A was done.** The code pass ran as seven read-only sub-passes (one per page group, same checklist); each finding cites its file and a greppable string. The checker re-read in code every blocker and money-signin claim before filing (the "free AI shortlist", the second budget reader, the Papic dial, `/setnayan-ai`'s 0% line, the `/signup` bypass) and adjusted two severities (A1-002 is sample data, so `wrong`; the AI-free claim keeps `money-signin` with the real free carve-out named). Entries marked "needs the browser" are for phase B to confirm or strike.
- **Live walk (SEEN-LIVE).** GET page loads only, signed out, 375 px then 1280 px, light; nothing pressed, typed or submitted. 160 page visits; every page opened (one intermittent 502, A1-148); **198 internal links found on the live pages, 0 dead**; no sideways scroll at 375 px on any page; made-up addresses give honest 404s (`/u/…`, `/i/…`, `/articles/…`, `/features/…`, `/help/…`, `/suppliers/…`, shop sub-pages), except `/panood/demo/<made-up>` (200, see A1-032). Console noise `ERR_TUNNEL_CONNECTION_FAILED` is this container's proxy blocking third-party hosts, not a site error. Screenshots stay in the checker's session scratchpad (this file is the only thing committed).
- **Side effect, disclosed:** loading `/papic` writes a `demo_sessions` row by design (A1-149); the walk's ~5 loads of `/papic` created ~5 demo sessions in production. Nothing else was written.
- **Kit mismatch:** kit § 3 says area 1 sees "the demo pair on Explore marked DEMO ONLY" signed out. Live, signed-out supplier browsing (`/?browse=1`, `/explore/compare`) sends a stranger to `/login` — that is the owner's 16 Nov ruling (`signedOutRedirect` in `apps/web/app/_components/frontdoor/front-door.tsx`), not a bug. Phase B needs the `front` sign-in (or area 2/3) to check the DEMO ONLY marks.
- **Switched off live:** `/sample` and `/sample/hub/*` are 404 (sample switch off), `/{shop}/booth` is 404 (booth switch off); their findings apply when switched on.
- **Speed figures** are from a US container through Vercel's Cleveland edge to Singapore; about 0.25–0.35 s of each is distance. Re-time from Manila in phase B.

## Progress

Each line: page · OFFLINE mark · SHAPE today → should.

- [x] / · OFFLINE: NOT NEEDED (marketing front door) · SHAPE: today PAGE → should PAGE
- [x] /about · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /acceptable-use · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /alaala · OFFLINE: NOT NEEDED (signed-out marketing page) · SHAPE: today PAGE → should PAGE
- [x] /api/v1 · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE (or not public at all, see finding)
- [x] /articles · OFFLINE: NOT NEEDED (an online community feed) · SHAPE: today PAGE → should PAGE
- [x] /articles/[slug] · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /articles/write · OFFLINE: NOT NEEDED (posting needs the network) · SHAPE: today PAGE (its own ✕ header) → should FULL-SCREEN POPUP over /articles (differs)
- [x] /budget · OFFLINE: NOT NEEDED (marketing page) · SHAPE: today PAGE → should PAGE (the signed-in "Add to an event" popup is wrong: see the popups finding)
- [x] /cookies · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /creators · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /download · OFFLINE: NOT NEEDED (marketing) · SHAPE: today PAGE → should PAGE
- [x] /explore/compare · OFFLINE: READ-ONLY IS ENOUGH (a couple at an expo may reopen a comparison by its link; Save and Ask need signal anyway) · SHAPE: today PAGE → should PAGE (people share it by its `?ids=` link)
- [x] /features · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /features/[slug] · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /for-suppliers · OFFLINE: NOT NEEDED (marketing) · SHAPE: today PAGE → should PAGE
- [x] /forgot-password · OFFLINE: NOT NEEDED · SHAPE: today a PAGE (`DoorShell`) → should SMALL POPUP (one field, a step of sign-in) (differs)
- [x] /guest-list · OFFLINE: NOT NEEDED (marketing page) · SHAPE: today PAGE → should PAGE (the signed-in "Add to an event" popup is wrong: see the popups finding)
- [x] /help · OFFLINE: READ-ONLY IS ENOUGH (the answers are fixed text, so a saved copy helps a guest or supplier at a venue with no signal; Ask and Message us need the network) · SHAPE: today PAGE → should PAGE
- [x] /help/[slug] · OFFLINE: READ-ONLY IS ENOUGH (static answer text) · SHAPE: today PAGE → should PAGE
- [x] /help/guides/[key] · OFFLINE: READ-ONLY IS ENOUGH (static steps) · SHAPE: today PAGE → should PAGE
- [x] /help/topics · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: today PAGE → should PAGE
- [x] /help/topics/[key] · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: today PAGE → should PAGE
- [x] /i/[slug] · OFFLINE: NOT NEEDED (joining needs the network) · SHAPE: today PAGE → should PAGE (shared by link and QR)
- [x] /login · OFFLINE: NOT NEEDED (signing in needs the network) · SHAPE: today a PAGE that draws its own centred popup (`.home-reskin-ov`, role=dialog) on every screen size → should SMALL POPUP (`Sheet`) (differs)
- [x] /marketplace · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /monogram · OFFLINE: NOT NEEDED (free design-and-download tool, used at home) · SHAPE: today PAGE → should PAGE
- [x] /mood-board · OFFLINE: NOT NEEDED (marketing page) · SHAPE: today PAGE → should PAGE (the signed-in "Add to an event" popup is wrong: see the popups finding)
- [x] /our-story · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /palogo · OFFLINE: NOT NEEDED (marketing page) · SHAPE: today PAGE → should PAGE (the signed-in "Add to an event" popup is wrong: see the popups finding)
- [x] /panood · OFFLINE: NOT NEEDED (marketing page) · SHAPE: today PAGE → should PAGE (its Live Watch demo popup is wrong: see the popups finding)
- [x] /panood/demo/[token] · OFFLINE: NOT NEEDED (a live peer-to-peer camera demo; nothing works without signal) · SHAPE: today PAGE → should PAGE (opened by scanning a QR on a phone)
- [x] /papic · OFFLINE: NOT NEEDED (marketing page; its live demo needs a connection) · SHAPE: today PAGE → should PAGE (/papic/try is its shareable address)
- [x] /pawebsite · OFFLINE: NOT NEEDED (marketing page) · SHAPE: today PAGE → should PAGE (the signed-in "Add to an event" popup is wrong: see the popups finding)
- [x] /pricing · OFFLINE: NOT NEEDED (prices must be live; a saved copy would show stale prices) · SHAPE: today PAGE → should PAGE
- [x] /pricing/plan · OFFLINE: NOT NEEDED · SHAPE: today PAGE (a step-by-step quiz; the steps are not in the URL, so Back leaves and refresh restarts) → should FULL-SCREEN POPUP over /pricing (differs)
- [x] /privacy · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /privacy/google-access · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /refunds · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
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
- [x] /start · OFFLINE: NOT NEEDED (the onboarding asks for an account at save and needs a connection) · SHAPE: today PAGE → should FULL-SCREEN POPUP (owner: creating an event is a full-screen popup; signed in, create-event is already a modal) (differs)
- [x] /suppliers · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /suppliers/[event]/[category] · OFFLINE: NOT NEEDED (an indexed directory; at an expo the couple uses Suppliers › Find inside their event) · SHAPE: today PAGE → should PAGE
- [x] /suppliers/[event]/[category]/[city] · OFFLINE: NOT NEEDED (same reason) · SHAPE: today PAGE → should PAGE
- [x] /terms · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /tl/about · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /tl/features · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /tl/features/[slug] · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /tour · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /tour/budget · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /tour/gallery · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /tour/seating · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /tour/vendors · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /u/[userSlug] · OFFLINE: NOT NEEDED (a public page read online; nothing to do there at a venue) · SHAPE: today PAGE → should PAGE (shared by link)
- [x] /u/[userSlug]/c/[chapterId] · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE (shared by link; forwards to /articles/&lt;slug&gt; when one exists)
- [x] /v/[slug] · LIVE: shops now live at /{shop}; /v/{shop} answers 308 → /{shop} (seen on /setnaprod, 200) · OFFLINE: NEEDED (couple at an expo. Today a `/{shop}` page opened once keeps a last copy only because sw.js treats any one-word address as a guest's event page (`isDayOfGuestNavigation`). Inquire, Add to your event and Check a date all need signal) · SHAPE: today PAGE → should PAGE
- [x] /v/[slug]/booth · LIVE: /setnaprod/booth 404 (switch off) · OFFLINE: NOT NEEDED (a 3D showcase, hidden behind NEXT_PUBLIC_PLAN3D_BOOTH_SHOWCASE) · SHAPE: today PAGE (full-screen canvas, no way back) → should PAGE
- [x] /v/[slug]/cached · LIVE: 404 "Not found" from outside (internal only) · OFFLINE: NEEDED (couple at an expo. This route does not provide it: it is a copy kept on the server and refreshed every 60 s, refused from outside, with nothing stored on the phone) · SHAPE: today PAGE (the page every signed-out visitor actually gets, at an internal address) → should PAGE
- [x] /v/[slug]/dates · LIVE: → /{shop}?dates=1, LCP 2.7 s · OFFLINE: NEEDED (at an expo, from the printed Check a date QR. Today it is a server redirect plus a live render, so no signal means no answer) · SHAPE: today a redirect to the shop with Check a date as a hand-built FULL-SCREEN POPUP → should FULL-SCREEN POPUP (RiseScreen) on its own address
- [x] /v/[slug]/guest-review · LIVE: 200, "We can’t find you on the door list" · OFFLINE: NEEDED (guests at the venue on the day, from the supplier's on-the-day guest QR. Every read and the send need signal) · SHAPE: today PAGE → should PAGE
- [x] /v/[slug]/story/[eventSlug] · OFFLINE: NOT NEEDED (a story page read at home) · SHAPE: today PAGE → should PAGE
- [x] /waitlist · OFFLINE: NOT NEEDED (marketing) · SHAPE: today PAGE → should PAGE
- [x] /web-only · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE

Forwards (kit: each must land):

- [x] /pakanta → /features · LIVE: lands on /features (200) · lands: yes (`redirect('/features')`; this is a temporary 307, while the retired /features/&lt;slug&gt; pages use a permanent `permanentRedirect`) · OFFLINE: NOT NEEDED · SHAPE: today forward → should forward
- [x] /patiktok → /features · LIVE: lands on /features (200) · lands: yes (same 307 `redirect('/features')`) · OFFLINE: NOT NEEDED · SHAPE: today forward → should forward

## Findings

Findings are grouped as the code pass ran. IDs are stable; phase B adds `SOURCE: SEEN` or strikes an entry (~~title~~ + reason), never renumbers.

### Code pass · samples, tour, Samahan (11 pages)

#### A1-001 · The tour says the AI shortlist is free, but Setnayan AI is a paid feature
```text
PAGE      /tour/vendors
BUTTON    "Start planning · free"
STEPS     1. Open /tour/vendors. 2. Read the hero and the closing panel.
EXPECTED  No "free" promise on Setnayan AI, which the corpus lists as "Setnayan AI: planner and supplier matching. Paid." If AI matching is shown, its price comes from the catalog.
ACTUAL    The closing panel says "let the AI shortlist for you — free, in minutes" above "Start planning · free". The hero says "Setnayan AI shortlisted a team…" and the AI switch is on by default. Nothing says it is paid. The only free AI carve-out is the FIRST reception-venue shortlist, once (`apps/web/lib/setnayan-ai-free-assist.ts` · `FIRST_VENUE_SHORTLIST_CAP`); a whole-team shortlist is behind the paid gate. (anchor: `apps/web/app/tour/vendors/page.tsx` · `let the AI shortlist for you — free, in minutes`)
SHOTS     — (phase B)
RULE      brand.md claims #3 (price promises) · corpus MARKETING_RESEARCH_BRIEF_2026-11-24.md ("Setnayan AI … Paid.")
SEVERITY  money-signin
SOURCE    CODE
```

#### A1-002 · The tour's "Committed" total comes from a second money reader and counts every supplier row
```text
PAGE      /tour/budget
BUTTON    —
STEPS     1. Open /tour/budget. 2. Read the "Committed" tile ("across every booked supplier") and "Left to pay … due in 30 days".
EXPECTED  Committed comes from the one reader, `resolveEventMoney`, which counts only confirmed bookings (`CONFIRMED.has(v.status)`). Suppliers the couple is still considering or has shortlisted count as estimates.
ACTUAL    `fetchBudgetSnapshot` adds up `itemizedTotal` for every `event_vendors` row, whatever its status. "Due in 30 days" adds up every line item due in the next 30 days, whether paid or not. (anchor: `apps/web/lib/budget.ts` · `budget: summaries.reduce((acc, s) => acc + s.itemizedTotal, 0)`; `apps/web/app/tour/budget/page.tsx` · `across every booked supplier`). (Needs the browser to confirm the sample holds a non-booked supplier with a price. Rule C8 makes the second reader a defect either way.)
SHOTS     — (phase B)
RULE      CLAUDE.md §4 (Budget: one reader `resolveEventMoney`) · design-and-wiring C8
SEVERITY  wrong  (sample data — no person's money; the second reader is the defect)
SOURCE    CODE
```

#### A1-003 · Signed in, /samahan's main button becomes "Add to an event", which sends people to an event dashboard
```text
PAGE      /samahan
BUTTON    "Add to an event" (signed out it reads "Create a group")
STEPS     1. Sign in as a host with an upcoming event. 2. Open /samahan. 3. Press the hero button.
EXPECTED  A group belongs to the account, not to an event (the page's own docblock says so). The hero stays "Create a group" → /dashboard/samahan/new.
ACTUAL    `studioKey="samahan"` turns the hero into the add-to-event picker. It reads "Add Groups to…", lists the host's events, and each row links to `/dashboard/<eventId>`, a page with no group on it. The create door is moved down to a "Start a new event" row. The picker is also a hand-built `fixed inset-0` overlay with `role="dialog"` `aria-modal` instead of `Sheet` (K3). (anchor: `apps/web/app/(shell)/samahan/page.tsx` · `studioKey="samahan"`; `apps/web/app/_components/marketing/add-to-event-data.ts` · `` `/dashboard/${e.eventId}` ``; `add-to-event.tsx` · `Add {serviceName} to…`) (needs the browser to confirm)
SHOTS     — (phase B)
RULE      design-and-wiring B5 (every press reaches the real destination) · HOUSE_DESIGN_STANDARD Part K3
SEVERITY  broken
SOURCE    CODE
```

#### A1-004 · /sample offers three people to look around as, but none of them can be opened
```text
PAGE      /sample, /sample/hub/[guestKey]
BUTTON    — (the three persona rows)
STEPS     1. With the sample switch on (or as an internal account), open /sample. 2. Try to open "The bride's cousin", "The bride's sister" or "Maria and Jose".
EXPECTED  Each persona row opens its view. /sample/hub/sample-guest-bride-cousin and /sample/hub/sample-guest-maid-of-honor are already built.
ACTUAL    Each row is static text tagged "Opening soon", under "Look around as one of three people". Nothing is pressable, and the built hub has no door from the landing. The only way out is "Start your own event". "Opening soon" also advertises a feature that is not live. (anchor: `apps/web/app/sample/page.tsx` · `Opening soon`)
SHOTS     — (phase B)
RULE      design-and-wiring A3 (registered and reachable) · brand.md claims #9 (coming features)
SEVERITY  broken
SOURCE    CODE
```

#### A1-005 · Group chat Add, Leave and Join chat fail silently
```text
PAGE      /samahan/chat/[threadId], /samahan/chat/new
BUTTON    "Join chat" · ＋ Add · Leave · "Make the group"
STEPS     1. In an event group, add a person, leave, or re-join, and have the database refuse it.
EXPECTED  A refusal shows a plain reason plus Try again.
ACTUAL    `addToGroup`, `leaveGroup` and `rejoinGroup` only log the error, then refresh the page. The press looks like it worked and nothing changes; "Join chat" just reloads "Join this chat again?". When `createGroup` is refused for any reason, it always says "Give it a name and try again." (anchor: `apps/web/app/samahan/chat/actions.ts` · `logQueryError('addToGroup (chat_group_add)'` · `rejoinGroup` · `The group was not made. Give it a name and try again.`)
SHOTS     — (phase B)
RULE      design-and-wiring B6 (a failure must render as a failure)
SEVERITY  broken
SOURCE    CODE
```

#### A1-006 · Find your seat shows the wrong guest's name for a shared table
```text
PAGE      /tour/seating
BUTTON    a name in "Matching guests"
STEPS     1. Type a name. 2. Pick a guest who shares a table with someone whose name sorts earlier.
EXPECTED  "<picked name>, you're at <table>."
ACTUAL    `selected` is the first seat at the picked table, not the seat that was picked. The line greets the other guest. (anchor: `apps/web/app/tour/seating/_components/find-your-seat.tsx` · `seats.find((s) => s.tableId === targetTableId)`)
SHOTS     — (phase B)
RULE      design-and-wiring B6
SEVERITY  wrong
SOURCE    CODE
```

#### A1-007 · On the tour, failed reads look like an empty or zero sample
```text
PAGE      /tour/vendors, /tour/gallery, /tour/seating
BUTTON    —
STEPS     1. Have the read fail (refused query or RPC). 2. Open each page.
EXPECTED  The read failure is said in words ("couldn't load, reload"), as /tour/seating and /tour/gallery already do for guests and inspirations.
ACTUAL    /tour/vendors passes no `onReadRefused`, so each category shows "0 found", "No sample suppliers in this category yet." and "Setnayan AI ranked 0 suppliers by fit". A failed counterparty read falls back to the typed name `'Liwanag Studios'`. /tour/gallery: `getWallSnapshot` ignores the `wall_visible_photos` error and the wall says "Memory lane is warming up". /tour/seating: when the guest read is refused, the header still prints "N tables for 0 guests". (anchors: `apps/web/app/tour/vendors/page.tsx` · `fetchWizardVendorRecommendations(admin, {` · `'Liwanag Studios'`; `apps/web/lib/live-wall.ts` · `const [{ data: feedData }`; `apps/web/app/tour/seating/page.tsx` · `formatCount(seatedCount)`)
SHOTS     — (phase B)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-008 · Group chat turns failed reads into empty lists
```text
PAGE      /samahan/chat/[threadId], /samahan/chat/new
BUTTON    the group name ▾ · "Make the group"
STEPS     1. Have `chat_group_list` or `chat_group_people` fail. 2. Open the ▾ sheet, or open New group.
EXPECTED  A failed read says so. `readEventGroups` and `readGroupPeople` return `null` precisely so the page can say so.
ACTUAL    The thread page flattens a failed groups read with `(groups ?? [])`, so ▾ opens an empty "Your groups" sheet. New group flattens a failed people read with `?? []`, so "Who is in it" is empty and looks the same as an event with nobody else (there are no empty-state words). A failed `chat_group_my_kind` read renders a 404. When everyone is already in a group, the shared ＋ list says "Every host of this event is already in this chat.", which is wrong for groups that hold guests and suppliers. (anchors: `apps/web/app/samahan/chat/[threadId]/page.tsx` · `(groups ?? []).map`; `apps/web/app/samahan/chat/new/page.tsx` · `((await readGroupPeople(supabase, eventId)) ?? [])`; `apps/web/app/_components/chat/chat-host-strip.tsx` · `Every host of this event is already in this chat.`)
SHOTS     — (phase B)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-009 · Speed and count claims in the tour copy
```text
PAGE      /tour, /tour/vendors, /tour/seating, /tour/gallery
BUTTON    —
STEPS     1. Read the closing panels and the gallery copy.
EXPECTED  No speed claims and no hand-typed counts.
ACTUAL    "free, in minutes" appears on all four pages. /tour/gallery says "On a real wedding day these appear the instant they're taken" and "photos appear here the moment they're taken". /tour/vendors says "didn't scroll through hundreds of suppliers". (anchors: `apps/web/app/tour/page.tsx` · `free, in minutes`; `apps/web/app/tour/gallery/page.tsx` · `appear the instant they`; `apps/web/app/tour/gallery/_components/tour-live-wall.tsx` · `the moment they`; `apps/web/app/tour/vendors/page.tsx` · `hundreds of suppliers`)
SHOTS     — (phase B)
RULE      brand.md claims #5, #6 · "Never hand-type a price, a count or a promise"
SEVERITY  wrong
SOURCE    CODE
```

#### A1-010 · The sample is called "a real wedding" in titles and share text
```text
PAGE      /tour, /tour/vendors, /tour/seating, /tour/budget, /tour/gallery
BUTTON    —
STEPS     1. Read the tab titles and share text.
EXPECTED  It is clearly marked as a sample, as the ribbon says ("a sample wedding").
ACTUAL    The titles read "Walk through a real wedding" and "The suppliers · A real wedding on Setnayan" (seating is the same). The share text reads "explore a real wedding budget" and "explore a real wedding's Memory lane". (anchors: `apps/web/app/tour/page.tsx` · `Walk through a real wedding`; `apps/web/app/tour/budget/page.tsx` · `explore a real wedding budget`)
SHOTS     — (phase B)
RULE      Group F brief (sample must be marked as an example) · brand.md
SEVERITY  wrong
SOURCE    CODE
```

#### A1-011 · "Ranked by distance" is claimed, but the tour never uses distance
```text
PAGE      /tour/vendors
BUTTON    the "% match" pill (tooltip)
STEPS     1. Read the hero, the description and the match tooltip.
EXPECTED  The copy names only what the ranking uses.
ACTUAL    The hero and description say "ranked by distance, reviews, and verification". The tooltip says "based on distance…". The code passes `distanceKm: null` (it notes "distance is unknown on the tour"). (anchors: `apps/web/app/tour/vendors/page.tsx` · `distanceKm: null` · `ranked by distance, reviews, and`; `tour-shortlist.tsx` · `based on distance, reviews, and verification`)
SHOTS     — (phase B)
RULE      brand.md (no claims that are not true)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-012 · The tour chat hard-codes a wedding date that will have passed by launch
```text
PAGE      /tour/vendors
BUTTON    "Hi! Are you available for our wedding on December 12, 2026?"
STEPS     1. Open /tour/vendors on or after 13 Dec 2026 (launch is 18 Dec). 2. Tap the suggested line.
EXPECTED  The date comes from the sample event (`ev.event_date`), and the sample stays future-dated.
ACTUAL    The script types "December 12, 2026" and the supplier answers "is still open on our calendar". The seed migration's comment dates the sample 2026-12-12, so at launch the chat asks about a past date and the whole tour shows a finished wedding. (anchor: `apps/web/app/tour/_components/tour-chat-thread.tsx` · `VISITOR_PROMPTS` · `December 12, 2026 is still open`) (needs the browser to confirm the sample's live event_date)
SHOTS     — (phase B)
RULE      design-and-wiring D15 (no hard-coded data in UI)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-013 · The planner's "typical range" is made up from a fixed ±15% band
```text
PAGE      /tour/budget
BUTTON    any service row → "Adjust this service"
STEPS     1. Tap a service in "Try the budget planner".
EXPECTED  A "typical range" comes from its home (`budget_leaf_benchmarks`), or is not shown.
ACTUAL    The sheet says "typical range ₱X–₱Y". The range is the sample's own spend multiplied by hand-typed 0.85 and 1.15. (anchor: `apps/web/app/tour/budget/page.tsx` · `p25Php: Math.round(amount * 0.85)`)
SHOTS     — (phase B)
RULE      CLAUDE.md §5 rule 3 (never guess a number that governs money)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-014 · "Bring Memory lane to life" adds copies of photos already on the wall
```text
PAGE      /tour/gallery
BUTTON    "Bring Memory lane to life"
STEPS     1. Press it on a wall that already has tiles.
EXPECTED  New moments arrive, or the demo is clearly a replay.
ACTUAL    The "new" tiles are clones of the first four tiles already shown, with new ids. The same photos appear twice and "N moments and counting" rises by 4. (anchor: `apps/web/app/tour/gallery/page.tsx` · `initialTiles.slice(0, 4).map`)
SHOTS     — (phase B)
RULE      Group F brief (sample numbers honest)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-015 · The sample guest Hub tells a guest "Opens on your wedding day"
```text
PAGE      /sample/hub/[guestKey]
BUTTON    —
STEPS     1. Open the bride's cousin's hub. 2. Scroll to "The Day".
EXPECTED  Words for a guest, such as "Opens on the wedding day", built from `SAMPLE_WORDS`.
ACTUAL    Every day-only row says "Opens on your wedding day" to a guest. (anchor: `apps/web/app/sample/hub/[guestKey]/page.tsx` · `Opens on your wedding day`)
SHOTS     — (phase B)
RULE      brand.md (words) · wrong word
SEVERITY  wrong
SOURCE    CODE
```

#### A1-016 · The sample ticket's "Copy link" copies a bare path, and its fallback points at a real-guest route
```text
PAGE      /sample/hub/[guestKey]
BUTTON    "Copy link"
STEPS     1. Press "Copy link" under the ticket. 2. Paste it anywhere.
EXPECTED  A full https://setnayan.com/sample/hub/… address. If the picture fails, the fallback makes sense for a sample.
ACTUAL    It copies `/sample/hub/<key>`, which is not a link once pasted. If the pass PNG fails, the shared fallback draws `/api/guest/qr`, a route that needs a real guest's cookie, and says "this code still works at the door". (anchors: `apps/web/app/sample/hub/[guestKey]/page.tsx` · `` invitationUrl={`/sample/hub/${guest.guestKey}`} ``; `apps/web/app/[slug]/_components/guest-ticket.tsx` · `src="/api/guest/qr"`)
SHOTS     — (phase B)
RULE      design-and-wiring B5
SEVERITY  wrong
SOURCE    CODE
```

#### A1-017 · The budget planner's adjust sheet is a hand-built dialog
```text
PAGE      /tour/budget
BUTTON    a service row → "Done" / "Reset to suggested"
STEPS     1. Tap a service in the planner.
EXPECTED  The shared `Sheet`: half height on a phone, centred dialog on desktop.
ACTUAL    A page-built `fixed inset-0` overlay with `role="dialog"` `aria-modal="true"` and its own panel. (anchor: `apps/web/app/tour/budget/_components/tour-budget-planner.tsx` · `aria-labelledby="tour-tilt-editor-headline"`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part K3
SEVERITY  look
SOURCE    CODE
```

#### A1-018 · Two accent buttons in the tour chat card
```text
PAGE      /tour/vendors
BUTTON    "Send" · the suggested-line chip
STEPS     1. Look at the chat card.
EXPECTED  One accent-filled main button; everything else neutral.
ACTUAL    "Send" is filled `bg-mulberry` (the CTA colour) and the suggestion chip is mulberry-tinted with a mulberry outline, both in one card. (anchor: `apps/web/app/tour/_components/tour-chat-thread.tsx` · `border-mulberry/30 bg-mulberry/[0.06]`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE
```

#### A1-019 · The tour pages use bordered cards and hand-made dark main buttons
```text
PAGE      /tour, /tour/budget, /tour/gallery, /tour/seating, /tour/vendors
BUTTON    "Start the tour →" · "Start planning · free" · "Next: Memories"
STEPS     1. Open any tour page.
EXPECTED  Part H: one terracotta main button (`ActionButton`) per hero and per close, shelves with no border and no shadow, and examples listed as rows with hairlines.
ACTUAL    The stops are listed as bordered cards. Every page closes on a bordered, tinted panel. The main buttons are hand-built `bg-[#1B1A17]` dark pills, not the house main button. (anchors: `apps/web/app/tour/page.tsx` · `rounded-2xl border p-5`; every tour page · `rounded-3xl border border-[#A9834B]/40 bg-[#FBF6EA]`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part H · Part K1
SEVERITY  look
SOURCE    CODE
```

#### A1-020 · /samahan's loading screen is blank
```text
PAGE      /samahan
BUTTON    —
STEPS     1. Navigate to /samahan from the rail.
EXPECTED  The loading screen mirrors the page, so loading and empty don't look alike.
ACTUAL    `loading.tsx` returns `null` on purpose (its docblock gives the reason), so the content area is blank until the page arrives. The page is dynamic because the hero button reads the session. (anchor: `apps/web/app/(shell)/samahan/loading.tsx` · `return null`)
SHOTS     — (phase B)
RULE      CLAUDE.md §5 rule 4 · Code-pass brief §2 (loading must not blank the page)
SEVERITY  look
SOURCE    CODE
```

#### A1-021 · New group should be a full-screen popup over Chats
```text
PAGE      /samahan/chat/new
BUTTON    "+ New group" (from the event's Chats)
STEPS     1. As a host, open Chats and press "+ New group".
EXPECTED  A `RiseScreen` over Chats; ✕ returns to the same place. It is not shared by link, and its list of everyone on the event runs past one screen.
ACTUAL    A separate page with a BackButton to `/dashboard/<id>/messages`. (anchor: `apps/web/app/samahan/chat/new/page.tsx` · `data-new-group`)
SHOTS     — (phase B)
RULE      SHAPE (owner, 25 Nov)
SEVERITY  look
SOURCE    CODE
```

> NOTES: Code only, so four things are unconfirmed: whether the sample switch (`platform_settings.sample_event_enabled`) is on in prod, so /sample may be a 404 for everyone; the live `event_date` of maria-and-jose; its `event_vendors` statuses; and whether its wall has tiles. Shared parts (DoorwayPage, SpotlightSection, ChatMessageStream, ChatSendForm, the Hub widgets) were checked only for the parts these pages use. Stop 1 (/maria-and-jose, the guest Event Hub) is outside this group and was not audited, including whether it has a door back to the tour.

### Code pass · product pages (13 pages)

#### A1-022 · Setnayan AI page tells hosts "0% supplier commission … never what pays us"
```text
PAGE      /setnayan-ai
BUTTON    —  (closing panel text, above "Start planning · free")
STEPS     1. Open /setnayan-ai signed out. 2. Scroll to the closing panel "Let it watch your back".
EXPECTED  The only allowed 0% line is exactly "Hosts pay 0% commission." No claim that Setnayan earns nothing from what the AI recommends.
ACTUAL    The closing body says "Add it when you want it; 0% supplier commission, so it recommends what fits you, never what pays us." Suppliers do pay a booking fee on clients Setnayan brings, and an AI match is one of those clients. So the line is not allowed by brand.md, and it is false about money.  (anchor: `apps/web/app/(shell)/setnayan-ai/page.tsx` · `0% supplier commission, so it recommends what fits you, never what pays us`)
SHOTS     — (phase B)
RULE      brand.md claims #2 (booking fee / "Hosts pay 0% commission." only) · lib/commission-promise.ts (one place that says 0%)
SEVERITY  money-signin
SOURCE    CODE
```

#### A1-023 · Papic price dial: a failed price read shows "You pay nothing" or vanishes
```text
PAGE      /papic
BUTTON    "More credits" / "Fewer credits"
STEPS     1. Open /papic when the catalog read or the Papic tier read fails (both return [] on error). 2. Scroll to "What it costs".
EXPECTED  A failed price read shows "Couldn't read" plus a way to try again. It never shows only the free option, and never disappears.
ACTUAL    `resolvePapicAnchor` turns failed rows into no paid options. If the free-credit read worked, the dial shows only the free option: "Start free. Move the dial only if you run out.", "You pay nothing", and + is disabled, so Papic looks free with no prices. If that read failed too, the whole "What it costs" section drops out without a word.  (anchor: `apps/web/app/(shell)/papic/page.tsx` · `if (priced.length === 0 && freeCredits <= 0) return null;` · `apps/web/lib/v2-catalog.ts` · `if (error || !data) return [];` · `apps/web/lib/papic-tier-config-read.ts` · `readPapicPassTiers` `return [];`)
SHOTS     — (phase B)
RULE      CLAUDE.md §5 rule 4 (honest states) · §1 "A failed read shows 'Couldn't read', never ₱0, 'Free' or empty"
SEVERITY  money-signin
SOURCE    CODE
```

#### A1-024 · Papic page suggests full-size photos are kept forever
```text
PAGE      /papic
BUTTON    —
STEPS     1. Open /papic. 2. Read the FAQ "What happens to the photos after the event?", the spotlight "For good", the Event Hub mock, and the closing line. 3. Open /papic/try and read its last line.
EXPECTED  Originals are kept 3, 6 or 12 months by plan, then a 720p copy is kept for life (brand.md; lib/llms-txt.ts "kept for a period set by the plan"). No "nothing expires" wording about the photos.
ACTUAL    The FAQ says flatly "three months after the event’s last day the original file is replaced by a 720p copy", which is wrong for Event Pro and Ultra and is a typed number. The spotlight title "Nothing here expires", the mock "These are yours to keep. Nothing here expires.", the closing "There is nothing separate to buy, and nothing that expires." and /papic/try "never expires" all suggest the originals last forever. "Nothing separate to buy" also clashes with the credit dial a few sections above.  (anchor: `apps/web/app/(shell)/papic/page.tsx` · `three months after the event’s last day the original file is replaced by a 720p copy` · `There is nothing separate to buy, and nothing that expires.` · `apps/web/app/(shell)/papic/_papic-sections.tsx` · `t: 'Nothing here expires'` · `These are yours to keep. Nothing here expires.` · `apps/web/app/(shell)/papic/try/page.tsx` · `never expires`)
SHOTS     — (phase B)
RULE      brand.md claims #3 (never imply full-size originals last forever)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-025 · Logo Maker page sells the retired "Animated Monogram" and an off-sale "Logo & QR part"
```text
PAGE      /palogo
BUTTON    —
STEPS     1. Open /palogo. 2. Read the browser tab and share-card title. 3. Read the FAQ "Can I try one first?", the "Try it free" spotlight and the closing panel.
EXPECTED  No retired product named (corpus MARKETING_RESEARCH_BRIEF §3 RETIRED: "Animated Monogram"). The animation is described as what it is today, part of Event Pro, without an off-sale part.
ACTUAL    The title, OG and Twitter text read "Logo Maker — Your Animated Wedding Monogram"; the JSON-LD name is "Logo Maker — Animated Wedding Monogram"; the OG alt is "your animated wedding monogram". Three places send buyers to "Event Pro’s Logo & QR part", but migrations `the_animated_monogram_reads_as_logo_and_qr` and `event_hub_pro_parts_are_retired_from_sale` set both of those SKUs to is_active = FALSE. The page's own docblock says it "never sells it by name".  (anchor: `apps/web/app/(shell)/palogo/page.tsx` · `Logo Maker — Your Animated Wedding Monogram` · `Event Pro’s Logo & QR part` · `animate your mark with Event Pro’s Logo & QR`)
SHOTS     — (phase B)
RULE      Brief: no retired product advertised · brand.md claims #9 · DECISION_LOG "EVENT HUB PRO IS SOLD WHOLE AGAIN"
SEVERITY  wrong
SOURCE    CODE
```

#### A1-026 · Budget page's search and share text still sells the removed "suggested split"
```text
PAGE      /budget
BUTTON    —
STEPS     1. Look at /budget's meta description, OG/Twitter description or JSON-LD description (for example, share the link in Messenger).
EXPECTED  It describes the shipped Budget: Target · Agreed · Paid · Owed, the Next line, and one list. The page's own docblock and its guard say the split planner was removed.
ACTUAL    The description comes from `studioDescription('budget')` and reads "take a suggested split from typical Filipino wedding costs". `product-pages-say-what-ships.test.ts` bans "suggested split" but only scans `app/(shell)`, so the string in `lib/studio-apps.ts` gets past it.  (anchor: `apps/web/lib/studio-apps.ts` · `take a suggested split from typical Filipino wedding costs`)
SHOTS     — (phase B)
RULE      brand.md claims #9 (say only what ships) · Brief §3 metadata words
SEVERITY  wrong
SOURCE    CODE
```

#### A1-027 · "Monogram" in words a person reads; the product is Logo Maker
```text
PAGE      /monogram, /palogo, /alaala, /mood-board
BUTTON    —
STEPS     1. Open each page and read the title, h1, FAQ, spotlights and studio text.
EXPECTED  "Logo Maker", or "logo"/"mark"; never "Monogram" (brand.md word rules).
ACTUAL    /monogram: title "Free Monogram Maker", h1 "Make your wedding monogram", JSON-LD "Setnayan Free Monogram Maker", aria "Monogram studio", studio card "pick it up in the Monogram Maker" (a retired name for the Logo Maker), and studio markup "Monogram studio · vector". /palogo: "drawn into a monogram that comes alive", "A monogram of your own", "A monogram that comes alive". /alaala: description and FAQ "your monogram (Logo Maker)", pillar "Your monogram, drawn to life". /mood-board: description, FAQ and steps "your monogram".  (anchor: `apps/web/app/(shell)/monogram/page.tsx` · `Free Monogram Maker · Setnayan` · `apps/web/app/monogram/public-monogram-studio.tsx` · `pick it up in the Monogram Maker` · `apps/web/lib/monogram-studio/markup.ts` · `Monogram studio · vector` · `apps/web/lib/studio-apps.ts` · `drawn into a monogram that comes alive` · `apps/web/app/(shell)/alaala/page.tsx` · `Your monogram, drawn to life`)
SHOTS     — (phase B) · SEEN-LIVE on /monogram, /palogo, /alaala, /mood-board (375 px)
RULE      brand.md word rules (Logo Maker, never Monogram)
SEVERITY  wrong
SOURCE    CODE · confirmed SEEN-LIVE
```

#### A1-028 · Setnayan AI page: a COMING feature, a "no other AI does this" claim, and the privacy law as a slogan
```text
PAGE      /setnayan-ai
BUTTON    —
STEPS     1. Open /setnayan-ai. 2. Read the FAQ "Does it learn my taste…" and "Is my information private?". 3. Read the meta/share description.
EXPECTED  No feature that is not live yet. No claim about every other product. No Data Privacy Act line used as marketing.
ACTUAL    The FAQ says "Those personalized and “couples like you” insights are coming, once our privacy sign-off is complete." The description, used for meta, OG and the rail, opens "Every other wedding AI waits for you to ask", a sweeping claim about all competitors. The FAQ also says "Setnayan runs on a privacy-first model under the Philippine Data Privacy Act (RA 10173)."  (anchor: `apps/web/app/(shell)/setnayan-ai/page.tsx` · `insights are coming, once our privacy sign-off is complete` · `privacy-first model under the Philippine Data Privacy Act` · `apps/web/lib/studio-apps.ts` · `Every other wedding AI waits for you to ask`)
SHOTS     — (phase B)
RULE      brand.md claims #9 (COMING), #11/#12 (rank / competitor claims), #13 (Data Privacy Act as a slogan)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-029 · Speed claims ("in seconds", "one minute")
```text
PAGE      /pawebsite, /papic
BUTTON    —
STEPS     1. Read /pawebsite's JSON-LD feature list. 2. On /papic, read the dial's "Not enough? Add more any time." line. 3. Open /papic/try and read its title, description and lede.
EXPECTED  No speed claims until measured (brand.md #6; HOUSE_DESIGN_STANDARD H5).
ACTUAL    "RSVP your guests answer in seconds"; "the new credits land in seconds"; "Two codes, two phones, one minute." (meta and share card) and "about a minute" (body).  (anchor: `apps/web/app/(shell)/pawebsite/page.tsx` · `RSVP your guests answer in seconds` · `apps/web/app/(shell)/papic/_papic-dial.tsx` · `the new credits land in seconds` · `apps/web/app/(shell)/papic/try/page.tsx` · `Two codes, two phones, one minute.`)
SHOTS     — (phase B)
RULE      brand.md claims #6 (speed claims)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-030 · Mood Board promises "nothing that expires" (a free-forever promise)
```text
PAGE      /mood-board
BUTTON    —
STEPS     1. Open /mood-board. 2. Read the FAQ "Is it really free?" and the "Free" spotlight.
EXPECTED  No price promises ("always free", "free for life" or the same idea in other words).
ACTUAL    "There is nothing to buy and nothing that expires." and the spotlight title "Nothing to buy, nothing that expires".  (anchor: `apps/web/app/(shell)/mood-board/page.tsx` · `nothing that expires`)
SHOTS     — (phase B)
RULE      brand.md claims #3 (price promises)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-031 · Every "Start planning · free" opens wedding onboarding, skipping the event-type picker
```text
PAGE      /alaala, /budget, /guest-list, /monogram, /mood-board, /palogo, /panood, /pawebsite, /schedule, /seat-plan, /setnayan-ai
BUTTON    "Start planning · free"
STEPS     1. Open /alaala (copy: "Works for every kind of event, not just weddings"), or a free tool ("Free with every Setnayan account"). 2. Press "Start planning · free".
EXPECTED  Land on /start ("What kind of event are you planning?"), which the front door and /pricing use, so a debut or christening host is not put into a wedding flow.
ACTUAL    Every hero and closing button is a typed `/onboarding/wedding?from=<page>`. The route exists, but a non-wedding host starts a wedding. Also a typed string, not a `lib/routes.ts` builder.  (anchor: `apps/web/app/(shell)/alaala/page.tsx` · `href="/onboarding/wedding?from=alaala"` · `apps/web/app/(shell)/budget/page.tsx` · `'/onboarding/wedding?from=budget'` · front door `apps/web/app/_components/frontdoor/front-door-landing.tsx` · `href="/start"`)
SHOTS     — (phase B)
RULE      design-and-wiring.md A4 / B6 (every press reaches the right destination)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-032 · Live Watch demo dead-end sends people to a homepage tile that no longer exists
```text
PAGE      /panood/demo/[token]
BUTTON    —  (none: the "full" and "expired" states have no button at all)
STEPS     1. Scan an old or used Live Watch demo QR, or a third phone scans a session that already has two cameras. 2. Read the message.
EXPECTED  Point to where the demo lives now (/panood → "Try the control room with two phones"), with a button to get there.
ACTUAL    "open a new one from the Live Watch tile on the Setnayan homepage" and "Open a fresh demo from the Live Watch tile on the homepage". The only opener today is `TryTheDemoButton` on the doorway pages; `/` mounts no demo. The in-flow "full" and "expired" states have no link at all. A failed token read (`resolveDemoToken` catch → null) also shows as "This demo link expired."  (SEEN-LIVE: a made-up token at https://setnayan.com/panood/demo/… shows exactly this, HTTP 200.) (anchor: `apps/web/app/panood/demo/[token]/page.tsx` · `open a new one from the Live Watch tile on the Setnayan homepage` · `apps/web/app/panood/demo/[token]/_components/cam-join-flow.tsx` · `Open a fresh demo from\n          the Live Watch tile on the homepage` · `apps/web/lib/demo-sessions.ts` · `resolveDemoToken`)
SHOTS     — (phase B)
RULE      design-and-wiring.md A4 (every way in moves with it) · CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE · confirmed SEEN-LIVE
```

#### A1-033 · Signed in: "Add to an event" says "You don't have an event yet" when the events read fails
```text
PAGE      /budget, /guest-list, /mood-board, /palogo, /panood, /pawebsite, /schedule, /seat-plan, /setnayan-ai
BUTTON    "Add to an event"
STEPS     1. Sign in as a host with events. 2. Open one of these pages while the events read errors (not a short blip). 3. Press "Add to an event".
EXPECTED  "Couldn't read your events" plus Try again (the helper `userEventsReadRefused` exists for this).
ACTUAL    `fetchUserEvents` falls back to [] on a non-blip error, so the dialog says "You don’t have an event yet. Start one and this can go straight into it." Any thrown error makes `resolveAddToEvent` return the signed-out view instead.  (anchor: `apps/web/app/_components/marketing/add-to-event-data.ts` · `fetchUserEvents(supabase, user.id, 'couple')` · `catch {\n      return signedOut;` · `apps/web/lib/events-for-studio-app.ts` · `You don’t have an event yet`)
SHOTS     — (phase B)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-034 · Papic money shown with a local "₱" formatter, not lib/php.ts
```text
PAGE      /papic
BUTTON    "More credits"
STEPS     1. Open /papic and move the dial to a paid option.
EXPECTED  Pesos formatted only through `formatPhp` / `formatPhpRounded`.
ACTUAL    The dial uses its own `const peso = (n: number) => '₱' + n.toLocaleString('en-PH');`.  (anchor: `apps/web/app/(shell)/papic/_papic-dial.tsx` · `const peso = (n: number) => '₱' + n.toLocaleString('en-PH');`)
SHOTS     — (phase B)
RULE      CLAUDE.md §1 Money (format only through lib/php.ts)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-035 · Popups on the product pages are hand-built, not Sheet / RiseScreen
```text
PAGE      /budget, /guest-list, /mood-board, /palogo, /panood, /pawebsite, /schedule, /seat-plan, /setnayan-ai (signed in); /panood (demo)
BUTTON    "Add to an event" · "Try the control room with two phones"
STEPS     1. Signed in, press "Add to an event" on any of these pages. 2. On /panood, press "Try the control room with two phones".
EXPECTED  Shared parts with the one dim-and-blur backdrop. The event picker is a SMALL POPUP (Sheet, half height on a phone). The camera and video demo is a FULL-SCREEN POPUP (RiseScreen).
ACTUAL    The picker is `fixed inset-0 z-50` with its own `bg-[var(--m-ink)]/30` scrim, no blur, and a hand-made `role="dialog"` centred card. The Live Watch demo is `OverlayShell`, a separate hand-made `role="dialog" aria-modal="true"` portal: a centred 460–680 px card holding live video, not RiseScreen.  (anchor: `apps/web/app/_components/marketing/add-to-event.tsx` · `fixed inset-0 z-50 flex items-center justify-center p-4` · `apps/web/app/_components/home/HomeOverlays.tsx` · `export function OverlayShell` · `apps/web/app/_components/home/panood-demo-overlay.tsx` · `label="Live Watch live demo"`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part K3 · SHAPE (owner, 25 Nov)
SEVERITY  look
SOURCE    CODE
```

#### A1-036 · Demo failures give no Try again button
```text
PAGE      /papic, /panood
BUTTON    —
STEPS     1. On /papic (or /papic/try), let the demo session fail to start. 2. On /panood, open the demo when it cannot start.
EXPECTED  A plain reason plus a Try again button.
ACTUAL    /papic: "The live codes could not be created just now…" with no button (the page must be reloaded). /panood demo: "Couldn’t start the demo right now. Close this and try again in a moment." with no Try again.  (anchor: `apps/web/app/(shell)/papic/_papic-scan.tsx` · `The live codes could not be created just now.` · `apps/web/app/_components/home/panood-demo-overlay.tsx` · `Couldn’t start the demo right now`)
SHOTS     — (phase B)
RULE      CLAUDE.md §3 (failure gives a plain reason plus Try again)
SEVERITY  look
SOURCE    CODE
```

#### A1-037 · Doorway kit lists steps and comparisons in bordered, shadowed cards
```text
PAGE      /alaala, /budget, /guest-list, /mood-board, /palogo, /panood, /pawebsite, /schedule, /seat-plan, /setnayan-ai
BUTTON    —
STEPS     1. Open any doorway page. 2. Look at the "How it works" steps, the "without / with" list and the closing panel (/alaala: the five pillar cards).
EXPECTED  Part H: no bordered card used to list examples; lists are plan rows with hairlines; shelves have no border and no shadow; the close is h2 → one terracotta button → fine print.
ACTUAL    Steps and pillars use `DOORWAY_TONE.card` (border + shadow). The differentiator list is a bordered, shadowed box. The closing panel has a gold border.  (anchor: `apps/web/app/_components/marketing/_doorway-tone.ts` · `card: 'rounded-2xl border border-[var(--m-line)] bg-[var(--m-paper)] shadow-[var(--m-shadow-sm)]'` · `closingPanel:` · `apps/web/app/_components/marketing/_doorway.tsx` · `overflow-hidden rounded-2xl border border-[var(--m-line)] shadow-[var(--m-shadow-sm)]`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part H3 (never a bordered card to list examples; shelves no border, no shadow)
SEVERITY  look
SOURCE    CODE
```

#### A1-038 · Coloured side stripe on a row in the Papic Event Hub mock
```text
PAGE      /papic
BUTTON    —
STEPS     1. Open /papic. 2. Scroll to "On your own page, not on ours" and the last line of the dark panel.
EXPECTED  Never a coloured `border-left` accent on a card or row.
ACTUAL    "These are yours to keep. Nothing here expires." is drawn with `border-l-2 border-[var(--sn-ob-gold)]`.  (anchor: `apps/web/app/(shell)/papic/_papic-sections.tsx` · `border-l-2 border-[var(--sn-ob-gold)]`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part H3 (never a coloured side stripe)
SEVERITY  look
SOURCE    CODE
```

#### A1-039 · /monogram: several filled buttons in one screen, and the same "Start planning · free" in two colours
```text
PAGE      /monogram
BUTTON    "Download SVG" · "Start planning · free" · "Download vector"
STEPS     1. Open /monogram signed out. 2. Look at the studio's buttons, the "Make it your wedding’s monogram" card, and the closing panel.
EXPECTED  One main button per scope; the rest neutral or a text link. One terracotta button per hero and one per close.
ACTUAL    "Download SVG", the card's "Start planning · free" and "Download vector" are all solid ink-filled (`bg-[#1E2229]`). The closing "Start planning · free" is a terracotta main. So the same action appears twice, in two different fills.  (anchor: `apps/web/app/monogram/public-monogram-studio.tsx` · `rounded-full bg-[#1E2229] px-5 py-3` · `href="/onboarding/wedding?from=monogram"` · `apps/web/app/(shell)/monogram/page.tsx` · `actionButtonClass('brand', { main: true, extra: 'mt-5 !h-11' })`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part K1 · Part H3
SEVERITY  look
SOURCE    CODE
```

#### A1-040 · Every page's loading.tsx returns null, so the content area goes blank
```text
PAGE      /alaala, /budget, /guest-list, /monogram, /mood-board, /palogo, /panood, /papic, /pawebsite, /schedule, /seat-plan, /setnayan-ai
BUTTON    —  (any rail row that opens these pages)
STEPS     1. Signed out, press a Studio row in the rail. 2. Watch the area under the shell while the page loads.
EXPECTED  The loading state looks like the page (Ghost skeleton for the parts that load later), so loading never looks like an empty page.
ACTUAL    All twelve `loading.tsx` files `return null;`. The shell stays, but the page area is blank until the page arrives. The docblock says this is on purpose, to avoid a second set of chrome.  (anchor: `apps/web/app/(shell)/papic/loading.tsx` · `export default function DoorwayLoading()` · `return null;`)
SHOTS     — (phase B)
RULE      CLAUDE.md §3 Loading (skeleton draws what the page draws) · HOUSE_DESIGN_STANDARD H5
SEVERITY  look
SOURCE    CODE
```

> NOTES: I did not open the demo stills (`/add-ons/demo/stills/*.jpg`) to look for prices or tier pills inside the pictures. I could not confirm whether "a personal video reel set to music" and "Life flash … set to music" on /papic still have a music source now that Music Maker is retired (`lib/reel-render.ts` names the Pakanta song as the source). /panood's "See pricing" may land on a /pricing page with no Live Watch line: `fetchV2CustomerCatalog` hides `LIVE_STUDIO` while `liveStudioRoamEnabled()` is off, and that is a production env setting I cannot see. I could not confirm in code that the Logo Maker lets you "describe the feel" (/palogo steps and FAQ), or that "glows on the screen at the reception" is live (needs the browser to confirm). I checked the signed-in branches (AddToEvent) in code only. I ran nothing and fetched nothing live.

### Code pass · finding suppliers (6 pages)

#### A1-041 · Compare: a failed read shows as a real answer
```text
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
```

#### A1-042 · Compare works out "verified" and "listed" itself instead of using the one reader
```text
PAGE      /explore/compare
BUTTON    "✓ Verified" pill · "Ask about your date"
STEPS     1. A verified shop is paused, or its papers lapse (its renewal day passes). 2. Open a comparison that includes it, from a saved link or ?ids=.
EXPECTED  The shop leaves every couple-facing list and loses its badge. Both decisions come from the one rule: `isShopFindable` / `findableShopGate` (lib/findable-shop.ts) and `hasVerifiedBadge` (lib/verified-badge.ts).
ACTUAL    Rows are kept by `.in('public_visibility', PUBLIC_SURFACE_VISIBILITIES …)` + `.or('verification_state.eq.verified,is_demo.eq.true')`, with no findable gate (`paused_at` and `papers_current` are never read). The pill is `visibility === 'verified'`. A paused or papers-lapsed shop still shows "✓ Verified" and an "Ask about your date" button. This page is not on the `lib/every-listing-asks-findable.test.ts` registry, so nothing catches it. (anchor: `apps/web/app/(shell)/explore/compare/page.tsx` · `.or('verification_state.eq.verified,is_demo.eq.true')`)
SHOTS     — (phase B)
RULE      design-and-wiring §C rule 8 (one reader)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-043 · Compare uses a second rule to decide which event is "yours"
```text
PAGE      /explore/compare
BUTTON    "Save"
STEPS     1. Sign in as a host with two or more events. 2. Open a comparison. 3. Press Save.
EXPECTED  The saved state, the distance and the save itself all use the same event. Like Discover's card, a host with several events gets to choose ("Save to…").
ACTUAL    The page reads the saved state and the venue from `fetchUserEvents(supabase, user.id, 'couple')` and takes `userEvents[0]`. That list includes archived events and ignores is_primary. The save action uses `resolvePrimaryHostEvent` instead (`app/(shell)/explore/actions.ts` · `saveVendorToPicks`). So the cell can say "Saved" for one event while Save writes into another, and the distance can be measured from the wrong venue. The `<SaveVendorButton` here gets no `events=`, so the "Save to…" PickMenu that Discover shows (`events={saveChoices}`) never appears. (anchor: `apps/web/app/(shell)/explore/compare/page.tsx` · `coupleEventId = userEvents[0]?.event_id`)
SHOTS     — (phase B)
RULE      design-and-wiring §C rule 8 (one reader)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-044 · Two filled accent buttons in the comparison table
```text
PAGE      /explore/compare
BUTTON    "Ask about your date" (twice)
STEPS     1. Open any two-shop comparison.
EXPECTED  One main button per screen. The other actions are neutral, and every button is an ActionButton (or `actionButtonClass()` for a link).
ACTUAL    Each column has a hand-built link painted `bg-terracotta-700 … text-cream`, so one table shows two accent-filled buttons side by side. Neither is an ActionButton. (anchor: `apps/web/app/(shell)/explore/compare/page.tsx` · `bg-terracotta-700 px-4 text-sm font-medium text-cream`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part K1 · CLAUDE.md §3 (Button)
SEVERITY  look
SOURCE    CODE
```

#### A1-045 · Marketplace "Add to an event" goes to the wrong places (signed in)
```text
PAGE      /marketplace
BUTTON    "Add to an event" → "Start a new event" · each event row
STEPS     1. Sign in as a host who has an event. 2. Open /marketplace. 3. Press "Add to an event". 4. Press "Start a new event", or press one of the events.
EXPECTED  "Start a new event" starts an event, like the page's own "Start planning · free" door. An event row opens that event's supplier desk (`eventHref` → `/dashboard/{id}/vendors` in lib/studio-apps.ts).
ACTUAL    The create row takes `createHref={primary.href}` and `createLabel={primary.label}`. On this page the primary is `{ href: '/?browse=1', label: 'Browse the marketplace' }`, so "Start a new event" (with "Browse the marketplace" under it) opens Discover. Event rows use `` `/dashboard/${e.eventId}` `` and never read `eventHref`, so they land on the event home. (anchor: `apps/web/app/_components/marketing/add-to-event-data.ts` · `` `/dashboard/${e.eventId}` `` · `apps/web/app/_components/marketing/add-to-event-cta.tsx` · `createHref={primary.href}`)
SHOTS     — (phase B)
RULE      design-and-wiring §B rule 5 (every press reaches a real destination)
SEVERITY  broken
SOURCE    CODE
```

#### A1-046 · "Add to an event" is a hand-built dialog
```text
PAGE      /marketplace (signed in; the same component sits on every service doorway page)
BUTTON    "Add to an event"
STEPS     1. Signed in, open /marketplace. 2. Press "Add to an event".
EXPECTED  A small popup built from `Sheet`: half height on a phone, centred on desktop, with the one shared dim-and-blur backdrop.
ACTUAL    A `fixed inset-0 z-50` wrapper with its own `bg-[var(--m-ink)]/30` scrim button and a hand-rolled `role="dialog" aria-modal="true"` panel. (anchor: `apps/web/app/_components/marketing/add-to-event.tsx` · `fixed inset-0 z-50 flex items-center justify-center p-4`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part K3
SEVERITY  look
SOURCE    CODE
```

#### A1-047 · The commission line is not the ruled sentence
```text
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
SOURCE    CODE · confirmed SEEN-LIVE
```

#### A1-048 · Creators page promises "free, forever" and types ₱0
```text
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
SOURCE    CODE · confirmed SEEN-LIVE
```

#### A1-049 · Creators page names the retired Stories page and makes an "only" claim
```text
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
```

#### A1-050 · Landing pages' "Start planning free" asks for an account first
```text
PAGE      /suppliers/[event]/[category], /suppliers/[event]/[category]/[city]
BUTTON    "Start planning free"
STEPS     1. Open any landing page, e.g. /suppliers/debut/coordinator. 2. Press "Start planning free" under "Planning a …?".
EXPECTED  It starts an event with no account (the account is asked for at save), through the `/onboarding/…` door that every other "Start planning" link uses, ideally for the page's own event type.
ACTUAL    `<Link href="/signup"` opens the account form. It is the only "Start planning" door under (shell) that goes to /signup, and it drops the page's event type. (anchor: `apps/web/app/(shell)/suppliers/_landing.tsx` · `Start planning free`)
SHOTS     — (phase B)
RULE      CLAUDE.md §1 (zero friction: a host starts an event with no account)
SEVERITY  broken
SOURCE    CODE
```

#### A1-051 · "See them all on the marketplace" drops the category and city
```text
PAGE      /suppliers/[event]/[category], /suppliers/[event]/[category]/[city]
BUTTON    "See them all on the marketplace"
STEPS     1. Open a landing page with more than 48 services. 2. Press the link after "Showing 48 of N."
EXPECTED  Discover's supplier view narrowed to this page's category, city and event. It already accepts `tile`, `city` and `event_type` (`lib/discover-suppliers.ts` · `DISCOVER_SUPPLIER_PARAM_KEYS`).
ACTUAL    `<Link href="/?browse=1"` opens the unfiltered supplier view, so "them all" are not what the person sees. (anchor: `apps/web/app/(shell)/suppliers/_landing.tsx` · `See them all on the marketplace`) (needs the browser to confirm the exact filter values)
SHOTS     — (phase B)
RULE      design-and-wiring §B rule 5 (real destination)
SEVERITY  broken
SOURCE    CODE
```

#### A1-052 · Landing copy puts a fixed "a" before the event name
```text
PAGE      /suppliers/[event]/[category], /suppliers/[event]/[category]/[city]
BUTTON    —
STEPS     1. Open a landing page for an event type whose label starts with a vowel or is not a noun, e.g. Anniversary, Corporate or Travel.
EXPECTED  Correct English: "an anniversary", "Planning an event?".
ACTUAL    The text is built as `Planning a {eventLower}?`, `for a ${r.eventLabel.toLowerCase()}` and `for a ${eventLower} in ${place}`. That produces "Planning a anniversary?" and "Planning a corporate?". The labels come from the live `event_type_vocab`. (anchor: `apps/web/app/(shell)/suppliers/_landing.tsx` · `Planning a {eventLower}?`) (needs the browser to confirm which event types have a page today)
SHOTS     — (phase B)
RULE      brand.md tone (plain words)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-053 · Bordered, shadowed cards are used to list examples
```text
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
```

#### A1-054 · Loading boundaries leave the page area blank
```text
PAGE      /suppliers, /explore/compare (also /marketplace, /creators)
BUTTON    —
STEPS     1. From the rail or a link, open /suppliers or a comparison on a slow connection.
EXPECTED  The loading state draws what the page draws (`Sk` / `Ghost`), so loading, empty and failure never look alike.
ACTUAL    Each loading file is `return null;`: `(index)/loading.tsx`, `explore/loading.tsx` (`ExploreLoading`, which covers compare), `MarketplaceLoading`, and the creators `Loading`. While /suppliers reads every live card (`loadLandingCards`) and compare runs four to six reads, the area under the shell is empty and looks like an empty page. This is deliberate per `the-press-commits-now.test.ts`, but it breaks the loading rule. It matters little on /marketplace and /creators, which read nothing. (anchor: `apps/web/app/(shell)/explore/loading.tsx` · `ExploreLoading`)
SHOTS     — (phase B)
RULE      CLAUDE.md §3 (Loading) · brief check 2 (honest states)
SEVERITY  look
SOURCE    CODE
```

#### A1-055 · Marketplace and compare copy speaks only to weddings
```text
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
```

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
```text
PAGE      /signup
BUTTON    "Secure my plan" (dashboard notice) · "Create a free account" (SaveToContinue)
STEPS     1. Start an event with no account (an anonymous session). 2. On the dashboard press "Secure my plan". 3. /signup?next=%2Fdashboard loads.
EXPECTED  The Create account card. Its `signUp` action has a branch that turns this same anonymous account into a real one (`existingUser?.is_anonymous` in signup/actions.ts).
ACTUAL    The page's signed-in bypass counts any session as signed in. `getCurrentUser()` returns anonymous users and the page never checks `is_anonymous` (/login does: `!user.is_anonymous`). So `if (user) { if (next !== '/') redirect(next) … }` sends the host straight back to /dashboard and the form never draws. Every door that links /signup for these hosts dead-ends the same way: secure-account-banner.tsx, anon-gate/save-to-continue.tsx and stay-registry accProfile. Anonymous onboarding is ON according to build-sessions/P0-b-SWITCHES.md (`NEXT_PUBLIC_ANON_ONBOARDING_ENABLED`). Checker re-read: `getCurrentUser()` (`apps/web/lib/auth.ts`) returns the anonymous user, and no version of `app/signup/page.tsx` ever checked `is_anonymous`. Not tried live (it needs a new anonymous host, which is a write). Phase B confirms first: on staging, start an event signed out, then press "Secure my plan".  (anchor: `apps/web/app/signup/page.tsx` · `Already-authenticated bypass`)
SEEN      Phase B, staging copy (commit bd86936), 375 px, signed out: /start → Birthday → 7 steps → "Create my birthday" made the event "FC Area1 anon test" with no account (the checker's own test event). On its dashboard the button "Secure my plan" links `/signup?next=%2Fdashboard`. Opening it lands back on `/dashboard/<that event>` at once; the Create account card never draws. Same on a second try. A host with no account has no way to save their event.
SHOTS     375 px light: dashboard with "Secure my plan" · the /signup press landing back on the dashboard (checker's scratchpad)
RULE      North Star (a host starts with no account; the account is asked for at save) · design-and-wiring B5 (every press reaches a real destination)
SEVERITY  blocker
SOURCE    CODE + SEEN
```

#### A1-057 · /reset-password lets any signed-in device set a new password without the current one
```text
PAGE      /reset-password
BUTTON    "Save new password"
STEPS     1. On a phone or laptop that is still signed in (sessions last up to a year), open setnayan.com/reset-password directly. 2. Type a new password twice and press Save new password.
EXPECTED  Only the recovery session from the emailed link may change the password, or the current password is asked for again, as Profile › Security does (`current_password` in lib/account-security-actions.ts).
ACTUAL    The page checks only `getCurrentUser()` and the action only `auth.getUser()`, so any live session sees "Choose a new password." and the action runs `updateUser({ password })`. It then runs `signOut({ scope: 'others' })`, which signs the real owner out everywhere else. Someone holding a borrowed, signed-in device can take the account. This holds unless Supabase's "Secure password change" setting is on, which needs the dashboard to confirm. An anonymous host is shown the same form.  (anchor: `apps/web/app/reset-password/page.tsx` · `const user = await getCurrentUser();` · `apps/web/app/reset-password/actions.ts` · `updateUser({ password: newPassword })`)
SHOTS     — (phase B)
RULE      brief: money-signin (signing into the wrong account)
SEVERITY  money-signin
SOURCE    CODE
```

#### A1-058 · Text from the URL is printed inside sign-in and sign-up cards, and a stray "%" breaks the page
```text
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
SOURCE    CODE · confirmed SEEN-LIVE
```

#### A1-059 · A supplier who goes from sign-up to sign-in and back is filed as a couple
```text
PAGE      /signup
BUTTON    "Sign in", then "Create account"
STEPS     1. Open /signup?as=vendor. 2. Press "Have an account? Sign in". 3. On the card press "New here? Create account". 4. Create the account with email.
EXPECTED  The supplier choice survives the round trip. login-data.ts already puts `as=vendor` back on its sign-up link when it receives it.
ACTUAL    `loginHref` carries only `next` (`/login${next !== '/' ? …}`) and never `as=vendor`. /login's "Create account" therefore opens plain /signup and the account is made as a couple. A Google or Apple start error from /signup also lands on `/login?error=…&next=…` without `as` (app/auth/oauth-actions.ts).  (anchor: `apps/web/app/signup/page.tsx` · `const loginHref =`)
SHOTS     — (phase B)
RULE      same principle as a-refused-supplier-signup-stays-a-supplier.test.ts · brief: money-signin (landing in the wrong account)
SEVERITY  money-signin
SOURCE    CODE
```

#### A1-060 · The referral banner promises a reward that may not exist, for the wrong action
```text
PAGE      /signup
BUTTON    ⓘ "About the invite"
STEPS     1. Open /signup?refc=S89R-XXXXXXXXXX (any code of the right shape). 2. Tap the ⓘ.
EXPECTED  A reward line only when the programme is on and a reward is set, in words that match what actually earns it.
ACTUAL    "A couple invited you to Setnayan." and "you'll both get a little something when you book your first service" show for any well-formed code. The page never reads `isReferralProgramEnabled()` or `platform_settings.referral_reward_php`. That setting defaults to 0, and at 0 the system records the referral but gives no reward (lib/referrals.ts: it "mints NOTHING"). What earns the reward is the first paid order on Setnayan (`qualifyReferralOnFirstPaidOrder`), not booking a supplier.  (anchor: `apps/web/app/signup/page.tsx` · `you’ll both get a little something when you book your first service`)
SHOTS     — (phase B)
RULE      brand.md claim 3 (price promises) · CLAUDE.md §5 rule 3 (never guess a number that governs money)
SEVERITY  money-signin
SOURCE    CODE
```

#### A1-061 · /signup promises a guest's photos will move to the new account; sign-up no longer does that
```text
PAGE      /signup
BUTTON    —
STEPS     1. Open any Event Hub invitation, which leaves a guest pass in the browser. 2. Open /signup.
EXPECTED  No promise, or a promise the sign-up keeps.
ACTUAL    The banner "Your event photos will be saved to your new account." shows whenever `readGuestSession()` finds a pass. Since 2026-09-30 `signUp` links no seat and no photos ("SIGNING UP BINDS NO SEAT" in actions.ts); only `/join/{id}/connect` does, and only on its own Yes. The page's comment ("the action will link the guest's tagged photos") is out of date.  (anchor: `apps/web/app/signup/page.tsx` · `Your event photos will be saved to your new account.`)
SHOTS     — (phase B)
RULE      design-and-wiring B6 · brand.md (no claim the product does not keep)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-062 · The You card shows blanks when its read fails, and Done erases saved details
```text
PAGE      /signup/you
BUTTON    "Done"
STEPS     1. A returning account opens /signup/you. The page still opens later ("a signed-in one who types the URL later simply sees their current values"). 2. The `users` read fails. 3. Type a display name and press Done.
EXPECTED  "Couldn't read" and nothing saved.
ACTUAL    The read's error is ignored and `me = (profile ?? {})` draws a blank card: no photo, phone or full name, and the @name field and Stories question as if the account were new. Done posts the blanks, and `planPersonalInfoPatch` writes `phone: null`, empty name parts and `profile_photo_url: null` (the photo's presence marker is always posted). The saved values are erased. If `saveYou`'s own `mine` read also fails, a posted @name replaces the existing one and skips the rename limit.  (anchor: `apps/web/app/signup/you/page.tsx` · `const me = (profile ?? {}) as YouCardMe;`)
SHOTS     — (phase B)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-063 · The You card's consent box names Real Stories, which is retired
```text
PAGE      /signup/you
BUTTON    the unticked Stories consent box
STEPS     1. Open /signup/you on a couple account with no consent on record.
EXPECTED  No retired feature is named.
ACTUAL    The box reads "Include my events in Setnayan's Stories showcase. 30 days after each event, its editorial page becomes publicly searchable on setnayan.com/realstories…". Real Stories was retired 16 Nov 2026 (PR #7847), and /realstories now forwards to Discover (`legacyRedirectTarget`). The corpus MARKETING_RESEARCH_BRIEF §3 lists Real Stories as RETIRED ("never mention").  (anchor: `apps/web/app/signup/you/_components/you-card.tsx` · `setnayan.com/realstories`)
SHOTS     — (phase B)
RULE      brand.md claim 9 / corpus RETIRED list
SEVERITY  wrong
SOURCE    CODE
```

#### A1-064 · /signup page description makes a speed claim
```text
PAGE      /signup
BUTTON    —
STEPS     1. Read the page's metadata description (the search and share snippet).
EXPECTED  No speed claim.
ACTUAL    "Create a Setnayan account in seconds."  (anchor: `apps/web/app/signup/page.tsx` · `Create a Setnayan account in seconds.`)
SHOTS     — (phase B)
RULE      brand.md claim 6 (speed claims)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-065 · "Wait a minute" on /forgot-password, but the limit lasts 15 minutes
```text
PAGE      /forgot-password
BUTTON    "Email me a reset link"
STEPS     1. Ask for a reset 4 times for one address within 15 minutes. 2. Wait a minute as told and press again.
EXPECTED  The wait it really needs.
ACTUAL    The message says "Too many reset requests in a row — please wait a minute, then try again." The limits are 3 per address and 10 per IP per 15 minutes (`PER_EMAIL_WINDOW_MS = 15 * 60_000`), so a minute later it refuses again. The sign-in card's version of the same refusal says "wait a few minutes".  (anchor: `apps/web/app/forgot-password/page.tsx` · `please wait a minute, then try again`)
SHOTS     — (phase B)
RULE      design-and-wiring B6 (a failure gives the true reason)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-066 · /waitlist words: commission lines and "Pre-register"
```text
PAGE      /waitlist
BUTTON    "Pre-register your business today"
STEPS     1. Read the hero, the list and the metadata description.
EXPECTED  Only "Hosts pay 0% commission.", and no waitlist wording for suppliers, who can open a shop today.
ACTUAL    Three other commission wordings: "…verified supplier marketplace with 0% commission on bookings." (description), "No waitlist, no commission on bookings." and "Zero commission on supplier bookings — couples pay suppliers directly." The footer says "Supplier? Pre-register your business today", which reads as a waitlist although /open-shop is live.  (anchor: `apps/web/app/(shell)/waitlist/page.tsx` · `Zero commission on supplier bookings` · `Pre-register your business today`)
SHOTS     — (phase B)
RULE      brand.md claim 2 (only "Hosts pay 0% commission.")
SEVERITY  wrong
SOURCE    CODE
```

#### A1-067 · /download says "Trusted"
```text
PAGE      /download
BUTTON    —
STEPS     1. Scroll to "The same Setnayan, closer to hand."
EXPECTED  No "trusted" promise.
ACTUAL    The value heading reads "Trusted & always signed in".  (anchor: `apps/web/app/(shell)/download/page.tsx` · `Trusted & always signed in`)
SHOTS     — (phase B)
RULE      brand.md claim 10 ("safe/scam-free/guaranteed/trusted")
SEVERITY  wrong
SOURCE    CODE
```

#### A1-068 · /download sells the desktop app for planning, then says it is only for Live Watch
```text
PAGE      /download
BUTTON    "Download for Mac"
STEPS     1. Read the hero and the metadata, then the "For Live Watch only" note.
EXPECTED  One story. Per the owner's 24 Nov fix, this download is the Live Watch encoder.
ACTUAL    The hero says "your guest list, invitations, planner and seating, one launch away". The metadata says "Install Setnayan as a native desktop app… your guest list, invitations, planner and seating in their own window", and the window drawing shows "Your wedding plan". Lower down the page says "Only for streaming with Live Watch. Planning needs no install." The compatibility banner also says the Setnayan app "doesn't support" Intel Macs.  (anchor: `apps/web/app/(shell)/download/page.tsx` · `Only for streaming with Live Watch. Planning needs no install.`)
SHOTS     — (phase B)
RULE      brand.md (no claim the product does not keep) · design-and-wiring C8 (one fact, one answer)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-069 · The supplier invite contradicts itself on when partners show
```text
PAGE      /i/[slug]
BUTTON    "I already have a shop"
STEPS     1. Open another supplier's /i/<slug> signed in with a shop.
EXPECTED  One true rule about when a partner shows on the other's page.
ACTUAL    The sub-line says "You'll show on their page as a trusted partner." and the card says "Joining makes you partners at once". The note under the buttons says "…shows on your Trusted partners, and you on theirs, once you have served an event together." Signed-out visitors see only the first two. (needs the browser to confirm which is true)  (anchor: `apps/web/app/vendor/claim/[token]/_components/claim-parts.tsx` · `Joining makes you partners at once` · `apps/web/app/i/[slug]/page.tsx` · `once you have served an event together`)
SHOTS     — (phase B)
RULE      design-and-wiring C8 (one fact, one answer)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-070 · A failed read shows a 404 or "Nothing public to show yet" on a real public profile
```text
PAGE      /u/[userSlug], /u/[userSlug]/c/[chapterId]
BUTTON    —
STEPS     1. Open a public profile while the `users`, `event_members` or `events` read fails.
EXPECTED  "Couldn't read", which is different from "no such profile" and from "nothing public yet".
ACTUAL    `resolvePublicProfile` ignores every error. A failed user read returns null and the page shows a 404 (the chapter page too). A failed memberships or events read becomes `[]`, so the page shows "Nothing public to show yet" or skips the one-event redirect. Both pages are cached for 60 seconds (`revalidate = 60`), so the wrong state can be served to others.  (anchor: `apps/web/lib/public-profile.ts` · `const { data: userRow } = await admin` · `const { data: memberships } = await admin`)
SHOTS     — (phase B)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-071 · The owner's preview banner names a settings section that does not exist
```text
PAGE      /u/[userSlug]
BUTTON    —
STEPS     1. With your public profile switched off, open your own /u/<slug>.
EXPECTED  The real path, Profile & settings › Privacy › Public profile (as the You card says), ideally as a link.
ACTUAL    The banner reads "Turn it on in Profile & settings → URL & handle to share it." "URL & handle" exists only as a code comment; the section a person sees is "Privacy › Public profile". The banner has no link.  (anchor: `apps/web/app/u/[userSlug]/page.tsx` · `uprof-preview`)
SHOTS     — (phase B)
RULE      design-and-wiring A4 (every way in moves with the page)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-072 · Follow fails silently
```text
PAGE      /u/[userSlug]
BUTTON    "Follow"
STEPS     1. Signed in, press Follow on someone's profile while the follow is refused (an RLS or database error).
EXPECTED  A plain reason with Try again.
ACTUAL    The button flips to "Following", then `setState((s) => ({ ...s, following: res.following }))` flips it back with no message. `res.ok` is never read, and the action returns `{ ok: false, following: false }` on every refusal.  (anchor: `apps/web/app/u/_components/follow-button.tsx` · `following: res.following`)
SHOTS     — (phase B)
RULE      design-and-wiring B6 (a failure must look like a failure)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-073 · The chapter page claims "Papic Memories" without checking, and names the person differently
```text
PAGE      /u/[userSlug]/c/[chapterId]
BUTTON    —
STEPS     1. Open a chapter that names an event. 2. Open the same person's profile for comparison.
EXPECTED  Claims that are measured, and the same name the profile shows.
ACTUAL    "Papic Memories of candid photos + clips sit behind this chapter." shows whenever a chapter names an event. It is never checked against real Papic photos and is not a link. The byline uses `user.display_name?.trim() || 'A Setnayan creator'`, while /u uses `profileShownName` (display name, else first and last name), so a person without a display name is named on their profile and "A Setnayan creator" on their own chapter.  (anchor: `apps/web/app/u/[userSlug]/c/[chapterId]/page.tsx` · `Papic Memories of candid photos + clips sit behind this` · `'A Setnayan creator'`)
SHOTS     — (phase B)
RULE      CLAUDE.md §5 rule 4 · design-and-wiring C8 (one reader)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-074 · Sign-in, sign-up and forgot-password are self-built centred cards, not the small popup
```text
PAGE      /login, /signup, /forgot-password
BUTTON    —
STEPS     1. Open /login, /signup and /forgot-password on a 375 px phone.
EXPECTED  The owner's ruling: sign-in is a SMALL POPUP, the shared `Sheet` (half height on a phone, centred on desktop) over the shared backdrop.
ACTUAL    /login draws its own dialog: `SignInCardModal` is a `.home-reskin-ov` div with role="dialog", aria-modal="true" and a backdrop it handles itself. The CSS keeps it a centred card at every width (`align-items: flex-start; … margin: auto`). /signup draws the same card as a whole page, and /forgot-password is a full `DoorShell` page you leave the sign-in card to reach.  (anchor: `apps/web/app/login/_components/sign-in-card-modal.tsx` · `className="home-reskin-ov sn-signin-simple sn-signin-scene"`)
SHOTS     — (phase B)
RULE      SHAPE (owner, 25 Nov) · HOUSE_DESIGN_STANDARD Part K3
SEVERITY  look
SOURCE    CODE
```

#### A1-075 · The You card should be a full-screen popup
```text
PAGE      /signup/you
BUTTON    —
STEPS     1. Create an account with email.
EXPECTED  A FULL-SCREEN POPUP (`RiseScreen`). It has a photo upload and 8 or more fields, and it is part of the first run.
ACTUAL    A plain page holding a card on paper (`home-reskin-ov` › `hr-ov-card` inside a `<main>`).  (anchor: `apps/web/app/signup/you/_components/you-card.tsx` · `How should we call you?`)
SHOTS     — (phase B)
RULE      SHAPE (owner, 25 Nov)
SEVERITY  look
SOURCE    CODE
```

#### A1-076 · Two terracotta buttons in one sign-in card
```text
PAGE      /login
BUTTON    "Email me a link to set a password" / "Send a new link" + "Continue"
STEPS     1. Sign in with a password on an account that uses only Google or Apple, with an address that is not gmail. Or open an expired email link while an address is remembered, or with Google and Apple turned off.
EXPECTED  One main button per card.
ACTUAL    The provider-refusal form and the dead-link form each draw `SubmitButton className="hr-si-submit"`, which is `#c24e25` inside `.sn-signin-terra`. The email form's "Continue" is the same class, and it is visible because the email part opens whenever there is an error or a typed address. Two filled terracotta buttons show together. (needs the browser to confirm)  (anchor: `apps/web/app/login/_components/sign-in-card.tsx` · `{reset.error ? SET_PASSWORD_WORDS.retry : SET_PASSWORD_WORDS.button}`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE
```

#### A1-077 · "Report this page" opens a self-built dialog
```text
PAGE      /u/[userSlug], /u/[userSlug]/c/[chapterId]
BUTTON    "Report this page"
STEPS     1. Press Report this page on a public profile or chapter.
EXPECTED  The shared `Sheet`.
ACTUAL    A div built by hand with `role="dialog"`, `aria-modal="true"` and `fixed inset-0 z-[60]`, plus its own panel, over `OverlayBackdrop`.  (anchor: `apps/web/app/_components/report-page-button.tsx` · `fixed inset-0 z-[60] flex items-end justify-center`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part K3
SEVERITY  look
SOURCE    CODE
```

#### A1-078 · /signup's loading skeleton draws the retired two-panel layout
```text
PAGE      /signup, /signup/you
BUTTON    —
STEPS     1. Cold-load /signup on a desktop.
EXPECTED  A skeleton of the one small card the page draws.
ACTUAL    A 960 px, two-column "brand panel + form" skeleton (`max-w-[960px] … lg:grid-cols-2`). It is the layout retired 2026-09-22, and it also covers /signup/you.  (anchor: `apps/web/app/signup/loading.tsx` · `mirrors the centered .m-signup-card layout`)
SHOTS     — (phase B)
RULE      CLAUDE.md §3 Loading (the skeleton draws only what the page draws)
SEVERITY  look
SOURCE    CODE
```

#### A1-079 · Two colours stay light-only in the dark sign-in and sign-up cards
```text
PAGE      /signup, /login
BUTTON    "Create account" / "Continue" (keyboard focus) · "Tick the Terms first."
STEPS     1. Set the phone to dark mode and open /signup. 2. Press Google before ticking the box. 3. Tab to the main button.
EXPECTED  Dark pairs from the colour tokens, readable on the dark card.
ACTUAL    The terms hint keeps `color: #b04722`, about 2.6:1 on the dark card, with no dark rule. The main button's focus ring keeps `outline: 2px solid #2c2a29`, nearly the dark card's own colour, so keyboard focus disappears in dark. The rest of the card (fields, ✕, banners, Google/Apple) has its dark pairs.  (anchor: `apps/web/app/_components/home/home-reskin.css` · `.home-reskin-ov .sn-signin-terra .hr-si-terms-hint` · `outline: 2px solid #2c2a29`)
SHOTS     — (phase B)
RULE      DARK_MODE_STANDARD (SIGNED_OUT_FOLLOWS_PHONE on /login and /signup)
SEVERITY  look
SOURCE    CODE
```

> NOTES: Settings I could not see from code: anonymous onboarding is ON according to build-sessions/P0-b-SWITCHES.md. `NEXT_PUBLIC_IOS_APP_STORE_URL` is described as unset, so /download honestly shows no "iPhone app" line and no store links today. Supabase's "Secure password change" setting decides how exposed /reset-password is. Dark rendering needs the browser. Out of my pages but on a door into /signup: app/host/accept/[token] links `/signup?…&email=`, but /signup reads only `prefill_email`, so that email is never filled in. The in-page sign-in pop-up (`sign-in-here-panel.tsx`) was not audited beyond the shared `SignInCard`. Checked and fine: Google and Apple go to real provider routes (`app/auth/oauth-actions.ts` → Supabase → `/auth/callback`), Facebook is hard-off, and every `next` goes through `safeNext`, which blocks redirects to other sites (`//`, backslash, control characters, encoded forms).

### Code pass · help, Articles, legal, API page (15 pages)

#### A1-080 · A no-account (anonymous) session gets past the article sign-in gate
```text
PAGE      /articles/write, /articles/[slug]
BUTTON    "Write a post" · "Reply"
STEPS     1. On a phone, tap a side camera on an Event Hub, or start an event or use Papic while signed out. This creates an anonymous Supabase session. 2. Open /articles and press "Write a post", or open any article.
EXPECTED  A session with no account is treated as signed out. It gets the sign-in door (`/login?next=…`) and "Sign in to reply", the same way /help treats it (`user && !user.is_anonymous`).
ACTUAL    `writerState` returns `signedIn: true` for any `auth.getUser()` uid and never checks `is_anonymous`. The write sheet and the reply box therefore open, and `createChapter` → `requireUser` accepts the anonymous uid. The anonymous trigger gives these sessions a `public.users` row, and the RLS insert policies are `TO authenticated`. So a public post or reply can be published under an account that has no email. (needs the browser to confirm) (anchor: `apps/web/lib/articles.server.ts` · `export async function writerState` · `if (!uid) return { signedIn: false }`; `apps/web/app/dashboard/(account)/creator/actions.ts` · `async function requireUser`)
SHOTS     — (phase B)
RULE      CLAUDE.md §1 (zero friction: the account is asked for at save) · sign-in gate
SEVERITY  money-signin
SOURCE    CODE
```

#### A1-081 · A shared guide or topic link is a 404 for anyone signed out, not a sign-in door
```text
PAGE      /help/guides/[key], /help/topics/[key]
BUTTON    —
STEPS     1. Signed in as a host, copy /help/guides/guests or /help/topics/guests. 2. Open it signed out, or with `?for=shop` or `?for=guest`.
EXPECTED  The guide or topic, or a "Sign in to see this" door.
ACTUAL    SEEN-LIVE: https://setnayan.com/help/guides/guests → 404 and /help/topics/guests → 404, signed out. Every guide has `coverage: ['user']`, and signed out the coverage is `'public'`, so the page calls `notFound()`. A topic other than About Setnayan also 404s signed out. The canonical metadata is still emitted for those keys. (anchor: `apps/web/app/(shell)/(help-pages)/help/guides/[key]/page.tsx` · `if (!guide || !guide.coverage.includes(place.coverage)) notFound();`; `…/help/topics/[key]/page.tsx` · `topicsForCoverage(HELP_TOPICS, place.coverage).find`; `apps/web/lib/help-ask-core.ts` · `PUBLIC_COVERAGE_TOPIC`)
SHOTS     — (phase B)
RULE      design-and-wiring §B5 (every press reaches a real destination)
SEVERITY  broken
SOURCE    CODE · confirmed SEEN-LIVE
```

#### A1-082 · The answer page's topic breadcrumb points at an anchor that does not exist
```text
PAGE      /help/[slug]
BUTTON    "<topic label>" (breadcrumb) · "All help topics"
STEPS     1. Open /help/what-is-setnayan. 2. Tap the topic in the breadcrumb.
EXPECTED  The topic opens (`routes.help.topic(key)` → /help/topics/<key>). "All help topics" goes to /help/topics.
ACTUAL    SEEN-LIVE: /help/what-is-setnayan links `/help#about-setnayan`; the live /help has `id="contact"` but no `id="about-setnayan"`. The breadcrumb links to `/help#<topic.key>`, and the JSON-LD BreadcrumbList does the same. /help renders no element with that id: rows only carry `data-help-row-link`. The tap lands at the top of /help. "All help topics" links to /help, which lists only three topics. (anchor: `apps/web/app/help/[slug]/page.tsx` · ``href={`/help#${topic.key}`}``)
SHOTS     — (phase B)
RULE      design-and-wiring §A3/§B5 (route builder · real destination)
SEVERITY  broken
SOURCE    CODE · confirmed SEEN-LIVE
```

#### A1-083 · A failed Message us send hides its reason, loses the typed message, and a crafted link crashes /help
```text
PAGE      /help
BUTTON    "Send message"
STEPS     1. Send a message while the `help_messages` insert fails. 2. Or open `/help?error=%25`.
EXPECTED  A plain reason plus Try again, with the typed text kept.
ACTUAL    The action redirects with the raw database text (`encodeURIComponent(error?.message ?? …)`). The page reopens the sheet (`startOpen … search.error`) over the `role="alert"` line, with the subject and message empty. The page also runs `decodeURIComponent` a second time on an already-decoded param, so any `%` throws a URIError and the page errors. SEEN-LIVE: https://setnayan.com/help?error=%25 shows the root error screen "Something on our end didn’t work". (anchor: `apps/web/app/help/actions.ts` · `error?.message ?? 'Could not submit. Try again.'`; `apps/web/app/(shell)/help/page.tsx` · `decodeURIComponent(search.error)`)
SHOTS     — (phase B)
RULE      CLAUDE.md §5 rule 4 (honest states) · §3 Toast (failure gives a plain reason plus Try again)
SEVERITY  broken
SOURCE    CODE · confirmed SEEN-LIVE
```

#### A1-084 · A failed story read on a /help search is silently dropped
```text
PAGE      /help (with ?q=)
BUTTON    —
STEPS     1. Search on /help while the stories read fails.
EXPECTED  The page says the stories could not be read.
ACTUAL    /help passes `title="Features"`. In titled mode `HowSearchResults` returns `null` when there are no hits and never reads `storiesFailed`, so a broken read looks the same as no feature rows. (anchor: `apps/web/app/_components/how-search/how-search.tsx` · `if (title) {` · `if (hits.length === 0) return null;`)
SHOTS     — (phase B)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-085 · /api/v1 advertises a public API that is switched off
```text
PAGE      /api/v1
BUTTON    —
STEPS     1. Open /api/v1 and read the endpoints tagged "Public". 2. Call /api/v1/vendors.
EXPECTED  No public API advertised in V1. If the page stays at all, it says the API is closed and uses setnayan.com.
ACTUAL    SEEN-LIVE: /api/v1/vendors answers 404 while the page calls it public. The page says "vendor browse is public" and "Public endpoints accept any origin via CORS", and tags `/api/v1/vendors` and `/:publicId` as `auth: 'public'`. Those routes return an opaque 404 while `PUBLIC_API_ENABLED` is off. The page also lists "Coming in V1.5" features and says "Rate limiting — currently unrate-limited", which tells any reader the API has no rate limit. Every example curl uses `setnayan-platform-web.vercel.app`. (anchor: `apps/web/app/api/v1/page.tsx` · `vendor browse is public` · `currently unrate-limited`; `apps/web/app/api/v1/vendors/route.ts` · `if (!isPublicApiEnabled()) return publicApiDisabledResponse();`)
SHOTS     — (phase B)
RULE      CLAUDE.md §6 (no public API endpoints in V1) · brand.md (setnayan.com only; no COMING features)
SEVERITY  wrong
SOURCE    CODE · confirmed SEEN-LIVE
```

#### A1-086 · Banned words: Monogram, Pabuya, vendor
```text
PAGE      /help/[slug] (/help/monogram), /help/topics/[key], /privacy, /api/v1
BUTTON    —
STEPS     1. Read the answer titles, the privacy section heads and the API copy.
EXPECTED  Logo Maker or QR mark, E-Gifts, supplier.
ACTUAL    Help answer title "Customize the QR monogram". Privacy has "Gift-receiving details (Pabuya)", "If you set up Pabuya" and "Gift records (Pabuya)". /api/v1 has "Browse published vendor profiles", "vendor browse is public" and "never other vendors’ data", plus the same in its metadata description. (anchor: `apps/web/lib/help/topics-existing.ts` · `title: 'Customize the QR monogram'`; `apps/web/app/(shell)/privacy/page.tsx` · `Gift-receiving details (Pabuya)`; `apps/web/app/api/v1/page.tsx` · `Browse published vendor profiles`)
SHOTS     — (phase B)
RULE      brand.md word rules
SEVERITY  wrong
SOURCE    CODE
```

#### A1-087 · Privacy describes retired products as live (Patiktok, animated monogram)
```text
PAGE      /privacy
BUTTON    —
STEPS     1. Read "TikTok integration (Patiktok)" and Subprocessors.
EXPECTED  Retired names are never shown, and retired products are not described as current.
ACTUAL    A whole section says "Couples who use Patiktok can connect…" and "open the Patiktok page and click Disconnect TikTok". Subprocessors lists "TikTok (Patiktok only …)". The featuring section lists "an animated monogram". Patiktok has been retired since 20 Nov (`RETIRED_PRODUCT_NAMES`), and Animated Monogram is on the corpus RETIRED list. (anchor: `apps/web/app/(shell)/privacy/page.tsx` · `TikTok integration (Patiktok)` · `animated` / `monogram`; `apps/web/lib/retired-products.ts` · `RETIRED_PRODUCT_NAMES`)
SHOTS     — (phase B)
RULE      brand.md claims 9 · corpus MARKETING_RESEARCH_BRIEF § RETIRED
SEVERITY  wrong
SOURCE    CODE
```

#### A1-088 · Privacy's "Public Event Summary" promises safeguards that are not built, on a retired address
```text
PAGE      /privacy
BUTTON    —
STEPS     1. Read "Public Event Summary (post-event editorial)".
EXPECTED  The notice states only what runs.
ACTUAL    It promises an index on `setnayan.com/realstories`, which is retired and forwards to Discover (`lib/legacy-redirects.ts`). It promises a "Reminder email at T+27d" ("Your wedding goes public in 3 days…"), but no sender of that email exists in the code. It also promises a "Pseudonymization option". The event privacy page's own docblock says these guardrails "live in V1.1 iteration 0046". Internal jargon ("Phase 4 starts at T+1d") is shown to readers. (anchor: `apps/web/app/(shell)/privacy/page.tsx` · `Public Event Summary (post-event editorial)` · `Reminder email at T+27d`; `apps/web/app/dashboard/[eventId]/website/privacy/page.tsx` · `live in V1.1 iteration 0046`)
SHOTS     — (phase B)
RULE      brand.md claims 9 (nothing COMING or unbuilt) · RA 10173 notice accuracy
SEVERITY  wrong
SOURCE    CODE
```

#### A1-089 · Privacy contradicts itself and the code on which AI provider reads what
```text
PAGE      /privacy
BUTTON    —
STEPS     1. Read "Regulatory posture", then "Reading your payment receipt", then Subprocessors.
EXPECTED  One consistent, current list.
ACTUAL    "Regulatory posture" says Anthropic does "reading an uploaded payment receipt". The receipt section says "The picture is not sent to any AI company", and since 17 Nov receipts are read on the phone. A use that is live is missing from the list: suppliers' verification papers are sent to Anthropic (`readVerificationPaper`, called after every upload), but the Subprocessors Anthropic row names only Deep Search. Subprocessors also omits the Gemini and Setnayan AI uses that "Regulatory posture" names. The header still reads "last updated 2026-11-03", although git shows edits on 22 and 24 Nov. (anchor: `apps/web/app/(shell)/privacy/page.tsx` · `reading` / `an uploaded payment receipt` · `AI web research for the supplier Deep Search tool`; `apps/web/lib/verification-paper-read.server.ts` · `readVerificationPaper`; `apps/web/app/vendor-dashboard/shop/inline-docs-actions.ts` · `await readVerificationPaper(`)
SHOTS     — (phase B)
RULE      RA 10173 notice accuracy · design-and-wiring §C8 (one source)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-090 · Privacy understates how long full-size originals are kept on paid plans
```text
PAGE      /privacy
BUTTON    —
STEPS     1. Read "How long we keep things" › Photos and video.
EXPECTED  "Kept 3 months (6 on Event Pro, 12 on Event Ultra), then a 720p copy". This is the corpus wording, and the code honours the Ultra extension.
ACTUAL    The page says "full-resolution originals are kept until 3 months after the event’s last day" for everyone. Event Ultra keeps them 12 months (`fullres_extra_keep_days`). The page's own comment says the declared period binds under RA 10173. (anchor: `apps/web/app/(shell)/privacy/page.tsx` · `full-resolution originals`; `apps/web/lib/event-ultra.ts` · `full-size originals kept 12 months after the event's last day instead of 3`)
SHOTS     — (phase B)
RULE      brand.md claims 3 (originals 3/6/12 by plan) · RA 10173 storage limitation
SEVERITY  wrong
SOURCE    CODE
```

#### A1-091 · iPhone-app purchases are described as live
```text
PAGE      /refunds, /privacy, /help/[slug]
BUTTON    —
STEPS     1. Read "Purchases in the iPhone app" on /refunds and the refund answer in Help.
EXPECTED  The native iPhone app and Apple in-app purchases are not presented as live. The corpus (24 Nov) says the iPhone app is "going through Apple review" and lists Apple in-app purchases as COMING.
ACTUAL    /refunds has a section stating "Anything bought through Apple in the iPhone app is paid to Apple". The help answer says "Purchases made through Apple in the iPhone app go to Apple". /privacy hedges with "(when available in the app)". Owner call: App Review may require the pre-disclosure. (anchor: `apps/web/app/(shell)/refunds/page.tsx` · `Purchases in the iPhone app`; `apps/web/lib/help/topics-existing.ts` · `Purchases made through Apple in the iPhone app`)
SHOTS     — (phase B)
RULE      brand.md claims 8 and 9
SEVERITY  wrong
SOURCE    CODE
```

#### A1-092 · Commission wording other than "Hosts pay 0% commission."
```text
PAGE      /help, /help/[slug], /help/topics/[key], /api/v1
BUTTON    —
STEPS     1. Ask Help "commission", or open /help/does-setnayan-take-commission.
EXPECTED  Exactly "Hosts pay 0% commission."
ACTUAL    Help answers say "Couples pay 0% commission on every booking", "Couples pay 0% commission on supplier bookings", "Couples pay 0% commission: you pay suppliers directly" and "book verified Filipino suppliers at 0% commission". /api/v1 says "(0% commission, off-platform settlement)". (anchor: `apps/web/lib/help/topics-existing.ts` · `Couples pay 0% commission`; `apps/web/app/api/v1/page.tsx` · `0% commission, off-platform settlement`)
SHOTS     — (phase B)
RULE      brand.md claims 2
SEVERITY  wrong
SOURCE    CODE
```

#### A1-093 · Help answers make banned promises ("free, for good", "always free", "Data Privacy Act compliant")
```text
PAGE      /help, /help/[slug], /help/topics/[key]
BUTTON    —
STEPS     1. Open /help/how-are-vendors-verified and /help/how-does-setnayan-handle-privacy. 2. As a shop, open /help/topics/messaging?for=shop.
EXPECTED  No price promises, and no "Data Privacy Act compliant" slogan.
ACTUAL    "Verification is free, for good". "getting Verified is free, for good". The shop Messaging topic line reads "Reply to couples. It is always free.", and the topic page renders `tile.line`. The privacy answer opens with "RA 10173 (Data Privacy Act of the Philippines) compliant." (anchor: `apps/web/lib/help/topics-existing.ts` · `Verification is free, for good` · `RA 10173 (Data Privacy Act of the Philippines) compliant.`; `apps/web/app/_components/help-ask/help-ask-places.ts` · `It is always free.`)
SHOTS     — (phase B)
RULE      brand.md claims 3 and 13
SEVERITY  wrong
SOURCE    CODE
```

#### A1-094 · Answer buttons use accent-outline and the info colour beside the one main button
```text
PAGE      /help (search results), /help/topics/[key], /help/guides/[key]
BUTTON    "Take me there" (in an answer row) · "Message us"
STEPS     1. Search /help, get a Best answer, then open a "More answers" row. 2. Or open any answer on a topic page.
EXPECTED  One terracotta main button per screen. Every other button is neutral or a text link.
ACTUAL    `Door` draws `tone="brand"` without `main` (terracotta outline) in every `AnswerRows` row, so it sits beside the Best answer's filled "Take me there". "Message us" is `tone="info"` (blue outline) in `AnswerWays`, `NoAnswer` and `AnswerFeedback`. (needs the browser to confirm how loud `--color-info` reads) (anchor: `apps/web/app/_components/help-ask/help-ask-view.tsx` · `function Door` · `tone="info"`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE
```

#### A1-095 · The Report popup on articles is a hand-rolled dialog
```text
PAGE      /articles/[slug]
BUTTON    "Report"
STEPS     1. Open an article and press "Report" on the article or on a reply.
EXPECTED  The shared `Sheet`.
ACTUAL    `ReportPageButton` builds its own `role="dialog" aria-modal="true"` `fixed inset-0` panel. It does use the shared `OverlayBackdrop`. Its heading reads "Report this page" even when you are reporting a reply. (anchor: `apps/web/app/_components/report-page-button.tsx` · `role="dialog"`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part K3
SEVERITY  look
SOURCE    CODE
```

#### A1-096 · Write a post is a separate page, not a full-screen popup
```text
PAGE      /articles/write
BUTTON    "Write a post" · "Close" (✕)
STEPS     1. From /articles?tag=venues, press "Write a post". 2. Press ✕.
EXPECTED  A FULL-SCREEN POPUP (`RiseScreen`) over the feed, where ✕ returns to the same place. The drawing says it "rises full screen".
ACTUAL    It is its own route. ✕ is a hard `<Link href="/articles">`, so it drops the tag, the sort and the scroll. (anchor: `apps/web/app/(shell)/articles/_components/write-sheet.tsx` · `href="/articles" aria-label="Close"`)
SHOTS     — (phase B)
RULE      SHAPE (owner, 25 Nov)
SEVERITY  look
SOURCE    CODE
```

#### A1-097 · The Message us form is five fields in a half-height sheet
```text
PAGE      /help
BUTTON    "Message us"
STEPS     1. Press "Message us" on a phone.
EXPECTED  A Sheet holds about 3 fields or fewer. Anything longer is a FULL-SCREEN POPUP.
ACTUAL    Email, name, topic, subject and a 5-row message box, plus Send, sit in a `Sheet` that opens at half height. The 21 Nov drawing chose a Sheet; the 25 Nov shape rule says otherwise. (needs the browser to confirm the height) (anchor: `apps/web/app/_components/help-ask/message-us.tsx` · `<Sheet open={open} onClose={close}`)
SHOTS     — (phase B)
RULE      SHAPE (owner, 25 Nov)
SEVERITY  look
SOURCE    CODE
```

#### A1-098 · Two pages sit outside the house shell
```text
PAGE      /help/[slug], /api/v1
BUTTON    —
STEPS     1. Open /help/what-is-setnayan on a phone. 2. Open /api/v1.
EXPECTED  The page sits inside the one shell, like /help/topics/[key]. Lists use hairline rows, not bordered cards.
ACTUAL    /help/[slug] draws its own `<header>` with `<Logo>`. Its "All help topics" link is `hidden` on a phone, and there is no shell and no bottom nav. This is deliberate, so the page can be prerendered (comment in `app/(shell)/help/page.tsx`). /api/v1 is also unshelled, and each endpoint is a bordered card (`rounded-2xl border border-ink/10 bg-cream p-5`). (anchor: `apps/web/app/help/[slug]/page.tsx` · `<Logo height={32} withWordmark title="Setnayan · Help" />`; `apps/web/app/api/v1/page.tsx` · `rounded-2xl border border-ink/10 bg-cream p-5`)
SHOTS     — (phase B)
RULE      design-and-wiring §A2 · CLAUDE.md §3 (one shell) · Part H (no bordered example cards)
SEVERITY  look
SOURCE    CODE
```

#### A1-099 · The loading screens are empty, so the content area blanks while data reads
```text
PAGE      /help, /help/topics, /articles, /articles/write, /privacy, /privacy/google-access, /terms, /refunds, /cookies, /acceptable-use
BUTTON    —
STEPS     1. From the rail, open /articles on a slow connection.
EXPECTED  A skeleton that draws what the page draws (`Sk` / `Ghost`), so loading looks different from empty and from failure.
ACTUAL    Every `loading.tsx` returns `null`. This is deliberate ("the shared shell is already painted"), but /articles runs three database reads behind a blank frame. (anchor: `apps/web/app/(shell)/articles/(list)/loading.tsx` · `return null;`; `apps/web/app/(shell)/help/loading.tsx` · `return null;`)
SHOTS     — (phase B)
RULE      CLAUDE.md §3 Loading · CLAUDE.md §5 rule 4 (loading, empty and failure never look alike)
SEVERITY  look
SOURCE    CODE
```

> NOTES:
> - **Not opened:** the corpus drawings. Of the corpus, I read only the 24 Nov marketing brief, for the COMING and RETIRED lists, through `gh api`.
> - **Partly read:** the ~3,000 lines of help answer text were scanned with targeted greps for banned words and claims, not read line by line.
> - **Production flag:** I could not see whether `PUBLIC_API_ENABLED` is set in production. If it is on, the /api/v1 finding becomes "a public API is live, against CLAUDE.md §6".
> - **Event Pro retention:** the 6-month figure comes from the corpus. The per-plan days live in the catalog row (`fullres_extra_keep_days`), which I did not read.
> - **Needs the browser:** the Sheet's opening height, how bright `--color-info` reads, and the anonymous-session path on /articles.
> - **Checked and fine:** every route linked from the legal pages exists, every in-page anchor on /privacy has a matching id, and the "Take me there" door targets exist.

### Code pass · the website's core pages (12 pages + 2 forwards)

#### A1-100 · A failed catalog read makes the paid plans disappear, as if nothing is for sale
```text
PAGE      /, /pricing, /pricing/plan
BUTTON    "See the Free plan" (/) · — (/pricing, /pricing/plan)
STEPS     1. platform_retail_catalog_v2 read fails (error, or no service key). 2. Open each page signed out.
EXPECTED  A "Couldn't read the prices" line where the paid plans and add-ons go. Never a page that looks complete with no paid plans.
ACTUAL    `fetchV2CustomerCatalog` returns [] on error. All plan prices become null, so every paid row is dropped and nothing says the read failed. Home shows only the ₱0 Free row under "See the Free plan". /pricing shows only "Included with every event" under "Make it even more yours. Each one is its own purchase". /pricing/plan asks no paid question and hides "Plans for your event". Related: /pricing always marks "Papic credits, first event" as Included without reading the free-grant switch, which Home does read (`readPapicFreeGrantRead`). (anchors: `apps/web/lib/v2-catalog.ts` · `if (error || !data) return [];` · `apps/web/app/_components/frontdoor/front-door.tsx` · `fetchV2CustomerCatalog().catch(() => [])` · `apps/web/app/_components/frontdoor/front-door-landing.tsx` · `'See the Free plan'` · `apps/web/app/(shell)/pricing/page.tsx` · `name: 'Papic credits, first event'` · `apps/web/app/(shell)/pricing/plan/page.tsx` · `planRows.length > 0 ?`)
SHOTS     — (phase B)
RULE      CLAUDE.md §5 rule 4 (honest states) · brief: a failed catalog read never shows an empty plan table as if true
SEVERITY  money-signin
SOURCE    CODE
```

#### A1-101 · Plan contents contradict between pages (Event Plus vs Event Pro, how long originals are kept)
```text
PAGE      /, /pricing/plan, /features/logo-maker
BUTTON    "Event Plus" plan row (/) · "Yes" on "Do you want the Event Hub to look like yours?" (/pricing/plan)
STEPS     1. On /, open Plans → Event Plus. 2. Compare with /pricing and the Event Pro row. 3. Take the quiz on /pricing/plan.
EXPECTED  One story everywhere (corpus §6 and /pricing): Event Plus = the whole Event Hub plus credits; Event Pro adds Setnayan AI; originals kept 3 months (Free), 6 months (Event Pro), 12 months (Event Ultra).
ACTUAL    - Home's Event Plus one-liner says "Setnayan AI and Papic credits for your event." Its own list, the Pro row ("Everything in Event Plus · Setnayan AI…") and /pricing ("Setnayan AI comes with Event Pro") all say the AI is Event Pro's.
          - Home's Memories ⓘ says full-size photos stay "three months… (twelve with Event Ultra)" and leaves out Event Pro's six months (fullres_extra_keep_days = 92 on Pro, migration 20271356433378).
          - The quiz sells Event Pro for "Your photos, music, themes and logo", which Event Plus already gives. Its Plus question ("A cleaner Event Hub and more of your photos") never says the whole Event Hub. So a yes there quotes the higher price.
          - /features/logo-maker says "The animated logo comes with Event Pro", but Event Plus holds the Logo & QR part (EVERYTHING_PEEK).
          (anchors: `apps/web/app/_components/frontdoor/front-door-landing.tsx` · `one="Setnayan AI and Papic credits for your event."` · `(twelve with Event Ultra)` · `apps/web/app/(shell)/pricing/plan/_plan-steps.ts` · `'Do you want the Event Hub to look like yours?'` · `apps/web/lib/feature-pages/invite.ts` · `'The animated logo comes with Event Pro.'`)
SHOTS     — (phase B)
RULE      CLAUDE.md §4 (one reader per shared fact) · brand.md (product facts from the corpus)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-102 · "0% commission" wording other than the one allowed line, and the booking fee shown to hosts
```text
PAGE      /, /pricing, /features, /tl/features, /about, /tl/about, /our-story
BUTTON    —
STEPS     1. Read the host-facing copy and metadata on each page.
EXPECTED  Only the exact sentence "Hosts pay 0% commission." The supplier booking fee is never shown to hosts or guests.
ACTUAL    Other 0% wordings:
          - /: "You pay them directly. 0% commission." and the meta description "…at 0% commission."
          - /pricing: "Find, compare, book — 0% commission."
          - /features and /tl/features: "0% commission, Filipino-first" and "rarely 0% commission".
          - /about and /tl/about: "0%-commission marketplace" and "zero commission".
          - /our-story: "with 0% commission on every booking".
          /pricing's meta, OpenGraph and Twitter descriptions also tell hosts "Suppliers pay Setnayan a booking fee, …".
          (anchors: `apps/web/app/(hub)/page.tsx` · `HOME_DESCRIPTION` · `apps/web/app/_components/frontdoor/front-door-landing.tsx` · `0% commission.` · `apps/web/app/(shell)/pricing/page.tsx` · `Suppliers pay Setnayan a booking fee` · `apps/web/app/features/_sections/_WhySetnayan.tsx` · `'0% commission, Filipino-first'` · `apps/web/app/(shell)/our-story/page.tsx` · `0%`)
          Note: corpus MARKETING_RESEARCH_BRIEF_2026-11-24 §8 says "Host pages may say '0% commission'", which conflicts with brand.md. The owner should settle which rule holds. Same rule as the finding-suppliers group's commission entry and the /waitlist, Help and /setnayan-ai entries — fix together.
SHOTS     — (phase B)
RULE      brand.md claims #2
SEVERITY  wrong
SOURCE    CODE
```

#### A1-103 · Price promises ("free to stay", "for good", "forever")
```text
PAGE      /for-suppliers, /features/supplier-plans, /tl/features/supplier-plans, /about, /tl/about
BUTTON    —
STEPS     1. Read the hero, plans and FAQ copy.
EXPECTED  No "free for life" or "always free" style promises.
ACTUAL    - /for-suppliers: "Free to start. Free to stay. No card needed.", "No hurry. Free stays free.", "Free / stays free", and the meta "Free to start, free to stay."
          - /features/supplier-plans: "Free costs nothing, for good" (twice); the Tagalog page says "Libre ang Free, habambuhay".
          - /about FAQ: "Verification is free, for good".
          - /about: "0% commission, ever"; /tl/about: "0% commission, forever".
          - /features (SEEN-LIVE): FaceBlock row "Opted-out guests are blurred everywhere. Always free." (the corpus brief itself says "Always free" for FaceBlock — same brand.md conflict).
          - /creators (SEEN-LIVE): "₱0 to publish, forever" — see the finding-suppliers group.
          (anchors: `apps/web/app/for-suppliers/_components/supplier-front-page.tsx` · `FREE_LINE` · `lede="No hurry. Free stays free."` · `apps/web/lib/feature-pages/suppliers-b.ts` · `for good` · `habambuhay` · `apps/web/lib/help/topics-existing.ts` · `Verification is free, for good` · `apps/web/app/(shell)/tl/about/page.tsx` · `'0% commission, forever'`)
          Note: /for-suppliers is the owner-approved 23 Nov drawing, so this is a drawing vs brand.md conflict for the owner.
SHOTS     — (phase B)
RULE      brand.md claims #3
SEVERITY  wrong
SOURCE    CODE · confirmed SEEN-LIVE
```

#### A1-104 · "Trust" promises about suppliers
```text
PAGE      /, /features
BUTTON    —
STEPS     1. On /, read the "Plan it · Suppliers" section. 2. On /features, open Compare → Supplier plans.
EXPECTED  No "trusted" style marketing promise about suppliers.
ACTUAL    (SEEN-LIVE on /.) The Home heading is "Suppliers you can trust." The /features Verified plan's tag is "Trusted." (anchors: `apps/web/app/_components/frontdoor/front-door-landing.tsx` · `Suppliers you can trust.` · `apps/web/lib/features-page.ts` · `tag: 'Trusted.'`) Note: HOUSE_DESIGN_STANDARD H4 names the Home section "Suppliers you can trust", so the standard and brand.md conflict here.
SHOTS     — (phase B)
RULE      brand.md claims #10
SEVERITY  wrong
SOURCE    CODE · confirmed SEEN-LIVE
```

#### A1-105 · Rank and comparison claims ("the first", "other wedding apps", "elsewhere")
```text
PAGE      /about, /tl/about, /features, /tl/features
BUTTON    —
STEPS     1. Read the /about hero and meta. 2. Read "Why Setnayan" and its FAQ on /features.
EXPECTED  No "first/#1/only" claims and no comparisons with other products.
ACTUAL    - /about hero and meta: "the first built here to do the whole event in one place"; /tl/about: "ang una ditong gawa".
          - /about and /tl/about: "Not a foreign directory with a Philippine filter".
          - /features (EN and TL): "How is Setnayan different from other wedding apps?", "What does Setnayan bring that I can't get elsewhere?", "adds what the others don't have", "rarely 0% commission", and the "What you'd otherwise juggle" rows.
          - The same section says the AI shortlist is "woven into the same free platform", but Setnayan AI is paid.
          (anchors: `apps/web/app/(shell)/about/_about-motion.tsx` · `the first built here` · `apps/web/app/(shell)/about/page.tsx` · `PAGE_DESCRIPTION` · `apps/web/app/(shell)/tl/about/page.tsx` · `ang una ditong gawa` · `apps/web/app/features/_sections/_WhySetnayan.tsx` · `WHY_FAQ`)
SHOTS     — (phase B)
RULE      brand.md claims #11 and #12 · MARKETING_RESEARCH_BRIEF §8 (no competitor comparisons)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-106 · Retired reels (Patiktok) still sold as live
```text
PAGE      /features, /tl/features, /our-story
BUTTON    —
STEPS     1. Read "Why Setnayan" on /features. 2. Read the /our-story hero and "What Setnayan is".
EXPECTED  Patiktok and reels are retired (20 Nov) and never mentioned.
ACTUAL    - /features: "live per-guest Memories, personal video reels", "a personal reel", "souvenir reel", and the card "every guest gets their own face-tagged photos and a personal video reel". /tl/features says the same in Tagalog.
          - /our-story: "Every guest goes home with a personal highlight reel", "a personal highlight reel of the moments", and "can build a personal highlight reel".
          (anchors: `apps/web/app/features/_sections/_WhySetnayan.tsx` · `personal video reels` · `apps/web/app/_components/marketing/OurStory.tsx` · `Every guest goes home with a personal highlight reel` · `apps/web/app/(shell)/our-story/page.tsx` · `personal highlight reel`)
SHOTS     — (phase B)
RULE      brief: retired names never shown · corpus MARKETING_RESEARCH_BRIEF §3 RETIRED
SEVERITY  wrong
SOURCE    CODE
```

#### A1-107 · "Monogram" where the house word is Logo Maker
```text
PAGE      /features/logo-maker, /tl/features/logo-maker, /about, /tl/about
BUTTON    —
STEPS     1. Open /features/logo-maker and read the tab title. 2. Read "Software, not an agency" on /about.
EXPECTED  Logo Maker; never Monogram (and the Animated Monogram product is retired).
ACTUAL    The tab and SERP title is "Wedding Monogram and Logo Maker · Setnayan"; the Tagalog one is "Monogram at Logo Maker sa Kasal". /about and /tl/about list "bespoke monograms" among the in-app services. (anchors: `apps/web/lib/feature-pages/invite.ts` · `title: { en: 'Wedding Monogram and Logo Maker'` · `apps/web/app/(shell)/about/page.tsx` · `bespoke monograms`)
SHOTS     — (phase B)
RULE      brand.md word rules
SEVERITY  wrong
SOURCE    CODE
```

#### A1-108 · "Pabuya" and "Safe" on the /features E-Gifts rows
```text
PAGE      /features
BUTTON    "Pabuya e-gifts" row · "Send a gift (Pabuya)" row
STEPS     1. Choose "I am: Hosts" or "Guests" and scroll to the gift rows. 2. Open the row's ⓘ.
EXPECTED  E-Gifts; no "safe" marketing promise.
ACTUAL    (SEEN-LIVE on /features: "Pabuya e-gifts".) The rows are named "Pabuya e-gifts" and "Send a gift (Pabuya)". The ⓘ says "Safe, traceable, from anywhere." (anchors: `apps/web/lib/features-page.ts` · `name: 'Pabuya e-gifts'` · `'Send a gift (Pabuya)'` · `why: 'Safe, traceable, from anywhere.'`)
SHOTS     — (phase B)
RULE      brand.md word rules · brand.md claims #10
SEVERITY  wrong
SOURCE    CODE · confirmed SEEN-LIVE
```

#### A1-109 · /features advertises "Coming" features and shows internal build-lane names to the public
```text
PAGE      /features
BUTTON    ⓘ on any "Coming" row (e.g. "Setnayan marks by plan", "Event chats…", "A public sample shop (SetnaProd)")
STEPS     1. Pick a persona. 2. Tap ⓘ on a row with the Coming chip, or on a live row that has a plan note.
EXPECTED  No feature that is not yet live, and no internal planning words.
ACTUAL    Planned rows are listed with a "Coming" chip. Their ⓘ prints "Planned · Build 6 · Lane L", "Planned · Queued after Build 6 (ruling 11 Nov)" and "Planned · Build 3 spec". Live rows print "Live · still to come: Phone autofill tokens: Build 5 Lane P". One row name exposes the internal "SetnaProd". `the-public-page-shows-no-internals.test.ts` only catches paths, snake_case and code spans, so none of this is caught. (anchors: `apps/web/app/features/_row-sheet.tsx` · `` `Planned · ${f.plan ?? 'next'}` `` · `apps/web/lib/features-page.ts` · `status: 'coming'` · `plan: 'Build 6 · Lane L'`) Note: the owner-approved v3 (11 Nov) shows Coming chips by design, which conflicts with brand.md #9.
SHOTS     — (phase B)
RULE      brand.md claims #9 · MARKETING_RESEARCH_BRIEF §3 COMING
SEVERITY  wrong
SOURCE    CODE
```

#### A1-110 · /features supplier plans are typed by hand and wrong
```text
PAGE      /features, /tl/features/supplier-plans
BUTTON    "Compare" → "Supplier plans"
STEPS     1. On /features, open Compare → Supplier plans. 2. Read the Tagalog FAQ on /tl/features/supplier-plans.
EXPECTED  Plan facts read from TIER_CAPS: live cards 1 · 3 · 15 · no limit · no limit; people beyond the owner 0 · 0 · 2 · no limit · no limit; branches on Pro and Ultra. Billing is monthly.
ACTUAL    - Verified shows "Unlimited live cards" (cap is 3).
          - Plus shows "One person, no friction… Operate the business alone" (Plus allows the owner plus 2 people).
          - Pro shows "Team seats" as if seats start there; Ultra shows "Branches and a bigger team", which Pro already has.
          - The Tagalog FAQ says paid plans are prepaid "bawat apat na linggo" (every four weeks), while the English says monthly.
          (anchors: `apps/web/lib/features-page.ts` · `SUPPLIER_PLANS` · `'Unlimited live cards'` · `apps/web/lib/vendor-tier-caps.ts` · `serviceCardsTotal: 3` · `apps/web/lib/feature-pages/suppliers-b.ts` · `bawat apat na linggo`)
SHOTS     — (phase B)
RULE      CLAUDE.md §4 / design-and-wiring C8 (plan limits from TIER_CAPS only)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-111 · /about and /tl/about state stale or false product facts
```text
PAGE      /about, /tl/about
BUTTON    —
STEPS     1. Read the hero, "Software, not an agency" and the FAQ.
EXPECTED  The current facts.
ACTUAL    - /about gives the name's meaning as "that's all set". The 19 Nov correction is "let's get that set" (lib/seo/ai-answers.ts and the help copy).
          - /about and /tl/about call the free single-camera stream "(Live Watch)", but Live Watch is the paid every-camera unlock.
          - /tl/about FAQ: "Bayad ang premium tools tulad ng Setnayan AI, Event Hub, at premium RSVP" (says the Event Hub and RSVP are paid; both are free).
          - /tl/about FAQ: "isang Papic camera sa bawat event" (cameras are unlimited; the per-camera hand-out is retired).
          - /about FAQ opens with "RA 10173 (Data Privacy Act of the Philippines) compliant." while NPC registration is "in progress".
          (anchors: `apps/web/app/(shell)/about/_about-motion.tsx` · `“that’s all set”` · `apps/web/app/(shell)/tl/about/page.tsx` · `Bayad ang premium tools tulad ng Setnayan AI, Event Hub, at premium RSVP.` · `gaya ng isang Papic camera sa bawat event` · `apps/web/lib/help/topics-existing.ts` · `RA 10173 (Data Privacy Act of the Philippines) compliant.`)
SHOTS     — (phase B)
RULE      brand.md (product facts from the corpus) · brand.md claims #13
SEVERITY  wrong
SOURCE    CODE
```

#### A1-112 · Host "start" buttons send a stranger to sign-up instead of /start
```text
PAGE      /features, /tl/features, /features/[slug], /tl/features/[slug], /about, /tl/about
BUTTON    "Start planning · free" · "Magsimula · libre" · "Create your account" · "Gumawa ng account"
STEPS     1. Signed out, press the host start button in the close, in a row's ⓘ, or on a feature page.
EXPECTED  /start, so the host begins with no account and is asked for one at save. Home, /pricing and the quiz all do this.
ACTUAL    These buttons go to /signup and ask for an account first. (anchors: `apps/web/app/features/_sections/_FinalCTA.tsx` · `href="/signup"` · `apps/web/app/features/_row-sheet.tsx` · `{ href: '/signup', label: 'Start planning · free' }` · `apps/web/app/features/_feature-page.tsx` · `{ href: '/signup', label: w.startHost }` · `apps/web/app/(shell)/about/page.tsx` · `Create your account`)
SHOTS     — (phase B)
RULE      CLAUDE.md §1 (zero friction: an account is asked for at save)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-113 · "Browse suppliers" and "Try it" put a stranger on the sign-in page
```text
PAGE      /about, /tl/about, /features/marketplace, /tl/features
BUTTON    "Browse suppliers" · "Try it" / "Subukan" (Marketplace)
STEPS     1. Signed out, press the button.
EXPECTED  A page the stranger can use (the public /suppliers directory exists and /features/marketplace already links it), or a label that says sign-in comes first.
ACTUAL    The href is `/?browse=1`. Signed out, `signedOutRedirect` turns any supplier-view parameter into /login?next=…. (anchors: `apps/web/lib/feature-pages/plan-b.ts` · `tryHref: '/?browse=1'` · `apps/web/app/(shell)/about/page.tsx` · `href="/?browse=1"` · `apps/web/lib/discover-six-parts.ts` · `signedOutRedirect`)
SHOTS     — (phase B)
RULE      design-and-wiring B5/B6 (the press reaches what it names)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-114 · Peso amounts formatted outside lib/php.ts
```text
PAGE      /, /pricing, /pricing/plan, /features, /features/[slug], /tl/features/[slug]
BUTTON    —
STEPS     1. Look at any plan or feature price.
EXPECTED  formatPhp / formatPhpRounded.
ACTUAL    Each builds "₱" + `formatPeso(n)` (lib/v2-catalog-pure.ts) by hand. (anchors: `apps/web/app/_components/frontdoor/front-door-landing.tsx` · `₱{formatPeso(php)}` · `apps/web/app/(shell)/pricing/page.tsx` · ``const peso = (n: number) => `₱${formatPeso(n)}` `` · `apps/web/app/(shell)/pricing/plan/_plan-quiz.tsx` · `const peso` · `apps/web/lib/feature-pages/price.ts` · `featurePriceLabel`)
SHOTS     — (phase B)
RULE      CLAUDE.md §1 (money only through lib/php.ts)
SEVERITY  wrong
SOURCE    CODE
```

#### A1-115 · Two accent buttons in one scope
```text
PAGE      /, /features, /tl/features, /about, /tl/about
BUTTON    "What are you planning? →" + "Start your event — free" (/) · "Start planning · free" + "Open a shop · free" (/features) · "How it works" + "See transparent pricing" and "Create your account" + "Browse suppliers" (/about, /tl/about)
STEPS     1. Scroll to each page's close (and the "Software, not an agency" block on /about).
EXPECTED  One main (terracotta) button per scope; every other button neutral or a text link.
ACTUAL    - /: the close's `fd-btn-terra` and the sticky thumb bar's `fd-btn-terra` are both on screen at the close. The bar is `position: sticky` at the bottom inside `.fl-landing`, which holds the close. SEEN-LIVE at 375 px: at the close both "What are you planning? →" and "Start your event — free" are filled terracotta in the same 812 px screen. /about SEEN-LIVE: "How it works" + "See transparent pricing" side by side (same row), and "Create your account" + "Browse suppliers".
          - /features close: a mulberry-filled `btnFill` beside a mulberry-tinted, mulberry-outlined `btnLine`. The code comment says "TWO EQUAL buttons".
          - /about and /tl/about: two `actionButtonClass('brand', { main: true })` side by side, twice.
          (anchors: `apps/web/app/_components/frontdoor/front-door-landing.tsx` · `fl-cta-bar` · `apps/web/app/features/_sections/_FinalCTA.tsx` · `` `${s.btn} ${s.btnLine}` `` · `apps/web/app/(shell)/about/page.tsx` · `actionButtonClass('brand', { main: true`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE · confirmed SEEN-LIVE
```

#### A1-116 · Heroes and closes do not carry the one terracotta button
```text
PAGE      /, /features, /tl/features, /pricing, /pricing/plan, /features/[slug], /our-story
BUTTON    "Start your event" · "Start planning · free" · "Try it" · "Start your wedding · free"
STEPS     1. Look under each hero and in each close.
EXPECTED  Part H3: under the hero, the one terracotta button (48 px); the close is h2 → one terracotta button → fine print.
ACTUAL    - The / hero (`FrontDoorAnchor`) has no button, only the type shelf and chips (SEEN-LIVE at 375 px: the first screen holds no terracotta button; the sticky "Start your event — free" appears only after scrolling). (H4 for Home lists the shelf right after the hero, so the standard is ambiguous here.)
          - The /features hero has only the "I am" PickMenu.
          - /pricing, /pricing/plan, /features/[slug] and /our-story paint their main button with the legacy mulberry `.m-btn-primary` / `--m-mulberry` instead of terracotta.
          (anchors: `apps/web/app/_components/frontdoor/front-door-anchor.tsx` · `FrontDoorAnchor` · `apps/web/app/features/_sections/_Hero.tsx` · `PersonaPicker` · `apps/web/app/globals.css` · `.m-btn-primary { background: var(--m-mulberry)` · `apps/web/app/features/_feature-page.tsx` · `PRIMARY_CTA`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part H3 · Part I.1 (one flat accent: terracotta)
SEVERITY  look
SOURCE    CODE · confirmed SEEN-LIVE
```

#### A1-117 · Layers on /pricing with no shared dim-and-blur backdrop
```text
PAGE      /pricing, /pricing/plan
BUTTON    ⓘ on any price row, Why point or quiz line · "Add to an event" (signed in)
STEPS     1. Tap an ⓘ on a phone. 2. Signed in, press "Add to an event" on Event Pro, Plus or Ultra.
EXPECTED  Every layer on top uses the shared parts: dim plus blur, the page behind inert, a tap on the backdrop closes it.
ACTUAL    - These pages still use the older `InfoTip` popover, which has no backdrop, so the page behind stays usable. The shared `<Explain>` does dim and blur on a phone.
          - The signed-in `AddToEvent` dialog is hand-rolled: `fixed inset-0`, its own unblurred `bg-[var(--m-ink)]/30` scrim, and its own `role="dialog"` `aria-modal`. Its trigger is a mulberry-filled pill.
          (anchors: `apps/web/app/_components/info-tip.tsx` · `<InfoTip>` · `apps/web/app/(shell)/pricing/_pricing-pickers.tsx` · `PriceRowShell` · `apps/web/app/_components/marketing/add-to-event.tsx` · `fixed inset-0 z-50` · `aria-modal="true"`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part K3
SEVERITY  look
SOURCE    CODE
```

#### A1-118 · /pricing and /features do not follow the Part H page order; /pricing spreads the accent everywhere
```text
PAGE      /pricing, /features, /tl/features
BUTTON    —
STEPS     1. Scroll each page top to bottom.
EXPECTED  - /pricing (H4): hero (short, so the first prices show without a swipe) → event plans → included → add-ons → supplier plans → close.
          - /features (H4): hero → Plan it · Live it · Keep it → three doors → why Setnayan → "See every feature" → close ("Free is complete. Pay for the show.").
ACTUAL    - /pricing is still the 25 Oct prototype: hero → Why Setnayan → Better together → prices. In the prices, Event Pro and Ultra come first, then the day add-ons, then Event Plus last under "A nicer, bigger event". The supplier plans sit inside the close, after its button.
          - /pricing paints every price, every ◆ and the whole "Why" band terracotta (`text-terracotta-700`, `bg-terracotta/[0.07]`), and the lock is an icon tile.
          - /features (v3, 11 Nov): hero → persona chapters → "Nothing is typed twice" → plans compare → Why → How → close.
          (anchors: `apps/web/app/(shell)/pricing/page.tsx` · `2 · WHY SETNAYAN` · `<Moment>A nicer, bigger event</Moment>` · `apps/web/app/features/_PageBody.tsx` · `FeaturesPageBody`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part H4 · Part I.1, I.2
SEVERITY  look
SOURCE    CODE
```

#### A1-119 · /features lists examples in shadowed, bordered cards with tinted icon tiles
```text
PAGE      /features, /tl/features
BUTTON    —
STEPS     1. Scroll to "Three apps' worth, in one" and "Who's who on Setnayan".
EXPECTED  Plan rows with hairlines between them; no bordered or shadowed cards to list examples; no tinted icon tiles.
ACTUAL    - The "juggle", "brings" and FAQ lists are `shadow-sn-frame` cards; each "brings" card has a `bg-terracotta/10` icon tile.
          - The role cards are `rounded-xl border border-ink/10 bg-cream p-5`, with the same icon tiles.
          (anchors: `apps/web/app/features/_sections/_WhySetnayan.tsx` · `shadow-sn-frame p-5` · `bg-terracotta/10 text-terracotta` · `apps/web/app/features/_sections/_HowItWorks.tsx` · `rounded-xl border border-ink/10 bg-cream p-5`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part H3 (never a bordered card to list examples) · Part I.2, I.4
SEVERITY  look
SOURCE    CODE
```

#### A1-120 · Multi-step flows are pages, not full-screen popups
```text
PAGE      /pricing/plan, /start
BUTTON    "See what Setnayan does for you →" (/pricing) · "What are you planning? →", "All N kinds →", "I'm hosting" (/)
STEPS     1. Open the quiz from /pricing. 2. Open /start from any Home door.
EXPECTED  - The quiz: a RiseScreen over /pricing; ✕ returns to the same place (it is a multi-screen flow whose steps are not in the URL).
          - /start: the owner ruled creating an event is a full-screen popup (signed in, create-event already opens as a modal).
ACTUAL    Both are their own pages inside the shell. The quiz's Back and refresh lose its step; its "Close" is a link to /pricing. (anchors: `apps/web/app/(shell)/pricing/plan/_plan-quiz.tsx` · `PlanQuiz` · `apps/web/app/(shell)/start/page.tsx` · `StartPage`)
SHOTS     — (phase B)
RULE      SHAPE (owner, 25 Nov)
SEVERITY  look
SOURCE    CODE
```

#### A1-121 · /start has no `<main>` landmark
```text
PAGE      /start
BUTTON    —
STEPS     1. Open /start with a screen reader or landmarks view.
EXPECTED  The page keeps its own `<main>`, because the doorway shell gives the landmark to the page.
ACTUAL    The doorway shell renders a `<div>` (`MainEl = ownsMain ? 'div' : 'main'`), and /start renders a plain `<div>`, so the page has no main landmark. (anchors: `apps/web/app/(shell)/start/page.tsx` · `data-start-picker=""` · `apps/web/app/_components/frontdoor/front-door-shell.tsx` · `const MainEl = ownsMain ? 'div' : 'main'`)
SHOTS     — (phase B)
RULE      CLAUDE.md §3 (one shell, one `<main>`)
SEVERITY  look
SOURCE    CODE
```

> NOTES:
> - **Machine-read only, so not reported as findings:**
>   - On /, the JSON-LD `softwareAppJsonLd.description` says the AI comes inside Event Plus and Event Pro, while its `featureList` says Event Pro and Event Ultra.
>   - Its `operatingSystem` lists iOS and Android.
>   - /pricing JSON-LD lists every active customer SKU, so a retired PATIKTOK_COMPILER or PAKANTA row would appear there if it is still `is_active` (prod rows not checked).
> - **Corpus:** I read only HOUSE_DESIGN_STANDARD_2026-11-20 and MARKETING_RESEARCH_BRIEF_2026-11-24 (via gh api). I did not open the prototypes or DECISION_LOG. Where a finding says "the drawing or v3 approves this", the owner may have overridden brand.md and that is unverified. The "0% commission" wording conflict between brand.md and MARKETING_RESEARCH_BRIEF §8 needs an owner ruling.
> - **Needs the browser:** that the close button and the sticky bar on / overlap on screen, and how InfoTip behaves on a phone.
> - **Not audited:** the shared chrome (shell, top bar, rail, footer), as instructed.

### Code pass · a supplier's shop page (6 pages)

#### A1-122 · The booking fee is shown to couples on a not-yet-verified shop
```text
PAGE      /v/[slug]
BUTTON    —
STEPS     1. Signed out, open a shop Setnayan has not verified yet. 2. Read the band under the hero (its ⓘ text).
EXPECTED  The booking fee is never mentioned to hosts. The only allowed line is exactly "Hosts pay 0% commission."
ACTUAL    The text reads "You can message and book them here; Setnayan's booking fee applies as usual." The same words also appear in the couple's chat.  (anchor: `apps/web/lib/findable-shop.ts` · `NOT_YET_VERIFIED_INFO` · rendered by `apps/web/app/v/[slug]/_components/not-yet-verified-notice.tsx` · `detail={renewing ? RENEWING_COUPLE_LINE : NOT_YET_VERIFIED_INFO}`)
SHOTS     — (phase B)
RULE      brand.md claims never made #2 (booking fee shown to hosts)
SEVERITY  money-signin
SOURCE    CODE
```
#### A1-123 · A package saved at ₱0 shows "₱0" to couples
```text
PAGE      /v/[slug]
BUTTON    "Sign in to customize" / "Book this package"
STEPS     1. A shop has an active package whose total is 0 (the database allows this). 2. Open its page and look at Packages.
EXPECTED  Same rule as the service cards: no figure, "Price on request", never ₱0.
ACTUAL    The card prints `formatCentavosPhp(0)` = ₱0 beside its main button. The page's own structured data already drops ₱0 packages (`pkg.total_price_centavos > 0`), but the visible card does not.  (anchor: `apps/web/app/_components/vendor-packages/package-card.tsx` · `formatCentavosPhp(pkg.total_price_centavos)` · schema `CHECK (total_price_centavos >= 0)`)
SHOTS     — (phase B)
RULE      CLAUDE.md §1 money (never ₱0 / "Free")
SEVERITY  money-signin
SOURCE    CODE
```
#### A1-124 · Every internal link breaks on a shop's own web address
```text
PAGE      /v/[slug], /v/[slug]/dates, /v/[slug]/story/[eventSlug]
BUTTON    "Check a date" / "See every month →" / "Show more reviews" / "Our story of this day" / a similar shop / "See all ›" / ‹ back / "Check your date with …"
STEPS     1. Open a Plus, Pro or Ultra shop on its verified own domain (the page prints "<domain> → this page"). 2. Press any of the links above.
EXPECTED  Each link opens its screen.
ACTUAL    The links are root paths like `/{slug}?dates=1`, `/{slug}?reviewsPage=2`, `/{slug}/story/{event}` and `/{other-shop}`. On a custom domain the middleware rewrites every path to `/v/{slug}{path}`, so they become `/v/{slug}/{slug}…`, which is a 404. (needs the browser to confirm on a live verified domain)  (anchor: `apps/web/middleware.ts` · ``rewrite.pathname = `${target}${pathname}` `` · page `withShopArrival(`${shopPath(vendor.business_slug ?? slug)}`, shopArrival, { dates: '1' })`, `moreHref={withShopArrival(`/${slug}?reviewsPage=`)
SHOTS     — (phase B)
RULE      design-and-wiring A3 / B5 (every press reaches a real destination)
SEVERITY  broken
SOURCE    CODE
```
#### A1-125 · One failed reviews or services read takes the whole shop page down
```text
PAGE      /v/[slug], /v/[slug]/cached
BUTTON    —
STEPS     1. The review-stats view, the reviews list or the services read fails (including its fallback). 2. Open the shop.
EXPECTED  That one section says "Couldn't load"; the rest of the page still shows.
ACTUAL    These readers throw, and the page's main `Promise.all` has no catch. There is no error.tsx under /v, so the visitor gets the root error screen instead of the shop.  (anchor: `apps/web/lib/reviews.ts` · `throw new Error(`fetchReviewStats failed` / `fetchReviewsForVendor failed` · `apps/web/lib/vendor-services.ts` · `fetchVendorServices failed` · page `const [reviewStats, trustedReviewStats, reviews, allServices`)
SHOTS     — (phase B)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  broken
SOURCE    CODE
```
#### A1-126 · The 3D booth page has no way back to the shop
```text
PAGE      /v/[slug]/booth
BUTTON    "Walk into my booth"
STEPS     1. On a Pro shop with the booth switch on, press "Walk into my booth". 2. Look for ✕ or Back.
EXPECTED  A way back to the shop (✕ or a back link), as the not-set-up page already has.
ACTUAL    A full-screen canvas with only a caption that cannot be pressed. In the installed app there is no exit. (switch may be off in prod: needs the browser to confirm)  (anchor: `apps/web/app/v/[slug]/booth/booth-showcase-client.tsx` · `position: 'fixed', inset: 0`)
SHOTS     — (phase B)
RULE      design-and-wiring A3 (every page has a door)
SEVERITY  broken
SOURCE    CODE
```
#### A1-127 · Share does nothing when the phone has no share sheet and copying fails
```text
PAGE      /v/[slug]
BUTTON    "Share"
STEPS     1. Open the shop in an in-app browser without the share sheet (e.g. Messenger). 2. Press Share.
EXPECTED  It shares or copies, or it says why it could not, with Try again.
ACTUAL    If the copy fails, the error is swallowed and nothing visible happens. (needs the browser to confirm)  (anchor: `apps/web/app/v/[slug]/_components/share-button.tsx` · `/* no-op */`)
SHOTS     — (phase B)
RULE      CLAUDE.md §3 Toast (failure gives a plain reason + Try again)
SEVERITY  broken
SOURCE    CODE
```
#### A1-128 · A failed shop read shows "Page not found", and the copy kept for strangers holds it
```text
PAGE      /v/[slug], /v/[slug]/cached, /v/[slug]/story/[eventSlug]
BUTTON    —
STEPS     1. The shop-row read fails with anything other than a missing-column error. 2. Open a real, live shop.
EXPECTED  "Couldn't open this shop, reload", never a 404. The booth page already makes this difference (`'unreadable'`).
ACTUAL    The read returns null, which leads to `notFound()`, and the tab title reads "Page not found". On the copy kept for signed-out visitors the 404 is served to every stranger until the 60 s refresh. The story page does the same (`return { kind: 'missing' }`).  (anchor: `apps/web/app/v/[slug]/page.tsx` · `return (data ?? null) as PublicVendorRow | null;` · `title: 'Page not found'` · `apps/web/lib/ultra-story-pages.server.ts` · `loadShopStoryPage.shop`)
SHOTS     — (phase B)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```
#### A1-129 · A failed trusted-stats read says "none yet"
```text
PAGE      /v/[slug]
BUTTON    —
STEPS     1. The trusted review stats read fails on a verified shop that has reviews. 2. Read the Reviews summary.
EXPECTED  "Couldn't load the rating" or similar.
ACTUAL    The reader returns 0/0 on error, so the summary shows "—" overall plus "Stars count reviews booked through Setnayan · none yet", and the rating badge disappears.  (anchor: `apps/web/lib/reviews.ts` · `fetchTrustedReviewStats` `if (error || !data) return zero;` · page `'Stars count reviews booked through Setnayan · none yet'`)
SHOTS     — (phase B)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```
#### A1-130 · The review count includes reviews the page hides, and "Show more reviews" never ends
```text
PAGE      /v/[slug]
BUTTON    "Show more reviews"
STEPS     1. A shop has a held (flagged) review, a fraud-voided review or one from an unlisted event. 2. Open Reviews and keep pressing Show more.
EXPECTED  The bars and "N reviews" count only what can be listed, and the pager stops when nothing is left.
ACTUAL    The bars, "N reviews across all their services" and `hasMore` read the raw `vendor_review_stats` view, which counts every row of `vendor_reviews`. The list reads `vendor_reviews_public` and skips unlisted events. So the count is higher than the list, and Show more reloads the same rows for ever.  (anchor: `apps/web/app/v/[slug]/page.tsx` · `const hasMore = reviewStats.total_count > reviews.length` · `const reviewCount = totals.reduce(` · `supabase/migrations/20260514100000_vendor_reviews.sql` · `LEFT JOIN public.vendor_reviews vr`)
SHOTS     — (phase B)
RULE      design-and-wiring C8 (one reader per shared fact)
SEVERITY  wrong
SOURCE    CODE
```
#### A1-131 · A not-yet-verified shop's service cards still show reviews and stars
```text
PAGE      /v/[slug]
BUTTON    a service card (opens the full card)
STEPS     1. Open an unverified shop that has collected reviews. 2. Tap a service card.
EXPECTED  No review and no rating anywhere until the shop is verified (the page's own Reviews section says so).
ACTUAL    The per-card reviews are passed to every card, unlike the card's record rating, which is gated on `isVerifiedShop`. The full card draws a Reviews section with "N · 4.8★" and the quotes. (behind NEXT_PUBLIC_SERVICE_DETAILS_ENABLED; needs the browser to confirm)  (anchor: `apps/web/app/v/[slug]/page.tsx` · `reviewsByService: reviewsByService,` vs `cardRecordRating: isVerifiedShop ?` · `service-details-sheet.tsx` · `` `${formatCount(n)} · ${avg.toFixed(1)}★` ``)
SHOTS     — (phase B)
RULE      DECISION_LOG 15 Nov (no rating or reviews on an unverified shop) · lib/an-unverified-shop-shows-no-review-anywhere.test.ts (gap)
SEVERITY  wrong
SOURCE    CODE
```
#### A1-132 · The story page can show a held (flagged) review
```text
PAGE      /v/[slug]/story/[eventSlug]
BUTTON    —
STEPS     1. An Ultra shop's story event has a review the fraud screener flagged and an admin has not cleared. 2. Open the story page.
EXPECTED  Only reviews a public page may list (`vendor_reviews_public`, as the shop page uses).
ACTUAL    It reads `vendor_reviews` directly and filters only `voided_by_fraud`, so a held review's stars and words show under "What they said".  (anchor: `apps/web/lib/ultra-story-pages.server.ts` · `.from('vendor_reviews')` `.select('rating_overall, body, voided_by_fraud')`)
SHOTS     — (phase B)
RULE      DECISION_LOG 2026-11-23 b89e2420 D (held reviews never list)
SEVERITY  wrong
SOURCE    CODE
```
#### A1-133 · The guest review page reveals a hidden shop's real name, for any shop address
```text
PAGE      /v/[slug]/guest-review
BUTTON    "Open <shop>'s page"
STEPS     1. Signed out, open /{any-shop}/guest-review with no event in the address.
EXPECTED  The same rules as the shop page: a non-public shop gets the 404 that never says whether a shop exists, and names go through `resolveVendorDisplayName`.
ACTUAL    It reads the raw `business_name` with no visibility check, so it confirms the shop exists and prints its real name. The button then links to `/{slug}#reviews`, which is a 404 for a non-public shop.  (anchor: `apps/web/app/v/[slug]/guest-review/page.tsx` · `const shopName = shop.business_name?.trim() || 'This supplier'` · `_components/guest-review-states.tsx` · `NotOnDoorList`)
SHOTS     — (phase B)
RULE      V2.1 hybrid anonymity (resolveVendorDisplayName) · lib/own-shop-preview.ts gate
SEVERITY  wrong
SOURCE    CODE
```
#### A1-134 · Guest review words break when a name is missing
```text
PAGE      /v/[slug]/guest-review
BUTTON    "Send"
STEPS     1. The event has no display name, or the guest has no first name. 2. Open the form and send it.
EXPECTED  Plain fallbacks ("this wedding", "Thank you").
ACTUAL    The heading reads "<shop> at the's wedding" and the thank-you reads "Thank you, you".  (anchor: `guest-review/page.tsx` · `` `${ev.display_name?.trim() || 'the'}’s ` `` · `guest-review/actions.ts` · `?.first_name?.trim() || 'you'`)
SHOTS     — (phase B)
RULE      brand.md tone
SEVERITY  wrong
SOURCE    CODE
```
#### A1-135 · The guest review page keeps its own copy of the "booked" statuses
```text
PAGE      /v/[slug]/guest-review
BUTTON    —
STEPS     1. Read the booked gate.
EXPECTED  Import `BOOKED_EVENT_VENDOR_STATUSES`.
ACTUAL    It hand-types `['contracted', 'deposit_paid', 'delivered', 'complete']`. The two agree today but will drift.  (anchor: `guest-review/page.tsx` · `const BOOKED = [`)
SHOTS     — (phase B)
RULE      CLAUDE.md §4 / design-and-wiring C8
SEVERITY  wrong
SOURCE    CODE
```
#### A1-136 · The booth keeps working for a shop whose paid plan has expired
```text
PAGE      /v/[slug]/booth
BUTTON    "Walk into my booth"
STEPS     1. A Pro shop's plan expires (the plan field still says Pro until the owner next signs in). 2. Open /{shop}/booth directly.
EXPECTED  The expired plan collapses to Free, as the shop page does (`effectiveSeoTier`), so the "Pro feature" note shows.
ACTUAL    The page checks the raw `tier_state` and never reads `tier_expires_at`, so the paid booth still renders.  (anchor: `apps/web/app/v/[slug]/booth/page.tsx` · `if (!boothTierCanBrand(vendor.tier_state))`)
SHOTS     — (phase B)
RULE      page D2 note ("a downgrade must REVERT the paid look")
SEVERITY  wrong
SOURCE    CODE
```
#### A1-137 · Review words assume every event is a wedding booked through Setnayan
```text
PAGE      /v/[slug]
BUTTON    —
STEPS     1. Open a shop that does debuts or christenings. 2. Read Reviews.
EXPECTED  Event-neutral words, and a header that only claims what each row shows.
ACTUAL    The list is titled "Recent weddings" or "Weddings at your venue" and the pill says "Verified wedding" whatever the event type. The header says "From verified couples who've booked <shop> via Setnayan", but some rows carry no pill (bookings made off Setnayan).  (anchor: `_components/venue-matched-events.tsx` · `'Weddings at your venue' : 'Recent weddings'` · page `VerifiedWeddingPill` · `From verified couples who’ve booked`)
SHOTS     — (phase B)
RULE      brand.md word rules (event) · page's own D2 event-neutral rule
SEVERITY  wrong
SOURCE    CODE
```
#### A1-138 · Rank-claim award names on the shop page
```text
PAGE      /v/[slug]
BUTTON    the award in the Awards row
STEPS     1. Open a shop that holds the No. 1 or Top 10 seal.
EXPECTED  No "first" / "#1" / "only" style rank claims.
ACTUAL    The Awards row prints "No. 1 Supplier of the Year" and "Top 10 supplier of <year>". The names come from DECISION_LOG e5ec685d, so they conflict with brand.md rule 11; the owner needs to choose.  (anchor: `apps/web/lib/shop-seals.ts` · `no1: 'No. 1 Supplier of the Year'` · `lib/shop-award-fact.ts` · `` `Top 10 supplier of ${g.year}` ``)
SHOTS     — (phase B)
RULE      brand.md claims never made #11
SEVERITY  wrong
SOURCE    CODE
```
#### A1-139 · Every Trusted partner wears a check badge, verified or not
```text
PAGE      /v/[slug]
BUTTON    a partner tile
STEPS     1. A shop's partner list includes a shop Setnayan has not verified. 2. Look at Trusted partners.
EXPECTED  A check badge only on a verified partner.
ACTUAL    The tile always draws a green check badge. The read fetches `verification_state` but never passes it to the tile.  (anchor: `_components/trusted-by-carousel.tsx` · `<BadgeCheck aria-hidden className="h-[15px] w-[15px] text-success-700"` · `lib/vendor-trusted-by.ts` · `const isVerified =`)
SHOTS     — (phase B)
RULE      CLAUDE.md §5 rule 4 / honest badges
SEVERITY  wrong
SOURCE    CODE
```
#### A1-140 · Some peso amounts are formatted outside lib/php.ts
```text
PAGE      /v/[slug]
BUTTON    —
STEPS     1. Read the Details facts, the "Typical price" card (hidden behind a switch) and the structured price range.
EXPECTED  `formatPhp` / `formatPhpRounded`.
ACTUAL    Hand-built `₱${…toLocaleString('en-PH')}` in three places.  (anchor: page `formatAttrFactValue` · `apps/web/lib/verified-median.ts` · `formatMedianPhp` · page `const peso = (n: number) =>`)
SHOTS     — (phase B)
RULE      CLAUDE.md §1 money (format through lib/php.ts)
SEVERITY  wrong
SOURCE    CODE
```
#### A1-141 · Hand-built pop-ups instead of the shared Sheet / RiseScreen
```text
PAGE      /v/[slug], /v/[slug]/dates
BUTTON    a service card · "Check a date" · "Report this shop" · "Book this package" · an award
STEPS     1. Open each of these layers.
EXPECTED  `RiseScreen` for the full screens, `Sheet` for the small ones, with the one shared backdrop.
ACTUAL    The full service card is a hand-built `fixed inset-0` dialog in a portal. Check a date is a hand-built full screen. The report dialog and the package booking pop-up are hand-built `role="dialog" aria-modal` boxes. The award screens use a native `<dialog>`.  (anchor: `_components/service-details-sheet.tsx` · `data-service-card-grown` · `_components/check-a-date-sheet.tsx` · `data-check-date-sheet` · `app/_components/report-page-button.tsx` · `aria-label="Report this page"` · `app/_components/vendor-packages/lock-modal.tsx` · `aria-labelledby="lock-package-title"` · `app/_components/award/verified-fullscreen.tsx` · `<dialog ref={dlg}`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part K3
SEVERITY  look
SOURCE    CODE
```
#### A1-142 · Portfolio photos open in a half sheet, not the full-screen photo viewer
```text
PAGE      /v/[slug]
BUTTON    a Portfolio photo · a service name ("See every … photo")
STEPS     1. Tap a portfolio photo on a phone. 2. Tap a card's service name.
EXPECTED  The full-screen photo viewer the hero already uses (✕, "3 of 12", ‹ ›).
ACTUAL    A portfolio photo opens one picture in a half-height `Sheet` with no next or previous. "Photos by service" is also a `Sheet`.  (anchor: `_components/portfolio-photo-tiles.tsx` · `data-portfolio-photo-viewer` · `_components/photos-by-service.tsx` · `PhotosByServiceSheet`)
SHOTS     — (phase B)
RULE      SHAPE (owner, 25 Nov)
SEVERITY  look
SOURCE    CODE
```
#### A1-143 · Two main (filled) buttons in one place
```text
PAGE      /v/[slug], /v/[slug]/dates
BUTTON    "Start a new event" + "Send" · "Start an event on <day>" + "Send" · "Join the waitlist for this date"
STEPS     1. Signed in with zero or two-plus events, open Inquire (or Check a date → Ask) and reach the event step. 2. Separately, as a couple whose date is booked out, view the shop.
EXPECTED  One main button per pop-up or screen.
ACTUAL    Both the start-event button (`main={!eventId}`) and Send are filled at the same time. On the page, the terracotta waitlist button sits beside the floating Inquire.  (anchor: `_components/inquire-sheet.tsx` · `label="Start a new event"` · `dates/_components/check-a-date-calendar.tsx` · `data-testid="check-date-start-event"` · page `Join the waitlist for this date`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE
```
#### A1-144 · Coloured side stripes on review blocks
```text
PAGE      /v/[slug]
BUTTON    —
STEPS     1. Open a Pro or Ultra shop with a pinned review, or a review the supplier replied to.
EXPECTED  No accent side stripe.
ACTUAL    The pinned review has `border-l-2 border-terracotta/40`; the supplier reply has `border-l-4 border-terracotta/40`.  (anchor: `_components/pinned-review-card.tsx` · `data-shop-pinned-review` · page `VendorReplyBlock`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part H (no coloured side stripe)
SEVERITY  look
SOURCE    CODE
```
#### A1-145 · Service filter chips: an accent-filled selected chip and a hand-made row of choices
```text
PAGE      /v/[slug]
BUTTON    "All" / a service group chip
STEPS     1. Open a shop whose cards span two or more groups.
EXPECTED  A PillSelector or PickMenu, neutral beside the one main Inquire.
ACTUAL    The selected chip is painted `bg-mulberry text-cream`, a second accent fill on screen, using a hand-rolled chip set.  (anchor: `_components/services-gallery.tsx` · `'border-mulberry bg-mulberry text-cream'`)
SHOTS     — (phase B)
RULE      HOUSE_DESIGN_STANDARD Part K1 · CLAUDE.md §3 Choices
SEVERITY  look
SOURCE    CODE
```

> NOTES: Sections of /v/[slug]/page.tsx covered: the shop read, metadata and structured data; the helpers (details, hide-prices, portfolio, showcase, covers, card kinds); the access gate, visibility and plan collapse; all reads (reviews, services, packages, completed events, seals, tier counts, card badges, saves count, Trusted by, typical price, this month); the experience check; card enrichment; inspiration; microsite, Instagram and songs; pinned review; per-card reviews; reach and own address; stories; partner tiles; branches; viewer and events; Inquire data; package ask targets; waitlist; view recording; held services; section tabs; awards row; and every JSX block from the top bar to the footer, Report and Check a date over the shop, plus each helper component at the bottom. Components followed: everything in `_components` except `sample-shop-page.tsx`, a lab page this route never renders. Shared pieces checked only for the parts this page uses: SaveVendorButton, ReportPageButton, PackageCard, LockPackageModal (pop-up only), ServiceCardView, SignInHereLink. Not opened: the sign-in panel, award kit internals, CardReviewsBlock, CardRecordSection, CardPortfolioSection, DirectionsMenu, ImageBadge. Switch states could not be read from code (NEXT_PUBLIC_SERVICE_DETAILS_ENABLED, NEXT_PUBLIC_PLAN3D_BOOTH_SHOWCASE, the typical-price switch, the card-record switch), so the full service card, booth and typical-price findings need the live switches confirmed. Whether any verified custom domain exists in prod was not checked. Offline gap: /v/[slug]/cached is a server copy kept for speed, not a copy on the phone. Nothing on the device is planned for a couple at an expo beyond the accidental last-copy rule in sw.js `isDayOfGuestNavigation`, which also stores a signed-in couple's render.

### Shared chrome + LIVE walk (setnayan.com, signed out)

#### A1-146 · Every public page is rendered per request and never cached at the edge
```text
PAGE      every area-1 page except /api/v1 (cached) and /explore/compare (a redirect) — 49 addresses swept
BUTTON    —
STEPS     1. `curl -sI https://www.setnayan.com/<page>` for each public page, signed out. 2. Read `cache-control` and `x-vercel-cache`.
EXPECTED  Part H / G2: public pages are static and cached at the CDN, so the resting page is complete on arrival and close to the 0.7 s target.
ACTUAL    Every page answers `cache-control: private, no-cache, no-store, max-age=0, must-revalidate` and `x-vercel-cache: MISS`; each view is rendered in the Singapore function. TTFB from this container 0.38–0.79 s for these pages vs 0.12 s for the one cached page (/api/v1). The cause is the session-reading shell: `apps/web/app/(shell)/layout.tsx` · `export const dynamic = 'force-dynamic'`, and Home reads the session in `(hub)`. Home also rides cron-free jobs on `after()` (`apps/web/app/(hub)/page.tsx` · `runDailyEmailJobs`), so every stranger's visit pays a render.
SHOTS     — (header sweep; no screenshot)
RULE      HOUSE_DESIGN_STANDARD Part G2 ("Public pages are cached / static (CDN)") · Part H ("Static, script-free, cached") · Law 8
SEVERITY  look
SOURCE    SEEN-LIVE
```

#### A1-147 · Speed: no page is usable within 0.7 s from here; the slow ones
```text
PAGE      /, /features, /papic, /login, /signup, /for-suppliers, /help, /{shop}?dates=1 (from /v/[slug]/dates), /explore/compare, /pakanta, /patiktok
BUTTON    —
STEPS     1. Load each page at 375 px, signed out, three times; take the median largest paint (LCP).
EXPECTED  Usable in about 0.7 s (Part G1); nothing over 2 s.
ACTUAL    Warm medians (LCP, 375 px): / 1.12 s · /features 1.23 s · /papic 1.16 s · /login 1.10 s · /signup 1.07 s · /for-suppliers 1.00 s · /help 1.00 s · /pricing 0.82 s · /alaala 0.72 s · /about 0.69 s. **Over 2 s:** a shop's Check a date (`/setnaprod?dates=1`, what `/v/[slug]/dates` forwards to) 2.7 s; /explore/compare signed out 2.0–2.4 s (two 307 hops: → `/?browse=1` → `/login?next=…`); /pakanta and /patiktok → /features 1.8–2.4 s (redirect + page); a missing shop's `/dates` (→ `/{word}?dates=1` → 404) 3.3–3.8 s; cold first loads of / (2.27 s) and /alaala (2.18 s). ⚠ Measured from a US cloud container through Vercel's Cleveland edge to the Singapore function: about 0.25–0.35 s of every figure is network distance a visitor in the Philippines does not pay. Re-time from Manila in phase B.
SHOTS     — (timings only)
RULE      HOUSE_DESIGN_STANDARD Part G1 (loads under 0.7 s) · checklist §5 item 10
SEVERITY  look
SOURCE    SEEN-LIVE
```

#### A1-148 · /pricing answered HTTP 502 once
```text
PAGE      /pricing
BUTTON    —
STEPS     1. Load https://setnayan.com/pricing at 375 px during the walk.
EXPECTED  200 every time.
ACTUAL    One load returned **502 Bad Gateway in 0.1 s** (1 of about 120 page loads in the walk). Not reproduced in 9 retries (6 by curl, 3 in the browser), all 200. Intermittent; watch for it in phase B.
SHOTS     — (seen once)
RULE      checklist §5 item 1 (no 5xx)
SEVERITY  broken
SOURCE    SEEN-LIVE
```

#### A1-149 · /papic creates a demo session and opens a live connection for every visitor, on load
```text
PAGE      /papic
BUTTON    — (nothing pressed)
STEPS     1. Open /papic signed out and press nothing. 2. Watch the network and console.
EXPECTED  A public page opens no live connection and writes nothing until a person asks for the demo (Part G2: "Guests get no live connection"; "Preload the next likely step only, after idle").
ACTUAL    A mount effect calls `startDemoSession('papic', …)`, which inserts a `demo_sessions` row (`apps/web/lib/demo-sessions.ts` · `.from('demo_sessions')` `.insert(`), and the page opens a Supabase realtime WebSocket to production. Every visitor and every crawler that runs scripts writes a row. (anchor: `apps/web/app/(shell)/papic/_papic-scan.tsx` · `startDemoSession('papic', window.location.origin)` inside `useEffect`.) Note: this checker's own read-only loads of /papic (about 5) created demo sessions this way.
SHOTS     — (console: `WebSocket connection to 'wss://<prod-ref>.supabase.co/realtime/v1/websocket…'`; blocked by this container's proxy, so not a site error)
RULE      HOUSE_DESIGN_STANDARD Part G2 · Law 8
SEVERITY  wrong
SOURCE    SEEN-LIVE + CODE
```

#### A1-150 · The shop page has two terracotta-filled buttons on one phone screen
```text
PAGE      /v/[slug] (seen on the sample shop /setnaprod)
BUTTON    "Inquire" · "Get directions"
STEPS     1. Open https://setnayan.com/setnaprod at 375 px. 2. Scroll to the map card.
EXPECTED  One main button per screen; "Get directions" is neutral beside the floating Inquire.
ACTUAL    Both are filled terracotta: Inquire at 752 px and Get directions at 1,195 px from the top, 443 px apart, so both fit in one 812 px screen. (anchor: `apps/web/app/_components/get-directions.tsx` · `tone="brand"` `main` `label="Get directions"`)
SHOTS     375 px light (phase A capture, not attached)
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    SEEN-LIVE
```

#### A1-151 · Test shops are public and are the only shops in the sitemap
```text
PAGE      /v/[slug] (shop pages, now served at /{shop})
BUTTON    —
STEPS     1. Open https://setnayan.com/sitemap-vendors.xml. 2. Open each listed shop.
EXPECTED  Only real, published shops are public and indexed; test shops are hidden (or marked DEMO ONLY and kept out of search, as /suppliers does with `is_demo`).
ACTUAL    The sitemap lists exactly three shops: /testw2walkcakes (titled **"TEST W2 Walk Cakes"**), /testnayanw1lights ("Liwanag Lights & Sound") and /setnaprod (the sample shop, which shows "Setnayan Verified"). All three open with HTTP 200 for strangers. `sitemap-suppliers.xml` is empty and /suppliers says no directory page has opened yet ("none has yet"), so test shops are all Google is handed.
SHOTS     — (sitemap + titles)
RULE      brand.md (honest suppliers, easy to find) · the DEMO ONLY rule (kit § 3)
SEVERITY  wrong
SOURCE    SEEN-LIVE
```

#### A1-152 · The shared website footer says "Monogram maker"
```text
PAGE      every page wearing the marketing footer (seen on /help/topics, /help/topics/[key], /tour, /tour/budget, /tour/gallery, /tour/seating, /tour/vendors, and the 404 page)
BUTTON    "Monogram maker"
STEPS     1. Scroll to the footer, column "Explore".
EXPECTED  "Logo Maker".
ACTUAL    The link reads "Monogram maker" (→ /monogram). (anchor: `apps/web/app/_components/marketing/reskin-footer.tsx` · `Monogram maker`)
SHOTS     375 px light (phase A capture, not attached)
RULE      brand.md word rules (Logo Maker, never Monogram)
SEVERITY  wrong
SOURCE    SEEN-LIVE
```

#### A1-153 · The top bar's "Sign in" opens a hand-made card from the top, not the small sheet
```text
PAGE      every signed-out page with the shell (top bar "Sign in", and the drawer's "Sign in" on a phone)
BUTTON    "Sign in"
STEPS     1. On a 375 px phone, press "Sign in" in the top bar of any public page.
EXPECTED  Owner (25 Nov): sign-in is a SMALL POPUP — the shared `Sheet`, half height on a phone, a centred dialog on desktop.
ACTUAL    `SignInHerePanel` portals its own `role="dialog"` `aria-modal` overlay (`.home-reskin-ov`), a card pinned near the top (`align-items: flex-start; padding: max(5vh, 28px)`) at every width. It does use the shared scrim token, blur and the shared lock (`useModalA11y`), so K3's dim/blur/inert holds; the shape does not. Pressing it from the open drawer closes the drawer first (no popup on a popup) — checked. Same family as the /login finding in the sign-in group. (anchor: `apps/web/app/_components/auth/sign-in-here-panel.tsx` · `className={`home-reskin-ov sn-signin-here sn-signin-simple`)
SHOTS     — (phase B: 375 px with the panel open)
RULE      SHAPE (owner, 25 Nov) · CLAUDE.md §3 (no new hand-rolled aria-modal)
SEVERITY  look
SOURCE    CODE
```

> NOTES: Chrome and live-walk findings by the checker (not a sub-pass). Live walk: GET page loads only, signed out, 375 px then 1280 px, light; nothing pressed, typed or submitted.

### Phase B · the staging walk (25 Nov, commit bd86936)

Blockers A1-056 (confirmed) and A1-154 (new) are at the top of this file.

#### A1-155 · Setnayan AI has three different prices: "from ₱265" on /pricing, ₱2,790 in the same page's search data and in llms.txt
```text
PAGE      /pricing · /llms.txt
BUTTON    "Setnayan AI" price row (ⓘ)
STEPS     1. Open /pricing. 2. Scroll to "Help planning". 3. Read the page's Product data (view source) and /llms.txt.
EXPECTED  One price, read from the catalogue, the same in the row, the Product data and llms.txt. If it is still sold on its own, the row has a way to buy it.
ACTUAL    The row reads "Setnayan AI · from ₱265" (lowest of the per-event-type bands, `aiFrom` in `app/(shell)/pricing/page.tsx`). The same page's Product data says ₱2,790. llms.txt says "sold on its own at ₱2,790 one-time per event" and repeats it in "What is Setnayan AI?". The page's own comment says "Setnayan AI is no longer sold on its own" and that the row stops drawing once it is off sale, yet the catalogue (copied from production) keeps it on sale. The row has no button, so the price leads nowhere (Add 4: a price with no door).
SHOTS     375 px light, /pricing "Help planning" row
RULE      CLAUDE.md §1 (money is read, one reader) · Add 4 HONEST · design-and-wiring C8
SEVERITY  money-signin
SOURCE    SEEN
```

#### A1-156 · Signing in takes about a minute, and creating an event over two minutes
```text
PAGE      /login · /start → /onboarding/birthday ("Create my birthday")
BUTTON    "Use email" → Sign in · "Create my birthday"
STEPS     1. /login at 375 px, "Use email", sign in with the spare account. 2. Signed out, /start → Birthday → 7 steps → "Create my birthday".
EXPECTED  A press looks pressed at once; sign-in lands in a few seconds (kit § 5 item 10).
ACTUAL    Sign-in showed "Signing in…" for 64 s before landing on /dashboard?hub=1. "Creating…" stayed for more than 120 s (the first try was abandoned at "Creating…"; the second landed after about 2.5 min). No message tells the person to wait. Measured while 8 checkers share the copy, from a US container: re-time on live from Manila before fixing, but a minute with no word is a finding either way. /api/telemetry/client-fault also answered 500 on both flows.
SHOTS     375 px light ("Signing in…", "Creating…")
RULE      kit § 5 item 10 (speed) · Add 5 (forgiving, clear)
SEVERITY  money-signin
SOURCE    SEEN
```

#### A1-157 · Signed-in supplier browsing says "No services listed yet" while ten verified shops have cards
```text
PAGE      /?browse=1 (also where /explore/compare lands with no ids)   (signed in as `front`)
BUTTON    "Suppliers" view on Discover
STEPS     1. Sign in. 2. Open /explore/compare (forwards to /?browse=1) or /?browse=1.
EXPECTED  The seeded verified shops and their service cards (Liwanag alone has 4), or an honest "Couldn't read" with Try again.
ACTUAL    "Suppliers · All categories · Most reviews · Filters — No services listed yet. Check back soon — suppliers are landing every week." A second open of /?browse=1 hung 93 s and ended blank. /?discover=1 on the same account lists the same ten shops, so the shops exist: the services read is failing (likely the same read that takes the shop pages down, A1-154) and the failure is drawn as "none". "Suppliers are landing every week" is a promise nobody measures.
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4 (honest states) · brand.md (no promises)
SEVERITY  wrong
SOURCE    SEEN
```

#### A1-158 · /pricing opens a 3-step tour over the page for a first-time visitor
```text
PAGE      /pricing (signed out, 375 px)
BUTTON    the tour's "Skip" / "Next"
STEPS     1. Open /pricing in a fresh browser at 375 px.
EXPECTED  The page itself: show it working, remove the fear, then the plans (brand.md page order). Add 5: a step that needs a tour is a finding.
ACTUAL    A "STEP 1 OF 3 · Why Setnayan … Press Next · Skip · Next" card covers the lower half and the page is scrolled past its heading to "Crafted for every event". The person has to dismiss a tour before reading prices.
SHOTS     375 px light
RULE      Add 5 (first-timer, no tour) · Add 1 (never a popup the person did not ask for)
SEVERITY  look
SOURCE    SEEN
```

#### A1-159 · "The best place to build your event." and "the Philippines-first … platform"
```text
PAGE      /pricing (H1) · /about and /tl/about (page title) 
BUTTON    —
STEPS     1. Read the /pricing heading. 2. Read the /about tab title.
EXPECTED  No rank claims (brand.md claim 11).
ACTUAL    /pricing H1 "The best place to build your event." · /about title "About Setnayan — the Philippines-first wedding & life-events platform" (and the Tagalog twin "ang Philippines-first wedding platform"); /about H1 "Set na ’yan. Your wedding, all set — on one Filipino platform." speaks only to weddings. Same family as A1-105.
SHOTS     —
RULE      brand.md claims 11 · word rules (event)
SEVERITY  wrong
SOURCE    SEEN
```

#### A1-160 · Sign-in pages and walls are indexed; /api/v1 is indexed with no canonical
```text
PAGE      /login · /signup · /signup/you · every page that forwards to /login (/articles/write, /explore/compare, /samahan/chat/[id]) · /api/v1 · sitemap-static.xml
BUTTON    —
STEPS     1. Read each page's robots meta and canonical. 2. Read sitemap-static.xml.
EXPECTED  Utility and private pages stay out of search (Add 9 SEO): noindex on sign-in, sign-up and the walls, and not in the sitemap.
ACTUAL    All carry `index, follow`. /login and /signup are listed in sitemap-static.xml. /api/v1 ("Setnayan API v1 — Reference") is `index, follow` with no canonical, though the locked decision is "no public API endpoints in V1". The four sign-in-wall pages share one title and description ("Sign in · Setnayan"). Pages that do it right: /reset-password, /web-only, /panood/demo/* (noindex).
SHOTS     —
RULE      Add 9 SEO · CLAUDE.md §6 (no public API in V1)
SEVERITY  wrong
SOURCE    SEEN
```

#### A1-161 · Titles, descriptions and share pictures: doubled brand, shared descriptions, no picture on legal pages
```text
PAGE      see list
BUTTON    —
STEPS     1. Read <title>, meta description and og:image on every public page at 1280 px.
EXPECTED  Each page: a unique title ending once in "· Setnayan", its own description, a share picture.
ACTUAL    • "What connecting Google does · Setnayan · Setnayan" (/privacy/google-access) and "Setnayan · Plan any event free. Every photo in one album. · Setnayan" (/) say the brand twice. • /creators' title runs on to "…bookable Chapters —" and is cut. • /help/topics, /help/topics/about-setnayan and /web-only use the site-wide description, not their own. • /privacy, /terms, /cookies, /refunds, /acceptable-use have no share picture (og:image). • /monogram title "Free Monogram Maker" and /palogo "Logo Maker — Your Animated Wedding Monogram" use the retired word in the title Google shows (A1-027 family). • /features ("Wedding & Life-Events Platform Philippines") and /pawebsite speak to weddings only.
SHOTS     —
RULE      Add 9 SEO · brand.md word rules
SEVERITY  wrong
SOURCE    SEEN
```

#### A1-162 · Sitemaps: an empty weddings sitemap, sign-in pages listed, old words in help addresses
```text
PAGE      /sitemap.xml and its children
BUTTON    —
STEPS     1. Open /sitemap.xml and each child.
EXPECTED  Every listed sitemap holds pages; only public, indexable pages; addresses in house words.
ACTUAL    sitemap-weddings.xml is in the index with 0 URLs. sitemap-static.xml lists /login and /signup (A1-160) and omits /suppliers (it is in sitemap-suppliers). sitemap-help.xml (315 URLs) carries the retired words in addresses and titles people see in search: /help/how-are-vendors-verified, /help/sign-up-as-vendor, /help/track-vendor, /help/start-thread-with-vendor, /help/vendor-reply-only, /help/verified-filipino-wedding-vendors-no-commission, /help/monogram ("Customize the QR monogram"), /help/what-is-pakulay. (Old addresses may be kept for links; then the title and words should still say supplier / Logo Maker / Mood Board, and a new address should forward.)
SHOTS     —
RULE      Add 9 SEO · brand.md word rules
SEVERITY  wrong
SOURCE    SEEN
```

#### A1-163 · llms.txt tells AI things the site does not do, and uses banned words and promises
```text
PAGE      /llms.txt (prices read live from both catalogues — those match /pricing, except A1-155)
BUTTON    —
STEPS     1. Read /llms.txt against the pages it points at.
EXPECTED  True and complete today (Add 9 GEO), in brand.md words.
ACTUAL    • "Marketplace … Browsing is free and open to anyone" and "Find suppliers on Discover — Browse verified Filipino event suppliers on the front page": a signed-out stranger who opens supplier browsing is sent to /login (owner's 16 Nov ruling, `signedOutRedirect`). • Setnayan AI "on its own at ₱2,790" (A1-155). • "Monogram Maker" twice, as a product name. • "A plan bought in the iPhone app is an Apple subscription" (brand.md claim 8). • Promises: "No fake reviews. No paid stars. Ever.", "Verified is free, for good", "Free costs nothing, for good" (the "for good" family, A1-024/A1-030/A1-048). • "Built under the Philippine Data Privacy Act (RA 10173)" as a trust line (claim 13). • The general answer "How much does Setnayan cost?" spells out the supplier booking fee; AI assistants will repeat it to hosts (claim 2 allows hosts only "Hosts pay 0% commission."). • The summary line "book verified Filipino suppliers at 0% commission" is commission wording other than the ruled sentence (A1-022 family). Correct today: the plan names (Free · Verified · Plus · Pro · Ultra; Event Plus · Pro · Ultra), all other prices, no "Max/Enterprise".
SHOTS     —
RULE      Add 9 GEO · brand.md claims 2, 3, 8, 13 · word rules
SEVERITY  wrong
SOURCE    SEEN
```

#### A1-164 · Web search knows nothing about Setnayan today
```text
PAGE      the whole public site (answers live on /help/what-is-setnayan, /help/how-much-does-setnayan-cost, /help/is-setnayan-free-for-couples, /help/setnayan-vs-free-apps-and-google-sheets)
BUTTON    —
STEPS     Web search, 25 Nov: "what is Setnayan" · "Setnayan price how much Event Plus" · "is Setnayan free for couples wedding planner Philippines" · "Setnayan vs wedding planning app Philippines".
EXPECTED  The help answers above come back, or at least setnayan.com.
ACTUAL    Not one result names Setnayan. The engine offered "Setan" (a village in Iran), "Setnja" (a Serbian dance), Evento Plus, Bridestory, Nuptial and eKasal instead, and said plainly it found nothing on Setnayan. So today an assistant asked about us has no facts at all, right or wrong. Not a page bug: the site is not yet found. The answer pages exist and are in sitemap-help.xml. Owner/controller steps outside the code: submit the sitemap in Google Search Console and Bing Webmaster Tools (Bing feeds several assistants), link setnayan.com from the Facebook page already in `sameAs`, and get a few real links. Also note robots.txt blocks GPTBot, Applebot-Extended, Amazonbot, cohere-ai, Bytespider, Diffbot outright (OAI-SearchBot, ChatGPT-User, PerplexityBot, ClaudeBot, Google-Extended allowed): an owner decision, written down so it is a choice.
SHOTS     —
RULE      Add 9 (what AI says about us now)
SEVERITY  wrong
SOURCE    SEEN
```

#### A1-165 · Product pages open with a slogan, not a plain answer
```text
PAGE      /budget · /seat-plan · /schedule · /setnayan-ai · /creators · /our-story · /pricing · /about
BUTTON    —
STEPS     1. Read the H1 and the first line of each page.
EXPECTED  Add 9 AEO: each page opens with a plain answer ("Setnayan Budget is a free budget tracker in pesos…"), then the detail. /features/<slug> already does this and is the model.
ACTUAL    H1s: "The truth, in PHP." · "Drag, drop, done." · "The day, minute by minute." · "It doesn’t chat. It watches your wedding for you." · "EVERYWHERE ELSE, THEY WATCH. HERE, THEY BOOK." · "Memories." · "The best place to build your event." An answer box or assistant quoting the first line gets a slogan. (Brand tone allows the feeling first; the fix is one plain line under it, not a new headline.)
SHOTS     —
RULE      Add 9 AEO
SEVERITY  look
SOURCE    SEEN
```

#### A1-166 · With no signal, help and public pages show the browser's blank error, not even Setnayan's offline page
```text
PAGE      /help · /help/[slug] · /help/topics · /help/topics/[key] (OFFLINE: READ-ONLY IS ENOUGH) · every public page
BUTTON    —
STEPS     1. Open /help, /help/what-is-setnayan, /help/topics/about-setnayan and / (service worker active, /offline.html in its cache). 2. Switch the browser offline. 3. Open each again.
EXPECTED  The help answers from a saved copy (phase A marked them READ-ONLY IS ENOUGH), or at least Setnayan's own offline page.
ACTUAL    Each gives the browser's own error (net::ERR_INTERNET_DISCONNECTED, a blank page in the test browser). By design `public/sw.js` leaves every navigation except the saved-copy shapes and day-of guest pages to the browser ("Every OTHER navigation … is left to the browser"), so /offline.html is never shown here. Back online, the page loads normally.
SHOTS     375 px, offline
RULE      Add 10 (offline beyond the five)
SEVERITY  wrong
SOURCE    SEEN
```

#### A1-167 · Desktop rail: a coloured stripe on the active row and two "Sign in" buttons
```text
PAGE      every signed-out page with the shell, at 1280 px (seen on /, /pricing, /features)
BUTTON    "Discover" (rail) · "Sign in" (top right) · "Sign in" (rail)
STEPS     1. Open / at 1280 px.
EXPECTED  Part H: never a coloured side stripe. K1: one main button per screen.
ACTUAL    The active rail row "Discover" carries a terracotta bar down its left edge. "Sign in" appears twice: an outline pill at the top right and a filled brown button in the rail, while the hero above the fold has no main button at all (Part H: one terracotta button per hero). At 375 and 768 only the top "Sign in" shows.
SHOTS     home-1280-light.png (shots/area-1)
RULE      HOUSE_DESIGN_STANDARD Part H · Part K1
SEVERITY  look
SOURCE    SEEN
```

#### A1-168 · A made-up couple "Maria and Jose" is the example on the home page and /pricing
```text
PAGE      / ("Same event. Each guest sees their own.") · /pricing ("An Event Hub that looks like yours")
BUTTON    —
STEPS     1. Scroll / to "Live it". 2. Open /pricing.
EXPECTED  Add 3: no made-up people presented as real; a sample is labelled as a sample.
ACTUAL    "Maria and Jose’s wedding, as their guests see it." and an "M & J · Maria & Jose" Event Hub card. The words present them as a real couple; nothing says sample. (If the owner wants a named sample, say "a sample wedding".)
SHOTS     home-768-light.png (shots/area-1) · 375 px /pricing
RULE      Add 3 (placeholders)
SEVERITY  look
SOURCE    SEEN
```

#### A1-169 · Pages over 2 seconds on the copy
```text
PAGE      see list
BUTTON    —
STEPS     Page loads at 375/768/1280, light and dark (6 loads each), time to DOM ready.
EXPECTED  Usable in about 0.7 s; anything over 2 s listed (kit § 5 item 10).
ACTUAL    Every page is over 0.7 s (best ~0.6–1.0 s DOM ready, 1.3–3.5 s to load). Over 2 s DOM ready: /suppliers 9.7–12.4 s · /suppliers/wedding/photo-video 9.3–11.2 s · /suppliers/wedding/photo-video/tagaytay up to 9.2 s · /tl/features 3.2–6.5 s · /tl/features/budget 2.1–4.7 s · /explore/compare 2.2–3.1 s · / up to 2.5 s · /sample (a 404!) 6.5–8.7 s · /u/<made-up>/c/x up to 15.7 s (a 404) · every shop page 23 s then 500 (A1-154). Measured with 8 checkers on the copy from a US container; the order (directory pages slowest) matches phase A's live figures (A1-147).
SHOTS     —
RULE      kit § 5 item 10
SEVERITY  look
SOURCE    SEEN
```
