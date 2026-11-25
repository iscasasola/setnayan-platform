# Final check — the owner's additions (25 Nov)

These go into every checker's brief, on top of `FINAL-CHECK-KIT.md` § 5. Main is frozen during the check, so they live here until the check ends.

## Add 1 · Popup, full-screen popup, or page (owner 25 Nov: "which ones should become popups and which ones are full screen? Like onboarding?" · "i think they work better as pop ups?")

On every page and every flow, mark one of three shapes. Write what it is TODAY and what the rule says it SHOULD be. Report only the ones that differ.

| Shape | House part | Use it when | Examples |
|---|---|---|---|
| **SMALL POPUP** | `Sheet`: half height on a phone, a centred dialog on desktop | One quick choice or a short task: one screen, about 3 fields or fewer. The person goes back to exactly where they were. | sign in · pick a date · add one guest · confirm and pay · a ⓘ note |
| **FULL-SCREEN POPUP** | `RiseScreen`: rises over the page; ✕ returns to the same place; a large centred dialog on desktop | A fill-in that takes several steps, or a camera, photo or video. Too big for a half sheet, but the person still came from somewhere and should land back there. | create an event (onboarding) · add a service card · invite or import guests · the camera |
| **PAGE** | its own address | A place people stay in, come back to, or share by link. Back, refresh and bookmarks must work. | Home · the guest list · the Event Hub · a shop page · the budget |

Three tests, in order:
1. Will they share it or come back to it by link? → PAGE.
2. Is it more than one short screen, or is it a camera or media? → FULL-SCREEN POPUP.
3. Otherwise → SMALL POPUP.

Two never-rules:
- never a popup on top of a popup;
- never a tall half-sheet that opens with its top out of reach.

Sources: Apple's guidance on sheets and modality, Material's dialogs and bottom sheets, and the Smashing Magazine 2026 modal-vs-page decision tree.
- **Sheets:** brief and occasional.
- **Full screen:** complex or long tasks, and media.
- **Page:** the default for anything long or shared.
- **Full-screen dialogs:** phone only; desktop uses a centred dialog.

Onboarding = a FULL-SCREEN POPUP on a phone and a centred popup on desktop. That keeps the owner's popup feel (you never leave where you were) with room for the steps. Any change ships only after a drawing.

## Add 2 · The design goal: clean, balanced, effective (owner 25 Nov: "Your goal is to make the effective design … we want the look to be clean, balanced and effective.")

Judge every screen against these three words, at 375 px and then desktop. The values come from the house standard
(`HOUSE_DESIGN_STANDARD_2026-11-20.md`). Each finding names what is wrong AND what it should be, in one line.

**CLEAN means nothing extra.**
- one heading per block, never a title that repeats the one above it;
- no explainer captions, helper paragraphs or labels that say what the screen already shows;
- one main button (K1); every other action is neutral or a text link;
- spacing only from 4 · 8 · 12 · 16 · 24, and text sizes only from the type scale;
- one corner radius per kind of thing, and no mix of borders, shadows and fills on the same kind of card;
- no clutter: if removing something changes nothing for the person, it is a finding.

**BALANCED means the weight sits evenly.**
- even gutters on both sides; left edges line up down the page;
- cards in one row are the same height, and their buttons sit on the same line;
- no side of the screen crowded while the other is empty;
- the desktop is not a stretched phone or a phone column lost in a wide empty page;
- no single orphan word on a heading's last line, and no lone card on its own row when a grid would hold it.

**EFFECTIVE means the job is obvious in 3 seconds.**
- a first-time person can say what this screen is for and what to press next;
- on a phone the main action is visible without scrolling, or it sits in a fixed bar;
- labels are plain words, never internal names or codes;
- the fewest taps to finish: count them for the area's main jobs (add a guest, book a supplier, publish a card, reply to a chat) and report any step that could go;
- no dead end: every finished task says what happened and offers the next step.

