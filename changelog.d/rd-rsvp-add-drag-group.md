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
  "Inside the Event Hub, the reply sheet keeps its own paper and its own way of opening." With Frosted picked the
  sheet's paper IS changed (to glass), so the line then reads "Inside the Event Hub, the reply sheet keeps its own
  way of opening." (`rsvpSheetKeepsLine`, a sentence of the one mapping; the wording and the "None is shown as
  Plain" mapping are the controller's, pending the owner's look). Four rows, filled from row 1: under Animate the
  line gives its row up while Move or Size is on.
- PROOF: the real guest page's own record (`lib/site-body-fixture-render`, branch `rd/site-body-fixture-render`
  `7ae4c46d8` — recorded at this base with no page file touched; it draws this sheet) laid over this change: 5/5,
  byte for byte; and the same page with only another screen's look, or the card at None with a Build in, is that
  record too. With a look stored the page gains the list inside the reply's fieldset and one `<style>`.
- The dev lab can show the sheet as a guest sees it: `/dev/maker-lab/guest?rsvp=form&sheet=1#your-details`.

**5c · ＋ is back on a line's frame — and it adds a Heading or a Message, never a scene**

- A picked line of a reply screen wears the same ＋ on its frame's top and bottom edge that every stage's part wears
  (`usePartEdits` `lineAdd`); the Hint takes ＋ above only (it stays at the card's foot); the card, the pass and the
  masthead take none. ＋ opens the shipped sheet (`MakerSheet`, the shipped row) with two rows — Heading · Message.
  The picked line steps apart from its neighbours so ＋ never lies over another line's words.
- The new line arrives EMPTY, picked, with its words box open; on the Maker's sample an empty one reads its kind in
  quiet italic, and a guest is never drawn an empty line. Typed, it is on the page as it is typed.
- Edit's LAST row on every line of a card: ↑ Earlier · ↓ Later · Group · Remove (`RsvpLinePlaceRow`, four shipped
  `ActionButton`s). A step that cannot be taken stays a button, grey, and a tap says why — the prototype's sentences
  and the controller's four (`RSVP_LIST_WORDS`; the caps' number is read from the rule). Only a line the couple
  added can be removed.
- MEASURED (the lab, touch): the four fit with icon and word at 375 × 812, 375 × 667 and 390 × 844 — no word cut,
  nothing overflowing; at 360 the whole row goes words-only together (Button Rule 3a, `useFitRow`), no word cut.
  Four equal shares cut "Remove" by 6 px at 375, so each button is never narrower than its word.
- ONE DOOR: the toolbar, the sheet and the last row only ASK (`RSVP_LIST_EDIT_EVENT`); the RSVP panel makes the
  edit (`lib/rsvp-layout-edit.ts`, pure), asks the size limit and saves through its one save, then answers what to
  pick and what to say. Every edit writes the screen's WHOLE order and is read back before it is saved: a line of
  the page's own can be moved but never lost (3,000 random edits, `the-rsvp-list-is-edited-whole`).
- The Maker's sample is re-arranged at the tap on the page the frame already drew (`rsvp-canvas-arrange.ts` — the
  page's own elements are moved, never rebuilt). Measured in a browser: the sample arranged live is the page the
  server draws for the same list (1,486 = 1,486 characters, identical).
- FOUND BY LOOKING, fixed before this commit: the ＋ sheet was drawn inside the toolbar and opened UNDER the stage's
  own panel (the dark was there, the two rows were not). It is drawn on the page's body now, as every part's sheet is.
- NOT FIXED, the app's one toast (`PeekToast`) is one line and cuts a sentence past about 40 characters at 375: "A
  screen takes up to 4 added lines. Remov…". Six of this stage's sentences are longer (the prototype's toast took two
  lines). The toast is every screen's; it is not changed here.

**6 · hold a line to move it — the Wedding March's feel, on a reply screen's lines**

