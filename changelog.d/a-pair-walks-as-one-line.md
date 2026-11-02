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

Guarded by `lib/a-pair-walks-as-one-line.test.ts` — thirteen tests, the ordering
ones EXECUTED rather than grepped. Fourteen sabotages confirmed red: ordering per
role again · an unplaced line read as position zero · the action writing a seat
· the roster losing a column · the roster's "walks with" mount renamed · the
panel hidden again on "All" · the drag handle losing its keyboard path · the
buttons replaced by the drag layer · the tab losing its label · the panel bolted
back over the roster · a move dropping you out of the view · the button shown on
every event type · the tab shown on every event type · the flash reverting to
the old name.

🪤 Three of those needed the assertion tightened first, all the same mistake:
`includes('<PartnerLine')` also matches `<PartnerLineX`. **A substring is not a
mount** — the assertions now match a tag boundary. A fourth guard failed on
CORRECT code: it sliced the page from the first mention of `rosterLensKey`,
which is its declaration far above the markup, so the window swallowed the very
branch it was meant to exclude. **A window has to face the thing it judges.** A fifth failed on a
DOCBLOCK — comments are not copy, and policing them is how a guard earns its
own deletion; it now strips comments and judges only the strings a couple
reads. That same assertion then caught a real one: the save confirmation still
said "Walking order saved."


## Arranging — it was built, and it was HIDDEN

⚖ Owner 2026-09-20: *"where is the arranging? why do you not build it?"*

The Walking order panel shipped in #5759 rendered **only under a role filter**.
On the default view it asked for roles, got none, and returned null — so the one
place a couple can arrange who walks first did not exist unless they already
knew to filter first. From where the owner was standing that is the same as not
built, and he was right to call it.

- **A "Wedding March" button in the header, beside "Arrange the room"** — ⚖ owner
  2026-09-20: *"Add a button on the upper part beside arrange the room to launch
  that. [Wedding March]."* "Arrange the room" is the door to the seat plan; this
  is the door to the AISLE, and they belong together precisely because they are
  not the same ordering.
- **And a matching tab** beside List and Mind map (`?gview=walk`). Owner: *"so
  how to launch it on the guestlist?"* — there had been no entry point at all.
- 🔑 **The owner named it, so "Wedding March" is the ONLY word the couple sees**
  — button, tab, panel heading and the saved-confirmation flash. A button called
  one thing that opens a view called another is two names for one idea, and the
  second always reads as a different feature. `entourage_order` stays: a schema
  name is not a word anybody reads.
- 🔑 **A celebration with no processional is not offered one.** A generic event's
  roles are guest · host · vip · family · helper — not one of them walks down an
  aisle, so "Wedding March" there would be the wrong word over an empty view.
  The button and the tab are DERIVED from whether the event's own role set
  offers any role the invitation prints, never from a list of event types, so a
  new profile answers correctly the day it is added.
- It is a **view, not a banner**. The whole processional pinned above the roster
  would push the guest list down the page on every visit, for a job a couple
  does a handful of times.
- A move **keeps you in the view you made it from**; dropping `gview` on the way
  back would bounce you out to the roster after every single move, and the
  control would work while feeling broken.
- Inside that view, every printed group is offered — the whole processional.
- Each group is headed by its printed NAME. A first draft rendered
  `key.replace(/_/g, ' ')` — a raw key with its underscores knocked out.
- **Desktop drag now exists, and it is additional.** The Move ↑ / ↓ forms are
  untouched and remain the always-available path: no JavaScript, works on a
  phone and under assistive tech. The drag layer wraps them and hides its own
  handle below `sm`.
- 🔑 **A handle that only drags is a control half the room cannot use.** Space
  grabs, ↑/↓ move, Space drops, Esc restores; `aria-pressed` says whether it is
  held and every move is announced in a live region — a silent reorder is
  indistinguishable from a dead control.
- The drag posts **lead guest ids, not positions**. A position only means
  something against the list the client was looking at; if another planner has
  moved a line since, applying positions reorders the wrong ones. Naming the
  lines lets the server refuse a stale order (`order_is_stale`) instead of
  obeying it. It touches no chair, exactly like the button path.

⏭ **Still NOT built, named rather than implied:** the roster's pair BRACKET. It
needs the two rows adjacent, and the roster orders by the couple's chosen sort —
so a bracket drawn today would join rows that are not a pair. Making pairs
adjacent there is a change to section building that fights the sort, and is its
own decision.

SPEC IMPACT: None — no locked decision changes.