Mark each screen **CLEAN / BALANCED / EFFECTIVE: ok, or the line that fails**. A design finding is severity
"polish" unless it hides money, a main action or a person's data; then it is "major". Design changes ship only after a
drawing (the owner's rule), so describe the fix in words. Checkers never draw or build.

## Add 3 · Placeholders (owner 25 Nov: "also look for placeholders")

Report every placeholder that a real person could see. In the walk, and in the code for your area's routes, look for:
- lorem ipsum, "sample", "example", "test", "TODO", "TBD", "XXX", "Your name here", "John Doe", "Juan dela Cruz" style made-up people;
- "₱X", "₱0.00" shown as a real price, "N/A", "—" where a real value belongs, made-up counts ("1,000+ suppliers") that no query backs;
- grey boxes, empty image frames, broken-image icons, stock or AI art where a real photo or the approved art belongs;
- "Coming soon", "Beta" or "Under construction" on something a person can press;
- made-up reviews, testimonials, ratings or logos presented as real;
- hard-coded demo data showing in place of the person's own.

**NOT a finding:** the copy's own seeded test data. That covers seeded pictures and seeded names like `stg-…`
events and `@final-check.test` accounts. The question is always: **would a real couple or supplier see this on
setnayan.com?** In the code pass, `grep -rniE "lorem|placeholder=|TODO|TBD|coming soon|john doe|sample"` over your
area's files finds most of them. A form field's own `placeholder=` hint text is fine when it reads as a hint.

## Add 4 · Every place to buy or upgrade is evident and clean (owner 25 Nov: "you need to make the purchase frame or where they can upgrade be evident and clean")

**First, list every buy or upgrade point in your area.** Name the route, what is sold, the price shown, and how a person
reaches it. That covers:
- supplier plans (Free · Verified · Plus · Pro · Ultra) and the plan rows on Pricing and For Suppliers;
- the gate on a locked feature or a limit (active cards, members, storage);
- Papic credits and top-ups, Live Studio and the other add-ons;
- Toolkit tools with a price band;
- the reservation fee and the booking payment;
- checkout and the payment proof (BDO / GCash QR).

The area reports together make the owner's full list of where Setnayan sells.

Then check each one against two words.

**EVIDENT means a person finds it at the moment they need it.**
- **At the wall:** a locked feature or a reached limit says so where the person hits it, in one line, with ONE upgrade button. It is never a silent grey control, a dead tap, or an error.
- **No hunting:** a person who wants more can find the upgrade from the area's home in 2 taps or fewer, without going to Settings.
- **Price before pressing:** the ₱ price and the plan or add-on name show before the buy button. "See pricing" with no number is a finding.
- **What you get:** three short plain lines at most, never a feature table on a phone.
- **What you have now:** the person's current plan or balance is shown. The button never offers what they already own, and never says "Upgrade" to a top-plan account.

**CLEAN means one decision, nothing extra.**
- one main button (K1) and one popup (never a popup on a popup);
- no stacked upsells, no second offer under the first, no countdowns or pressure words;
- the small popup or full-screen popup shape follows Add 1. Choosing a plan is a SMALL POPUP when it is one choice, and the Pricing page itself stays a PAGE;
- follows the page method on Pricing and the promotion pages: show it working, then remove the fear, then sell the upgrade. Plans come last, never first.

**HONEST means the number and the result are true.**
- the price matches `platform_retail_catalog_v2` / `vendor_billing_catalog` on every page that shows it, and the copy holds production's prices;
- a failed read never shows "Free" or ₱0;
- after a test payment proof is logged (BDO / GCash only, never pay anything real), the order says what happens next and the unlock appears where the person started, not only in a receipt.

Count the taps from the wall to "payment logged" and report them. Anything over 4 is a finding.

## Add 5 · Everything is easy to handle (owner 25 Nov: "we want everything to be easy to handle.")

Rate each of your area's main jobs **EASY / OK / HARD** and name the one step that makes it hard. Main jobs are things
like: create the event, add or import guests, seat them, book a supplier, reply to a chat, publish a service card,
log a payment, check a guest in. Walk each job as a first-timer would, on a phone, with one hand.

- **First-timer.** Someone new finishes the job with no guessing and no help text. A step that needs a tour, a tip
  or a manual is a finding.
- **One hand.** On 375 px the main controls sit in thumb reach, in the lower half or a fixed bottom bar. Every tap
  target is at least 44 px, with no tiny ✕ and no two controls touching.
- **Short forms.** Ask only what this step needs, with sensible defaults. The right keyboard comes up (number, email,
  date). Never ask again for what Setnayan already knows (the event date, the couple's names, the shop's address).
- **Forgiving.** Undo instead of "Are you sure?" where the action can be undone. Nothing typed is lost on Back,
  refresh, a dropped signal or a closed popup. Long fill-ins keep a draft.
- **Clear errors.** The message sits next to the field and says what to do, in plain words, never a code or
  "Something went wrong" alone.
- **Readable.** Body text is readable on a phone without zooming, and there are no walls of text. Plain English or
  Taglish a tita would follow.
- **Same everywhere.** One thing works one way: search is an icon until tapped, sort is the sliders icon, a popup
  closes the same way, and the buttons for chat, search, add and sort sit inside the text box. A control that
  behaves differently on one page is a finding.

## Add 6 · Proof that every button was pressed (owner 25 Nov: "will you also check all buttons?")

Kit § 5 item 2 already says press every control. To prove it was done, each page's Progress line now carries a
count: **buttons N · pressed N · failed N**. A control is anything a person can press: buttons, links, tabs,
toggles, chips, each option of each dropdown, each menu item, and the ✕ and backdrop of each popup. Count them at
375 px and again on desktop, because the controls can differ. A page where pressed is lower than buttons says which
ones were left and why, for example "would pay real money" or "would email a real person".

## Add 7 · Three sizes, light and dark, the same across every role (owner 25 Nov: "We want them to work light and dark mode, adaptive to mobile, tablet and desktop view" · "if the dark and light mode exists. If the design of light and dark mode is consistent all throughout their roles. As user, as event, as supplier, as admin")

- **Three sizes, not two.** Walk every page at **375 px (phone), 768 px (tablet) and 1280 px (desktop)**. At tablet
  width the layout must be designed for it, not a stretched phone and not a squeezed desktop. Look for cut-off
  text, overlapping bars, a bottom bar and a side rail both showing, or one narrow column floating in an empty
  screen.
- **Light and dark exist.** Mark every page `DARK: yes · no · partly`. A signed-in page with no dark mode, or one
  that is half dark (a white card, a white popup, a light chart, a light map on a dark page), is a finding. Public
  signed-out pages that are light only are marked `light only` and counted, not reported one by one. The owner
  decides those from the count.
- **One design for all four roles.** The couple or host (the user), the guest Event Hub (the event), the supplier
  and the admin share ONE light design and ONE dark design: the same page background, card surface, top-block glow,
  text colours, accent and button look. Each area commits six shots of its home screen to
  `build-sessions/final-check/shots/area-N/` (`home-375-light.png`, `home-375-dark.png`, `home-768-light.png`,
  `home-768-dark.png`, `home-1280-light.png`, `home-1280-dark.png`). The controller lays the four roles side by side
  and reports every place where one role looks unlike the others. A role that uses its own colours, its own card
  style or its own dark shade is a finding.

## Add 8 · The reveals (area 3; owner 25 Nov: "we have now multiple reveals. how are they organized.")

Ten reveals ship today, listed in `app/[slug]/_components/reveal/reveal-templates.ts`: Veil · Beach curtains ·
Envelope classic · Envelope gatefold · Fabric · Scratch · Smoke · Cathedral doors · Petals · Fireworks. The gift
box and more designs per reveal wait in PR #8222, held until the check ends. That PR is not on the copy.

- **How a couple finds them:** Maker › Cover Scene › Style, and Save the Date › Step 5. Report whether the choice
  is easy at 375, 768 and 1280: grouped sensibly, each with a picture that shows what it does, the current one
  marked, one tap to preview, nothing hidden off-screen.
- **Every reveal plays:** on the guest's Event Hub at 375, 768 and 1280, in light and dark, and with reduced
  motion. Each one fills the screen with no gaps or stretching, opens to the page, and leaves no overlay behind.
  The text on it is readable on both themes, and the page it opens to matches the theme.
- **One list:** the Maker, Save the Date and admin Reveal Studio show the same reveals with the same names, in
  the same order.

## Add 9 · Two areas the owner named for fixing (25 Nov: "please fix admin also. the pages are so confusing" · "fix the whole website okay? Texts. placeholders. even their llms and GEO SEO AEO?")

**Area 8: measure the admin against the approved drawing.** The owner approved admin's new shape on 13 Nov, then
added Focus | Full on 14 Nov and the reorganisation on 17 Nov. It is five tabs (Work · Money · People · Catalogue
· Insights) with admin-of-admin under the avatar. The drawing is specs `prototypes/admin_pub/` (artifact
NTDv6ThNDWpkxUvkjtazoY), with `admin_five_tabs_2026-11-13/BUILDER-NOTES.md` and `admin_reorg_2026-11-16/`.
Today's admin still uses the older groups (Today · People & shops · Studio · Root map · Numbers · Money in
`admin-nav-groups.tsx`). Write `build-sessions/final-check/area-8-admin-gap.md`: every approved tab, row and setting
against what ships (built · partly · missing · lives somewhere else). Add a "nothing lost" list: every shipped admin
page and setting, with its home in the approved shape, so the fix builder starts from a measured list. Also note
each page where an admin would not know what it is for.