- Press and hold a line (350 ms, the prototype's own number): it lifts as a ghost, its place dims with a dashed mark,
  the opening under the finger shows a line, and on letting go the others slide to where they now stand while the
  ghost flies home. A short tap still only picks; a plain swipe still scrolls; while a line is held the page does
  not scroll under the finger, and near the top or bottom edge the page comes to it.
- A SECOND SMALL DRAG, not the March's (`rsvp-canvas-drag.ts`): the March's is tied to its names and walks. Its two
  numbers are IMPORTED (`SETTLE_MS`, `EDGE_PX` — exported from `details-march.tsx`, nothing else of that file
  changed); its bare numbers (×1.03, 30 % dim, 220 ms, 4 px) are named here beside where the March has them.
- WHAT A PRESS PICKS UP (the prototype's rule, `rsvpDragSubject`): the line — or, inside a group, the WHOLE GROUP
  unless that very line is the picked one. The Hint, a question's field, the pass and the card's own ground cannot
  be held; words being typed are never lifted.
- A DROP IS ONE EDIT of the list, asked of the panel (`do: 'place'`) like every other change; dropped back where it
  was, nothing is asked. What was held is picked. Nothing is ever put among the reply's lines while dragging: the
  ghost and the opening's line are drawn on the page's body, and the ghost is a picture (inert, nameless — the
  reply's two answers are never on the page twice).
- 🔒 Every drop there is, on every screen, with added lines and groups: the list is the one expected and every line
  of the page's own is still in it exactly once, Yes and No with them (`the-rsvp-stage-moves-a-line` § 2 — 178 drops
  on 2026-10-11; `SHOW_DROPS=1` on that test prints the count). 14 sabotages of this step's code, each caught — one
  only after its guard was mended (it could not see a call written with `!`).
- COLOUR TOKENS ONLY (owner 2026-10-11): the prototype drew the ghost's card white and its marks in fixed greys;
  here they are the page's paper and ink, the one accent and the app's large shadow — so a dark page is still read.
- While a line is held the picked part's frame steps aside (`usePartEdits` `away`).

**7 · Group — several lines on one background of their own**

- Edit's last row › Group turns on PICKING (the prototype's mode): the lines of the screen step apart and wear a ring,
  a tap ticks one (again: lets it go), and the lower third is the picking bar — "Group · pick the lines", one sentence
  that says how, "N picked", Done · Cancel (`RsvpGroupPickBar`). The count is plain words; Done under two is grey and
  a tap says "Pick at least two lines." A group cannot be ticked, nor a line already in one — each says the
  prototype's sentence. Nothing is held or framed while picking; Escape, Cancel or another screen ends it unchanged.
- Done is ONE edit (`do: 'group'`): the group stands where the first of its lines stood, is picked, and opens on
  Background — None · Plain · Frosted, the card's own three tiles (`RsvpCardGroundRows`, one drawing) with the
  group's sentence. THE CARD STANDS ASIDE: making the first group of a screen sets its card to None and remembers
  what it was; the last Ungroup puts it back; a ground the couple picks for the card in between stands.
- A GROUP IS A PART: a tap on its own paper picks it ("RSVP › Form › Group"), it wears the frame and ＋, it is held
  and moved as one, and its last row is ↑ Earlier · ↓ Later · Ungroup. Its tools are Edit and Background; Style and
  Animate are grey and say the prototype's two sentences (a group has no Animate — the reader keeps room for one,
  nothing offers it). A line inside a group reads "RSVP › Form › Group › Question", moves inside its group, takes ＋
  (the new line joins the group), and under Background says "This sits on its group's background." with "Open the
  group". Group on a line already in one is grey and says why; so is Group on a screen that holds its four.
- 🔒 A REPLY IS NEVER LOST TO A GROUP: the real card, drawn for a guest, with Yes and No grouped, apart, in two
  groups, moved, with a line added between them — one "attending" and one "declined", inside the reply's one
  fieldset, which still has its name; grouped then ungrouped is today's page to the byte
  (`the-rsvp-stage-groups-lines` § 5). The cap of four groups is the edit's own, not only the button's (§ 3).
  20 sabotages of this step (`scratchpad/rsvp-adg/sab7.py` lists them), each caught — three only after their guards
  were mended (the bar's number, the line-in-a-group branch, the fifth group).
- COLOUR TOKENS ONLY in the picking marks and the bar (owner 2026-10-11); a frame only round what is pressed.
- PINS RE-AIMED, each with its reason beside it: `ownTool` in two fixed-block guards and one RSVP guard (a group has
  Background but no Animate); "the frame's only control is ＋" (two arms now draw it: a line of a fixed page, a part
  of a stage); "the tool is set only by a tap on the selector" (the prototype opens a line just added on Edit and a
  group just made on Background); the last row's count in the panel (three: a group's Edit draws it too). The
  toolbar's pinned `why={edits.why}` is word for word again: the Save button's reasons go through the frame's hook.

**After 7 · what `pnpm preflight` and the pictures found**

- `pnpm preflight` on steps 5c–7 was red twice and is clear now (49 checks; the full unit suite, the full DB replay,
  the production build and the first-load budget are CI's). Both faults were in the drag: a corner typed in px
  (`borderRadius: '2px'` — the app's radius tokens now, `--m-r-md` for the ghost's small card and `--m-r-full` for
  the opening's line), and the file had no `'use client'` while reading two numbers from the March's client file.
- Two pins broken by 5c were found only when the wider guards ran (`the-preview-only-selects`,
  `the-toolbar-is-four-rows`); each is re-aimed or put back word for word, with its reason beside it.
- SEEN, NOT CHANGED: (1) the app's one toast cuts a sentence past about 40 characters at 375; (2) a FINGER on a
  group's own paper beside an answer button is taken by the button (the phone's own snapping of a tap to the nearest
  control — measured: the point under the finger is the group, a pointer there picks the group, a touch picks the
  answer); a group is reached surely from any line inside it › Background › Open the group.

SPEC IMPACT: None beyond the locked record already in the corpus (`Maker_RSVP_Per_Element_Add_Drag_Group_LOCKED_2026-10-09.md`
§4–§5 names the cap and the migration). The measured numbers confirm §5's (24,576 / 19,000).
