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

## 2026-10-09 · fix(guests): the guest card's buttons are the one ActionButton, its words are plain, and a failed autosave says so

Step 4C. The hand-made buttons in the card body (give this spot, this is me, send/resend the invite, cancel, and the like) go through a kit leaf (`K.Submit`, `K.Tip` for the ⓘ, `K.SaveState`): on the Guests pages they are the app's ActionButton and ⓘ; in the Maker's parent cards they stay today's hand-drawn ones. The card's refusals are plain sentences (`guest-card-error-copy.ts`, chosen by the pages — never imported by the body, so the Maker's first load is untouched), in the danger colour.

The autosave line no longer says "Saved" when the action threw or was refused. A failed save says "Couldn't save." with a "Try again" within the same press, keeps the unsaved value on screen (React's own post-action form reset is refused for a failed save), and records no Undo for a change that did not land. The Undo of a landed change is recorded after it lands, not when it is sent. `a-failed-save-says-so.test.ts` holds it; the framework's redirect / not-found signals are not mistaken for a failure. The autosave fires no more often than before. No request, no server action, no migration added.

SPEC IMPACT: None

## 2026-10-09 · test(guests): the templated guest card holds no hand-made control

Step 4D. `the-templated-card-holds-no-hand-made-control.test.ts` renders the card with the template kit in its states and asserts every control it draws is a template's (a Form row, switch, chip, ActionButton, PickMenu) — no bare `<button>`, `<input>` or `<select>` of the card's own — with the one named exception (the native swap-name input that keeps an empty swap from falling through to "take the seat back"). The ⋯ menu's Unlink is now the danger colour instead of gold. No request, no server action, no migration added.

SPEC IMPACT: None

## 2026-10-09 · fix(guests): a REFUSED autosave stays on the card like a thrown one — the typed words kept, one message, no page-wide toast

Step 4E. Seen on the dev lab (`?part=card&refuse=1`, 375 wide): typing into Middle and pausing posted the card; `updateGuest` refused by REDIRECTING to `…?error=…`, which blanked the card for ~1.5 s, fired the app-wide bottom toast (`toast-from-params.tsx` fires for any `?error=`), then redrew the card from the server with the typed words lost and the card's own error line — two messages in two places. `updateGuest`, for a QUIET post only (the autosave's — nothing else posts `quiet=1`), now RETURNS `{ refused: <code or the action's words> }` instead of redirecting; every refusal in it goes through one local `refuse()`, and a non-quiet post redirects exactly as before. A redirect cannot be noticed by its caller (Next performs the navigation itself), so the autosave hears the returned refusal the way it hears a throw (`hearSave`): "Couldn't save." + Try again, the typed words kept, no Undo, no page navigation, no toast. The templated line adds the action's own sentence when the card knows the code (`GUEST_CARD_ERROR_COPY`, handed to the line by the card body — no new import in the Maker's first load) or the words are plainly a sentence; the database's words are never printed. The dev lab's stand-in now refuses a quiet post the same way. `a-refused-quiet-save-stays-on-the-card.test.ts` calls the REAL `updateGuest` and renders the REAL save line. Cost in the Maker's first load: `guest-card-autosave.tsx` only (+~100 B minified, no import added). The port-control baseline is regenerated on purpose: the guests route's `action` / `<AutosaveState>` are now the autosave's `run` wrapper and the kit's `K.SaveState` (the same two controls, renamed by 4C/4E). No request, no server action, no migration added; the golden FormData test is untouched.

SPEC IMPACT: None
