## 2026-09-26 · fix(home): on a phone, the event cards' tags stop covering the invitation, and the ⓘ bubbles open on screen

Mobile audit of `/dashboard` at 375 px (owner's signed-in session): (1) the Planning cards'
chips ("KASAL", "You organise this") sat over the poster's paper, so the eyebrow printed under
them ("THER WITH THE") and the monogram was hidden — under a 220 px card the paper now drops
the two minor lines and starts 34 % down (`event-poster.module.css`, container query); (2) the
row ⓘ (`ShelfInfo`) sits at the row's right end and its bubble, anchored `left-0`, opened mostly
off-screen — below `sm` it is now `fixed` across the screen with a 16 px gutter, and the ⓘ's
tap area is 40 px (`before:` layer) without changing its look. Both previewed live in the
browser pane before the change.

SPEC IMPACT: None.
