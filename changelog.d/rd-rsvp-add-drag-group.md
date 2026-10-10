## 2026-10-10 · feat(maker): the RSVP stage adds a line, drags to reorder, and groups (steps 5–7)

Owner's ruling (spec corpus `Maker_RSVP_Per_Element_Add_Drag_Group_LOCKED_2026-10-09.md` §3, approved prototype
`prototypes/maker_rsvp_add_drag_group_2026-10-09.html`): ＋ is back on the RSVP stage and adds a line (Heading ·
Message), a held line drags to a new place, and several lines can share one background as a group.

**5a · the database has room, and a live fault is cured**

- Migration `20271267092468_events_rsvp_ask_config_room_for_added_lines.sql`: the size CHECK on
  `events.rsvp_ask_config` goes from 2,048 to 24,576 bytes. Only the CHECK changes — no column, no data, no grant,
  no RLS, no view.
- The app's own refusal (`RSVP_CONFIG_ROOM`, `apps/web/lib/rsvp-look.ts`) goes from 1,900 to 19,000 JSON bytes, in
  the same change. The two numbers are a measurement, repeated on the replayed schema by
  `apps/web/tests/db/rsvp-ask-config-has-room.db.test.ts`: the worst config the app's shape allows is 17,327 JSON
  bytes and 19,025 bytes as stored (1,698 over); with no typed words the stored form is ×1.284 its JSON. So
  nothing the app saves is over about 20,700 bytes stored, and even all-structure 19,000 × 1.29 < 24,576.
- FOUND AND CURED: the old pair did not hold. The app counts JSON bytes, the database counts the stored value, and
  the stored value is the bigger one — a look-heavy config a little under 1,900 JSON bytes was over 2,048 as stored,
  so the app passed it and the database refused it at Apply. The db test writes that case down as a measurement.

**5b · the reply pages draw their lines from a list — and with nothing stored they are today's pages, to the byte**

- `apps/web/lib/rsvp-look.ts` — the one strict reader now reads three more keys of `rsvp_ask_config.look`: `added`
  (lines a couple added: a Heading or a Message, at most 4 a screen, words cleaned and capped), `order` (a HINT — any
  line it does not name is put back, so no stored order can lose the Yes or the No) and `groups` (at most 4 a screen,
  a line in one group, never a group in a group; its background None · Plain · Frosted). `rsvpScreenLayout` turns them
  into the list a page draws, and answers `null` for a screen that stored none of it.
- `apps/web/app/[slug]/_components/rsvp-lines.tsx` (new, a server component): walks that list. An added line's words
  are text, never markup; a group is one plain `<div>` INSIDE the reply's one fieldset, so the two answers stay one
  radio group wherever they stand. An added line with no words is never drawn for a guest.
- `rsvp-widget.tsx`: the reply card's fieldset is drawn from the list. While Eyebrow then Question lead it they are
  its `<legend>`, as before; otherwise the fieldset is named by the same two lines (`aria-labelledby`).
- `rsvp-note-lines.tsx` (new): the note after a Yes and after a No, moved out of `invite/enter/page.tsx` unchanged
  and drawn from the list.
- Reach is the same as each line's look: the invitation's reply page and the page after a reply, the reply card's
  own style. The Event Hub's reply sheet and The question / The ticket are handed no list.
- The Hint keeps its place at the card's foot (it is drawn by the one-question flow, not by the card), so no order
  and no group holds it — a difference from the prototype, decided by the controller 2026-10-10.
- PROOF, recorded before any page file changed (the commit before this one): `the-reply-card-is-todays-page` (83
  cases of the whole card, by sha-256) and `the-note-after-a-reply-is-todays-page` (18 cases, the notes' HTML in
  full, from the page's own JSX). Both still hold. `the-reply-is-never-lost`: over 3,000 hostile stored values the
  card always has one Yes and one No, in its one fieldset, nothing hidden, still named; six sabotages each go red.
- The dev lab (`/dev/maker-lab/guest`) draws the real reply card and the real notes now, instead of hand-made
  copies of them, and takes `?look=<json>` to be drawn as a saved page is.

**5b2 · a look set on the RSVP stage reaches the Event Hub's own reply sheet (a dead setting, live until now)**

- FOUND: a guest replies in two places — the invitation's reply page (the first reply) and the Event Hub's own
  reply sheet (`site-body.tsx`: changing a reply later, and every guest of a "no reply needed" event). Only the
  first drew what the Maker's RSVP stage sets, so each line's Font · Colour · Size · Build in was live in the Maker
  and never seen by a guest on the sheet.
- `site-body.tsx` (four additive hunks, no existing line changed): the reply card on the sheet is handed the same
  list (`lines`) and the sheet carries the same one `<style>` (`RsvpLookStyle`), from the config the page already
  holds — no new read, and for an event that stored nothing, NOTHING (not an empty tag).
- The card on the sheet, ruled by the controller 2026-10-10 and written in one place (`rsvpCardGroundOn`,
  `lib/rsvp-look.ts`): Plain = the sheet's own paper; Frosted = that paper as the app's glass; None is shown as
  Plain (a sheet with no ground over the invitation cannot be read); the card's Build in is not drawn there. A
  group's background applies on the sheet as on the page.
- The Maker says so where the couple sets them: one quiet line under the form card's Background and its Animate —
  "Inside the Event Hub, the reply sheet keeps its own paper and its own way of opening."
- PROOF: the real guest page's own record (`lib/site-body-fixture-render`, branch `rd/site-body-fixture-render`
  `7ae4c46d8` — recorded at this base with no page file touched; it draws this sheet) laid over this change: 5/5,
  byte for byte; and the same page with only another screen's look, or the card at None with a Build in, is that
  record too. With a look stored the page gains the list inside the reply's fieldset and one `<style>`.
- The dev lab can show the sheet as a guest sees it: `/dev/maker-lab/guest?rsvp=form&sheet=1#your-details`.

SPEC IMPACT: None beyond the locked record already in the corpus (`Maker_RSVP_Per_Element_Add_Drag_Group_LOCKED_2026-10-09.md`
§4–§5 names the cap and the migration). The measured numbers confirm §5's (24,576 / 19,000).
