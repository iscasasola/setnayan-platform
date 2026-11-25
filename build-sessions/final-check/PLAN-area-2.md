# Final check · PLAN · Area 2 · Couple: create and plan

**Date:** 25 Nov 2026 · planner: Fable · read from `origin/main` (frozen at bd86936 for the check). Plan and drawings only; no app code was changed.

**Sources:** `ALL-FINDINGS.md` (lanes) · `area-2.md` on `final-check/area-2` (the detail per ID) · `FINAL-CHECK-OWNER-ADDS-2026-11-25.md` (Adds 1–25 win) · the house design standard.

**Drawings (lane B):** specs repo, `prototypes/final-check-area-2_2026-11-25/final-check-area-2_2026-11-25.html`
(https://github.com/iscasasola/Setnayan-specs/blob/main/prototypes/final-check-area-2_2026-11-25/final-check-area-2_2026-11-25.html). One file, 15 sections, Now beside Proposed at 375 and 1280, light and dark, no script.

**Scope.** Lane A: 61 own entries + the two shared fixes whose area list starts with 2 (SW-HYDR, SW-RAWDB). Lane B: 12 own entries + four shared fixes whose area list starts with 2 (SW-K2, SW-POPPOP, SW-CONFIRM, SW-GLOW). Lane C and R are not planned here. Area 2 members of sweeps led by another area (SW-PHP, SW-BOOKED, SW-WORDS, SW-K1, SW-DIALOG, SW-SKEL, SW-DARK, SW-SHADOW, SW-TAP…) ride that area's plan.

**LIVE.** None of the 21 LIVE faults is in area 2, so no batch jumps the queue. Order below is by harm: broken and money first, then failed reads, then rules and words.

---

## Lane A · no screen change · 7 batches

**Rules for every batch**
- One PR per batch. Inside a batch, fix in the order listed (shared readers first, then the pages that use them).
- Every claim gets a guard that tests the claim itself, never a cheaper proxy. Source-scanning guards use `lib/strip-comments.ts`. Run `tsx --test` suites one at a time (exit 144 = killed, not passed).
- A failed read uses the shipped `ReadFailed` / `ReadRefusedNotice` part with Try again. Never 0, never "none", never a 404, never the empty state.
- Words follow `docs/brand.md`: supplier, reservation fee, hosts; pesos through `lib/php.ts`.
- Done = CI + the guard + a 375 px light and dark shot of each touched screen + the door walked.

### Batch A-1 · Broken doors and controls shown to the wrong role (13)

| # | ID | Fix | Files | The test that holds it |
|---|---|---|---|---|
| 1 | A2-H2 (money) | Decisions show "₱ — hosts only" to a money-hidden viewer | `lib/event-vendor-money.ts` · `lib/thread-decision-sources.server.ts` · `messages/[threadId]/page.tsx` | `lib/a-money-hidden-viewer-reads-no-amount-in-a-thread.test.ts`: render the decision list for a helper with money hidden; no digit follows ₱ |
| 2 | A2-H3 | Only a host sees Book and "Amount to pay" in a thread | `messages/[threadId]/page.tsx` | `messages/only-a-host-books-or-pays-in-a-thread.test.ts`: coordinator and helper viewers render zero Book / Pay controls |
| 3 | A2-G1 | Build "Ask to book" and Compare "book" hidden from the coordinator | `vendors/_components/booked-row.tsx` · `book-this-build.tsx` · `bench-vendor-actions.tsx` | `vendors/a-non-host-never-sees-book-or-pay.test.ts`: each of the three parts with `viewer.role = coordinator` |
| 4 | A2-H10 | "Put this away" only for someone who may archive | `details/page.tsx` · `archive-actions.ts` | `details/put-away-follows-the-archive-right.test.ts`: the control's gate and the action's gate are the same function |
| 5 | A2-P8 | Before the day, Clearance says it opens after the event; no main button | `clearance/page.tsx` | `clearance/close-out-waits-for-the-day.test.ts`: event date in the future → no close-out button, the "opens after" line present |
| 6 | A2-G17 | A failed close-out says why and offers Try again; the page stays | `clearance/actions.ts` · `clearance/page.tsx` | `clearance/a-failed-close-out-says-so.test.ts`: stub the write to fail → result is `{ ok:false }`, no success redirect |
| 7 | A2-G19 | One confirm before the irreversible close-out (confirm only, drawn in lane B section 14) | `clearance/page.tsx` | `clearance/close-out-asks-first.test.ts`: the submit is reachable only through the confirm |
| 8 | A2-G18 | "Stop the livestream" lands on the live controller | `clearance/page.tsx` | `clearance/stop-the-livestream-goes-to-live.test.ts`: the href equals the route `launch/page.tsx` uses for the live desk |
| 9 | A2-H11 | Details field links open Event Settings ON that row | `details/page.tsx` · `details/field/[row]/page.tsx` | `details/a-field-link-keeps-its-row.test.ts`: every row key forwards to `?settings=1&row=<key>` |
| 10 | A2-H16 | Find-your-date doors open for their own viewers | `find-date/_components/find-your-date.tsx` · `date-selection/page.tsx` | `find-date/every-door-opens-for-its-viewer.test.ts`: each href is allowed by the target page's own gate for host, co-host and coordinator |
| 11 | A2-H1 | The Suppliers chip narrows the list, or is not offered | `messages/_components/chat-inbox.tsx` | `messages/the-suppliers-chip-narrows.test.ts`: with a group thread present, Suppliers ≠ All |
| 12 | A2-G11 | A shop with no slug is not a link | `lib/bench-marketplace-search.ts` · `vendors/categories/page.tsx` | `vendors/a-find-row-never-links-to-hash.test.ts`: a row with `slug = null` renders no `href="#"` |
| 13 | A2-P4 | /dashboard/samahan shows People › Groups ("No group yet" + New group) | `(launcher)/_components/people-segment.tsx` · the samahan forward | `people/the-groups-door-lands-on-groups.test.ts`: the forward target renders the Groups view with zero groups |

### Batch A-2 · Money on Home, saves and payments that say nothing (12)

| # | ID | Fix | Files | The test that holds it |
|---|---|---|---|---|
| 1 | A2-P1 (money) | Home's paid and owing show the real figures at once, never a count up from ₱0 | `_components/home-control-row.tsx` | `home/money-never-counts-up-from-zero.test.ts`: the first server render already carries the final figures |
| 2 | A2-P10 | Event Home gives the same facts on each load | event Home readers (`page.tsx` and its count readers) | `home/two-loads-agree.test.ts`: two renders from one fixture are equal; each count has ONE reader |
| 3 | A2-F5 | Maya "Checking your payment" has a way back and Try again | `pay/[reference]/page.tsx` · `_components/maya-checking.tsx` | `pay/the-checking-state-has-a-way-out.test.ts`: both controls render in the checking state |
| 4 | A2-F4 | A refused Cancel order says it could not cancel and why | `orders/actions.ts` · `orders/[orderId]/page.tsx` | `orders/a-refused-cancel-says-so.test.ts` |
| 5 | A2-F7 | The order slip names where /pay really takes the money and a next step that exists | `receipts/order/[orderId]/page.tsx` | `receipts/the-slip-names-the-real-account.test.ts`: the slip reads the same pay-way source as /pay |
| 6 | A2-G4 | "reservation fee" and "supplier" on the payment record | `vendors/_components/vendor-itemization-card.tsx` · `vendors/actions.ts` | `vendors/no-downpayment-or-vendor-word.test.ts` (comment-stripped scan of both files) |
| 7 | A2-I19 | Save Nikah details says a failed save; success gets a toast | `nikah-actions.ts` · `_components/nikah-essentials-card.tsx` | `nikah/a-failed-save-says-so.test.ts` |
| 8 | A2-I10 | Paperwork save and upload failures are said inline | `paperwork/actions.ts` · `paperwork/page.tsx` | `paperwork/a-failed-save-stays-on-the-page.test.ts`: the action returns, never throws to `error.tsx` |
| 9 | A2-I11 | Replaced or abandoned paperwork scans are deleted | `lib/cleanup-delete.ts` · `paperwork/actions.ts` | `paperwork/a-replaced-scan-is-removed.test.ts`: replace → the old object key is in the delete call |
| 10 | A2-D1 | A failed seat read keeps the List; Seats says it could not load | `guests/page.tsx` · `lib/seating.ts` · `seating/error.tsx` | `guests/a-failed-seat-read-keeps-the-list.test.ts` |
| 11 | A2-H4 | The chat box marks the phone key "Send" | `app/_components/chat-send-form.tsx` | `chat/the-enter-key-says-send.test.ts`: `enterKeyHint="send"` whenever `shouldSendOnEnter` |
| 12 | A2-P22 | Check-in and Home reopen from their saved copy with no signal | the offline kit (`OFFLINE_COPY_SHAPES`, `DeskSavedMark`) · `guests/checkin/page.tsx` | `offline/the-desk-reopens-offline.test.ts`: the saved shape covers every field the desk draws. Largest item; if it grows past the kit, split it out and tell the controller |

### Batch A-3 · A failed read never looks empty · event pages (14)

One shared move: each reader returns `{ ok:false }` on error and each page draws "Couldn't read … · Try again". Fix the `lib/` readers first, then the pages.

| # | ID | Files | The test that holds it |
|---|---|---|---|
| 1 | A2-I5 (money) | `lib/paperwork.ts` · `lib/contracts.ts` · `documents/page.tsx` | `documents/a-failed-read-is-not-no-documents.test.ts` |
| 2 | A2-I8 | `lib/paperwork.ts` · `paperwork/page.tsx` | `paperwork/a-failed-read-is-not-start-your-checklist.test.ts` |
| 3 | A2-G14 | `lib/contracts.ts` · `contracts/page.tsx` · `contracts/[contractId]/page.tsx` | `contracts/a-failed-read-is-not-empty-or-404.test.ts` |
| 4 | A2-I3 | `lib/preparation.ts` | `lib/the-planning-list-says-what-it-could-not-read.test.ts` |
| 5 | A2-B9 | `lib/activity.ts` · `activity/page.tsx` | `activity/a-failed-read-is-not-nothing-happened.test.ts` |
| 6 | A2-F10 | `lib/referral-actions.ts` · `refer/page.tsx` | `refer/a-failed-read-is-not-no-referrals.test.ts` |
| 7 | A2-E7 | `access-requests/page.tsx` | `access-requests/a-failed-check-is-not-nothing-waiting.test.ts` |
| 8 | A2-G15 | `disputes/page.tsx` | `disputes/a-failed-read-is-not-no-disputes.test.ts` |
| 9 | A2-H5 | `manpower/page.tsx` | `manpower/a-failed-read-is-not-no-gigs.test.ts` |
| 10 | A2-E8 | `people/page.tsx` | `people/a-failed-read-is-not-not-shared.test.ts` |
| 11 | A2-I1 | `schedule/page.tsx` · `schedule/_components/day-sheets.tsx` | `schedule/a-failed-requests-read-is-not-nothing-waiting.test.ts` |
| 12 | A2-I13 | `sponsors/page.tsx` | `sponsors/a-failed-read-is-not-zero-filled.test.ts` |
| 13 | A2-G10 | `vendors/categories/page.tsx` | `vendors/a-failed-search-is-not-zero-suppliers.test.ts` |
| 14 | A2-H15 | `find-date/page.tsx` | `find-date/a-failed-date-read-is-not-set-your-dates.test.ts` |

Each test stubs the read to return an error and asserts two things: the could-not-read part renders, and the empty-state words do not.

### Batch A-4 · A failed read never looks empty · account, sign-up and the door counts (12)

| # | ID | Fix | Files | The test that holds it |
|---|---|---|---|---|
| 1 | A2-C7 | A refused profile read shows no editable form; Save cannot write blanks | `(account)/profile/page.tsx` · `profile/actions.ts` | `profile/a-refused-read-never-saves-blanks.test.ts`: the action refuses a submit made from an unread form |
| 2 | A2-A7 | Same for the sign-up "You" card | `signup/you/page.tsx` · `signup/you/actions.ts` | `signup/a-failed-read-never-writes-blanks.test.ts` |
| 3 | A2-B2 | Home's Shop part says "Couldn't read your shop" | `lib/unihome.server.ts` · `(launcher)/_components/unihome.tsx` | extend `unihome-is-the-drawing.test.ts` + `unihome/a-failed-shop-read-is-not-none.test.ts` |
| 4 | A2-C12 | A refused read on a loved one or linked events is "Couldn't read", not a 404 | `(account)/people/[dependentId]/page.tsx` · `lib/clusters.ts` · `clusters/[clusterId]/page.tsx` | `people/a-refused-read-is-not-not-found.test.ts` |
| 5 | A2-C14 | Each group list says it could not be read | `lib/communities.ts` · `samahan/[communityId]/page.tsx` | `samahan/a-refused-read-is-not-none.test.ts` |
| 6 | A2-A10 | A failed invite read is "couldn't read", distinct from an invalid link | `host/accept/[token]/page.tsx` | `host/a-failed-invite-read-is-not-not-found.test.ts` |
| 7 | A2-D2 | Seats and Check-in count replies through `computeGuestStats` | `seating/page.tsx` · `guests/checkin/page.tsx` | `guests/attending-has-one-reader.test.ts`: both pages import the one reader; no local reply filter |
| 8 | A2-E4 | One unseated count from `lib/seating.ts` for the plan and the chart | `lib/seating.ts` · `seating/page.tsx` · `seating-editor.tsx` · chart | `seating/unseated-has-one-count.test.ts`: plan and chart equal on a fixture with pending guests |
| 9 | A2-D13 | The desk headcount reads "—" on a failed read | `guests/checkin/page.tsx` · `checkin/_components/checkin-desk.tsx` | `checkin/a-failed-read-is-not-zero-of-zero.test.ts` |
| 10 | A2-E2 | A refused guest read stops the souvenir desk and says so | `guests/souvenirs/page.tsx` · `souvenir-desk.tsx` | `souvenirs/a-refused-guest-read-stops-the-desk.test.ts` |
| 11 | A2-E1 | The souvenir total counts guests expected at the door (through #7's reader) | `souvenirs/_components/souvenir-desk.tsx` · `souvenirs/page.tsx` | `souvenirs/the-total-counts-who-is-coming.test.ts` |
| 12 | A2-E3 | The tea serving order is the elders who are coming | `guests/tea-ceremony/page.tsx` | `tea-ceremony/the-order-is-elders-who-are-coming.test.ts` |

### Batch A-5 · Rules, sources and words (10)

| # | ID | Fix | Files | The test that holds it |
|---|---|---|---|---|
| 1 | A2-H12 | Locking a date here runs the date's real writer and its fan-out | `date-selection/actions.ts` · `candidate-date-picker.tsx` | `date-selection/a-lock-uses-the-one-date-writer.test.ts`: the action calls `updateEventDate`; no direct `events` update |
| 2 | A2-P9 | A locked date shows the date and why; no path to pick a new one | `date-selection/page.tsx` | `date-selection/a-locked-date-does-not-start-over.test.ts` |
| 3 | A2-H13 | "Long weekend" only when the gap touches a weekend | `date-selection/page.tsx` (the holiday helper) | `date-selection/long-weekend-needs-a-weekend.test.ts`: a Wednesday holiday → no line; a Friday or Monday holiday → the line |
| 4 | A2-I14 | Sponsors are counted from the one guest reader (`guests.role`) | `lib/entourage.ts` · `sponsors/page.tsx` · `app/[slug]/_lib/loaders.ts` | `sponsors/sponsors-come-from-the-guest-list.test.ts`. Adds no table or column; if the old list holds rows the guest list lacks, stop and tell the controller (data move = owner) |
| 5 | A2-I15 | Godfather or godmother is the couple's choice, never guessed from side | `lib/event-sponsors.ts` · `sponsors/page.tsx` | `sponsors/no-role-is-guessed-from-side.test.ts` |
| 6 | A2-I9 | No Paperwork door for an event with no statutory paperwork, or a page that says so | `paperwork/page.tsx` · `documents/page.tsx` · `schedule/_components/preparation-agenda.tsx` | `paperwork/a-non-wedding-never-meets-a-blank-page.test.ts` |
| 7 | A2-C8 | The Account pane says "Supplier" / "Host"; no internal codes | `(account)/profile/page.tsx` | `profile/no-raw-enum-on-the-account-pane.test.ts` |
| 8 | A2-D16 | The desk shows the reply in the house words (`RSVP_LABELS`) | `checkin/_components/checkin-desk.tsx` | `checkin/the-reply-is-in-house-words.test.ts` |
| 9 | A2-P6 | Seed: "Bea Villanueva" and "Paolo Garcia" on their own rows | `supabase/seed.sql` (staging seed only) | `seed/the-couple-rows-hold-their-own-names.test.ts` |
| 10 | A2-P5 | Import either works (no notice) or is closed (no steps) | `guests/import/page.tsx` (`guestImportGate`) | `import/a-closed-import-shows-no-steps.test.ts` |

### Batch A-6 · SW-HYDR · server and client draw the same markup (3 IDs · areas 2, 6, 8)

Order: A2-P11 (Schedule, React #418 on load), then A6-B09, then A8·P-B-1. Find the cause on Schedule first (a time, locale or `window` read during render); the same cause is likely on the other two.
- Files: `schedule/page.tsx` · `schedule/_components/chapters-host.tsx` · `day-list.tsx` (area 2); the area 6 and area 8 pages named in their reports.
- Test: `lib/the-server-and-client-draw-the-same.test.ts` renders each of the three pages twice (server string, then a client render under a different clock and time zone) and compares the markup. Proof: the copy's console shows no #418 on the three routes.

### Batch A-7 · SW-RAWDB · no raw database words (8 IDs · areas 2, 3, 4, 5)

Order: build one mapper (`lib/plain-save-error.ts`: known codes → a plain sentence that says what to do; unknown → "Didn't save · Try again"; the raw text goes to the log only), then swap each action to it: A2-A9 `host/accept/[token]/actions.ts` · A2-C6 `(account)/api-keys/actions.ts`, `profile/actions.ts`, `clusters/actions.ts` · A2-D7 `guests/new/actions.ts`, `new/page.tsx` · A2-I18 `sponsors/actions.ts`, `sponsors/page.tsx` (also: the page prints fixed message keys, never text from the URL) · A3·P-09 · A3·S-07 · A4-14 · A5-G1-12.
- Test: widen the shipped `guests/_components/a-host-never-reads-database-words.test.ts` to every action above (no `error.message` reaches a redirect, a return value or JSX), plus `sponsors/the-url-cannot-forge-a-message.test.ts`.

---

## Lane B · a look change · drawing first · 15 screens

Nothing below is built until the controller approves its drawing. Section numbers are the sections of the one HTML file.

| # | Screen to change | IDs | What changes, in one line | Drawing | Approval |
|---|---|---|---|---|---|
| 1 | Event Home at 1280, the cover card | A2-P21 | The date eyebrow may wrap, so "FEBRUARY 23, 2027" is whole | section 1 | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/BbEscw6Kkzrrv1Lpru3X6G), except items flagged lane C or R |
| 2 | Find your date · Pick your date cards | A2-H14 | No icon tile, title from PageMasthead, plain fact icons | section 2 | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/BbEscw6Kkzrrv1Lpru3X6G), except items flagged lane C or R |
| 3 | Guest sub-pages (10 routes) | A2-D8 · A2-P15 | One shared Back and one title, in place of seven Backs and three titles | section 3 | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/BbEscw6Kkzrrv1Lpru3X6G), except items flagged lane C or R |
| 4 | Add a guest · Quick add · Import | A2-D9 | Three pages become full-screen popups over Guests (centred dialog on desktop) | section 4 | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/BbEscw6Kkzrrv1Lpru3X6G), except items flagged lane C or R |
| 5 | Paperwork | A2-I12 | One hero number, the rest in one hairline row, neutral document cards | section 5 | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/BbEscw6Kkzrrv1Lpru3X6G), except items flagged lane C or R |
| 6 | Schedule at 1280 | A2-P23 | The day spans two columns until a chapter is opened; nothing cut | section 6 | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/BbEscw6Kkzrrv1Lpru3X6G), except items flagged lane C or R |
| 7 | Schedule › Planning Stage rows | A2-I4 | Neutral rows, plain icons, token colours | section 7 | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/BbEscw6Kkzrrv1Lpru3X6G), except items flagged lane C or R |
| 8 | Entrance seating chart · Walkthrough videos | A2-E12 | Two pages become full-screen popups over Seats; flat paper, Ghost loading | section 8 | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/BbEscw6Kkzrrv1Lpru3X6G), except items flagged lane C or R |
| 9 | Account home behind New event, in dark | A2-X3 | A popup wears the theme of the page that opened it; never half-dark | section 9 | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/BbEscw6Kkzrrv1Lpru3X6G), except items flagged lane C or R |
| 10 | Create a group | A2-C15 | A page for two fields becomes a small popup over People › Groups | section 10 | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/BbEscw6Kkzrrv1Lpru3X6G), except items flagged lane C or R |
| 11 | Create an event (picker + every onboarding flow) | A2-A1 | One full-screen popup from the tile to the last step; ✕ returns to where it started | section 11 | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/BbEscw6Kkzrrv1Lpru3X6G), except items flagged lane C or R |
| 12 | SW-K2 reference: receipt Pay button, event-day Home text, Nikah card, guest and booking popups | SW-K2 (77 IDs; area 2: A2-F8 · B8 · E14 · D5 · G8 · I20) | Raw px, hex, palette classes and typed shadows become house tokens | section 12 | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/BbEscw6Kkzrrv1Lpru3X6G), except items flagged lane C or R |
| 13 | SW-POPPOP reference: guest ticket confirm, supplier search filter, pay-sheet QR | SW-POPPOP (13 IDs; area 2: A2-D4 · G6 · G7) | The second layer never opens: swap in place or open in place | section 13 | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/BbEscw6Kkzrrv1Lpru3X6G), except items flagged lane C or R |
| 14 | SW-CONFIRM reference: walkthrough delete and remove | SW-CONFIRM (8 IDs; area 2: A2-E11) | The house confirm sheet (or Undo) in place of the browser's box | section 14 | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/BbEscw6Kkzrrv1Lpru3X6G), except items flagged lane C or R |
| 15 | SW-GLOW: Budget, Guests, Schedule, event-day Home, Activity, account home | SW-GLOW · A2-X4 | The dark top block wears the shared glow; light moves no pixel | section 15 | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/BbEscw6Kkzrrv1Lpru3X6G), except items flagged lane C or R |

