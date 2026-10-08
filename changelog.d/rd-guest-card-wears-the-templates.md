## 2026-10-09 · refactor(guests): the dev lab's guest card is pressable without reaching the database; the lab's Finalize flip follows

Step 4A. `GuestCardBody` takes an optional `actions` prop (the three writes its forms post); every real page leaves it out and gets the shipped `updateGuest` / `releaseGuestClaim` / `inviteGuestByEmailAction`, the dev lab hands in inline stand-ins that write nothing (and, with `?refuse=1`, refuse in the database's own words so a guard can prove the card never prints them). The card's ⋯ takes New QR / Unlink from the lab's context. The lab's successful Finalize now moves the fixture's `?hc=` with `router.replace` (a `replaceState` + `refresh()` was not followed), so "Reopen guest list" can be seen and pressed. No request, no server action exported, no migration added.

SPEC IMPACT: None

## 2026-10-09 · fix(guests): the Undo store is its own React-free file, so the guest card adds no toast weight to the Maker's first load

Step 4A found a regression of 2B: the guest card (drawn inside the Event Hub Maker's first load, `launch/page.tsx` → `GuestCardBody`) imports the autosave, whose `pushUndo` lived in the same file as the toast HOST — and from 2B the host drew `PeekToast` and a portal. The store (`undo-store.ts`, no React, a type-only toast import) is now separate from the host (`undo-toast.tsx`, mounted by each page); the autosave and the delete flow use the store. `the-guest-card-adds-no-first-load-weight.test.ts` holds it. `check-maker-js-budget.mjs` needs a build and was not run. No request, no server action, no migration added.

SPEC IMPACT: None

## 2026-10-09 · test(guests): the guest card's posted form is pinned, state by state, before any field moves

Step 4B-0 (test only, no source change). The card is live — its autosave posts the whole form to `updateGuest` — so moving its fields onto the templates must not change one posted name or value. `the-card-posts-the-same-form.test.ts` renders the card's form in twelve states (a guest and the couple, sides, claimed, +1, every toggle on and off, empty texts, several "Invited to" blocks and none, a seated and a declined guest, the tea-ceremony order, awkward characters), builds the FormData a browser would (checked boxes post, unchecked do not; textarea, entities, hidden), and compares it with the committed golden file. No request, no server action, no migration added.

SPEC IMPACT: None

## 2026-10-09 · feat(templates): TypedRow, SwitchRow and Chips can post a named value into a form — only when asked

Step 4B-1. One additive, optional prop each (`fieldName`; on `Chips` a function of the chip's key), so a row inside a LIVE autosaving form (the guest card) posts its answer instead of keeping it only in React state: `TypedRow` carries the kept words in a hidden input and tells the form once, when they are kept; `SwitchRow` carries a real visually-hidden checkbox (present when on, absent when off, like a native one) and tells the form on a tap; `Chips` carries one such checkbox per chip. An Undo's restore drives the controls without telling the form. Without `fieldName` every template draws byte for byte what it drew (golden strings in `the-form-templates-post-only-when-named.test.ts`) and posts nothing. Verified in a real browser against a bundled harness: exactly one form event per tap or keep, none while typing, none for an unchanged keep, none for a restore. No request, no server action, no migration added.

SPEC IMPACT: None

## 2026-10-09 · refactor(guests): the guest card on the Guests pages is drawn by the app's Form rows; and a live bug on the card is fixed

Step 4B. The card's fields — the name and mobile, Details, RSVP, Seat, Photos, Private note — are ONE list in `guest-card-body.tsx`, and each leaf is drawn by a kit: on the Guests pages (the list's panel, the card page, the dev lab) by the app's templates (`guest-card-rows.tsx`: a typed row, a switch row, a dropdown row, chips for "Invited to", the shared fold, a fact row for the couple's locked role — one hairline list per fold, pills one width, helper sentences behind an ⓘ); in the Event Hub Maker's parent cards, which are drawn inside the Maker's first load where those templates are not, by today's hand-drawn rows. Both post the SAME form: `the-card-posts-the-same-form.test.ts` renders the card in twelve states with each kit and holds every column, name and value equal to the committed golden file (unchecked switches absent, empty texts empty, several "Invited to" blocks, multi-value dropdowns). No Maker first-load file gained an import (`the-guest-card-adds-no-first-load-weight.test.ts`). The ⋯ the page hands the Invite cell no longer raises React's "unique key" dev warning (`Handed`).

LIVE BUG FIXED (found while moving the fields): React 19 resets a form after its action lands, and a controlled checkbox goes back to its mount-time `checked` attribute — so the card's "Invited to" switches snapped back on screen after a save, and the NEXT autosave (any other field) posted the reverted set, quietly un-inviting the guest from the blocks the host had just ticked. Measured in a real browser with the autosave's own form. `InvitedToChips` (and the new checkboxes) now keep the attribute equal to the box; `a-saved-form-does-not-revert-its-checkboxes.test.ts` holds it. No request, no server action, no migration added.

SPEC IMPACT: None
