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