**Build order once approved.** 15 (one shared class) → 12 (tokens, no layout) → 14 and 13 (layers) → 3, 2, 7, 5, 1, 6 (single screens) → the shared `RiseScreen` desktop dialog, then 4, 8, 10 → 11 last (the largest; it touches every create flow). Section 9 waits on SW-DARK's sweep of /dashboard, or ships its one-line rule first.

**Shared part, built once.** `RiseScreen` has no centred desktop dialog today (`fixed inset-0`). Sections 4, 8 and 11 all need it (Add 1: "full-screen dialogs: phone only; desktop uses a centred dialog"). Build it once before those three.

**Proof per screen (law 10).** 375 px light and dark, 768, 1280; a 390 px dark shot showing the top-block glow; every way in walked; ✕, backdrop, Esc and phone Back each return to the same scroll; reduced motion checked; one main button counted per scope.

**Planner's notes for the controller**
- **A2-X3 is not really lane B.** There is no look to choose: it is one rule in `theme-provider.tsx` (decide the theme on the page under an intercepted route). It was read from code and not seen on the copy. Suggest lane A, or fold it into SW-DARK.
- **A2-A1 carries lane C questions.** The shape is the owner's (Add 1). But it also changes where ✕ lands, what phone Back does in each flow, and whether a draft resumes at its step. Signed-out create is already with the owner (A2-A2, A2-A3, A2-A4). Suggest the owner sees section 11's table before it is built.
- **A2-D9 and A2-E12 keep their addresses** (`RiseRoute`), so shared links, the Tea ceremony and Event Hub doors to /guests/new, and a refresh still work. If the controller would rather drop the addresses, that is a function change (lane C).
- **Section 14 inside section 8.** If the walkthrough becomes a full-screen popup, its confirm is drawn in place in the thumb zone, never as a second layer. The same rule should hold for every SW-CONFIRM member that sits inside a layer.
- **A2-I14 (lane A)** may hide a data move if the old sponsor list holds rows the guest list lacks. Flagged in batch A-5.
