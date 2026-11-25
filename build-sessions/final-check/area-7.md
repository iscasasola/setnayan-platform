# Final check · Area 7 · Coordinator, Spaces & venue, maps

FIXER: area 7 done · lane A #8307 · #8308 · #8312 (migration needs GO) · A7-16 #8351 (stacked on #8312, migration needs GO) · L6 retire #8346 · lane B #8347 · all ready, regens named for the GitHub Controller · 🟠 A7-32 (owner) · waiting

STATUS: phase B done · 10 of 10 pages walked at 375 / 768 / 1280, light and dark · 36 findings (27 code + 9 seen):
blocker 0 · money-signin 2 · broken 3 · wrong 18 · look 13 · product blockers 0, two checks blocked by the seed (see BLOCKERS)
· DARK: signed-in no-dark 5 · public light-only 4 · own skin 1 · buttons counted 193 at 375, pressed 109 (the 3D room's 65 not reached; 5 timed out; writes skipped), failed 2 (A7-30, venue walk's back link → area 4 B-01)

Checker 7 of 8. Report only. Phase A pinned commit `fb3f72d`; phase B walks the staging copy at `bd86936`. Kit: `build-sessions/FINAL-CHECK-KIT.md`.
Phase A = code pass (`SOURCE: CODE`). Phase B = staging browser walk (`SOURCE: SEEN`): headless Chromium at 375 · 768 · 1280,
light and dark (`sn-theme` cookie), signed in as `coordinator` (Tala Events Coordination, and its seat on Hardin ng Tagaytay),
and as `messy_one` for the hosts' pages (the coordinator cannot open `/dashboard/<event>`: 404, see A7-B03).
Read against the corpus `HOUSE_DESIGN_STANDARD_2026-11-20.md` (Parts C, D, F, H, K) and `DARK_MODE_STANDARD_2026-11-20.md`.

