## 2026-10-10 · feat(suppliers): Find shows only what can be booked for this event, and one inquiry covers every category ticked

Owner, 2026-10-10: *"so when they search for a supplier's service card. it will
be compared to the available schedule of that service on the event's date and
if there is a location already, if we can cater that service to that location.
service card will not show if they are not available to that date/s or that
location. when they inquire, we also show what other categories they offer. so
when they inquire, they will inquire for all the categories they want to know.
it will be counted as 1 inquiry."*

Nothing here is a new mechanism. Every part was shipped and is extended.

### 1 · Find hides what cannot be booked on the date

`searchCategoryVendors` has taken `hideUnbookable` since 2026-09-11 (H6: a
supplier the couple has never met leaves the search when EVERY card they sell in
the category is refused on EVERY day in scope). The bench's overlay and the
"More to compare" row passed it; Find a supplier
(`vendors/categories/page.tsx`) did not, so it only moved such a supplier down.
Find now passes it.

Unchanged, on purpose: it is per service card; a supplier the couple already
knows never leaves; a supplier with no calendar set is not refused and stays;
any error in the read hides nobody.

- `lib/h6-mirrors-the-booking-path.test.ts` — the "who asks to hide" pin is
  re-aimed, not weakened: it now names Find as the second deliberate caller,
  with the owner's sentence as the reason.
- `lib/find-shows-only-what-can-be-booked.test.ts` — new. Anchored on Find's own
  call (every call the page makes, counted), so it cannot be satisfied by some
  other call in the file.

Callers left alone: the Build fallback (`build-3state-fallback-actions.ts`), the
unlock (`unlock-category.ts`) and the free-venue shortlist. They are not Find.

### 2 · "date/s" — an event still choosing between days

An event that has not settled its day keeps `events.event_date` NULL and holds
its shortlist in `events.date_candidates`. The hide read `event_date` alone, so
for those events it asked about no day and hid nobody. `unbookableDateScope`
now takes the candidates: a settled day wins, then the candidates, then a month
— the order `resolveProbeWindow` already uses for the bench's free days. A
supplier leaves only when every card is refused on EVERY candidate.

⚠ That rule for several dates is the controller's reading, not the owner's
words (the same shape as his "Hide only if full all month"); the code comment
says so. It applies to every caller that hides — Find and the bench search read
one scope. No migration and no RPC change: `service_cards_unbookable_on` already
takes any set of up to 31 days. A flexible window (`date_window_start/end`) is
NOT read — nobody has ruled on it.

### 3 · One inquiry, every category ticked

On the supplier sheet, "The rest of their portfolio" was a row of separate
"Ask about X" buttons, and `contactShortlistVendor` always sent
`alsoServiceIds: []`. For a supplier already on the couple's list, "Ask about
Cake" opened the chat and recorded nothing about Cake.

It is now the shipped "Also ask about" tick list (the block from
`app/v/[slug]/_components/inquiry-composer.tsx` — its legend, its checkbox, its
ticked look), and the sheet's ONE ask button sends the category on screen and
every ticked one together:

- `contactShortlistVendor` takes `alsoTiles` (no new exported action). Each
  ticked category resolves to that supplier's earliest active card in it
  (`lib/supplier-sheet-ask.ts`, the same reading the sheet's list is built
  from) and rides the one `startServiceInquiry` call as `alsoServiceIds`.
- One thread (`chat_threads` UNIQUE (event_id, vendor_profile_id)), one
  `thread_service_interests` row per category.
- A conversation that already exists gains the new categories on the SAME
  thread: with a tick, "Open chat" becomes the ask button. No second message is
  posted on a resumed thread — that rule is `startServiceInquiry`'s and is
  unchanged.
- A ticked category the supplier no longer has a live card in is said
  ("That service is no longer available.") before anything is sent.

Frames only on what is pressed (owner 2026-10-11: *"only have frames if
something needs to be clicked like a button, separate topics with divider."*):
each tick and the ask button are framed; the list's heading sits on the sheet
with no box, and the topic starts at a divider. The per-row fragment "can be in
the same quote" is gone: said once it is not a sentence, and the composer's own
sentences here are the bundle nudge's, which promise a bundle price this sheet
does not ask for — the words are the owner's to give.

The ticks are the app's accent (`accent-terracotta`, the RSVP's token). The
class copied from the composer is a forms-plugin idiom with no plugin behind
it, so it painted nothing and the boxes ticked browser blue. The sheet's ask is
its row's MAIN verb — filled, by the button rule; it was outlined like Follow
and Share beside it.

Also fixed in the sheet, found measuring this at 375 px: its button row was
never fitted (`useFitRow` ran in the component that returns null until `<body>`
is known), so "Ask for a quote · Follow · Share" ran 10 px past the sheet's
edge for any supplier with no conversation yet. The row is now fitted by the
component that draws it — the same trap and the same answer as
`find-thumb-row.tsx`.

Not changed: the supplier's side. The thread header names every category
asked (`ThreadInterestChips`); the Today card, the messages list and the
new-inquiry notice do not — reported, not built.

### 4 · Find offers "farther away"

Owner, same day: *"yes offer the farther away option. in case the need to
search more"*. Find a supplier listed only the suppliers who reach the event's
place and had no way to look past them; the expander shipped only in the bench's
search overlay. Find now carries the same control with the same four sentences
("Show suppliers farther away" · "Finding suppliers farther away…" · "Farther
away · outside their service area" · "No suppliers farther away — everyone
covering your area is listed above.").

- A press adds `far=1`; the page then asks the SAME search with
  `includeFarther` (only the out-of-reach suppliers, nearest first). It runs
  only once asked for, and is offered only when the event has a place.
- **Distance only.** The farther search passes `hideUnbookable` too — a
  supplier who cannot be booked on the date stays hidden with it open.
- Reach itself is untouched: per supplier, read as it was; no radius number
  changed. `/explore` is untouched.
- The rows moved, unchanged, into `find-supplier-list.tsx` so both lists draw
  the same row and `/dev/suppliers-lab?find=<category>` can show them at 375 px.

One difference from the overlay: it shows its expander only under a non-empty
list. Find offers it under an empty list as well — that is when a couple most
needs to search more, and "No supplier lists this yet" would otherwise be said
while suppliers farther away exist.

### 5 · An empty list says why

With Find hiding who cannot be booked, a category whose every supplier is full
on the date came back as no rows — and the page said "No supplier lists this
yet. Check back soon.", the sentence for a category nobody has joined.

The search now returns `hiddenForDate`: the number of rows its own hide removed
(counted around the one filter; no second query; absent when zero). Nothing
found and somebody hidden is the booked case; `findEmptyState`
(`lib/supplier-find.ts`) picks the sentence, and the page carries none of its
own. The booked case reads **"Every supplier here is booked on your date."**,
followed by the farther-away control and nothing else.

⚠ That sentence is the controller's wording, pending the owner's look (built
from the shipped badge "Booked your date"); the code says so. The approved
prototype's words for the same case are "Nobody is free on <date> — try another
day in Help me choose."

SPEC IMPACT: None beyond the row already filed — `DECISION_LOG.md` 2026-10-10
"SEARCH SHOWS ONLY WHAT CAN BE BOOKED FOR THIS EVENT; ONE INQUIRY COVERS EVERY
CATEGORY THE COUPLE TICKS" (the controller filed it; this change implements it).
