## 2026-09-21 · feat(rail): the rail focuses on the section you are in

Owner: *"When we enter an Event sidebar will collapse focusing on just everything
needed for that event and an icon to return to Events"* · *"same concept when on
memories, people, shop, and admin."*

New `focus` prop on `FrontDoorShell`/`AppRailShell` (decision in the pure
`rail-focus.ts`). When focused, the desktop rail draws one back row, the
section's own menu, and the small print. Discover, My Home and the free-tool
groups are not drawn; inside an event Studio and "Browse by category" stay.

- Event → "Back to events"; shop, HQ, Memories, People → "My Home" (all `/dashboard`).
- Memories gets a rail menu: the page's own lens + "Also kept" chips, from the
  new shared `library/_data/library-views.ts` (`resolveLibraryView`), which the
  page now imports too. The chips are `lg:hidden` (the rail carries them ≥1024).
- People gets People · Connection tree · Alaga · Samahan (anchors
  `#connection-tree`, `#alaga` added to their sections). Samahan pages focus too.
- Other account pages (profile, notifications, …) keep the full rail.
- In focus only drawn rows compete for the lit row; free-tool lists are emptied
  once rather than gated at render (per `the-rail-renders-what-it-is-handed`).
- Guard `rail-focus.test.ts` (executes the rule; 3 sabotages caught).
  `alaala-is-memories.test.ts` re-anchored to the moved `LENS_KEYS`.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-21 row — closes One Shell decision #4
(push vs swap) as a swap; records the Memories/People rail menus.
