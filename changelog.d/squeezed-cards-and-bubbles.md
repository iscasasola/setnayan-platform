## 2026-11-17 · fix(layout): service cards and short chat bubbles are no longer squeezed

- Shop page (`/[slug]`, `app/v/[slug]/_components/services-gallery.tsx`): the one services grid set its column count
  from the window (`sm:grid-cols-2 lg:grid-cols-3`) while, from md, it sits in the column beside the shop card — at an
  800 px window each card was 206 px and the face's words 90 px; at 1024, 177 px and 61 px. It now auto-fills from its
  own width with each card at least 300 px (still 1 → 2 → 3 columns as the room allows). Came in with the one service
  face (d4fb26055d, 12 Nov), which put the side-by-side face into the old grid.
- Chat (`app/_components/chat-message-stream.tsx`): the message row is `w-full` (not for your own file, which keeps
  its swipe's sizing), so the bubble's `max-w-[75%]` is of the thread, not of a row shrunk to the bubble — "Hello" no
  longer draws as "He / llo". Latent since the Messenger thread (7bb570488a, 28 Oct).
- Neither is from the clean warm look (#7888): no token or shared class changed width.
- Guard: `lib/nothing-is-squeezed-by-its-own-content.test.ts` (sabotage-tested both ways).

SPEC IMPACT: None
