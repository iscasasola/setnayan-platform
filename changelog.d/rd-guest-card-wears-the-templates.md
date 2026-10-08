## 2026-10-09 · refactor(guests): the dev lab's guest card is pressable without reaching the database; the lab's Finalize flip follows

Step 4A. `GuestCardBody` takes an optional `actions` prop (the three writes its forms post); every real page leaves it out and gets the shipped `updateGuest` / `releaseGuestClaim` / `inviteGuestByEmailAction`, the dev lab hands in inline stand-ins that write nothing (and, with `?refuse=1`, refuse in the database's own words so a guard can prove the card never prints them). The card's ⋯ takes New QR / Unlink from the lab's context. The lab's successful Finalize now moves the fixture's `?hc=` with `router.replace` (a `replaceState` + `refresh()` was not followed), so "Reopen guest list" can be seen and pressed. No request, no server action exported, no migration added.

SPEC IMPACT: None

## 2026-10-09 · fix(guests): the Undo store is its own React-free file, so the guest card adds no toast weight to the Maker's first load

Step 4A found a regression of 2B: the guest card (drawn inside the Event Hub Maker's first load, `launch/page.tsx` → `GuestCardBody`) imports the autosave, whose `pushUndo` lived in the same file as the toast HOST — and from 2B the host drew `PeekToast` and a portal. The store (`undo-store.ts`, no React, a type-only toast import) is now separate from the host (`undo-toast.tsx`, mounted by each page); the autosave and the delete flow use the store. `the-guest-card-adds-no-first-load-weight.test.ts` holds it. `check-maker-js-budget.mjs` needs a build and was not run. No request, no server action, no migration added.

SPEC IMPACT: None

## 2026-10-09 · test(guests): the guest card's posted form is pinned, state by state, before any field moves

Step 4B-0 (test only, no source change). The card is live — its autosave posts the whole form to `updateGuest` — so moving its fields onto the templates must not change one posted name or value. `the-card-posts-the-same-form.test.ts` renders the card's form in twelve states (a guest and the couple, sides, claimed, +1, every toggle on and off, empty texts, several "Invited to" blocks and none, a seated and a declined guest, the tea-ceremony order, awkward characters), builds the FormData a browser would (checked boxes post, unchecked do not; textarea, entities, hidden), and compares it with the committed golden file. No request, no server action, no migration added.

SPEC IMPACT: None