**Area 1: the whole public website's words and how it is found.** On every public page:
- **Words:** `docs/brand.md`, plain, and speaking to the feeling. Run Add 3's placeholder hunt.
- **SEO:** a unique title and description, a canonical address, a share picture, and the page present in the
  right sitemap. Private pages stay out of search.
- **GEO / AEO** (how AI assistants and answer boxes read us):
  - Is `llms.txt` (`app/llms.txt/route.ts`) true and complete today? Check the plans (Free · Verified · Plus · Pro ·
    Ultra), the prices against the live page, and what Setnayan does for couples, guests and suppliers.
  - Does each page open with a plain answer before the detail?
  - Do the FAQ answers and their FAQPage data match what people actually ask?
  - Does the structured data (Organization · WebSite · FAQPage · BreadcrumbList · Article · LocalBusiness ·
    Service) say the same as the page?
- **What AI says about us now:** use web search to ask "what is Setnayan", "how much is Setnayan", "is Setnayan free
  for couples" and "Setnayan vs …". List every wrong or missing fact, with the page that should correct it.

Follow the specs' `SEO_GEO_POSITIONING_2026-09-26.md`, `SEO_GEO_UPDATE_2026-07-10.md`, `WEBSITE_CONTENT_2026-11-19.md`
and DECISION_LOG 10 Nov (what AI gets wrong, the factual comparison), 16 Nov (supplier websites findable) and 17 Nov
(articles found like Reddit). Never type a price or a count: read it.

## Add 10 · What else should work offline, by role (owner 25 Nov: "for the offline, you will also see what other parts of the supplier, event, guest, event hub should run when offline mode")

Every page already gets an `OFFLINE: NEEDED · READ-ONLY IS ENOUGH · NOT NEEDED` mark. The owner limited full
offline to 5 places on 24 Nov: guests at the venue (the Event Hub and the walk-in hub), the supplier on the day,
the supplier at an expo, the couple at an expo, and the coordinator on the day. Everything else is a saved,
read-only copy.

At the end of your area's file, add **"Offline — beyond the five"**: one table per role your area covers (supplier ·
event host or couple · guest · Event Hub · coordinator). Each row is:
- **the part** (route and what it does);
- **the moment the signal drops** (at the venue on the day · at an expo booth · on the road · in a province with
  weak data);
- **the level it needs**: `READ-ONLY` (see the last copy) · `SAVE AND SYNC` (do it now, send when back online) ·
  `FULL` (works the whole way with no signal);
- **why**, in one line: what breaks for the person if it does not work.

Only list parts that are NOT already one of the five places. On the copy, also switch the browser offline
(DevTools → Network → Offline) and try each offline piece that already ships in your area: the check-in desk,
Papic capture, the saved Event Hub copies and the offline bar's words. Report whether it works, what it says, and
whether it catches up when back online. The controller merges the five tables into one list for the owner to
decide.

