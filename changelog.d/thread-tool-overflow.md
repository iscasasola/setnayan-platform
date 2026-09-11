## 2026-09-11 · fix(chat): an open tool no longer buries the conversation

Owner, live test round 1: with "Build a quote" open on the supplier's thread
(`/vendor-dashboard/messages/[threadId]`), the composer drew over the All /
Decisions / Files tabs, the page ran past its side panels' backgrounds, and on
a phone the bottom menu bar sat over the composer.

Cause: the three-column row is a fixed height and the conversation column did
not scroll, so an open tool squeezed the flex-1 message stream to zero and
everything after it overflowed the row.

Fix: the row keeps its fixed height (that is what keeps a long thread
scrolling inside its own box with the composer pinned). The conversation
column now scrolls itself (`min-h-0 overflow-y-auto`), and the stream sits in a
wrapper with a floor (`min-h-[20rem] flex-1`), so an open tool pushes the
conversation down instead of flattening it. Measured in a layout harness: tool
closed, an 80-message list fills the column and scrolls inside it with the
composer pinned; tool open, the column scrolls, the stream keeps 320px, and
nothing overlaps. `min-h` on the row was rejected: it fixes the tool case but
grows the page to ~5,190px on an 80-message thread and drops the composer
below the fold.

The couple thread and the supplier client page don't mount a tall tool above
the stream, so they're unchanged.

Also: in `ProposalMaker`'s payment schedule, the peso/percent toggle printed
the CURRENT unit, so a percent row read "20 % %". It now shows the unit a tap
switches to, with a `title` naming the action. Function unchanged.

Guard: `app/vendor-dashboard/messages/[threadId]/an-open-tool-does-not-bury-the-conversation.test.ts`
(5 tests). It fails if the row becomes `min-h`, if the column stops scrolling,
or if the stream loses its floor. Each sabotage was run.

SPEC IMPACT: None
