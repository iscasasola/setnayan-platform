## 2026-10-03 · fix(guests): the owner's live iPhone test — add, names, the card, copy link, select mode, delete, spacing

From the owner's live test on prod 5666406 (host, dashboard Guests page) and the Problems log:

- **+ adds.** The + inside "Add a guest" was a picture (`pointer-events-none`); it is now a button running the same submit as Enter.
- **Names split sensibly, in one place.** `parsePersonName` (lib/person-name-parse.ts): last word (or particle surname) = last name, everything before = first name; no guessed middle name — only a typed initial ("M.") is a middle. "Test Guest A" → First "Test Guest", Last "A". The quick list's edit and save now use the same parser.
- **The card opens fast and fits.** Rows on the sheet no longer prefetch `/guests/<id>` (~40 server renders per list open in prod logs); `loadGuestCard` reads in one batch (15 waits → 3 steps) and starts beside the roster; the sheet shows "Opening…"; the ticket is fetched only when the Invite sheet opens, only for a guest who has one (pass-card timeouts + 404s in the Problems log); the thumbnail loads after the card. The panel inside the sheet is the sheet's width (it was clamped to 340 px — clipped at 390).
- **Copy invitation link** in the Invite sheet, beside the share (phone) and under the steps (computer). Invite opens the sheet at every width. The link is spelled by `invitationLinkOn`, the tail `buildInvitationUrl` (lib/qr.ts) ends in.
- **Select mode always has a way out.** Unticking the last guest leaves it; Done shows while selecting; a list mid-selection is never kept as last-seen, so a reload never redraws it.
- **The card's dropdowns stick.** `FormPick`'s hidden input was `defaultValue`, which React re-applies on every re-render — the pick was reverted before the autosave read it (Reply "No reply" saved as "Attending").
- **Delete any guest, one warning, three places** (DECISION_LOG 2026-10-03 "A HOST CAN DELETE A GUEST WHO ALREADY ACCEPTED"): card ⋯, row swipe, selection bar ("Delete N guests"); one in-page warning; one path (`useGuestRemoval` → `bulkSoftDeleteGuestsForUndo`, with Undo); a refusal is said where they acted. RSVP gate retired; their +1 goes in the same soft-delete. Removed: `softDeleteGuest` (−1 server action) and `RemoveGuestConfirm`.
- **The row's ⋯ list is drawn on the page** (it opened clipped inside the row — RAGE_TAP in the Problems log).
- **Mobile up front** on the card; **sticky card header** (eyebrow · name · reply · ×, divider on scroll, safe-area); round ×; no frame inside the panel; two explainer captions removed.
- **Guests page top** on one spacing scale (flex `gap-4`, `gap-6` after the title); Finalize is one row (stacks on a phone, 44 px pill).
- Home's "coming / no reply" verified to read the same rows as the Guests list (test added).

SPEC IMPACT: None
