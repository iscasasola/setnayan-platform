## 2026-11-19 · feat(supplier-today): Today v3 part 1 — the Focus shape: no hero photo, a short mast, ONE list by urgency, every row opens as a card

Owner, 19 Nov, looking at live Today: "then why do i have a header when this was not part of the design" · "remove the
photo of that header" · "we do not want unwanted space on top" · "it was suppose to look like a search with ust a list
of notifications" · "it was suppose to look like foucs" · on what sits under the list: "Keep them below". Rulings:
DECISION_LOG 2026-11-19 "TODAY HAS NO HERO PHOTO", "TODAY v3 — THREE MORE CALLS", "TODAY v3 RULED AS A WHOLE".
Drawing: artifact F4vQbaCwFtu2iawYd2r6q2 (v3.5). This is PART 1 of five — the shape only, with no new data.

- **No hero photo.** Today no longer mounts `SupplierHero`, reads no picture (`heroPicture` · `mostViewedPhotoKey` ·
  the photo-views read · the upload facts are gone from the page) and draws no "Sample photo · Upload yours" or Upload
  pill. Supersedes the 9 Nov "Today shows the most-viewed" (Lane E item 11) and, for Today, the one 208 px hero (item
  10). Shop keeps its cover; uploading stays on Portfolio.
- **A short mast** (`TodayCover`): "Good morning, <Shop> · <date>" over "N tasks today · X of Y done" and the pips, ⚙ at
  the right. No band; only as tall as its two lines.
- **The list comes first.** Needs you today sits right under the mast. The Next badge card, Next events and the five
  numbers moved UNDER the list, each still its own block; Grow, Recommended, Trending, Coming up, Shop and How is
  business stay below as drawn (owner: "Keep them below").
- **One list, most urgent first** — red, then amber, then the rest; the Quick and "Opens a screen" groups and their
  counts are gone, so there is one count. A level always wears its word (Overdue · Today · Soon) and comes ONLY from a
  deadline the code already has (drawing V3 · 3, the whole table): a date change's `dueAt` (`taskUrgency`), EACH
  booking fee's `dueOn` (`feeUrgency` — overdue · last day · not yet due), the business permit's own rule
  (`permitUrgency` — expired red, 7 days or fewer amber, from `permitNeed`'s line tone), and a booked event today (red)
  or tomorrow (amber) (`eventUrgency`, from the page's `upcoming`). `todayOneList` puts every one of them in one order.
- **Each fee bill is its own row** (fix after the 19 Nov Fable review): its own tint, edge and level word ("Overdue ·
  since Sat 14 Nov"), its own place in the list, and it opens as a card with the amount, the introduced line, the lock
  sentence and Pay, ending in "Open in page ›" (the bill's page). It is still a `data-fee-bill-today` row inside
  `data-today-need-bills`, so Today's search finds it as a payment.
- **The permit and today's events join the list when they wear a level**, and are counted, as drawn ("Needs you today
  6"). A permit further out stays under "Also for your badges and your page"; an urgent one is not said again as a
  grow move. An event row's card holds the day's line — nothing to answer — and "Open in page ›" (the client).
- **Every row opens in place as a card.** The bigger kinds (inquiry, message, booking ask, cancel request, quote and
  contract drafts, dispute, a lapsed ask) no longer rise as a second screen: each opens in its own row with the SAME
  shipped body, in the shared frame, and ends with "Open in page ›".
- **A short bookings read is never "done"** (controller re-review): the overview read now returns `bookingsComplete`
  (its booked-events read reached the end); when it is false Today gets `eventsUnread` — no count, never "You're done
  for today", and a "Couldn't load your bookings just now" row. Held by `today-unread-bookings-are-never-done.test.ts`.
- **A row's badge tag sits under its line** (drawing V3 · 3 `.bg`), so at 390 px the line is no longer cut off by a
  pill and a tag side by side.

NOT in this part (each its own PR, in this order): drag right / drag left and "Do it tomorrow" (needs a put-off record)
· the finished-event wrap-up card · admin Focus opening in place · the three urgency windows that are admin settings
not yet set ("soon" for an inquiry or booking ask, for an event beyond tomorrow, the 7 silent days). The search at
Today's foot is still the shipped box — the app-wide "round icon until tapped" thumb-row ruling is its own change.

Guards re-aimed on purpose, each with a note: `one-supplier-hero` (Shop alone mounts the hero) ·
`today-gear-rides-the-header` (the ⚙ sits in the mast's slot, no cover ink) · `today-has-a-side-pane-on-a-computer`
(the top block is found wherever it sits) · `today-is-one-task` (a bigger kind opens in its row, not a risen screen) ·
`today-v2-reads-are-honest` (one count) · `the-today-pin-never-bleeds-past-its-gutter` (the mast does not bleed at
all) · `every-supplier-top-row-is-one-selector` (the mast's words). New: `today-is-focus-shaped.test.ts` and
`lib/supplier-today-v2.test.ts` V1–V6. `today-is-focus-shaped` test 3 re-aimed: the bills no longer move as one
block — each of bill, permit and event is its own card row with its level, word and "Open in page ›".

SPEC IMPACT: None new — builds rulings already in DECISION_LOG (the controller logs "Keep them below").
