## 2026-08-20 · feat(dashboard): the counter rides the card, and an event can be removed from My Events

Three owner asks from one look at My Events (2026-08-20).

**1 · A celebration can be removed, from the board.** *"we can allow users to delete
their planned event. how can we do that on my events?"* Every card a person
organises grows a "⋯" menu offering **Put this away** (reversible, unchanged, and
listed first) and **Remove for good** below a divider. Removing names what goes —
real counts of photos, guests and booked suppliers — and costs the event's typed
name.

Nothing about the mechanism is new: `couple_can_delete_event` has been live in
prod for the whole project, and migration `20271138150255` already moved the
address-hold into a `BEFORE DELETE` trigger *"so no path present or future can
miss it, including one nobody has written yet"*. This is that path. The hold is
NOT re-written here.

- Couple members only — narrower than put-away (which admits coordinators), and
  an exact match for the RLS floor, since `current_couple_event_ids()` is
  `member_type = 'couple'` alone. A co-host may tidy the list; a co-host may not
  destroy somebody else's wedding.
- 🔒 **The money gate fails closed.** An event with a settled order (`paid` /
  `fulfilled` / `refunded`) cannot be self-removed — and neither can one whose
  order count could not be READ. Every other number on the confirmation degrades
  to "we couldn't check" and lets the person decide; a paid service is a receipt
  and a BIR record, so an unmeasured answer takes the safe side. Intent
  (`submitted` / `awaiting_payment`) is never counted as money.

**2 · The page title is unpainted.** *"Remove Your Events on My Events. we don't
need that text."* The top bar already names this place, so the visible `<h1>` was
the same word twice. It survives as `sr-only`: stripping it outright would leave
the document with no heading at all and start the outline at "Coming up" with no
parent.

**3 · The count moved onto the event it belongs to.** *"can't we just place a
counter on the event card for that event itself on that page?"*

🔑 **His instinct is a real defect.** The retired banner rendered `watchRows[0]` —
the busiest event and no other — so a second event with something waiting said
nothing at all, on a page whose whole job is to show you your events.

⚖ **This reverses an owner ruling whose premise had expired.** Owner 2026-07-15
put attention counts in ONE home, never on a card — correct while The Watch tile
listed EVERY event with its own count. The strip-to-events change (2026-08-19)
deleted The Watch and the "Needs you" board tile, and what survived was a banner
that is not a home for the numbers but a home for one of them. "One home for
overdue counts" had quietly become "one count".

The pill leads with the total and still names the top action, because both owner
rulings are live: 2026-07-10 asked for a named line rather than a bare badge, and
a bare "9" would satisfy the new instruction by breaking the old one.

**Also:** removed `needsTotal`, `watchRows` and the `buildHomeBoardTiles` import —
all three fed The Watch tile and had been computing numbers nothing rendered.

**Guards** — 20 assertions, every one mutation-checked with its occurrence count
printed before → after, all RED on sabotage:
- `lib/event-deletion-gate.test.ts` (9) — the money gate fails closed on `null`;
  an empty box can never delete a nameless event.
- `app/dashboard/(launcher)/counter-on-the-card.test.ts` (11) — all 5 card call
  sites pass a summary; an absent summary renders nothing, never a `0`; the
  counter never appears on an invited card; the menu is a SIBLING of the card,
  never inside its `<Link>` (a nested button activates both).

⚠ Three mutations in the first run **did not apply** (perl choked on `/` in the
patterns) and their GREEN meant nothing — caught by printing the counts, re-run
with a replacer that lands. Assume a fourth.

SPEC IMPACT: `DECISION_LOG.md` — row added 2026-08-20 (couple-side event
deletion + the 2026-07-15 one-home-for-counts reversal).
