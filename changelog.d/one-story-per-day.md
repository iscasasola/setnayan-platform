## 2026-08-22 · fix(story): "Write the story of X" opens that day's own story

Owner, 2026-08-22: *"isn't that the editorial. the story?"* He was right, and the
answer was worse than a naming clash — **My Events was pointing at the wrong
product.**

Two different things are called "the story of a day":
- **the event's own story page** — Setnayan drafts it from the day's schedule and
  photos; the couple opens it already written and corrects it; one per event,
  created automatically;
- **a Storyteller chapter** — a blank page where a PERSON types their account of
  a day from memory; one day can have several, including one from a supplier.

They are separate records. Nothing copies between them. Verified by reading: no
file in the app touches both, and no migration links them.

**What a couple hit before this.** She publishes her story page and it says
*"Your story is live."* She returns to My Events and the same wedding still sits
under *"Untold — no story written yet"* offering *"Write the story of Cale & Ice"*
— which opened a blank page, with an example naming a stranger's wedding, asking
her to write the same day again from nothing. **The app told her, in the same
minute, that her story was live and that it was never written.**

- The Untold/Told shelves now measure the EVENT'S OWN story page, not a chapter.
- The chip opens that page. The guest-list wrap-up button already did — two
  buttons reading "Write the story" now agree instead of going to two screens.
- Told's footer stops saying "chapters" and points at Memories, where a told day
  is read back.
- 🔒 The new measure has NO hidden precondition: publishing needs no public
  address and no paid upgrade (that gate was retired 2026-08-21). The old one
  required sharing publicly AND claiming a permanent web address first.
- Every comment asserting the old wiring is corrected in this same commit
  (`front-door-shell.tsx`, `command-data.ts`, `event-board.ts`) — a claim left
  behind in one file is how the next session re-derives the wrong answer.
- Guard updated to pin the new destination AND to refuse the old one; both
  assertions mutation-checked by occurrence count (1 → 0, each red).
- Port baseline regenerated: 403 routes before and after, 0 dropped, and the diff
  removes EXACTLY ONE entry — the composer link this change deliberately retires.

📊 **Safe by arithmetic:** prod holds 0 published story pages and 1 published
chapter attached to no event, so both measures are empty today. Nothing moves on
anybody's board.

⚠ **FLAGGED, NOT FIXED — the board's Storyteller door is dead code.**
`BecomeStorytellerRow`, `OpenShopRow` and `CreateSamahanRow` are all defined in
the launcher and rendered NOWHERE (zero call sites app-wide). Two guards assert
the board carries those doors and are currently satisfied by strings inside
components nothing mounts. The Storyteller is still reachable from the account
menu, so nobody is stranded — but those guards are decorative and should be made
honest. Separate work.

⚠ **OWNER CALL — the free/paid split may be inverted.** The blank page is free;
on the story we already wrote for her, naming the moments, ordering the sections
and choosing which wishes to feature are sold as Event Hub PRO.

SPEC IMPACT: None — no price, SKU or locked decision moves.