**Add 10b · The supplier QR challenge (areas 5, 6 and 7; owner 25 Nov: "this includes our challenge in line with the offline mode on QR Code creation of suppliers").**
At an expo or a venue, a supplier must be able to make a QR code for a couple with no signal, and nothing may go
wrong when the phone comes back online. Today's QR makers are under `vendor-dashboard/shop/qrs`, `shop/store`,
`shop/promote`, `invite`, `customers`, `clients/[eventId]` and `on-the-day`. The offline engine that signs codes on the
phone (PR #8284: each phone signs its own codes, no stock, re-checked at sync) is held, so it is NOT on the copy.
Report on what ships today:
1. **The list:** every QR a supplier can make. For each, say what it is (shop link · invite · a date hold or deal ·
   a gift or freebie · check-in · payment), where it is made, and what the couple or guest sees when they scan it.
2. **With no signal (DevTools offline):** can each one still be made, shown or shared? What does the screen say?
   What does the person scanning see if they are offline too?
3. **Back online:** for each one that touches a date, a price, money or a gift, what can go wrong at sync? Name the
   case: the same date held twice, a price changed in between, a gift that ran out, a code shown twice, a code made on
   a phone that has since been removed. Say whether today's code catches it, and in what words the supplier and
   the couple are told.
4. **Easy to handle:** making a QR takes how many taps from the supplier's home? Is it one size that scans from
   arm's length, with the shop's name under it, in light and dark?
Rows go into "Offline — beyond the five", marked `QR`. The controller hands the list to #8284's builder after the
check, so the engine is measured against real cases.

---

# Adds 11 – 14 (owner, 25 Nov, during phase B) · every checker applies these to every page

## Add 11 · It must feel like a real phone app
Owner: *"the basic functions of how an app feels and perform"* · *"When you pull down, the screen should still look like
an app, not just cutting the headers"* · *"proper scrolling, proper fade of speed when we scroll"* · *"not feeling like a
forced table, but an actual on-screen app"*.
1. **Scroll:** smooth, slows down naturally; no jumps, no layout shift while loading, no page scrolling inside a page.
2. **Top bar stays put:** headers and the bottom bar stay fixed or sticky and are never cut; content passes under them
   with a soft fade, not a hard cut.
3. **Pull down:** on a list or feed page, pull to refresh works and looks native: the header stays, a spinner shows, no
   white gap, no bare-page bounce, no clipped header. Missing on a list page = a finding.
4. **Overscroll:** no rubber-band showing white or the page behind; no white flash in dark.
5. **Back:** the back gesture and button return to the same place and scroll position.
6. **Lists:** long lists load more as you scroll (or page cleanly), keep their place, show skeletons, never blank.
7. **Tables:** a table that forces sideways scrolling on a phone is a finding; name what it should become (cards, a list
   with a details sheet, or a popup per Add 1).
8. **Touch:** taps ≥ 44 px on touch; a press shows pressed at once; no hover-only controls; the keyboard never covers the
   field or the main button.
9. **Edges:** safe areas respected; fixed bars never cover the last item of a list.
10. **Effects:** at the house speeds, never stuttering on scroll.
Each miss carries one line `Reference:` naming how a well-known app does it (iOS Settings list, Instagram pull to
refresh, Google Maps bottom sheet, Airbnb listing cards…). Name the pattern; never copy a brand's look.

## Add 11b · Each screen size behaves its own way
Owner: *"how app performs also depends on how it looks like… desktop mode, tablet mode, mobile mode… on desktop rows can
be a bit smaller because it is controlled by mouse or cursors, while on mobile it needs to be a bit bigger because it is
finger-ruled buttons."*
- **Phone (375, touch):** finger-sized rows and buttons (≥ 44 px) with room between them; pull to refresh, swipes, sheets
  from the bottom, a bottom bar in thumb reach; one column.
- **Tablet (768, touch, also sideways):** still finger-sized but uses the width (two columns, list + details); popups
  centred or side sheets, never a phone sheet stretched wide.
- **Desktop (1280, mouse):** denser rows and smaller controls are right; hover, pointer cursor, keyboard (Tab, Enter, Esc
  closes popups); refresh is a button or live, never pull; centred dialogs; clean wide tables are fine.
- A phone layout stretched across a desktop is a finding; so is a phone-sized giant button on desktop. Note any site-wide
  rule that forces one size on every screen (for example a 44 px minimum on every button, desktop rows included).
Write the size, what it does now, what it should do, and a `Reference:` (Gmail phone vs desktop, iPad Mail split view…).

## Add 12 · Every animation follows OUR templates
Owner: tables that expand and collapse, *"how buttons are pressed, how we animate full screen, and the movement of pages
when we transfer from one to another, and even the icons… animated icons that when you press on the icon, it does this
small animation that creates a bit of flavor."*
Rulebook: Setnayan-specs `MOTION_STANDARD_2026-11-18.md` (visual contract `prototypes/motion_standard_2026-11-18_fable.html`);
animated-icon plan in Setnayan-specs `prototypes/control_templates_2026-10-08_working.html`.
1. Expand/collapse = motion 9 "Open": Move 320 open, Quick 200 close, no snap. 2. Press: Tap 100 in, Release 280 out;
controls never dance. 3. Full-screen rise: behind to 0.96, chrome last, close mirrors open. 4. Page moves: the named
transitions (Zoom through, Picture leads, Unfold), never a hard cut or white flash. 5. Icons against the animated-icon
plan. 6. Named speeds only; reduced motion still works. Write: page · motion number/name · now · what the standard says.
Planned but not built = "planned, not built" (its own list, not a fault).

## Add 13 · Missing icons
Owner: *"there are some icons that we might not have yet. So we want to be able to create those icons."* Under
`## Icons`, one line each: page · control · what it shows now (none, placeholder, generic, wrong meaning) · what the icon
should mean. This becomes the list of icons to draw.

## Add 14 · The copy is slow: how to handle it (controller, 25 Nov ~07:30 UTC)
Simple pages answer in 0.2 s; pages with many reads take 9–13 s and some Event Hubs return 500; the database is idle and
its tables tiny. So it is the staging copy's setup, not proven to be the app. Keep to 1–2 tabs; retry a slow or 500 page
once after a minute; log it under `## Copy health (not counted)` with the route and seconds; keep judging what you can
see. A slow page or a 500 is a product finding only when the code shows the cause.

## Add 15 · The Setnayan logo comes from ONE place (owner, 25 Nov)
The one place: **Admin → Business → "Default brand icon"** (upload · reset; `brand-icon-form`, `brand_icon_*` settings).
It already feeds `<Logo>`/`<LogoMark>` (via `BrandProvider`/`useBrandMark`), the browser tab and the app icon. Every
other spot that shows the Setnayan mark must be mapped to it. Today these bypass it (main @ bd86936; checkers: confirm
on screen, file one finding per spot, area = the screen it shows on):
- **A copied drawing of the mark** (its own path data): `auth/forming-mark.tsx` (login), `setnayan-mark-icon.tsx`,
  `onboarding/wedding/_components/onboarding-shell.tsx` + `welcome-moments.tsx`, `[slug]/_components/reveal/veil-shared.ts`,
  `lib/qr-style-svg.ts`, `lib/photo-mark-geometry.ts`, `lib/papic-photo-mark.ts`, `src-tauri` desktop icon + shell.
- **A fixed file link** to `/brand/setnayan-*`: `components/sd-loader/sd-loader.tsx`, `brand-marks.tsx`, `lib/qr-look.ts`,
  `lib/print-layout.ts`, `lib/wallet-pass-icons.ts`, the seating export and both mood-board PDF routes.
Fix rule (lane B, one batch): one shared source module for the mark's shapes + one resolver for its URL; every spot
reads those. Animated marks (login, loader) need the vector, so they read the uploaded SVG when there is one and the
built-in gold vector otherwise; never a third copy. Event and shop logos (a couple's or a shop's own) are NOT this.

## Add 16 · Loading logo APPROVED (owner, 25 Nov)
The looping loader drawing is approved: ring builds clockwise 700 · turns once 700 · logo grows inward 700 · hold 400 ·
collapse 320 · unwinds counterclockwise 700 (one loop 3,520 ms); 20 px = ring and turn only; reduced motion = still mark.
Press = house press (.96 at Tap 100, back at Release 280) + one gold sheen; starts or cancels nothing. After ~8 s one
line "Still working: …", with a separate Cancel only where stopping is safe. The top-bar still logo is a real Home
button. It replaces the particle SDLoader look; it reads the mark from Add 15's one source. Build = lane B fix batch.

## Add 17 · Find retired pages; never fix them, list them for deletion (owner, 25 Nov)
Fixing a page nobody can reach wastes the run. Before filing ANY finding on a page, ask: is it reachable from a live
door, and is its product still sold? If not, file ONE line under `## Retired candidates (delete, do not fix)` with the
route, why (no door / flag off for good / product folded into another / owner retired it), and what links to it, and
file no other findings on it. Fixers skip those pages until the owner rules; the deletion is one batch with forwards.
Known now (main @ bd86936, owner to rule):
- `/dashboard/profile/concierge` (Setnayan AI settings): both doors behind `CONCIERGE_ENABLED = false` for good (A2-C11).
- `/dashboard/[eventId]/studio/setnayan-ai` (the ₱1,499 stand-alone AI buy page): the 4 Nov price sheet says AI is no
  longer sold alone (it comes inside Event Plus/Pro), yet home cards, Suppliers and onboarding still link here.
- `/setnayan-ai` (public marketing page): in nav, sitemap and llms.txt; keep or fold into Pricing is the owner's call.
- The concierge tables are already listed as retired in CONNECTION_MATRIX.

## Add 18 · Reveals are edited in the Event Hub only (owner, 25 Nov)
The reveal belongs to the Event Hub, where the couple edits the website (`launch/` maker: `maker-reveal.tsx`,
`stage-panel/reveal-designs-row.tsx`). Any other place that shows reveal templates to PICK is a second copy: today the
Save the Date builder's Step 5 "Opening (reveal)" (`studio/save-the-date/_components/StdBuilderClient.tsx` →
`RevealPreviewCard`). File each one; the fix is a link "Choose your reveal in the Event Hub" (deep link to the reveal
part), never a second picker. Today and Home show at most a status line, never the templates. Held PR #8222 touches
`reveal-preview-card.tsx` too; it must follow this before it lands.

