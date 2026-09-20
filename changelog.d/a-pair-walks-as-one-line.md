## 2026-09-20 · feat(entourage): a pair walks as one line

⚖ OWNER 2026-09-20 (controller ruling, prototype at
`build-sessions/prototypes/guestlist-pairing.html`):

- a paired couple does **not** collapse on the roster and **no column is
  removed** — RSVP, meal, seat and contact are facts about a *person*: a ninang
  can decline while her ninong attends;
- the pair collapses to ONE line only where the pair is the unit — the
  walking-order panel and the printed processional;
- walking order and seating stay two orderings. Moving a pair never moves a
  chair.

**Schema-free, as ruled.** `entourage_order` could always express this; nothing
was writing it that way. It was compared inside a single ROLE — and ninong and
ninang are two different roles, so ordering each role separately could not
express a pair at all: "move her up" moved her past other ninangs while he
stayed where he was, and the pair came apart on the page that exists to show
them together. The unit is now the LINE (a pair, or a single who walks alone),
and both halves carry the same number.

- `entourageLines(rows, groupKey)` in `lib/entourage.ts` is the one ordering
  three surfaces share: the invitation, the panel, and the Move ↑ action. A
  surface deriving its own order is how "move this pair up" comes to mean
  something different on each.
- `moveInEntourageOrder` takes a GROUP key, not a role, and writes the index to
  both halves of every line. ⛔ It touches neither `event_seat_assignments` nor
  `seating_priority`, and a guard strips comments before asserting that.
- `clearEntourageOrder` clears the whole printed group, derived from the roles
  in it, so a group that gains a role cannot keep half its order.
- **A pair may not span two printed groups** — `pair-actions.ts` refuses with
  the reason. A pair between two plain guests is still fine: only a pair that
  straddles two PRINTED groups has no line to live in.
- A ceremony-only sponsor reaches the line with `ceremonyOnly`, prints normally
  and shows "· ceremony only".

🪤 **Changing the UNIT of ordering must not change the default ORDER.** The
first draft sorted unplaced lines by surname alone, which put Abad the ninang
above Zamora the ninong and discarded the convention `spec.roles` encodes. An
existing test caught it; the comparator now ranks by placement, then the
group's role order, then surname.

Guarded by `lib/a-pair-walks-as-one-line.test.ts` — eight tests, the ordering
ones EXECUTED rather than grepped. Five sabotages confirmed red: ordering per
role again · an unplaced line read as position zero · the action writing a seat
· the roster losing a column · the roster's "walks with" mount renamed.

⏭ **NOT built, and named rather than implied:** the roster's pair BRACKET. It
needs the two rows to be adjacent, and the roster orders by the couple's chosen
sort — so drawing a bracket there today would join rows that are not a pair.
Making pairs adjacent on the roster is a change to section building that fights
the sort, and is its own decision. Desktop drag is also unbuilt: the ruling
makes it "additional", and the always-available buttons are what shipped.

SPEC IMPACT: None — no locked decision changes.
