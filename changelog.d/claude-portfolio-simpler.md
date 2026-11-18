## 2026-11-19 · feat(portfolio): Portfolio, simpler — albums row, four ways in, one Show-and-sort round, search by place

Owner 2026-11-19: "simple (no header) just the way to cleanly access his shop's photos … First row would be the most
viewed albums and recently viewed albums" · "portfolio simpler approved" · "just one: show and sort" · "no word just
icon" · "B · Sliders" · "when i type a place, example tagaytay, i see all event albums from tagaytay, services
inspiration and videos taken there as well". Drawing: artifact 7SfMdJW9mryK59pm7bKa5A (v6).

`/vendor-dashboard/collections` — the shipped parts, repositioned:

- **No header.** The photo band, its "Latest" pill, the counts and the pinned row are gone. The house ⚙
  (`PortfolioSettings`) sits at the right of Row 1's heading; Show ▶ (the album slideshow) moved into it.
- **Row 1 is albums** — the page gallery, one per event, per service card, per inspiration part — in the Sort's order,
  "All N albums" last (`lib/portfolio-albums.ts`).
- **Four ways in**: From events · From services · From inspiration · Video links. A tap rises the group full screen;
  inside, the shipped sections draw as plain headings (one level). An event says its venue and the service cards booked
  at it.
- **One round in the thumb row** (sliders icon, named "Sort") opens one dropdown: Show (a filter — All · Events ·
  Services · Inspiration · Videos) then Sort (Most viewed · Opened by you · Newest); a dot when not the default. ＋
  appears only when the search words match nothing, and opens the device's picker.
- **Search by place**, from what is already linked: an event's venue and address, the cards booked at it
  (`card_portfolio_booked_events`), a look's tagged event (`inspiration_tag_event_lines`); a video by its title.
  Nothing is tagged by hand.
- **"Most viewed" reads the two counters the app already has** — `service_card_opens()` and
  `vendor_portfolio_photo_views` (summed for the page album). NO new view counter. Event and inspiration albums cannot
  be counted (private album · no open on the public page): they wear no count and sort after the counted ones; the ⓘ
  says why.
- **Migration `20271351728222_vendor_album_opens.sql`** — when a shop's own people last opened each album ("Opened by
  you"). RLS at create (own rows, select/insert/update), cascade with the shop, default grants revoked. Written from
  the browser through RLS (`lib/portfolio-album-opens.ts`) — no new server action.

Removed on purpose (all listed in the drawing): the header; the twelve stacked sections and their ˅ folds; "More";
Reorder (`portfolio_section_order` stays stored, unused); "Your best work" (its photo counter keeps counting); the
separate ＋ at rest; Sort "By name"; the bottom "Add photos" fold (now "Edit my page photos" inside All albums, still
`#gallery-media`).

NOT DONE, on purpose: at rest the search is the shipped `ThumbRow` field, not the growing search icon with the 🔍→＋
morph — that component belongs to the motion lane (#7792) and is swapped in when it lands (TODO held by
`collections/the-portfolio-is-simpler.test.ts`). Video links keep the shipped editor (tap a row to edit, ▶ plays,
Remove inside) rather than swipe-to-remove.

Guards updated on purpose (each with a note): `each-group-heading-rises-full-screen`, `an-empty-portfolio-looks-finished`,
`the-portfolio-is-all-media`. New: `collections/the-portfolio-is-simpler.test.ts`, `lib/portfolio-albums.test.ts`.

SPEC IMPACT: DECISION_LOG row 2026-11-19 "PORTFOLIO, SIMPLER — APPROVED" (albums row · four ways in · one Show-and-sort
round · search by place · no second view counter).