## Add 19 · Setnayan AI: OWNER RULING (25 Nov) — supersedes the Add 17 "owner to rule" lines
- **Keep `/setnayan-ai`, the public page.** It tells people Setnayan AI is a service BUILT INTO the Event Hub: it helps
  them build, manage and track their list of suppliers, and a watchdog keeps watch over them. It shows the stand-alone
  value as "normally ₱X per event" with X READ from the catalogue (`SETNAYAN_AI`, ₱1,499 today; never typed in code),
  then "included with the Event Hub". No Buy button on it.
- **Retire `/dashboard/[eventId]/studio/setnayan-ai`, the buy page.** There is no page to purchase Setnayan AI.
  Every door to it (home planner card, home first screen, Suppliers banner and search overlay, onboarding value card,
  `lib/routes.ts` setnayanAi) goes to the Event Hub offer instead; the old address forwards there.
- **Retire `/dashboard/profile/concierge`, the settings page** (no door since `CONCIERGE_ENABLED = false`).
- Checkers: file the remaining AI doors and copy that still say "buy" or "paid add-on" under this Add. Lane C until the
  plan question below is answered (which Event Hub plan includes it).

## Add 20 · CORRECTION to Add 19 (owner, 25 Nov): Setnayan AI comes with Event Pro and Event Ultra
Not "the Event Hub" and not Event Plus (since the 18 Nov re-cut; `_plan-steps.ts`, `add-ons-catalog.ts`). The public
`/setnayan-ai` page presents it as a planning service built to do the jobs below, included in Event Pro and Event Ultra,
with a door to Pricing. No Buy button; the buy page and the concierge settings page are still retired (Add 19).
What it really does today (only wired features, from `setnayan-ai-value-copy.ts`, owner rule "just list what is true"):
- Finds the right people: builds your suggested supplier team by best fit to your date and budget, not cheapest.
- Keeps it all moving: tracks every category's booking window (plus, for weddings, marriage license, Pre-Cana, PSA)
  and tells you the one most urgent thing to do next.