Marks on each line: **OFFLINE** = NEEDED (where signal is lost) · READ-ONLY · NOT NEEDED.
**SHAPE** = TODAY → SHOULD (PAGE · FULL-SCREEN POPUP · SMALL POPUP); `=` when they match.
Offline today: the only saved addresses are `OFFLINE_COPY_SHAPES` in `apps/web/lib/offline-copies.ts` (event Home, Check-in desk,
Schedule, the supplier's On the day + live console, a customer's Schedule tab, a guest's Me) plus `/[slug]` and `/[slug]/find-my-table`
in `public/sw.js`. No page in this area is on that list.

## BLOCKERS

**No product blocker found.** Two parts of this area cannot be walked on the copy, because of how the copy was seeded
(not a fault of the code; logged here so the controller can decide):

- **CHECK BLOCKED (seed) · the 3D demo.** `/pa3d` and `/pa3d/try` → "Step inside" → "The room didn't load." The server
  action answers 404: `getSampleEvent()` (`app/tour/_lib/sample-event.ts`) reads the sample event by its fixed slug
  `maria-and-jose` with `is_sample = true`, and the copy has no such row (the seed's demo event has its own slug). So
  the room, "Tap any seated guest", the QR and every `/3d_plan/demo/<token>` cannot be made on the copy. Production is
  not checked (never touched). If production also lacks that row, this is a blocker for the whole demo.
- **CHECK BLOCKED (seed) · the coordinator's seat.** The coordinator's day-of tools on both seeded weddings are behind the
  "This booking is not confirmed on Setnayan yet" lock (`feeLockCopy` reason `no_charge`): the seed set the
  `event_vendors` status but never made the Setnayan handshake. So `/vendor-dashboard/clients/<event>/seat-plan` shows
  only the lock, and A7-16 / A7-17 cannot be seen on the copy. The lock itself is a finding (A7-B02).
- **Seen, already reported by area 4 (B-01):** every Event Hub `/[slug]` answers 500 after about 23.6 s ("Still
  opening your invitation…", reference shown). From this area it is reached by the venue walk's "← Back to the
  invitation". An unknown slug (`/fc7-no-such-event`) also answers 500, not 404.

## Progress

- [x] /[slug]/venue · OFFLINE: READ-ONLY (at the venue on the day; find-my-table already holds the seat offline, the walk is not saved today) · SHAPE: PAGE =
- [x] /3d_plan/demo/[token] · OFFLINE: NOT NEEDED · SHAPE: PAGE = (opened from a QR)
- [x] /dashboard/[eventId]/plan3d · OFFLINE: READ-ONLY (at the venue on the day; agree it is saved for the day — today it is not, no Seats address is in `OFFLINE_COPY_SHAPES`) · SHAPE: PAGE = (a forward to Guests › Seats › 3D, which keeps its own address `?gview=seats&seat=3d`; its View only card and Accents sheet differ, see A7-08, A7-09)
- [x] /dashboard/[eventId]/studio/panood/setup/venue-check · OFFLINE: NOT NEEDED (it measures the signal; with none it says "We couldn't reach Setnayan from here") · SHAPE: PAGE = (opened on a phone at the venue; the place note is for the coordinator)
- [x] /dashboard/[eventId]/vendors/[vendorId]/workspace · OFFLINE: NOT NEEDED (money is never kept offline, HOUSE F2; the day's supplier contacts are on the saved Home › Today and Schedule) · SHAPE: PAGE = (its own address with `?tab=` and `#payments` doors; its sheets differ, see A7-26)
- [x] /for-coordinators · OFFLINE: NOT NEEDED · SHAPE: PAGE =
- [x] /pa3d · OFFLINE: NOT NEEDED · SHAPE: PAGE =
- [x] /pa3d/try · OFFLINE: NOT NEEDED · SHAPE: PAGE = (the link people paste)
- [x] /vendor-dashboard/clients/[eventId]/seat-plan · OFFLINE: READ-ONLY (at the venue on the day: the caterer's covers per table; agree it is saved for the day — today it is not, only the customer's `?tab=schedule` is) · SHAPE: PAGE =
- [x] /vendor-dashboard/spaces · OFFLINE: NOT NEEDED (set up at the shop, with signal) · SHAPE: PAGE = (its space sheet differs, see A7-11)

## Phase B · the staging walk (SOURCE: SEEN)

How it was walked: headless Chromium through the session's proxy, every page at 375 · 768 · 1280 in light and dark
(the `sn-theme` cookie), scrolled to the end, then every visible control pressed at 375 (and 1280 where the controls
differ). Links were checked by asking for the address. Controls that would change shared data (Pay, Record, Send,
Remove, Save, Confirm) were counted but not pressed, as the kit asks. No money was paid, nothing seeded was deleted.

**Speed caveat.** With eight checkers on one preview, first loads took 2 s to over 90 s (several timed out at 90 s
and were re-walked). The same address answered in 1–3 s minutes later. Speed (kit check 10) is therefore not judged
page by page; anything over 2 s here is the preview under load, not a finding.

**Dark.** None of the ten pages is on `DARK_READY` (`lib/appearance.ts`), so a person who chose Dark sees every page
in this area in light. Seen at all three sizes: `html.dark` is never set and the page stays light. One finding,
A7-34, covers the area and the four-role comparison (Add 7).

### Progress (phase B)

- [x] /for-coordinators · SEEN 375/768/1280 · DARK: light only (public) · buttons 23 · pressed 23 · failed 0 at 375; buttons 36 · pressed 36 · failed 0 at 1280
  · A7-18 seen (₱24,999 and "4.9 · 64" on "Amihan Events, Taguig", a made-up shop) · A7-19 seen ("No end date" twice) · CLEAN: the hero repeats "free" in the button and the line under it · BALANCED: ok · EFFECTIVE: ok
- [x] /pa3d · SEEN · DARK: light only (public) · buttons 11 · pressed 11 · failed 0 · "Step inside" → "The room didn't load" on the copy (see BLOCKERS: seed) · A7-28 new
- [x] /pa3d/try · SEEN · DARK: light only (public) · buttons 7 · pressed 7 · failed 0 · same room failure · A7-28 new (the page contradicts itself)
- [x] /3d_plan/demo/[token] · SEEN with an unknown token only (no token can be minted on the copy) · DARK: light only · buttons 1 · pressed 1 · failed 0 · A7-03 seen: "This demo link expired … from the 3D Plan tile on the Setnayan homepage", and no button but the wordmark
- [x] /[slug]/venue · SEEN on stg-bea-paolo, stg-carla-miguel, stg-maria-jose-dela-paz · always dark (the guest walk's own skin) · buttons 1 · pressed 1 · failed 1 (its only button, "← Back to the invitation", lands on the Event Hub that answers 500: area 4 B-01) · every seeded plan shows "The 3D room opens on the day", so A7-01, A7-02 and A7-05 cannot be seen on the copy (no event is today)
- [x] /dashboard/[eventId]/plan3d · SEEN as messy_one (stg-maria-jose-dela-paz) · forwards to `guests?gview=seats&seat=3d` as Phase A said · DARK: no · the 3D room draws · at 375 the count row ("161 · 174 · 40") is cut off under the "More seat-plan tools" button (A7-35) · the seeded 40 tables are drawn piled in one corner, across the wall: a seed fault, not counted (see Seed notes)
- [x] /dashboard/[eventId]/studio/panood/setup/venue-check · SEEN · DARK: no · idle screen correct ("Takes about 25 seconds · Uses up to 9 MB · 2.6 Mbps") · "Start the check" pressed: it starts (the result was not awaited; a cloud machine is not a venue)
- [x] /dashboard/[eventId]/vendors/[vendorId]/workspace · SEEN as messy_one, supplier Tala Events Coordination, tab Book & Budget · DARK: no · A7-25 seen ("Record payment" and "Propose a change" are both accent-tinted pills) · A7-32, A7-33 new
- [x] /vendor-dashboard/clients/[eventId]/seat-plan · SEEN as coordinator on both weddings · DARK: no · only the lock is shown (BLOCKERS: seed) · A7-29 new
- [x] /vendor-dashboard/spaces · SEEN as the coordinator's seat on Hardin ng Tagaytay · DARK: no · A7-15 seen (bare empty line, hand-made top) · A7-11 seen on the New hall sheet (ten rows and two buttons in a half sheet that scrolls inside) · A7-12 seen in part ("Add the hall" filled, "Add another like this" accent-tinted) · A7-30, A7-31 new · good: the New hall sheet fills Floor width 30 and length 45 from the venue's own size

### New findings (phase B)

#### A7-28 · /pa3d calls the sample room "A real reception, not a mock-up"

```
PAGE      /pa3d   and   /pa3d/try
BUTTON    none — the eyebrow over "Step inside"
STEPS     1. Open /pa3d at 375.  2. Read the card above "Step inside".  3. Open /pa3d/try.
EXPECTED  A sample said to be a sample, once. No made-up couple shown as real (Add 3).
ACTUAL    "A REAL RECEPTION, NOT A MOCK-UP · Maria & Jose's room — their tables, their seats, their colours."
          Maria & Jose is the seeded sample event (`is_sample`, slug `maria-and-jose`). /pa3d/try says the opposite
          one line above it ("This is Maria & Jose's sample room") and then repeats the same card, so the page says
          "sample" and "not a mock-up" about one room, and its heading "Stand in a real reception." repeats it.
          At 375 the eyebrow breaks with "UP" alone on its second line.
SHOTS     375 px light (pa3d, pa3d-try)
RULE      Add 3 (made-up people / demo shown as real) · Add 2 CLEAN (a title repeating the one above) · brand.md claims
SEVERITY  wrong
SOURCE    SEEN
```

#### A7-29 · The coordinator's seat plan: a lock with no way forward, saying the opposite of "Booked"

```
PAGE      /vendor-dashboard/clients/[eventId]/seat-plan   (as coordinator; Bea & Paolo and María-José & Juan Carlos)
BUTTON    none — "Back to the booking" is the only control
STEPS     1. As the coordinator, open Clients › Bea & Paolo (the header reads "Booked").  2. Open Seats.
EXPECTED  The lock names the one thing to do and gives ONE button to do it (B7); one word for the booking's state.
ACTUAL    "This booking is not confirmed on Setnayan yet. The rest of this event — and this event's day-of tools —
          open once you accept this booking on Setnayan and its booking fee is settled." No button: the person must
          guess where "accept" lives. The client page one tap back says "Booked" (and "PAID ₱0 of …"). Two screens
          disagree on whether this booking exists. `feeLockCopy` (`lib/event-access-stage.ts`) sets `cta: null` for
          reason `no_charge` on purpose (no bill yet), but then the door should be the accept step, not nothing.
SHOTS     375 px light (the lock, beside the client page header)
RULE      design-and-wiring B7 (locks are honest: one button) · CLAUDE.md §4 (booked = one reader) · Add 2 EFFECTIVE (no dead end)
SEVERITY  wrong
SOURCE    SEEN
```

#### A7-30 · Spaces: a helper fills the whole New hall sheet, "Add the hall" is refused, and the sheet says nothing

```
PAGE      /vendor-dashboard/spaces   (coordinator's seat on Hardin ng Tagaytay Events Place, role Helper)
BUTTON    "Add what you typed" → "Add the hall"
STEPS     1. Switch to Hardin ng Tagaytay.  2. Shop › Spaces.  3. Tap the search icon, type a name, tap "Add what you typed".
          4. In "New hall", press "Add the hall".
EXPECTED  Either a helper cannot start (the page says who can change spaces), or the refusal shows in the sheet with
          the reason (HOUSE F4).
ACTUAL    The sheet opens with every control live. "Add the hall" posts; the server answers
          `{ok:false, error:"Only the shop's owner can change its spaces."}` and the sheet stays open, unchanged, with
          no message, for as long as I watched (60 s). Pressing again does the same. The person thinks the app froze.
          (Nothing was saved, so there was nothing of mine to delete.)
SHOTS     375 px light (the sheet after pressing)
RULE      CLAUDE.md §5 rule 4 · HOUSE F4 (failure gives a plain reason) · design-and-wiring B6
SEVERITY  broken
SOURCE    SEEN
```

#### A7-31 · Spaces' empty state points to "the box below", which is a search icon

```
PAGE      /vendor-dashboard/spaces   (a shop with no spaces: Hardin ng Tagaytay on the copy)
BUTTON    the search icon at the thumb (bottom left)
STEPS     1. Open Spaces with no spaces at 375.
EXPECTED  The empty state states the fact and offers one action (kit check 9): an "Add a space" button.
ACTUAL    "No spaces yet. Type in the box below to add your first." There is no box: search is an icon until tapped
          (house rule), so a first-timer looks for a box that is not drawn. The add is found only by tapping the
          magnifier.
SHOTS     375 px light
RULE      kit check 9 · Add 5 (first-timer) · Add 2 EFFECTIVE
SEVERITY  wrong
SOURCE    SEEN
```

#### A7-32 · The hosts' workspace counts an unconfirmed payment as paid; the supplier counts ₱0

```
PAGE      /dashboard/[eventId]/vendors/[vendorId]/workspace?tab=budget   (messy_one, stg-maria-jose-dela-paz, Tala Events Coordination)
          against /vendor-dashboard/clients/[eventId]?tab=details (coordinator, the same booking)
BUTTON    none — "Payments so far", Progress
STEPS     1. As the hosts open Tala's Book & Budget.  2. As the coordinator open the same client.
EXPECTED  One paid figure for one booking on both sides, from one reader (resolveEventMoney / event_vendor_money_read),
          and an unconfirmed payment shown as "waiting for confirmation", not as paid.
ACTUAL    Hosts: "PAYMENTS SO FAR · ₱14,364 paid", "₱14,364 · Nov 11, 2026 · bank_transfer · Awaiting Tala Events
          Coordination's confirmation", and Progress ticks "✓ First payment paid".
          Supplier: "PAID ₱0 of ₱47,880 · ₱14,364 to collect" and "The couple logged a ₱14,364 payment … Confirm received".
          The same ₱14,364 is paid on one side and unpaid on the other.
SHOTS     375 px light, both screens
RULE      CLAUDE.md §4 (Budget: one reader) · design-and-wiring C8 · kit check 3 (connections)
SEVERITY  money-signin
SOURCE    SEEN
```

#### A7-33 · "Amount to pay: Next payment" with no amount, and a raw method code

```
PAGE      /dashboard/[eventId]/vendors/[vendorId]/workspace?tab=budget   (as above)
BUTTON    none — the AMOUNT TO PAY card
STEPS     1. Open Book & Budget for a supplier who has no payment method on Setnayan.
EXPECTED  The amount still owed (₱ from the one reader) or no "Amount to pay" row at all; methods in plain words.
ACTUAL    The row reads "Amount to pay: Next payment" — a label and a step name, no peso. The payment line shows the
          stored code "bank_transfer" (the supplier's page shows it too) instead of "Bank transfer".
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4 (a missing value never drawn as if complete) · Add 2 EFFECTIVE (labels are plain words)
SEVERITY  wrong
SOURCE    SEEN
```

#### A7-34 · Area 7 has no dark mode, and the supplier role wears its own colours (Add 7)

```
PAGE      every signed-in page in area 7, and the four-role comparison
BUTTON    Account › Appearance › Dark
STEPS     1. Choose Dark.  2. Open each page of this area.  3. Compare the coordinator's Today with the couple's Home.
EXPECTED  Each signed-in page has a dark design; the four roles share one light and one dark design (Add 7).
ACTUAL    DARK: no on all five signed-in pages (plan3d → Guests › Seats › 3D, venue check, workspace, supplier seat plan,
          Spaces): none is on DARK_READY. Across roles (measured on the copy):
          · page, light — couple rgb(247,245,244) warm grey · supplier rgb(238,242,248) blue-grey
          · page, dark — couple rgb(18,17,16) warm near-black · supplier rgb(13,22,38) navy (`supplier-look.css`)
          · main button — couple terracotta · supplier blue rgb(34,114,230) ("Add the hall", "Create service card", the shop check)
          · the guest walk `/[slug]/venue` is near-black in both themes (its own skin, allowed for the Event Hub)
          · admin: not walked (no admin sign-in for this checker; area 8 has the shots)
          The supplier's own navy and blue are by design today (B4 note in `lib/appearance.ts`), so this is the owner's
          call; by Add 7's rule it is a finding.
SHOTS     shots/area-7/home-*.png (the coordinator's Today) beside the couple's Home
RULE      Add 7 · DARK_MODE_STANDARD · HOUSE K2
SEVERITY  look
SOURCE    SEEN
```

#### A7-35 · At 375 the 3D seat plan's count row is cut off under a button

```
PAGE      /dashboard/[eventId]/plan3d → Guests › Seats › 3D   (messy_one)
BUTTON    the count chips "161 seated · 174 unseated · 40 tables" and "More seat-plan tools"
STEPS     1. Open the 3D seat plan at 375.
EXPECTED  The row fits or wraps; no control sits on top of another.
ACTUAL    "Seats · 3D 🪑161 👥174 ⊙ 4…" — the tables count is clipped under the round "…" button; the "i" and ⚙ buttons
          follow. Two controls touch (Add 5, one hand).
SHOTS     375 px light
RULE      Add 5 (no two controls touching) · Add 7 (cut-off text)
SEVERITY  look
SOURCE    SEEN
```

### Owner's additions (25 Nov), area 7

#### Add 1 · Popup, full-screen popup, or page (only the ones that differ)

| Where | TODAY | SHOULD | Why (the three tests) |
|---|---|---|---|
| Spaces › "Add what you typed" → New hall | SMALL POPUP (half `Sheet`, 10 rows + 2 buttons, scrolls inside) | FULL-SCREEN POPUP | more than one short screen (A7-11, seen) |
| Spaces › a hall's sheet › "Open the floor plan" | full-screen popup over a half sheet | one layer: the hall itself rises full screen | never a popup on a popup (A7-11, code) |
| 3D seat plan › "View only / Editing" card | hand-made card, no backdrop | SMALL POPUP (`Sheet`) | one short choice (A7-08, code; the 3D buttons were not reachable in the headless walk) |
| 3D seat plan › Accents | half `Sheet`, 22 rows | FULL-SCREEN POPUP | long fill-in with photos (A7-09, code) |
| Workspace › Log your payment · Propose a change · Photo approvals | half `Sheet` | FULL-SCREEN POPUP | photo / four fields / a photo list (A7-26, code) |
| Workspace › Pay › Show QR | hand-made popup on the pay sheet | one layer | never a popup on a popup (A7-26, code) |
| Workspace itself (`…/workspace`) | a PAGE drawn with a ✕ like a full-screen popup | PAGE (keep), but a ✕ on a page reads as "close a popup": use the Back arrow | it has its own address with `?tab=` doors; people come back to it |

Every one of the ten routes is rightly a PAGE.

#### Add 2 · Clean, balanced, effective

| Screen | CLEAN | BALANCED | EFFECTIVE |
|---|---|---|---|
| /for-coordinators | fails: "free" twice in the hero (button and the line under it) and "No end date" (A7-19) | ok at 375 and 1280; 768 is the phone column centred, not a tablet layout | ok |
| /pa3d | fails: "A REAL RECEPTION, NOT A MOCK-UP" eyebrow over a sample (A7-28); "UP" orphaned at 375 | ok | ok until "Step inside" (room fails on the copy) |
| /pa3d/try | fails: heading, lede and card say the same thing three times (A7-28) | ok | ok |
| /3d_plan/demo (expired) | ok | fails at 1280: a small card top-left of an empty page | fails: no next step (A7-03) |
| /[slug]/venue (before the day) | ok | ok | ok: says when to come back, one button |
| 3D seat plan (375) | ok | fails: count row cut under a button (A7-35) | ok |
| Venue check | ok | ok | ok: one main button, the cost in data before you press |
| Workspace › Book & Budget | fails: two accent pills (A7-25) | ok | fails: "Amount to pay: Next payment" with no amount (A7-33); "bank_transfer" is a code |
| Supplier seat plan | ok | ok | fails: a lock with no button (A7-29) |
| Spaces | fails: hand-made top, bare empty line (A7-15) | ok | fails: "the box below" is not drawn (A7-31); a refused save says nothing (A7-30) |

#### Add 3 · Placeholders a real person could see

- /pa3d, /pa3d/try: "Maria & Jose" shown as "a real reception, not a mock-up" (A7-28).
- /for-coordinators: the sample card "Amihan Events · Taguig · ₱24,999 · 4.9 · 64 · about 8 km" (A7-18). It is labelled "A sample card and calendar", but the price and rating are typed.
- /3d_plan/demo: "A sample guest, on a sample table" (A7-04, code; no token could be minted on the copy).
- Workspace: "Amount to pay: Next payment" with no amount (A7-33).
- Code grep (`lorem|TODO|TBD|coming soon|john doe|sample|XXX|beta`) over the ten routes found nothing else a person sees. The `+63 9XX XXX XXXX` hint on the self-added contact card reads as a hint (fine).

#### Add 4 · Every place to buy or upgrade in area 7

| Route | What is sold | Price shown | How a person reaches it | EVIDENT · CLEAN · HONEST |
|---|---|---|---|---|
| /vendor-dashboard/spaces › 🔒 "Your own names", 🔒 "Make it a floor plan" | supplier Plus | none: "Price from the price sheet when you tap Upgrade" (A7-14) | a space's sheet (Free shop only) | EVIDENT fails (no price before pressing) · CLEAN ok · HONEST not seen: both seeded shops are Plus/Pro, so the lock never shows on the copy |
| /for-coordinators › "Your shop, fees and plans" ⓘ, the Booking fee line | supplier plans; the booking fee | the fee read from `_facts.ts` ("5% up to ₱100,000, 3% above"); plans via /pricing | ⓘ on the page | ok |
| /for-coordinators › "Start as a coordinator free →" | nothing (opens the shop) | "free" | hero and close | ok; answered 200 in 77 s on the copy |
| Workspace › "Pay {supplier}" (direct pay sheet, BDO / GCash QR) | the booking payment to the supplier | the plan's due amount | Book & Budget | not seen: Tala has no payment method on the copy, so the card says "hasn't added a way to pay"; never pressed |
| Workspace › "Record payment" | logs a payment the couple made elsewhere | typed by the couple | Book & Budget | not pressed (would write) |
| Supplier seat plan lock | (would be the booking fee) | none, and no button (A7-29) | Clients › a booking › Seats | EVIDENT fails |
| /pa3d, /pa3d/try | nothing for sale on the page ("start planning free") | — | — | ok |

Taps from the wall to "payment logged": not measurable on the copy (no lock in this area has a button that reaches a checkout).

#### Add 5 · Easy to handle (main jobs, first-timer, one hand, 375)

| Job | Rating | The step that makes it hard |
|---|---|---|
| Add a space (venue) | HARD | the empty state points at a box that is not drawn (A7-31); as a helper the save fails silently (A7-30) |
| See a client's seat plan as the coordinator | HARD | the lock gives no button (A7-29) |
| Walk your own reception in 3D (hosts) | OK | the count row is cut at 375 (A7-35); the rest of the controls sit in a bottom row in thumb reach |
| Check the venue's signal | EASY | one button, says data use and time first |
| Pay / log a payment to the coordinator (hosts) | OK | "Amount to pay" has no amount (A7-33) |
| Try the 3D demo (public) | HARD on the copy | the room does not load (seed); on a phone the room traps the page's scroll (A7-05, code) |

Tap targets under 44 px seen at 375: the SETNAYAN wordmark (110 × 23) and "setnayan.com/pa3d/try" (157 × 17) on /pa3d; "read what it's for" (112 × 17) on /pa3d/try; the "Setnayan home" link (171 × 30) on the expired demo. Each is a text link; the kit asks for 44.


#### Add 6 · Buttons pressed (375; 1280 where the controls differ)

Counted: every visible button, link, tab, toggle, select and summary. Links were checked by asking for their address
(all answered 200, some after 77–93 s on the loaded preview). Three tools-only misses are not counted as failures: the
search icon sits under its own transparent input (a finger lands on the input, which opens search), one ⓘ needed a
real tap, and the notifications bell (its badge moves) opens its panel on a real tap. All three were re-pressed by hand and work.
On every signed-in page the wordmark link to `/dashboard?hub=1` has no accessible name (a screen reader says "link").

| Page | 375 | 1280 | Not pressed, and why |
|---|---|---|---|
| /for-coordinators | buttons 23 · pressed 23 · failed 0 | buttons 36 · pressed 36 · failed 0 | — |
| /pa3d | buttons 11 · pressed 11 · failed 0 | (as 375, plus the desktop top bar) | the room itself: it does not load on the copy (seed) |
| /pa3d/try | buttons 7 · pressed 7 · failed 0 | (as 375) | as above; "Tap any seated guest" cannot be reached |
| /3d_plan/demo/[token] | buttons 1 · pressed 1 · failed 0 | same | — |
| /[slug]/venue | buttons 1 · pressed 1 · failed 1 | same | its one link opens the Event Hub that answers 500 (area 4 B-01) |
| Guests › Seats › 3D | buttons 65 (40 of them are tables) · pressed 0 | — | the headless browser could not finish drawing the room within 2–3 min on the loaded preview; Walk in / Accents / View only were not reached |
| Venue check | buttons 15 · pressed 15 · failed 0 | — | "Start the check" was pressed and started (content changed); its result was not waited for |
| Workspace › Book & Budget | buttons 33 · pressed 27 · failed 0 confirmed · 5 timed out at 180 s on the loaded preview (Close, Chat, Details, Schedule, one unnamed button) | — | 6 not pressed because they write: Record payment, Save costs, Delete the payment, Amount to pay, its ⓘ, the Book & Budget tab re-press. "Propose a change" opens its sheet (Esc closes). See A7-36 |
| Supplier seat plan | buttons 10 · pressed 10 · failed 0 | buttons 20 (the rail adds its words) | — |
| Spaces (Hardin) | buttons 11 · pressed 11 · failed 0, then in the New hall sheet buttons 16 · pressed 3 · failed 1 ("Add the hall", A7-30) | buttons 21 | the sheet's dropdowns and steppers were not changed (they only edit an unsaved draft) |

#### Add 7 · Three sizes, light and dark, one design across roles

- **Shots:** `build-sessions/final-check/shots/area-7/home-{375,768,1280}-{light,dark}.png` = the coordinator's Today
  (`/vendor-dashboard`, Tala Events Coordination). The three `-dark` files are LIGHT: the supplier Today is not on
  `DARK_READY`, so Dark does nothing there. `roles-375-couple-light-couple-dark-supplier-dark.png` sets the couple's
  Home (light, dark) beside the supplier's Clients (dark, which is dark-ready) at 375.
- **Sizes:** 375 ok (bottom bar, thumb row); 768 is a real tablet layout (icon rail, no bottom bar); 1280 has the full
  rail with words. No bottom bar and rail showing together; no sideways scroll on any area 7 page at any size.
  On /3d_plan/demo at 1280 the card sits top-left of an empty page (BALANCED).
- **Dark:** `DARK: no` on all five signed-in pages of this area; `light only` on the four public ones; the guest walk is
  always dark. Count: signed-in no-dark 5 · public light-only 4 · own skin 1.
- **Roles:** see A7-34. Couple light page rgb(247,245,244) vs supplier rgb(238,242,248); couple dark rgb(18,17,16) vs
  supplier navy rgb(13,22,38); couple main button terracotta vs supplier blue rgb(34,114,230). Admin not walked here.

#### Add 8, Add 9 · not this area.

#### Add 10 · Offline, beyond the five (area 7)

Tried on the copy (the service worker installs: `sw=active`), then DevTools-style offline and a reload:
`/stg-bea-paolo/venue`, `/pa3d` and `/for-coordinators` each give the browser's own "No internet" page, not a Setnayan
line. That matches Phase A: none of these addresses is in `OFFLINE_COPY_SHAPES` or `sw.js`.

**Coordinator**

| Part | When the signal drops | Level | Why |
|---|---|---|---|
| `/vendor-dashboard/clients/[eventId]/seat-plan` (covers per table, who sits where) | at the venue on the day | READ-ONLY | the caterer and coordinator need the table list at the door; today it is not saved |
| `/vendor-dashboard/spaces` | at the shop | NOT NEEDED | set up with signal |

**Event host / couple**

| Part | When the signal drops | Level | Why |
|---|---|---|---|
| Guests › Seats › 3D (`/dashboard/[eventId]/plan3d`) | at the venue on the day | READ-ONLY | showing the room to the venue's staff; a saved copy is enough (the 2D seat editor is Area 2's FULL case) |
| Workspace (`…/vendors/[vendorId]/workspace`) | on the road | READ-ONLY for Details (the supplier's phone and address); money NOT NEEDED (HOUSE F2) | the couple calls the supplier from the car |
| Venue check | at the venue | NOT NEEDED | it measures the signal; offline it says it could not reach Setnayan |

**Guest / Event Hub**

| Part | When the signal drops | Level | Why |
|---|---|---|---|
| `/[slug]/venue` (the 3D walk to your seat) | at the venue on the day | READ-ONLY | the guest finding their table in a weak-signal hall; `find-my-table` is saved, this is not. Today offline shows the browser's error |

#### Add 10b · The supplier QR challenge (area 7's part)

1. **The list (area 7 only).**
   - The 3D demo guest QR (`mintPlan3DGuestQr`, /pa3d and /pa3d/try → "Tap any seated guest"): opens `/3d_plan/demo/<token>` from that guest's seat. Not a supplier QR; a demo. Could not be made on the copy (seed).
   - The supplier's payment QR in the hosts' workspace ("Pay {supplier}" → "Show QR", BDO / GCash): made by the supplier in Profile › How clients pay you (area 5/6), shown here to the couple. Not seen on the copy (Tala has no payment method).
   - The coordinator's own invite QR (`/i/<shop>`) is shown on /for-coordinators only as a drawn sample (`FcSampleQr`, not a real code, says the code); the real one is in Shop › Partnerships (area 5).
   - Spaces and the supplier seat plan make no QR.
2. **No signal.** The demo QR is minted by a server action: offline it cannot be made (and the room cannot load). The payment QR is an image the supplier uploaded; whether it shows offline depends on the browser cache (the workspace is not saved).
3. **Back online.** The demo QR touches no date, price or gift. The payment QR touches money: a QR shown from a stale page could carry an account the supplier has since changed. Today the workspace reads it fresh on every load; nothing warns when a copy is old. Name of the case: "a price or account changed in between".
4. **Taps.** Not measurable here (no supplier QR maker in area 7).

#### A7-36 · Workspace: 16 px ⓘ buttons, a 13 px "on" link, and "Open workspace" that opens the same page

```
PAGE      /dashboard/[eventId]/vendors/[vendorId]/workspace?tab=budget   (messy_one, Tala Events Coordination)
BUTTON    ⓘ "About Who can do what" · ⓘ "About Amount to pay" · ⓘ "About Change orders" · "on" · "Open workspace"
STEPS     1. Open Book & Budget at 375.  2. Tap each ⓘ with a thumb.  3. Press "Open workspace".
EXPECTED  Every tap target at least 44 px (Add 5); every control goes somewhere new.
ACTUAL    The three ⓘ are 16 × 16 px, the "on" control is 13 × 16 px and changes nothing visible. "Open workspace"
          (beside "Message") links to the workspace the person is already in.
SHOTS     375 px light
RULE      Add 5 (one hand, 44 px) · design-and-wiring B5 (every press reaches a real destination)
SEVERITY  look
SOURCE    SEEN
```

### Seed notes (not findings; for whoever re-seeds the copy)

- The sample event `maria-and-jose` (`is_sample`) is missing → no 3D demo, no demo QR (BLOCKERS).
- The coordinator's two bookings have no Setnayan handshake → every coordinator day-of tool is locked (BLOCKERS).
- `event_tables.x_pos / y_pos` are seeded in pixels (100–820, 120–1560) while a sized room reads them as percent, so
  all 40 of María-José's tables are drawn piled in the bottom-right corner, across the wall. A real plan stores
  percent; the 3D room could still clamp a stray table inside the walls.
- Hardin ng Tagaytay has `venue_width_m 30 × venue_length_m 45` but no `vendor_units` row, so Spaces is empty, and the
  coordinator's seat (role Helper) may not add one (A7-30). No seeded event is today, so the guest walk never opens.

### Seen in other areas (reported there or for the controller)

- Event Hub `/[slug]` 500 after ~23.6 s, and an unknown slug answers 500 not 404: area 4 B-01.
- `/login`: 1 of 7 password sign-ins failed under load with "We could not sign you in. Check your email and password,
  or try again in a moment."; the address became `/login?error=%7B%7D` (an empty error object) and the email field was
  emptied, so it had to be typed again (Add 5: nothing typed is lost). The same sign-in worked on the next try. Area 1.
- `/api/telemetry/client-fault` answers 500 `insert_failed` on the copy (client faults are not being recorded). Controller.
- `/vendor-dashboard` (area 5): React error #418 (hydration mismatch) at 768 and 1280. Likely the greeting ("Good afternoon")
  worked out in the server's time zone and again in the browser's (the checker's browser runs in UTC). A person abroad would see it flicker.
- `/dashboard/<event>` Home (area 2): a 4-step coach-mark tour ("STEP 1 OF 4 · Now · Press Next") covers the page at first open (Add 5: a step that needs a tour).

## Phase A summary (code pass, 10 of 10 pages)

- Findings: 27 · blocker 0 · money-signin 1 (A7-24) · broken 2 (A7-22, A7-27) · wrong 14 · look 10.
- OFFLINE marks: NEEDED 0 · READ-ONLY 3 (`/[slug]/venue`, `/plan3d`, supplier `seat-plan`) · NOT NEEDED 7.
  Where I differ from the plan: the 3D room is view-only now, so a saved read-only copy is enough. NEEDED fits the
  2D seat plan that the coordinator edits (Guests › Seats, Area 2). None of the three is saved for offline today.
- SHAPE marks: all 10 pages are PAGE and should be PAGE. Six popups inside them differ from what the rules say:
  - the 3D room's View only card → SMALL POPUP (A7-08);
  - Accents → FULL-SCREEN (A7-09);
  - a space's sheet → FULL-SCREEN (A7-11);
  - three workspace sheets → FULL-SCREEN (Log your payment, Propose a change, Photo approvals; A7-26).
  
  There are also four places where a popup opens on top of a popup: the floor plan and the 🔒 over a space's sheet, the
  QR and leaving popups over the pay sheet, and "Show" over the View only card.
- Phase B is waiting for the staging address. These are the findings the browser has to settle:
  - A7-01: watch for 70 s;
  - A7-05: scroll with a thumb on a phone;
  - A7-08 and A7-26: tap the backdrop;
  - A7-15 and K2 everywhere: the dark top-block glow;
  - A7-27: see what is drawn.

## Scope notes

- `/dashboard/[eventId]/plan3d` only forwards (`redirect(guestsViewHref(eventId, 'seats', { seat: '3d' }))`). The 3D plan now lives in
  Guests › Seats › 3D: `guests/page.tsx` streams `seating/page.tsx` (`host=guests`), which streams `seating/lab/page.tsx` (the room).
  Those host pages are Area 2's; the room's own controls (`seating/lab/_components/*`) are checked here because they ARE the 3D plan.
- `/pa3d` and `/pa3d/try` mount the same `Pa3dRoom`; findings A7-05 to A7-07 apply to both.
- Maps: no Area 7 page draws an OpenStreetMap picture (no `scene-map-tiles`, `vendor-location-map`, `venue-widget` or
  `reach-map` import under any of the ten routes), so the OSM-prefetch rule has nothing to hold here. The seeded venue's map
  pin is drawn on its shop page `/v/[slug]` (Area 1) and the Event Hub's venue plate (Area 4).
- One source: the guest walk reads `public_venue_scene`, the couple's 2D and 3D read `lib/seating.ts`, the supplier reads
  `get_vendor_seat_plan`, Spaces reads `vendor_units`. Spaces and the couple share the one editor (`SeatingEditor` in venue
  mode) and the one engine (`lib/seat-plan-engine`); the supplier's client seat plan does not (A7-16, A7-17).

## Findings

### A7-01 · The venue walk's live refresh throws away what the server joined

```
PAGE      /[slug]/venue?t=<a seated guest's personal token>   (event: any with a published plan, e.g. stg-carla-miguel)
BUTTON    none — the room's own refresh, every 60 s while visible
STEPS     1. Open the walk from a seated guest's personal link.
          2. Note "You're at <table name>", the couple's colours on the room, the booth logos, and
             "Book this supplier for your event" on a booth card.
          3. Keep the tab visible for just over a minute.
EXPECTED  The room changes only when a seat, table or booth really moved, and keeps the table's name,
          the couple's colours, guest photos, booth logos and the booth card's links.
ACTUAL    `use-live-scene.ts` re-asks `public_venue_scene` from the browser and swaps in the RPC's RAW answer.
          The first scene was built on the server with joins the raw answer lacks: `withYourTableName`
          (`you.tableName`), `rolePalette` (events.role_palette), resolved guest photo URLs, resolved booth
          logo / poster URLs, and the booth's `slug` / `bookable` / `boothAddonActive` (fetchBooths).
          `sceneSignature` hashes `you`, `photos` and `booths`, so the first poll always "differs" for a seated
          token holder or any event with booths. After ~60 s: the caption falls back to "your table", the room
          drops to the default palette, photos and logos become `r2://` refs (broken or generic), branded booths
          go generic, and the booth card loses "Book this supplier". `/api/venue-scene/[slug]` already makes most
          of these joins ("so a live refresh never puts the code back") but nothing calls it.
SHOTS     375 px light + dark, at 0 s and at 70 s
RULE      CLAUDE.md §4 (one reader per fact) · design-and-wiring C8
SEVERITY  wrong
SOURCE    CODE
```

### A7-02 · "Try again" on the venue walk forgets whose walk it was

```
PAGE      /[slug]/venue?t=<token>
BUTTON    "Try again" (on "The 3D venue didn't load")
STEPS     1. Open a guest's personal venue link when the scene read fails.  2. Press "Try again".
EXPECTED  The same walk again, with the guest's own gold seat and tablemates.
ACTUAL    The link is `/${slug}/venue` with no `?t=`. A retry that works shows the anonymous room: no
          "You're at…", no gold seat, no tablemates. Every other door to this page carries the token
          (`room-links.ts`, `site-nav.ts`: `${base}/venue?t=…`).
SHOTS     375 px light
RULE      design-and-wiring B6 (trace the control to its end)
SEVERITY  wrong
SOURCE    CODE
```

### A7-03 · The 3D demo's dead end points at a homepage tile that no longer exists

```
PAGE      /3d_plan/demo/[token]   (an old or reused token)
BUTTON    none — the card has no button
STEPS     1. Open /3d_plan/demo/<an expired token>.
EXPECTED  A way forward to where codes are made today (/pa3d/try).
ACTUAL    "This demo link expired. … open a new one from the 3D Plan tile on the Setnayan homepage." The
          homepage has had no 3D Plan tile since the cinematic homepage went (2026-08-13, noted in
          `_doorway.tsx`); codes are minted by "Tap any seated guest" in the room on /pa3d and /pa3d/try. The
          card offers no button, only the wordmark home.
          Also: `loadPlan3DDemoScene` ignores the guests read's error (`guestResult.data ?? []`), so when that
          read fails `resolvePlan3DGuestToken` finds no guest and the page says "This demo link expired." — a
          failed read told as an expiry.
SHOTS     375 px light
RULE      design-and-wiring A4 (every way in moves with it) · CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

### A7-04 · The 3D demo promises the walk to "every real Setnayan guest"

```
PAGE      /3d_plan/demo/[token]   (a fresh token from /pa3d/try)
BUTTON    "Where am I seated?" → the line under "You're at …"
STEPS     1. On /pa3d/try tap a seated guest, open the code.  2. Press "Where am I seated?".
EXPECTED  A true line, e.g. that guests get this when their hosts share the seat plan.
ACTUAL    "A sample guest, on a sample table — every real Setnayan guest gets this on the day." Guests only
          get the walk when the hosts publish the plan (`public_venue_scene` is published-gated) and the event
          type has seating (`/[slug]/venue` 404s otherwise).
SHOTS     375 px light
RULE      docs/brand.md (claims never made: promises about Setnayan)
SEVERITY  wrong
SOURCE    CODE
```

### A7-05 · On a phone the 3D room traps the page's scroll

```
PAGE      /pa3d  and  /pa3d/try
BUTTON    "Step inside" → the room
STEPS     1. At 375 px press "Step inside".  2. With the room loaded, put a thumb on it and swipe up to scroll on.
EXPECTED  The page scrolls; the room turns only on a deliberate gesture (or a visible tap path).
ACTUAL    The canvas sets `touchAction: 'none'` (`plan3d-scene.tsx`) and fills a 4:5 box the width of the column
          (about 335 × 420 px) in the middle of a long page. A swipe that lands on it orbits the camera; the only
          way past is the 20 px gutters.
SHOTS     375 px light (a screen recording)
RULE      HOUSE_DESIGN_STANDARD D3 ("never touch-action: none on scrolling content")
SEVERITY  look
SOURCE    CODE
```

### A7-06 · "Tap any seated guest": a failed code just vanishes

```
PAGE      /pa3d  and  /pa3d/try
BUTTON    a seated guest in the room ("Tap any seated guest to open the room from their seat")
STEPS     1. Step inside.  2. Tap a guest while the mint fails (or tap one that is no longer seated).
EXPECTED  "Couldn't make their code" with Try again.
ACTUAL    `handleGuestClick` shows "Making their code…", then `.catch(() => setQr(null))` and a `null` answer
          both end with nothing drawn. The press looks like it did nothing.
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4 · HOUSE F4 (failure gives a plain reason + Try again)
SEVERITY  wrong
SOURCE    CODE
```

### A7-07 · The demo room's controls: two filled accent pills, spinners, hand-made buttons

```
PAGE      /pa3d  and  /pa3d/try
BUTTON    "Walk around" / "Walking" · "Their colours: on/off" · "Back to my seat" · "Try again"
STEPS     1. Step inside (colours are ON by default).  2. Press "Walk around".
EXPECTED  One main button per scope; on/off choices are switches; loading is a Ghost, not a spinner.
ACTUAL    "Walking" and "Their colours: on" are both filled `--m-mulberry` pills side by side, with a neutral
          "Back to my seat" between them. Two yes/no choices drawn as accent pills (D2: a yes/no is a switch,
          one switch per drawing). "Standing up the room…" and "Making their code…" use `Loader2 animate-spin`.
          The failed state's "Try again" and all three pills are hand-made `<button>`s, not `ActionButton`.
SHOTS     375 px light + desktop
RULE      HOUSE K1 · D2 · CLAUDE.md §3 (Loading: no spinners; Button: ActionButton)
SEVERITY  look
SOURCE    CODE
```

### A7-08 · The 3D room's "View only" card is a popup with no backdrop, holding another popup

```
PAGE      /dashboard/[eventId]/plan3d → Guests › Seats › 3D   (event: stg-bea-paolo)
BUTTON    "View only" (or "Editing") in the room's bottom row → "Show ▾"
STEPS     1. Open the 3D room.  2. Press "View only".  3. Tap the room behind the card.  4. Press "Show ▾".
EXPECTED  Anything on top dims and blurs the room, the room cannot be used while it is open, a backdrop
          tap closes it (K3). One layer at a time.
ACTUAL    `room-view-tools.tsx` draws the card as a hand-made `role="dialog"` frame inside the tools row: no
          shared backdrop, no dim or blur, the room behind still orbits and takes taps, a tap outside does not
          close it (only pressing "View only" again), no Esc. "Show ▾" then opens a PickMenu list over the card —
          a popup on a popup. The card holds one line, "Take over", "Switch to 2D", "Show" and the legend: a
          SMALL POPUP (`Sheet`) by the shape tests.
SHOTS     375 px light + dark
RULE      HOUSE K3 1–4 · SHAPE (never a popup on top of a popup) · CLAUDE.md §3 (no new hand-rolled dialog)
SEVERITY  look
SOURCE    CODE
```

### A7-09 · Accents is a tall half-sheet of 22 rows; its "Add it" is accent-outlined; a failed "No thanks" is silent

```
PAGE      /dashboard/[eventId]/plan3d → Guests › Seats › 3D   (event: stg-bea-paolo)
BUTTON    "Accents" → "Add it" / "No thanks" on a booked-supplier suggestion
STEPS     1. Open the 3D room.  2. Press "Accents".  3. Scroll the sheet.  4. Press "No thanks" while offline.
EXPECTED  SHAPE: more than one short screen → FULL-SCREEN POPUP (`RiseScreen`). One main button per row,
          others neutral. A failed save says so.
ACTUAL    TODAY a `Sheet` with 22 rows (7 "In the 3D room" + 15 "For your concept and suppliers"), each a
          switch plus a style dropdown plus photos → SHOULD be a full-screen popup.
          Each suggestion's "Add it" is a hand-made button with `border-terracotta` (accent-outlined; K1.2 says a
          second-rank button is never accent-outlined, and a main one is filled), several per sheet.
          "No thanks" hides the suggestion at once; if `dismissRoomSuggestion` fails it only calls
          `trackFailure` — nothing on screen, and the suggestion is back on the next open.
SHOTS     375 px light + dark (sheet open, scrolled)
RULE      SHAPE (owner 25 Nov) · HOUSE K1 · HOUSE F4
SEVERITY  look
SOURCE    CODE
```

### A7-10 · The seat plan and the 3D room draw a failed floor-plan read as the couple's real room

```
PAGE      /dashboard/[eventId]/plan3d → Guests › Seats (2D and 3D)   (event: stg-bea-paolo)
BUTTON    "Show guests their seats early" switch; the room itself
STEPS     1. Open Seats when the `event_floor_plan` read is refused (or the scene-objects / signs reads fail).
EXPECTED  "Couldn't read your floor plan" — never a default room, never the switch drawn Off.
ACTUAL    `seating/page.tsx` and `seating/lab/page.tsx` call `fetchFloorPlan` — the form that returns
          DEFAULT_FLOOR_PLAN on an error (`fetchFloorPlanMeasured` exists for exactly this and says why) — and
          `fetchSceneObjects` / `fetchSigns`, which return `[]` on an error. So a refused read draws the default
          room size, stage, dance floor and entrance as if the couple's, drops every placed fixture and sign, and
          the switch reads `floorPlan.published_at` = null → Off, inviting a needless re-publish. The Guests page
          above it knows (`sideReads.seats` uses `floorPlanRead.measured`), the plan body below does not.
SHOTS     375 px light (with the read refused)
RULE      CLAUDE.md §5 rule 4 (honest states; copy guests-read-is-honest)
SEVERITY  wrong
SOURCE    CODE
```

### A7-11 · A space's sheet is a tall half-sheet, and it opens popups on top of itself

```
PAGE      /vendor-dashboard/spaces   (shop: Hardin ng Tagaytay Events Place, the 30 × 45 m hall)
BUTTON    the hall's tile → "Base layout" → "Open the floor plan"; the 🔒 "Your own names" row
STEPS     1. Tap the hall's tile.  2. Scroll the sheet.  3. Open "Base layout".  4. Press "Open the floor plan"
          (on a Free shop, tap the 🔒 name row instead).
EXPECTED  SHAPE: more than one short screen → FULL-SCREEN POPUP (RiseScreen). Never a popup on top of a popup.
ACTUAL    TODAY a `Sheet` (`space-sheet.tsx`). For a hall it holds What is it · Hall or room · Names · Seated ·
          Standing · Floor width · Floor length · Connects to · Base layout (the doors list, three door pickers,
          Add a door, the plan picture, every table row, then Add tables: names, type, chairs, ends) · Preview ·
          two buttons: far past one short screen. "Open the floor plan" raises the couple's editor in a
          `RiseScreen` over that sheet, and the 🔒 row raises `LockedFeature`'s own `RiseScreen` over it too.
SHOTS     375 px light + dark (sheet scrolled; editor open over it)
RULE      SHAPE (owner 25 Nov) · HOUSE K3.4 (one layer at a time)
SEVERITY  look
SOURCE    CODE
```

### A7-12 · A hall's sheet carries two filled main buttons and an accent-outlined one

```
PAGE      /vendor-dashboard/spaces   (the hall with its tables)
BUTTON    a table row's "Save" · "Add tables" · "Save hall"
STEPS     1. Open the hall.  2. Open Base layout.  3. Open one table's row.
EXPECTED  One main button in the sheet; every other button neutral.
ACTUAL    In the one sheet: the table's "Save" (`ActionButton tone="ok" main`, filled green), "Add tables"
          (`tone="brand"` without `main`, so accent-outlined) and the sheet's "Save hall" (`tone="brand" main`,
          filled). "Add a door" is neutral, as it should be.
SHOTS     375 px light + dark
RULE      HOUSE K1.1–K1.2
SEVERITY  look
SOURCE    CODE
```

### A7-13 · A failed date change keeps the old day's tiles under the new day's name, and says "Saved"

```
PAGE      /vendor-dashboard/spaces
BUTTON    the Date menu (top right)
STEPS     1. Pick another date while the read fails.
EXPECTED  The tiles say nothing about a day they could not read (the page's own rule for a refused day read), and the
          message says the day could not be read.
ACTUAL    `onPick` sets the date first (`setDate(k)`) and then runs `{op: 'read'}`. On failure `read` is untouched, so
          the tiles still show who holds each space on the OLD day (`tilesOnDay(read.day.date, …)`) under the NEW
          day's heading ("Sat 14 Feb · Tiles follow this date"). The warning is `fresh()`'s "Saved, but we couldn't
          read your spaces back. Open the page again." — nothing was saved; it was a read.
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

### A7-14 · The two Spaces locks never show the price

```
PAGE      /vendor-dashboard/spaces   (a Free shop)
BUTTON    🔒 "Your own names" (in a space's sheet) · 🔒 "Make it a floor plan"
STEPS     1. On a Free shop tap either lock.
EXPECTED  Problem → solution → preview → the plan's price from the catalogue → one button.
ACTUAL    `PAID_NEED` passes `price: null` (`space-sheet.tsx`), so the lock reads "Price from the price sheet when you
          tap Upgrade". The Plus price is in `vendor_billing_catalog` and other pages read it
          (`getVendorPrices` + `monthlyPlanPrice`).
SHOTS     375 px light
RULE      design-and-wiring B7 (locks are honest)
SEVERITY  wrong
SOURCE    CODE
```

### A7-15 · Spaces skips the house title, toast, Undo and empty state

```
PAGE      /vendor-dashboard/spaces
BUTTON    "Add the hall" / "Save hall" / "Remove Hall001"; the page top
STEPS     1. Open Spaces in dark.  2. Add a space.  3. Remove it.  4. Open a shop with no spaces.
EXPECTED  `PageMasthead` (and in dark the top block carries the glow); success a small toast; remove at once with
          Undo in a toast; empty as `EmptyState`.
ACTUAL    A hand-made `<h1 className="text-[22px]">` under a BackButton, no `PageMasthead`. Success shows as a
          `ShopNotice` banner at the top of the page ("Added", "Hall001 saved"). "Remove Hall001" removes with no
          Undo. Empty is a bare line, "No spaces yet. Type in the box below to add your first." Half-pixel sizes
          (`text-[12.5px]`, `text-[13.5px]`, `font-size: 12.5px` in the module CSS).
SHOTS     375 px light + dark
RULE      CLAUDE.md §3 (Page title · Toast · Empty · Type) · HOUSE D2 (Remove a row) · K2
SEVERITY  look
SOURCE    CODE
```

### A7-16 · The supplier's seat plan is a second drawing of the plan, not the shared engine

```
PAGE      /vendor-dashboard/clients/[eventId]/seat-plan   (event: stg-bea-paolo, as a booked floor supplier)
BUTTON    none — the map
STEPS     1. Open the client's Seats.  2. Compare with the hosts' 2D plan of the same event.
EXPECTED  DECISION_LOG 2026-11-20, "ONE SEAT-PLAN ENGINE FOR THE COUPLE AND THE SUPPLIER": the picture drawn by
          `lib/seat-plan-engine` (`PlanPoster` / `planTableGeometry`), as Spaces draws a hall.
ACTUAL    `seat-plan-body.tsx` hand-draws its own map: every table a fixed 9 % × 9 % square or circle
          (`isRound` on the type's name) whatever its type, chairs or size, so a long table is a small square.
          Joined tables are drawn apart under their own labels (the hosts and find-seat use the group's name). An
          unsized room is drawn 4:3 landscape while the engine's default room is 20 × 30 m (`DEFAULT_ROOM_M`),
          so the supplier's picture of an unsized plan is the hosts' stretched the other way.
SHOTS     375 px light + dark, beside the hosts' 2D plan
RULE      DECISION_LOG 2026-11-20 · design-and-wiring D11–D12 (one way to make each thing)
SEVERITY  wrong
SOURCE    CODE
```

### A7-17 · The supplier's "N of M seated" counts removed chairs, and the covers disagree with "seated"

```
PAGE      /vendor-dashboard/clients/[eventId]/seat-plan   (event: stg-bea-paolo, as the caterer)
BUTTON    none — the table rows
STEPS     1. As the hosts, remove 2 chairs from a table.  2. As the caterer, open Seats.
EXPECTED  The same "seated of seats" the hosts see; covers that add up to the seated count, or a line saying why not.
ACTUAL    `get_vendor_seat_plan` sends `capacity = event_tables.capacity`; the hosts' plan counts
          `effectiveCapacity(capacity, removed_seats)`. A table with 2 chairs removed reads "6 of 10 seated" for
          the supplier and 6 of 8 for the hosts. `seated` counts every seat at the table, but `meal_counts`
          leaves out guests not counted for this supplier, the passed away and the represented — so the caterer's
          "Covers per table" pills add up to fewer than the "seated" line beside them, with nothing saying why.
SHOTS     375 px light, beside the hosts' table
RULE      CLAUDE.md §4 (one reader per shared number) · kit check 3 (connections)
SEVERITY  wrong
SOURCE    CODE
```

### A7-18 · /for-coordinators types a price and a rating on its sample card

```
PAGE      /for-coordinators
BUTTON    none — "Your shop" part, the sample service card
STEPS     1. Scroll to "Your shop".
EXPECTED  No hand-typed price, count or rating on a public page.
ACTUAL    `price={formatPhpRounded(24999)}`, `rating={{ avg: 4.9, count: 64 }}`, `aboutKmLine(8)`, "2 coordinators,
          12 hours": the card shows ₱24,999 and 4.9 (64). The page's own guard bans `/₱\s?\d/` ("no price is
          typed — prices come from vendor_billing_catalog"); sending the number through `formatPhpRounded` slips
          past it. The fine print says "A sample card and calendar."
SHOTS     375 px light
RULE      docs/brand.md claims #1 (a hand-typed price) · CLAUDE.md §1 (never write a price into code)
SEVERITY  wrong
SOURCE    CODE
```

### A7-19 · /for-coordinators promises "No end date"

```
PAGE      /for-coordinators
BUTTON    none — the hero's fine print; the "On the day" ⓘ
STEPS     1. Open the page (the day-of tools' switch is on).
EXPECTED  "Free", with no promise about how long.
ACTUAL    "Coordinator tools are free on every plan. No end date." and "The day-of tools are free on every plan,
          with no end date." DECISION_LOG 2026-11-04 rules the tools free with no end date and says the marketing
          tag is plain "Free"; brand.md, which wins on wording, bans price promises ("always free", "free for life").
SHOTS     375 px light
RULE      docs/brand.md claims #3 (price promises)
SEVERITY  wrong
SOURCE    CODE
```

### A7-20 · Venue check: a failed event read is a 404; the bar animates its width; four equal number tiles

```
PAGE      /dashboard/[eventId]/studio/panood/setup/venue-check   (event: stg-carla-miguel)
BUTTON    "Start the check" → the result
STEPS     1. Open the page.  2. Run a check.
EXPECTED  A refused read says so; motion is transform and opacity only; one hero number.
ACTUAL    `const { data: event } = await eventRowOnce(…)` drops the error, so a refused read gives `notFound()` —
          "this page does not exist". The progress bar is `transition-[width] duration-500` (width, and 500 ms is
          not a house speed). The result is Upload · Slowest second · Delay · Stream needs as four equal tiles.
          Otherwise this page is right: idle, running, saving, result and failure each look different and every
          failure has words and Try again.
SHOTS     375 px light + dark (result screen)
RULE      CLAUDE.md §5 rule 4 · HOUSE E2.2 · HOUSE Part I.3 (one hero metric)
SEVERITY  look
SOURCE    CODE
```

> A7-21 to A7-27 cover the hosts' picked-supplier page (the shared workspace). It is ≈3,200 lines plus 30 parts; a
> helper read swept it rule by rule, and every finding below was re-read in the code before it was written here.
> Production draws it through `PickedSupplierShell` (`NEXT_PUBLIC_RELATIONSHIP_WORKSPACE_ENABLED`), tabs Details ·
> Book & Budget · Schedule · Files · Chat. Nothing dead was found: every typed route exists, no `#`, no empty handler.
> No "vendor" in any word a person reads.

### A7-21 · Details says "Booked" over a supplier who is not booked

```
PAGE      /dashboard/[eventId]/vendors/[vendorId]/workspace?tab=details   (event: stg-bea-paolo, a supplier in each state)
BUTTON    none — the green chip in the top block
STEPS     1. From Chats (or Suppliers), open a supplier who is only shortlisted, or who declined, or whose request expired.
EXPECTED  The chip names the real state; "booked" is decided by BOOKED_EVENT_VENDOR_STATUSES.
ACTUAL    `heroSection` draws "Asked" only when `lockRequestStateOf(…) === 'requested'`, and green "Booked" for every
          other state — none, declined, cancelled, expired. The colour-access card says "{category} · booked for this
          event" the same way. Two hand-written lists also decide "booked" on this page: `inferStage` (contracted ·
          deposit_paid · delivered · complete → `isBooked`, the steps, the quote schedule) and
          `const BOOKED = new Set([...])` in `promote-coordinator-card.tsx`.
SHOTS     375 px light + dark, for a declined supplier
RULE      CLAUDE.md §4 (Booked = BOOKED_EVENT_VENDOR_STATUSES) · design-and-wiring C8
SEVERITY  wrong
SOURCE    CODE
```

### A7-22 · A failed contact read shows a blank card, and "Save" then wipes the saved address

```
PAGE      /dashboard/[eventId]/vendors/[vendorId]/workspace?tab=details   (a supplier the hosts added themselves)
BUTTON    "Save their details"
STEPS     1. Open a self-added supplier while the `manual_vendors` read fails.  2. Type a phone number.  3. Save.
EXPECTED  "Couldn't load their details" and no save over data the page never read.
ACTUAL    `manualContactRes?.data ?? null` never checks the error, so the card shows empty fields and "No contact yet.
          Add one so you can reach {name}." The save always writes `address: address.value` (`actions.ts`), so the
          blank address field overwrites the stored one, and the payment note with it when the form sends it.
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  broken
SOURCE    CODE
```

### A7-23 · Failed reads on the workspace are drawn as "nothing there"

```
PAGE      /dashboard/[eventId]/vendors/[vendorId]/workspace   (Files · Schedule · Details · Book & Budget tabs)
BUTTON    none — the sections
STEPS     1. Open the page when each read below is refused.
EXPECTED  "Couldn't load …" with Try again, never an empty or zero state.
ACTUAL    Each read logs the error and then empties itself (`?? []`):
          · Files: `handovers = handoverRows ?? []` → `HandoverInbox` returns null — the delivered gallery with
            "Open album" / "Confirm receipt" vanishes. The code's own comment names this exact danger.
          · Schedule: `apptRows ?? []` → "No appointments yet. Propose a meeting…" — invites a duplicate booking.
          · Details: `grantRows ?? []` / `changeRows ?? []` → colour access "Off", "No changes yet", and the Reject
            buttons for changes already made are hidden.
          · Book & Budget (catering / crew meals): `eventVendorCrewRows ?? []` → "Feeding 0 crew meals … they see
            this count on their production sheet."
SHOTS     375 px light, one per tab
RULE      CLAUDE.md §5 rule 4 (copy guests-read-is-honest)
SEVERITY  wrong
SOURCE    CODE
```

### A7-24 · Money on the workspace: a failed payments read reads as nothing paid; two amounts due; its own peso formatter

```
PAGE      /dashboard/[eventId]/vendors/[vendorId]/workspace?tab=budget   (event: stg-bea-paolo, a supplier with payments)
BUTTON    none — "Paid so far", the Next step row, "Amount to pay", Costing's "Total"
STEPS     1. Open Book & Budget when the payments read is refused.  2. Open it for a supplier whose accepted quote has its
             own schedule.  3. Look at an amount with centavos (e.g. ₱837.50).
EXPECTED  A refused read says so; one amount due everywhere; pesos only through lib/php.ts.
ACTUAL    · `paidSoFarPhp` takes `vendorBudgetSummary.paidTotal`, which is 0 when `paymentsMeasured` is false; the page
            never checks that flag, so "Paid so far" disappears — the same as nothing paid. When the summary itself
            fails: "No payment milestones added yet. Add a line item or log a payment…"
          · The Next step row above Chat reads the payment plan's due step (`planProgress`), while "Amount to pay" reads
            `readBookedMoney` and can show the accepted quote's schedule — two different amounts due.
          · A page-local `formatPHP` (`maximumFractionDigits: 0`) prints ₱837.50 as ₱838 for Paid so far, Price and
            Total, while `VendorItemizationCard` on the same page prints ₱837.50. More local formatters: refunds
            (`toLocaleString`), `pesoFromCentavos`, `fmtPeso`, `peso`, `fmtPHP`. Costing's "Total" is added up on the
            page (`serviceNowNum + transportNum + foodNum`, `?? '₱0'`), not read from `resolveEventMoney`.
SHOTS     375 px light + dark
RULE      CLAUDE.md §1 (money via lib/php.ts) · §4 (resolveEventMoney) · §5 rule 4
SEVERITY  money-signin
SOURCE    CODE
```

### A7-25 · The workspace's screens each carry several main buttons

```
PAGE      /dashboard/[eventId]/vendors/[vendorId]/workspace   (Book & Budget · Details)
BUTTON    "Pay {supplier}", "Save costs", "Save crew", "Record payment", "Propose a change", "Log ₱X", "Send it again";
          "Save their details", "Save details", "Save answers", "Yes, I got everything", "Leave a review"
STEPS     1. Open Book & Budget.  2. Open Details.
EXPECTED  One filled main button per screen, sheet or card; every other button neutral or a text link.
ACTUAL    Book & Budget: "Pay {supplier}" (`tone="brand" main`) plus "Save costs" and "Save crew" (`bg-mulberry`
          fills) on one screen; "Record payment", "Propose a change", "Log ₱X" are `tone="brand"` without `main`
          (accent-outlined); after a refusal `main={declined || …}` makes "Send it again" a second main beside "Pay"
          in one card. Details: "Save their details" and "Save details" are both `tone="brand" main` (a third,
          "Move", while its confirm is open); for a Setnayan supplier, "Save answers" per form plus "Yes, I got
          everything" / "Leave a review" (`bg-mulberry`).
SHOTS     375 px light + dark, each tab
RULE      HOUSE K1
SEVERITY  look
SOURCE    CODE
```

### A7-26 · Workspace popups: a hand-made popup over the pay sheet; long sheets that should rise full screen

```
PAGE      /dashboard/[eventId]/vendors/[vendorId]/workspace?tab=budget
BUTTON    "Pay {supplier}" → "Show QR" / a method's "Pay"; "Record payment"; "Propose a change"; Photo approvals
STEPS     1. Press "Pay {supplier}", then "Show QR".  2. Press "Record payment".  3. Press "Propose a change".
EXPECTED  One layer at a time, each a shared part; more than one short screen or a photo → RiseScreen.
ACTUAL    · "Show QR" and "You're leaving Setnayan" open a hand-made `ModalShell` (`role="dialog"`, `fixed inset-0
            z-[60]`, `vendor-direct-pay.tsx`) on top of the "Direct payment" `Sheet` — a popup on a popup. Each link
            method there also draws its own filled `bg-terracotta-700` "Pay" (several mains in one sheet).
          · "Log your payment" is a half `Sheet` with amount, method, reference and a proof photo → SHOULD be a
            full-screen popup (a photo, four fields).
          · "Propose a change" is a `Sheet` with a toggle and four fields → SHOULD be full screen.
          · Photo approvals is a `Sheet` holding a list of photos with Show/Hide each → SHOULD be full screen.
SHOTS     375 px light + dark, each open
RULE      SHAPE (owner 25 Nov) · HOUSE K3.4 · CLAUDE.md §3 (no new hand-rolled dialog)
SEVERITY  look
SOURCE    CODE
```

### A7-27 · A failed "Save costs" or "Save crew" throws the whole screen away

```
PAGE      /dashboard/[eventId]/vendors/[vendorId]/workspace?tab=budget
BUTTON    "Save costs" · "Save crew"
STEPS     1. Change a cost.  2. Save while the accepted-quote read or the write fails.
EXPECTED  The row stays, with "That did not save. Nothing changed — please try again." (HOUSE F4).
ACTUAL    Both are bare `<form action={updateVendorCosts}>`; the action `throw`s (`vendors/actions.ts`) and there is no
          `error.tsx` under `/dashboard/[eventId]` except `seating/`, so the root error page replaces the screen.
          `quote-bridge.tsx` shows the same action's `err.message`, which in production is Next's generic
          server-render text. (What exactly is drawn: confirm in the browser.)
SHOTS     375 px light
RULE      HOUSE F4 · CLAUDE.md §5 rule 4
SEVERITY  broken
SOURCE    CODE
```

## Second pass (25 Nov)

Adds 11, 11b, 12, 13, 15, 17, 18 on the pages the fixer touched (code read on main @ bd86936 plus the phase B shots).
Lane A ones are fixed in the batches; the rest wait for their lane.

- [B] /pa3d, /pa3d/try · Add 12 · "Standing up the room…" and "Making their code…" spin a `Loader2` (no spinners; a Ghost of the room) — same as A7-07.
- [B] /vendor-dashboard/spaces · Add 11.3 · a list/grid page with no pull to refresh; the date menu is the only refresh. Reference: iOS Mail's pull to refresh on a list.
- [B] /vendor-dashboard/spaces · Add 11b · at 1280 the tiles stay a phone-sized grid in a 4xl column; desktop could show the hall's sheet beside the grid (list + details). Reference: iPad Mail split view.
- [B] /dashboard/[eventId]/vendors/[vendorId]/workspace · Add 11.2 / Add 1 · a PAGE drawn with a ✕ at the top like a popup; the top should be the house Back (the address, Back and refresh already work).
- [B] /dashboard/[eventId]/vendors/[vendorId]/workspace · Add 11.8 · the three ⓘ buttons are 16 px (A7-36, lane B SW-TAP).
- [B] /[slug]/venue · Add 12.4 · the "opens on the day" and "didn't load" plates arrive with a hard cut to near-black from the Event Hub; no named page move.
- Drawn for the owner, 25 Nov: `build-sessions/final-check/drawings/area-7-second-pass.html` (artifact https://claude.ai/artifact/EU2nkDsrVNc9iR85pmdeiH). All five lane B lines above wait for his yes; none is built.
- Add 13 · no missing icons found on these pages.
- Add 15 · no Setnayan mark drawn on these pages outside `<Logo>` (the 3D demo QR draws no mark; `renderUrlQrSvg` carries none).
- Add 17 · none of the ten routes is retired: `/dashboard/[eventId]/plan3d` is a forward kept for old links; `/3d_plan/demo/[token]` is reached from the /pa3d room's QR.
- Add 18 · no reveal picker on these pages.
