## 2026-10-03 · fix(guests): search finds everything · every heading folds · tap the card to open it · the ⋯ list stays on screen · the delete warning is true

Owner, 2026-10-03 (screenshots: searching "VIP" and "Bestman" found nobody), plus
two live bugs measured at 375 px on 74ff0be.

- **One guest matcher** — `guestMatchesSearch` (`apps/web/lib/guest-search.ts`),
  table-tested in `lib/guest-search.test.ts`. Names (every part, accents off),
  the reply in every word (no reply · pending · accepted · attending · coming ·
  declined · not coming · maybe — "coming" never lists the guests who are not
  coming), the role however it is spelled ("bestman" = Best Man, "maid of
  honour", one or two letters off for a role word), the role group ("VIP ·
  Immediate Family", "Groomsmen"), the couple's own role words, group, side,
  tags (VIP), table, and every RSVP answer (meal, dietary, +1 name, the note to
  the couple, their song requests). The Guest list's `?q=` filter — the one the
  top bar's "Search guests" box writes — now calls it; the inline
  `haystack.includes(q)` is gone. No custom RSVP questions exist in the schema
  yet; `facts.answers` is the slot for them.
- **Every heading folds, the pinned "Bride & Groom" too** — the section build
  makes every section whole and ONE function, `foldSections`
  (`lib/roster-arrangement.ts`), empties folded ones for every key alike; the
  table and the phone list draw only from its output.
- **A tap on a card's white space opens the guest card** — through the name's
  own trigger; the side dot, role, + group, reply pill, Invite and ⋯ keep their
  taps; while picking rows white space ticks the row. The computer row's own
  "click anywhere" rule now shares the same `isWhiteSpaceTap` (`row-tap.ts`).
- **The row ⋯ list opens wholly on screen** — it was pinned by its right edge to
  a button on the LEFT of the phone card and ran off-screen. It and the
  guest-table popovers now place through one function, `placeMenu`
  (`lib/menu-place.ts`): lined up with the ⋯ when it fits, clamped into the
  viewport otherwise, flipped above when there is no room below.
- **The delete warning's "song request" is now true** — the delete takes the
  guest's `event_song_requests` rows (service role, scoped to the guests RLS
  really deleted, guest lane only) and hands them to the Undo, which writes them
  back through one re-check (`restorableSongRequests`,
  `lib/released-song-requests.ts`). No schema change, no new server action.

Guards: `lib/guest-search.test.ts`, `the-top-bar-searches-guests.test.ts` (+1),
`_components/every-heading-folds.test.ts`,
`_components/a-tap-on-white-space-opens-the-card.test.ts`,
`_components/the-row-menu-opens-on-screen.test.ts`,
`the-delete-warning-is-true.test.ts` — each sabotaged once.

SPEC IMPACT: None (rows already logged: DECISION_LOG 2026-10-03 "A HOST CAN DELETE A GUEST WHO ALREADY ACCEPTED"; INTERACTION_RULES § 4).
