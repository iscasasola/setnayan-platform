# Supplier-ready walk on LIVE setnayan.com

Commit served (`/api/health`): **e307da2**. Walked with the built-in browser at 390×844 (phone), then at 1280×800 (desktop).
- Signed out: sign up, public shop and the public Check a date.
- Signed in as **SetnaProd** (the owner signed in himself): chat, cards and schedules.
- Read-only throughout. Nothing was saved, sent, toggled or created:
  - A typed chat draft was cleared without sending.
  - Create, Save card, Send quote, Accept bookings and Not available were never pressed.

Screenshots: shared notes folder `supplier-walk-2026-11-24/` (numbered files named below).

## Result: **4 of 4 working**

| Area | Verdict | What was walked |
|---|---|---|
| Chat | **Works** | Chats list → thread → quote card → View quote (`/proposals/…`) → Update this quote (Book & Budget opens) → message box types and shows Send. Desktop: two-pane chat. |
| Service cards | **Works** | Shop → card list (3 cards, 1 Offline) → Card Maker picker (search "Photo booth" → Mirror photobooth → "Make 1 card") → card form with photos, price, includes, schedule, crew, payment, Create. Existing card editor → Save card. Desktop: live preview "As couples see it". Public shop shows the 2 online cards. |
| Sign up | **Works, as far as walked** | /for-suppliers → Open your shop → step 1 (name, address "Available", service search → Florist) → step 2 Account (Google, Apple, email, password, Terms). Empty Continue is refused with "Add a valid company email." **Steps 3–5 (Your shop, Your card, Open my shop) were NOT walked**, because Continue on step 2 creates a real account. |
| Schedules | **Works** | /calendar → Clients calendar (week strip, month) → tap Sat 28 Nov → day bar (Accept bookings, Book a client, Open the day) → day page (Free per schedule, Not available, Show a QR) → Clients settings (lead time, per-schedule counts, approve first, time slots, .ics, not-available days, waiting list). Public Check a date on the shop: day sheet with per-card availability and "Ask about this date". |

No area is blocked: a supplier can do each job end to end, up to the submit step.
The faults below are wrong numbers, wrong prompts and speed.

## Faults, ranked by how badly they block a supplier

**1. The quote bills 100 guests the couple never gave (money number guessed in code)**
- Where: Chat › Update this quote (`/vendor-dashboard/clients/<id>?tab=quote`) › "Billed".
- Saw: "Billed **100** pax · no count from them yet". The inquiry said "80 guests", and "On their list" says "No count yet".
- Cause: `apps/web/app/vendor-dashboard/messages/[threadId]/page.tsx` passes `requestedPax={thread.pax_at_inquiry ?? headerPax ?? 100}`.
- Expected: with no count, Billed is empty or "set a count", never 100. A per-guest card quotes a total built on a number nobody gave (CLAUDE.md rule 3).
- Screenshot: `22-quote-editor-billed-100-pax-390.jpg`.

**2. The card editor's first paint says a live card is missing everything**
- Where: Shop › a card › editor (`/vendor-dashboard/services/<id>`), at 390.
- Saw: on load, "PHOTOS 0 of 5" with an empty add tile, and "Couples can see it · still missing: **a cover photo · a price · what's included**". The card has 5 photos, a ₱14,999 price and an includes line. About 1–2 s later it corrects to "5 of 5" and "Couples can see it · hide · start another from this".
- Expected: the server render shows the real photos and status, or a skeleton. Never a false "missing" (honest-states rule 4).
- Screenshots: `27-card-editor-first-paint-wrong-390.jpg` → `28-card-editor-after-load-390.jpg`.

**3. Supplier pages are over the 0.7 s budget, and carry heavy JS**
- How measured: the full HTML stream, signed in, 2 runs each.

| Page | Time | Status |
|---|---|---|
| Today `/vendor-dashboard` | 0.89–1.26 s | over |
| Client chat `?tab=chat` | 1.57–2.05 s | over (423 KB HTML) |
| Quote `?tab=quote` | 1.40–1.43 s | over |
| Shop `/vendor-dashboard/shop` | 1.50–1.88 s | over (625 KB HTML) |
| Clients settings `?gear=1` | 0.79–0.87 s | over |
| Chats list | 0.54–0.70 s | in budget |
| Card Maker | 0.50–0.66 s | in budget |
| Card editor | 0.69–0.77 s | at the line |
| Calendar | 0.63–0.70 s | in budget |
| Day page | 0.52 s | in budget |

- Public shop `/setnaprod`: **2.76 s DOMContentLoaded cold** (TTFB 2.19 s), 0.25 s warm.
- `/for-suppliers`: DCL 0.35 s, but load 1.26 s.
- The Card Maker page pulled **182 JS chunks, 6.3 MB decoded**.
- Expected: < 0.7 s at 390, one batched read per screen.

