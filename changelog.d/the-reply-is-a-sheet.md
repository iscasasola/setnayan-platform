## 2026-09-20 · feat(invitation): the reply is a half sheet, with the invitation still behind it

ARRIVAL slice 4 (owner-approved canvas board "2 · RSVP sheet"). The reply card was a SECTION in
the page's flow: answering meant leaving the invitation, scrolling past the hub card and the
keepsake, and scrolling back. It is now a half sheet that rises over the page with the couple's
mark visible above it — the convention every event app in the research uses.

- **One mechanism, one mount.** The sheet is a container; inside it is the same `<RsvpWidget>`
  posting the same `submitRsvp` with the same field names. The `<details>` drawer that held a
  second, byte-identical copy of the card for a guest who had already answered is gone, so the
  guest tree now holds EXACTLY ONE reply card. `only-the-answer-freezes.test.ts` pins that count
  at 1 — strictly tighter than the `> 1` it pinned before.
- **Two doors, one destination.** The hub card's `#your-details` chip and `resolveArrivalAction`'s
  default `#site-me` both open the same sheet. It listens to the FRAGMENT, so it needs no element
  of its own — `guest-hub-bar.tsx` already owns `#site-me` and must keep owning it alone.
- **A half-typed note survives a close.** `children` render in both states; closing hides the
  panel, never unmounts it.
- **No outcome of a save can be swallowed.** The flash renders at the top of the form, which is now
  behind a closed sheet — so an ERROR reopens the sheet (`sheetOpensOnLoad`) and an OK outcome is
  rendered on the trigger row in the page's own flow. Without both halves, a guest whose reply was
  refused by a finalized list would have landed on a page that said nothing.
- **With JavaScript off there is no sheet and the form still works.** The panel's default CSS is
  plain flow; only `.sn-sheet-js`, set by an inline pre-paint script, turns it into a sheet.
- **Not a second fixed bottom bar.** When closed there is no fixed element at all.

Two things were measured in a browser rather than reasoned, and both changed the build:

- the panel must be a SIBLING of `<article data-pahina-chapters>`. The §6 reveal puts a `transform`
  on every direct child of that article, and a transform (identity included) is the containing
  block for a `position: fixed` descendant — same panel, one 812px viewport: `bottom = 812` as a
  sibling, `bottom = 853` inside it. The bottom 41px of this sheet is its Save button.
- "return the guest to where they were reading" could not be kept from `hashchange`. Probed one
  real tap from 705px down a 705px page: `beforeClick=705 · click=705 · hashchange=0`. The closed
  panel is `display:none`, so the browser cannot scroll to the fragment and falls back to the top
  of the document BEFORE any listener runs. The position is captured on the tap instead.

Verified in a real browser against a harness (deleted before commit), not against a real event —
local dev has no `SUPABASE_SERVICE_ROLE_KEY`, so the invitation cannot render outside production.

SPEC IMPACT: None. No schema, no locked decision, no price. The reply card's fields, its server
action and its post-lock behaviour are untouched; only where it is drawn has changed.

### Follow-up, same day — the sheet uses the shared focus hook

The first build hand-rolled the visible half of modal behaviour (body-scroll lock, Escape,
`.focus()` on open) and none of the half that matters: Tab was never trapped, so it walked straight
out of the sheet into the invitation behind the scrim, and focus was never handed back to the
control that opened it — while the panel claimed `aria-modal="true"`. `lib/use-modal-a11y.ts`
already existed for exactly this (2026-06-25 audit), and `lib/modal-a11y-adoption.test.ts` named
this file the first time the FULL unit suite ran. RULE 0, caught by the repo's own guard.

Now: `useModalA11y({ open, onClose, containerRef })` owns focus, Tab, Escape and the
reference-counted body lock; the sheet keeps only the page-scroll position, which the hook does not
do. A new guard in `the-reply-is-a-sheet.test.ts` pins the call — not merely the import — and
asserts neither hand-rolled half has crept back beside it.

SPEC IMPACT: None.