- Watchdog: flags a payment before it is due · warns before you go over budget · tells you when a watched supplier
  changes their price · tells you when someone you are considering gets booked or frees up · warns when two things
  clash on the day · shows who else is eyeing your date.
Never list: first inquiry sent for you, chasing quiet suppliers (not built yet), "learns your taste", "couples like
you" (dormant). It is rule-based, not a chatbot; the "% match" score is free for everyone.
⚠ Money, lane C, owner to confirm before any copy ships: live `platform_retail_catalog_v2` (read 25 Nov) has
`SETNAYAN_AI` = ₱2,790 and **is_active = true** (bands B ₱1,980 · C ₱1,190 · D ₱265 · renewal ₱799, all off). The owner
said ₱1,499 per event. The "normally ₱X" line reads the catalogue; the catalogue value is the owner's to set.

## Add 21 · Setnayan AI: what is free already vs AI-only (controller audit, main @ bd86936; lane C, owner to rule)
Live (read 25 Nov): paywall ON; 1 of 28 real events has AI. Alerts have no cron: `sweepGuardNotifications` runs only
when a host opens the event (`dashboard/[eventId]/layout.tsx:455`), ≤ every 6 h, ≤ 3 alerts, 7-day repeat gap.
- FREE ALREADY → take off the AI list, make strong in the free app: **budget** (budget page "₱X over target",
  `budget-summary.tsx:275`; home ring; supplier cards) · **next_move** core (today's one thing for everyone,
  `event-dashboard.tsx:1084`) · **deadlines** dates (Schedule › Planning Stage, `preparation-agenda.tsx:214`) ·
  **schedule_clash** (Schedule flags it free, `chapters-host.tsx:405`).
- PARTLY: **payments** (seeing what is due is free; the reminder alert + day-before email is AI,
  `setnayan-ai-notify.ts:228`) · **date_watch** (today's booked/free is free; the CHANGE alert is AI) · **rank** (free
  score + cheapest-first team; AI = best-fit team, `build-3state-actions.ts:185`, small).
- AI-ONLY AND WORKING: **price_watch** (`setnayan-ai-snapshot.ts:425`). ⚠ Its copy is false: it says "the figure you
  were quoted"; the code compares the supplier's own old vs new list price (`:455`).
- AI-ONLY, LIKELY REACHING NO ONE: **demand** ("N also eyeing your date") needs privacy control `same_date_demand`,
  created OFF.
- Dead and unadvertised: the decision-window alert (input always empty, `setnayan-ai-snapshot.ts:678`).
Owner's direction (25 Nov): free features leave the AI list and get their best version free; the AI becomes what helps a
host handle SUPPLIERS better. Candidate AI features (data already exists): send one requirement-filled inquiry to the
best fit and follow it up (`requirements-capture.ts:181`) · check each quoted price against the supplier's list and
history · check payment plans (balance after the event, odd deposit) · when a booked supplier cancels, line up free
look-alikes · rank your list by real reply speed · sum up reviews per shortlisted supplier · warn when a
supplier-added to-do is slipping · find dates every picked supplier is free. Nothing is built until the owner picks.

## Add 22 · Setnayan AI's purpose (owner, 25 Nov): make building the supplier team ~10× easier for the client
The AI is for the CLIENT (host). Its headline is a one-tap top recommendation that feels clearly special: the whole
team picked for this event, asked in one tap, followed up and swapped for them. Free keeps browsing, the "% match",
manual inquiries and the sign-up fan-out. Controller's proposed shape (drawing first, owner OK before any build):
one screen "Your team, picked for you" (top pick per category + 2 backups, why each fits, total vs budget) → one
button "Ask them all" (requirement-filled inquiries) → the AI follows up the quiet ones, swaps a declined or booked one
for the next best, and keeps the team's status on one line. Supporting AI checks: fair-price check on each quote,
payment-plan check, backup line-up when a booked supplier cancels. Not built; lane C until the owner approves.

