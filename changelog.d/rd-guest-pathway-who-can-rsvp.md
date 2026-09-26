## 2026-09-27 · feat(maker): RSVP is its own page in the Maker; "Who can RSVP?" and "one question at a time" are one stored value each

Guest pathway brief, items 4 + 5 (couple side).

**Item 4 — the stored values.** Both ride inside the existing
`events.rsvp_ask_config` jsonb — no new column, no migration:

- `whoCanRsvp` — `'guest_list'` (Only my Guest List, the default and what an
  absent key means) or `'anyone'` (Anyone, I approve — a person without a key
  may ASK to join and waits in Requests).
- `oneAtATime` — boolean, default off.

`lib/rsvp-ask.ts` exports the typed readers every surface uses —
`readWhoCanRsvp`, `anyoneMayAskToJoin`, `readOneAtATime` — plus
`resolveReplyBy`, which returns the couple's own `guest_list_edit_deadline`
when set and otherwise 30 days before the event, marked as the default (it
never overwrites a set deadline). The draft-path sanitizer keeps both keys, so
saving one question switch can no longer reset "Who can RSVP?".

**Item 5 — RSVP in the Maker bar.** The bar is now
Details · Logo · Hero · Reveal · Love Story · **RSVP** │ stages │ Prints & Tickets
(key `rsvp-page`, because `rsvp` is the Invitation stage's own key). Picking it
opens a page like Details: the body is the guest's RSVP as they meet it (the
Invitation on the SAMPLE seat-holder, reply sheet open — no real guest), and
beside it: Ask one question at a time · What do you ask your guests? (MOVED
here from Details) · Who can RSVP? · Reply by (the couple's date, or "30 days
before") · Requests waiting (n) → Open Requests. Every setting saves into the
draft through the existing `hubDraftAction` — Draft → Apply like the rest of
the Maker — as ONE object, so the settings cannot overwrite each other.
Guest List → Invite now shows "Who can RSVP?" from the same stored value, with
a link to where it is changed (it has no writer of its own).

Held by `lib/who-can-rsvp-is-one-value.test.ts`,
`lib/the-made-once-items-are-pages.test.ts` (RSVP renders as a page, settings
beside it, the questions moved off Details) and
`launch/_components/the-maker-bar-is-the-final-bar.test.ts` (eleven items).
Server actions: +0. Migrations: none.

SPEC IMPACT: None — implements DECISION_LOG 2026-09-26 "NOBODY WITHOUT A KEY" /
2026-09-27 guest pathway prototype rows (RSVP made-once page) as written.