**4. Today tells the supplier to "Reply" when the couple owes the reply**
- Where: Today › Needs you today.
- Saw: "Reply to TEST SetnaProd walk · 'Quote ₱6,750 sent' · waiting 10 days", with "→ Quick Responder · reply within 1 hour". The last message in that thread is the supplier's own quote.
- Expected: a sent quote with no answer is "waiting on the couple" (or a nudge), not a reply task. It also burns the Quick Responder promise.
- Screenshot: `16-today-390.jpg`.

**5. The public shop says "0 reviews" above 3 reviews**
- Where: `/setnaprod` › Reviews (couple-facing).
- Saw: "— overall · **0 reviews** across all their services". Directly under it, the bars read 5★ = 2 and 4★ = 1, and a 4★ review is printed. Today also lists 3 reviews to reply to.
- Expected: "4.7 overall · 3 reviews". Couples are judging this number.
- Screenshot: `09-shop-reviews-0-but-3-390.jpg`.

**6. One chat has three names**
- Saw:
  - Chats list: "TEST's Birthday (date not set)".
  - Thread header and Today: "TEST SetnaProd walk".
  - Clients: "TEST SetnaProd walk · Birthday". The other thread is "TEST walk 2 birthday".
- Expected: one name per event everywhere.
- Screenshots: `17`, `18`, `29`.

**7. Card capacity says 500 a day, settings say 1**
- Where: card editor › "How many events a day can this service take? **500**", against Clients settings › How many a day › "Photo Booth 1 · at the same time".
- Expected: one number, or two labelled so a supplier can tell them apart.

**8. The couple is missing from the chat's people strip**
- Where: thread header › "Shared chat · 2 inside" → "SetnaProd · You". The couple (who wrote 3 messages) isn't listed, and the info line is cut ("Everything you need for this event is already").
- Screenshot: `20-chat-2-inside-no-couple-390.jpg`.

**9. Desktop Clients detail cuts the first letter**
- At 1280, the event detail pane reads "obile bar by Setnaprod" and "roduction sheet". The section headings are fine.
- Screenshot: `37-calendar-1280-first-letter-cut.png`.

**10. Smaller ones**
- The phone chat box has no "Message" placeholder. At rest the "Set an ocular" chip sits where you type (desktop shows the placeholder). `18`.
- Desktop Card Maker top bar shows "Create" next to "+ Create service card": two create verbs side by side. `35`.
- The day bar's "Accept bookings" (on) and the day page's "Not available" (off) are the same fact with opposite switches. `30`, `31`.
- "Hosted by · **Someone —**" on an event with no host name. `29`/`36`.
- Sign-up step 1 at 1024 px clips "+ Specialties (opt…" in the service tile (fits at 1280). `12`, `12b`.
- Public Check a date on a phone hides the month arrows (`display:none`), with no hint to swipe for the next month. `10`.
- Public shop: the sticky section tabs don't follow scroll (About stays lit over Services; Services stays lit over Reviews). `08`.
- The supplier `CheckADate` component (`app/vendor-dashboard/customers/_components/check-a-date.tsx`) is exported but mounted nowhere. The comment in `customers/page.tsx` says it was retired for the month view. It's dead code.

## Not verified (said plainly)
- **Sign up steps 3–5** and "Open my shop": each one writes prod.
- **Publishing a card, saving a card, sending a quote, sending a chat, toggling a day**: all write prod. Walked up to the button only.
- **Real paint time of supplier pages.** The pane was hidden for most of the signed-in walk.
  - React's streamed reveal (`$RC`/`$RT`) waits for a frame, so a hidden pane showed "Loading supplier dashboard…" for 20–60 s. The content appeared the moment a screenshot forced a frame.
  - Those 20–60 s numbers are an artifact and are **not** listed as faults. The server-stream times in fault 3 are the honest numbers.
  - The quote editor's 23–35 s "Loading the quote…" is likely the same artifact. Re-check it with the pane visible.
- **One client-fault beacon + a Sentry envelope** fired on a Card Maker reload, at the moment the page painted. The error text was not captured. Check Sentry around 24 Nov ~02:00 UTC.
- After the owner signed in, the tab sat on `/dashboard?hub=1`, not `next=/vendor-dashboard`. I can't tell how he signed in, so this is not listed as a fault.

## Console and network
- Console: no errors on any walked page (one "Deprecated API for given entry type" warning came from my own timing read).
- Network: no failed requests.
- POSTs seen:
  - `/open-shop` ×3: name and address check reads.
  - `/vendor-dashboard/clients/<id>?tab=quote` ×3: quote loader actions.
  - `/api/telemetry/client-fault` ×2.