## Add 23 · Setnayan AI = 10 features + its panel on the Suppliers page (owner asked 25 Nov; controller proposal)
Ten (for the client; [works] = running today, AI-only):
1 Team picked for you (top pick per category + 2 backups, a reason each, total vs budget) · 2 Ask them all
(requirement-filled inquiries in one tap, follow-up of quiet ones) · 3 Auto-swap (declined/booked → next best; a
booked supplier cancels → replacement lined up) · 4 Fair deal check (quote vs the supplier's own list and past prices;
odd payment plans: balance after the event, oversized deposit) · 5 Payment reminders before due, bell + email [works]
· 6 Price watch on suppliers you consider [works; fix copy: list price, not "your quote"] · 7 Availability watch,
booked or freed on your date [works] · 8 Budget fixer: when over, suggests the swaps that bring it back · 9 Supplier
report card: real reply speed + what past hosts praised or complained about · 10 Supplier to-do watch: warns when a
task a supplier owes you is slipping.
Panel (drawing first, owner OK before build): a one-line Setnayan AI bar at the top of Suppliers ("6 of 8 confirmed ·
2 need you"); tap → a sheet (popup, not a page) with: the team by category and each one's state · "Needs you" items ·
one main button (Ask them all / Review the swap) · a switch per feature (follow-ups, auto-swap, alerts). Each supplier
card gets a small "AI pick" chip with its reason. Without AI the same bar is an honest preview, "Let Setnayan AI build
your team · included in Event Pro and Ultra", door to Pricing. Alerts also need a real schedule, not only on page open.

## Add 24 · Features 5–10 re-checked + the AI setup questions (controller audit, main @ bd86936)
No crons at all (`vercel.json` "crons": []); every reminder fires on a page open or a button press.
- 5 Payment reminders: PARTLY free (home Budget card lists due/late payments with Pay; supplier/coordinator bell
  pushes by hand). Only the automatic due-soon notice + email is AI (`ai_payment_due`).
- 6 Price watch: PARTLY free for BOOKED suppliers (pax surcharge, change order, "Price changed" line). AI only for
  suppliers still being considered.
- 7 Availability watch: PARTLY free ("Free on your date / Booked" when you look). The push is AI.
- 8 Budget fixer: NOT BUILT for events (the math exists only on the public tour, `lib/budget-overspend.ts`).
- 9 Supplier report card: FREE ALREADY (reply-speed badge, reviews, stars) → drop from the AI list; note the reply
  badge is on Explore only, not the host's Suppliers pages (free-app gap).
- 10 Supplier to-do watch: free ghosting nudge exists; a booked supplier's overdue task: not built.
Onboarding already stores budget (`estimated_budget_centavos`, editable on Budget + Details), guests, date (or date
options), region/area, venue setting, ceremony, style, wanted categories. NOT captured anywhere: per-category budget
split, must-haves / deal-breakers, ranked priorities, preferred contact, how far the AI may act alone. No host editor
for `search_areas`, `venue_name`, `style_preferences`, onboarding categories.
Proposed "Set up Setnayan AI" (a sheet, pre-filled from onboarding, editable any time from the AI panel's "Your
setup"): confirm budget · guests · date · area (pre-filled) → top 3 priorities → per-category budget split (suggested,
adjustable) → must-haves and deal-breakers → how suppliers reach you → "send for me" vs "ask me first". Lane C.

## Add 25 · OWNER RULE (25 Nov): the free app absorbs anything close to free; AI = only clearly different features
If a paid AI feature is almost what the free app already does, the free app takes it over and the AI drops it.
So these move to FREE (lane C to build, then removed from the AI list): automatic payment-due alert + email (5) ·
price watch on suppliers still considered (6) · availability-change alert (7) · budget fixer next to the existing
"over target" warning (8) · supplier report card on the host's own Suppliers page (9) · overdue booked-supplier task
nudge beside the free no-reply nudge (10). They need a real schedule (no crons today).
AI keeps (very different from free): 1 team picked for you · 2 ask them all + follow-ups · 3 auto-swap and cancel
backup · 4 fair deal check (quote vs the supplier's own prices; odd payment plans).
Six candidates to replace 5–10, each to be checked against the free app before listing (controller, not yet checked):
quote comparer (like-for-like across suppliers in one category) · hidden-fee and inclusions check (overtime, travel,
hours, missing items) · negotiation helper (drafts a counter-offer or a package that fits the budget) · change
broadcast (one change, e.g. guests or time, sent to every affected supplier, confirmations tracked) · day-of supplier
run sheet (call times and contacts sent to each supplier) · best-date finder (date options where the most top picks
are free and the total is lowest).

## Add 26 · OWNER RULINGS on the six flagged items (25 Nov: "with all six. Go for it.") — now buildable as lane B
1. **Memories works like the phone's photo app (A3·P-11 moderation):** open a photo → delete, hide and photo notes are
   right on it; a "Hidden" album brings hidden photos back. The separate moderation page is no longer the everyday path.
2. **First-visit tours never block (A3·N-05, and the shared Spotlight tour for EVERY role):** the page works at once;
   the tour becomes small hints beside the controls, dismissible, no dim, no blocking panel.
3. **/pricing order (A1-118):** short hero → plans visible without a swipe → why it's worth it → questions. The two
   extra sections move lower; nothing is deleted. No price or plan content changes (those stay lane C).
4. **Retire the /pricing first-visit tour (A1-158).**
5. **Plan quiz and /start as full-screen rises (A1-120):** they KEEP their own address (a shared link, refresh and
   Back still work; a deep link opens the rise); ✕ returns exactly to where the person was.
6. **Admin Focus on phone (A8·P-B-20): keep the 14 Nov ruling** (tabs stay behind ☰); only add the current tab's
   name next to ☰. Not the five-tab bar.
Still lane C (not covered by this ruling): A6-11 booking ask as a popup (controller recommends keeping the 10 Nov
RISE FULL SCREEN ruling), A6-71 double-claimed date rule, A6-B14 fee wording, A6-B07 Money line, A1-098 help shell
caching. A6-B15 Manpower part = R candidate.

## Add 27 · Door check of every drawn screen (controller audit, main @ 7c14361159) — redesign only what has a live door
Areas 1, 2, 3, 8: 85 screens checked → 80 KEEP. Not to redesign:
- R (retire, not redesign): `guests/quick` (A2-D9 part; in `lib/ugat/baselines/no-door.baseline.txt`) ·
  `website/widgets` and `website/photo-moments` (A3·E-20; only door is a Maker row never shown on screen; jobs already
  inline in the Maker) · Patiktok (A3·S-10; `/patiktok` forwards).
- MOVE: the wax seal maker `studio/save-the-date/stamp` (A3·I-11). The seal is part of the guest envelope reveal
  (`app/[slug]/_lib/reveal-props.ts:56`), so per Add 18 its door and parent become the Event Hub reveal
  ("seal or ribbon", `launch/_components/maker-reveal.tsx:825`), not Save the Date. Save the Date stays (live, weddings).
- Check by a DB read before work: `/onboarding/simple` (door is a database setting).
**Before redesigning ANY screen** run the door check and stop if it fails:
`git show origin/main:apps/web/lib/ugat/screens.generated.json | jq '.screens[]|select(.route=="<route>")|{status,doors:[.doors[]|select(.from|startswith("app/dev/")|not)]}'`
Pass = status "connected" AND one door file really shows the link on screen (the map counts Maker rows that never
render, misses DB doors, and ignores flags). Admin: `lib/admin-map/admin-routes.generated.ts` needs `inMenuSource: true`
or a real link. A failed check = file an R line, do not redesign.

## Add 28 · OWNER RULINGS, area 6 (25 Nov)
1. **Retire Manpower (A6-B15 part):** lane R; delete with a forward, no redesign.
2. **Two clients claim the same date (A6-71), the rule:** whoever REGISTERED FIRST is first in line. Nothing is final
   on a claim alone: when the supplier's page loads or refreshes, the server re-checks which claim truly came first
   (the stored creation time, not the order the screen received them) and only then marks the winner and updates both
   clients. Until that check the date shows as "being confirmed", never as won. Lane C → now buildable (owner ruled);
   needs a test that two claims in either arrival order give the same winner.
3. **Booking ask as a small popup (A6-11):** YES, a popup so it feels like a quick add-on. This REVERSES the 10 Nov
   "RISE FULL SCREEN" ruling for this one panel: the fixer updates the guard test that held it, citing this Add.
   The booking-fee line on that panel stays as it is (no money change).
Still lane C: A6-B14 fee wording, A6-B07 a new line on the Money screen.

## Add 29 · OWNER APPROVED drawings for areas 4, 5, 6 and the controller's recommendations (25 Nov: "go with your recommendations for all")
Area 4: (1) the guest Event Hub stays a phone-width column on tablet/desktop for now (A4-B05 d; revisit after launch);
(2) the camera is NOT a layer over the Hub (A4-69; earlier ruling and its two tests stand); (3) the guest reply stays a
page on phones (A4-41).
Area 5: (1) pull to refresh comes to supplier pages (SP5-01): Add 11 (25 Nov) supersedes the 15 Jun rule; it keeps
the header and the app look; (2) a popup never opens on a popup: A5-G3-06, A5-G5-17, A5-G5-18 open IN PLACE inside the
first popup; (3) empty screens keep their "Example" cards (B5-08 held change is dropped).
Area 6: see Add 28. Lane B drawings for areas 4, 5, 6 are approved; run the Add 27 door check before each.

## Add 30 · OWNER RULING (25 Nov): the post-event story is an EDITORIAL ARTICLE with a "Play the story" view on top
Approved "as long as we can execute it and it is presented properly". One address per event story: big cover photo
(≥1200 px wide, og:image 1200×630) + title + "Play the story" (the shipped tap-through story, full screen) → below it
the article: the host's write-up, photos and chosen moments. Both are made from the same content, made once.
Article/ImageObject structured data, `max-image-preview:large`, readable by screen readers, printable. Reason
(research 25 Nov): Google reduced Web Stories in Feb 2024 and rarely shows them in PH; FB/Messenger previews are the
main share path; articles keep, print and index. Drawing first (Fable), then a build plan; lane C until the drawing
is approved. Findings that point at the post-event story are kept and placed in this page.
**Add 30 detail (owner, 25 Nov):** once the event ENDS, the Event Hub ceases to exist as a hub, and its SAME LINK
(`/[slug]`) becomes the editorial. The editorial holds everything: all stories, all videos, the uploaded Save the Date
videos, all photos and all write-ups. It need not look like the Event Hub. "Play the story" plays the Facebook-style
tap-through of the same content.

## Add 31 · OWNER DELEGATION (25 Nov): he checks the LOOK; the controller owns FUNCTION
Owner: "my main concern is that nothing is off the design; how they work, present, connect and act should be all
you, because I cannot check that from the samples." So: the owner approves drawings for look; the Main Controller
decides and verifies behaviour, wiring, doors and states (money, prices, plan contents and sign-in rules stay his).
- Area 7 drawing APPROVED, including Undo after removing a space (A7-15: one new write op inside the existing Spaces
  action, with a test).
- Event story (Add 30) behaviour, controller decisions under this delegation: (1) audience choices Everyone · People
  with the link · People of this event · Only me; "Only me" until the host publishes; (2) after the event and before
  publishing, `/[slug]` shows "Our story is coming soon" with the cover and date, never the old Hub; (3) the host can
  open the old Hub read-only from their dashboard, guests cannot; (4) player: tap zones, hold to pause, photos 5 s,
  videos play in full, ✕ returns to the same spot; (5) the writing helper is free; (6) guest dark mode follows the
  couple's theme (no house glow), as the guest pages do today.
Every fixer PR is function-checked by the controller before it lands: the change is reachable (Add 27 door check),
wired end to end, honest on failure, and its test holds the claim.

## Add 32 · OWNER RULING (25 Nov): what each plan gets after the event (Lane C, money/rule)
Owner: "if it's for free, then it will be very basic, like no editorials, no write-ups, and just photos, their gallery,
their cover photo… if they go to Pro, they go to Ultra, the full editorial will be created and the printout as well."
- **Free (below Pro):** the post-event link shows the cover photo and the photo gallery only. No editorial, no write-ups,
  no story chapters. Gate the write-up tools and the writing helper (this replaces Add 31 (5) "the writing helper is free").
- **Event Pro:** the full editorial (write-ups, story play, chapters, Save the Date videos).
- **Event Ultra:** the full editorial plus "Our Day Paper", the broadsheet print download (drawing
  https://claude.ai/artifact/Ev7VMomriwQT4GgYqVS9f7; sizes are the existing DAY_POSTER_SIZES, largest first; gate through
  the existing `eventCanvasPrintsActive`/`eventUltraActive`).
- Open for the owner: is Pro's print excluded even for Pro bought before canvas left Pro (`CANVAS_LEFT_PRO_AT` grandfathering)?
  Default until he says: follow the same grandfathering rule as canvas.
- Nothing already written is deleted when a plan is lower: it stays saved and shows again on upgrade.
- **Look APPROVED (owner 25 Nov: "A newspaper looks good.")** for the Our Day Paper drawing. Function stays the controller's (Add 31).
