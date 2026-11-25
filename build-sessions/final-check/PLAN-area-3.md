# Final check · PLAN · Area 3 — Couple: Maker, Event Hub, Papic, Memories

**Date:** 25 Nov 2026 · Fable planner for area 3. Plan and drawings only; no app code was changed.
**Read from:** `ALL-FINDINGS.md` (branch `final-check/brief`), `area-3.md` (branch `final-check/area-3`), owner Adds 1–25, the house design standard, and the component code on main at `bd869365ca`.
**Drawings:** specs repo `prototypes/final-check-area-3_2026-11-25/final-check-area-3_2026-11-25.html` (one section per lane B screen).

Paths below are under `apps/web/app/dashboard/[eventId]/` unless they start with `apps/`, `lib/` or `panood/`.
IDs are written as in `ALL-FINDINGS.md` (`A3·E-01`); search `area-3.md` for the part after the dot.

## How the fixer uses this

- Lane A now, in the batch order below. One branch and one PR per batch: `claude/fc-fix-a3-b1` … `b5`.
- **No LIVE entry belongs to area 3** (all 21 are area 1), so batch 1 is the worst-first batch: the blocker and the saves that lie.
- Lane B waits. Every lane B line below reads `APPROVAL: pending controller`. Start a line only when the controller changes it to approved.
- Never edit a lane R page. For area 3 that is `studio/papic/challenges`, `studio/papic/run-of-show` (R6) and `studio/setnayan-ai` (R2). Two lane A entries touch code those pages share; the notes say where to stop.
- Money entries (`money-signin`): change only HOW it shows ("Couldn't read", a guard that refuses). Never an amount, a plan's contents or which price is read. If the right fix needs that, mark it 🟠 in the PR and skip it.
- Every fix follows the house error line: *"That did not save. Nothing changed — please try again."* for a failed save, and "Couldn't read …" for a failed read. A failed read never shows as 0, empty, free, off or "none yet".
- Budgets hold: server actions 1,251 (fold, never raise), shared JS 202.3 KB, no baseline regenerated. Each fix that removes a line from `lib/supabase-unread-error.baseline.txt` shrinks that file in the same commit.

## Lane A · 46 own entries + 1 shared sweep = 5 batches

### Batch 1 · the blocker and the saves that lie (12) · `claude/fc-fix-a3-b1`

Order: B-01 first (it unblocks M-05 and the lane B drawing B1), then the Event Hub saves, then invitations.

| # | ID | Files | The fix | The test that holds the claim |
|---|---|---|---|---|
| 1 | A3·B-01 | `alaala/assignments/page.tsx` (the `guests` read) | Read attending guests through `countsTowardEvent`, not `.eq('rsvp_status','confirmed')` (no such value). A failed read says "Couldn't read your guests", never "No guests to assign". | `the-assignments-page-lists-attending-guests.test.ts`: the read uses a value that exists in the `rsvp_status` enum (read from the migration), and a failed read renders the error state, not the empty one. |
| 2 | A3·M-05 | `alaala/assignments/_components/assignment-controls.tsx` `AssignmentRow` · `actions.ts` | `remove` reads its result; on failure the row stays and the house error line shows. | Same file: a refused `removeAssignment` leaves the row and sets the error text. |
| 3 | A3·E-01 | `website/hero-photo/actions.ts` · `website/editor/actions.ts` (`setOpenBrowse`, `saveRsvpBackdrop`, `clearRsvpBackdrop`) · `launch/_components/studio-tools.tsx` `pickVersion` · `story/actions.ts` `saveEditorial` | Read every update's `error`; return not-ok; the control goes back and says the house error line. Remove the seven lines from the unread-error baseline. | `event-hub-saves-say-when-they-fail.test.ts`: each named action returns `ok:false` when the client returns an error; the baseline no longer lists them. |
| 4 | A3·E-02 | `website/our-photos/actions.ts` (the drafting branch) | A blocked or unreadable photo says "One photo couldn't be added…", as the live path does. | The drafting branch returns the same notice key as the live branch for a blocked file. |
| 5 | A3·E-10 | `website/our-story/actions.ts` `updateOurStory` · `lib/love-story-words.ts` | If the read of the current story failed, refuse the save ("Couldn't read your story"); never write over moments. | `a-story-save-never-wipes-unread-moments.test.ts`: a failed read ends with no update call. |
| 6 | A3·E-11 | `website/photo-moments/actions.ts` · `website/widgets/actions.ts` | A write that changed no row is a refusal, not "Saved". | Zero rows returned → `ok:false` and the refusal sentence. |
| 7 | A3·E-17 | `website/site-chrome/page.tsx` · `site-chrome/actions.ts` | With both parts locked, no Save is drawn and the action saves nothing. | Both gated → the page source renders no submit; the action returns without "saved". |
| 8 | A3·E-15 | `website/privacy/page.tsx` `VisibilityCard` | The tapped choice shows as chosen at once (before Save). | The card's chosen mark follows the tapped value, not the saved one. |
| 9 | A3·I-04 | `invitation/actions.ts` (`markGuestInvitationSent`, `updateMonogram`) · `invitation/page.tsx` · `_components/guest-invite-modal.tsx` | "Mark sent" failure is shown; a zero-row "Save" is "Couldn't save". | Failure of either action reaches the rendered message; zero rows is not success. |
| 10 | A3·I-05 | `event-qr/page.tsx` · `event-qr/actions.ts` `regenerateEventMasterQR` | Read the result: say success or "Couldn't make a new QR"; one confirm, like the guest QR's. | The page renders the action's failure and success; the confirm is the house confirm sheet already used by the guest QR. |
| 11 | A3·I-06 | `studio/save-the-date/page.tsx` · `_components/StdBuilderClient.tsx` `handleRender` · `actions.ts` `saveAllStdContent` | A failed read says "Couldn't read" and offers no save; a dropped connection is caught; a failed write is not "Saved". | A thrown fetch in `handleRender` ends in the error line; `saveAllStdContent` returns `ok:false` on a write error. |
| 12 | A3·P-07 | `apps/web/app/_components/iap/apple-pro-screen.tsx` | When the App Store product is missing, say "The App Store is not answering. Try again." instead of a button disabled for good. | A null product renders the sentence and a Try again press. |

### Batch 2 · live studio and Papic: writes and guards (11) · `claude/fc-fix-a3-b2`

Order: L-04 (fail closed) → L-01, L-02, L-03 → L-05, L-06, L-09 → Papic.

| # | ID | Files | The fix | The test |
|---|---|---|---|---|
| 1 | A3·L-04 | `apps/web/app/panood/program/[eventId]/page.tsx` `fetchProgramChannels` · `program-surface.tsx` `sourceAllowed` | A failed channel read fails closed: only the ★ channel can go to air. 🟠 if this changes who may air what beyond the existing rule. | A failed read → `sourceAllowed` is true for the ★ channel only. |
| 2 | A3·L-01 | `apps/web/app/panood/control/[eventId]/actions.ts` (the eleven named actions) | Each reads its write's `error`; failure → an error banner, state unchanged. Shrink the baseline. | Each action returns `ok:false` on a client error; none of the eleven is left in the baseline. |
| 3 | A3·L-02 | `panood/control/[eventId]/page.tsx` (`activeBroadcast`, `isLive`) · `transport-row.tsx` | A failed read says "Couldn't check whether you're on air", never "Off air". | A read error produces the unknown state, not `isLive=false`. |
| 4 | A3·L-03 | `panood/control/[eventId]/actions.ts` `requireLiveStudioOwned` · `page.tsx` (unlock bar) | A failed plan read is an error, not a trip to the buy page; the price slot says "Couldn't read". Display only. | A failed plan read never redirects to the buy page. |
| 5 | A3·L-05 | `studio/panood/setup/actions.ts` (six actions) | No "Saved" and no ok after a failed write. | Each returns `ok:false` on a write error. |
| 6 | A3·L-06 | `live/_components/flash-auto-wall-toggle.tsx` | A failed save shows the error and the switch goes back. | A refused save restores the previous value. |
| 7 | A3·L-09 | `studio/panood/cameras/page.tsx` · `cameras/print/page.tsx` · `studio/panood/_components/copy-link.tsx` | One sentence for what a guest camera joins, from one shared constant. | Both pages import the same sentence. |
| 8 | A3·P-01 | `studio/papic/actions.ts` (eight actions) · `studio/papic/_lib/papic-in-place.ts` · `lib/papic-missions.ts` | A failed write returns a plain failure line. **Stop at the actions and the helper: the challenges and run-of-show page files are lane R (R6), do not open them.** | Each action returns `ok:false` on a write error. |
| 9 | A3·P-03 | `studio/photo-delivery/actions.ts` `disconnectPhotoDelivery` | "Couldn't disconnect" when the write fails. | A write error never returns disconnected. |
| 10 | A3·P-05 | `studio/papic/recap/actions.ts` · `recap/_components/recap-social-feature-toggle.tsx` | Publish / Make it private show a failure line. | A failed action reaches the toggle's rendered error. |
| 11 | A3·P-06 | `studio/papic/crew/_components/copy-button.tsx` | When the clipboard is blocked, show the link to select, with a line. (Lane B drawing B8 later moves this into a sheet; the button is the same part.) | A rejected `clipboard.writeText` renders the link text. |

### Batch 3 · failed reads say "Couldn't read", and pages have one home (12) · `claude/fc-fix-a3-b3`

Order: the shared readers first, then pages, then words.

| # | ID | Files | The fix | The test |
|---|---|---|---|---|
| 1 | A3·L-08 | `live/page.tsx` · `studio/live-studio-control/page.tsx` · `lib/add-on-stats.ts` · `studio/panood/broadcast/page.tsx` · `cameras/page.tsx` · `cameras/print/page.tsx` · `studio/panood/setup/page.tsx` | Counts, "Auto", cameras, prints and connection read "Couldn't read" on a failed read. | For each read: an error produces the unread state, never 0 / "Auto" / empty. |
| 2 | A3·P-08 | `studio/papic/crew/page.tsx` · `lib/shared-join-link.ts` · `moderation/page.tsx` · `recap/page.tsx` · `lib/auto-recap.ts` · `photo-delivery/page.tsx` | Same rule for the crew notice, moderation list, recap counts and delivery state. | Same shape, one case per read. |
| 3 | A3·M-08 | `alaala/page.tsx` · `alaala/assignments/page.tsx` · `apps/web/app/(account)/library/_data/editorials.ts` | Sections that failed to read say so; they do not vanish. | A failed section read renders `ErrorState`, not nothing. |
| 4 | A3·I-07 | `guests/_components/invite-message-setup.ts` · `guests/invite/_components/share-link-panel.tsx` · `invitation/page.tsx` · `invitation/print/page.tsx` · `event-qr/page.tsx` | No address, theme, QR look, bounce or 404 is stated from a failed read. | Each failed read maps to "Couldn't read", never a default fact. |
| 5 | A3·S-05 | `studio/mood-board/_components/mood-board-editor.tsx` · `studio/playlist/page.tsx` · `lib/songs.ts` · `guest-columns/page.tsx` · `apps/web/app/(account)/creator/page.tsx` · `lib/creator-offers.ts` | Same rule for the studio tools. **Skip the Setnayan AI files (R2) and the Patiktok files (held, see lane B).** | One case per read kept in scope. |
| 6 | A3·E-05 | `website/editor/page.tsx` (`widgetsRaw`) · `story/page.tsx` · `website/our-photos/page.tsx` | Scenes, chapters and photos say "Couldn't read", not "nothing here". | A read error never yields the empty state. |
| 7 | A3·E-16 | `website/privacy/page.tsx` · `website/stories/page.tsx` · the four page event reads | Consent and authors say "Couldn't read"; a failed page read does not bounce to Home. | A failed event read renders the error, with no redirect. |
| 8 | A3·F-01 | `event-page/page.tsx` | A coordinator is forwarded to the public `/[slug]`; a failed read says so; no 404. | Member type coordinator → redirect to the slug; read error → error state. |
| 9 | A3·M-06 | `alaala/page.tsx` · `galleries/page.tsx` `countPapicPhotos` · `memories/page.tsx` `countGalleryFrames` · `_components/after/finished-event-summary.tsx` | One page per name (Memories · Guest Stories · More from your day) and one photo count from one reader. Words only on the titles; no layout change. | Both pages call the one counter; no two page titles are equal. |
| 10 | A3·N-02 | `live/page.tsx` | "Showing now: your photos (picked for you)"; no mode code, no event id at the foot. | The page source prints no mode key and no id tail. |
| 11 | A3·N-08 | `studio/papic/recap/page.tsx` · `studio/about/[addon]` · `studio/live-studio-control/page.tsx` · `studio/playlist/page.tsx` · `lib/nav-registry-defaults.ts` | Masthead, lit tab and Back name the same home. **Skip `studio/setnayan-ai` (R2).** | For each page, the registry's home equals the Back link's target. |
| 12 | A3·N-11 | `studio/papic/recap/page.tsx` · `prints` (the Apply button) | "1 photo"; no "Apply 0 changes" (the button reads "Apply" and is off at zero). | Plural helper used; zero changes never prints a count. |

### Batch 4 · prices and E-Gifts show honestly; ruled words (11) · `claude/fc-fix-a3-b4`

All money rows are display only. Order: E-Gifts first (a wrong add form is the riskiest), then prices, then words.

| # | ID | Files | The fix | The test |
|---|---|---|---|---|
| 1 | A3·I-01 | `pabuya/page.tsx` · `lib/egift.ts` `readEgiftMethods` · `_components/pabuya-manager.tsx` | A failed read says "Couldn't read your E-Gift methods" and draws no add form. | A read error never renders the empty state or the form. |
| 2 | A3·E-03 | `launch/_components/hub-pro-offer.tsx` · `website/editor/_components/unlock-label.ts` · `launch/page.tsx` | "Couldn't read" where the price goes. | `unlockLabel` with an unread price returns the unread words, not a bare plan name. |
| 3 | A3·E-13 | `website/our-story/page.tsx` · `our-story/_components/love-story-pro-line.tsx` | Unread price → "Couldn't read"; unread plan → no upsell. | No offer is rendered when the plan read failed. |
| 4 | A3·I-03 | `studio/save-the-date/page.tsx` | "Couldn't read" by the price; no "bundle only" claim from a failed read. | A failed catalogue read never produces the bundle sentence. |
| 5 | A3·M-02 | `memories/_components/memories-settings.tsx` · `_components/inline-checkout-drawer.tsx` | "Couldn't read" by the row. The checkout takes the sheet's place (one layer, Add 1): close the ⚙ sheet as the checkout opens. | Unread price → unread words; opening checkout closes the sheet. |
| 6 | A3·M-03 | `memories/thank-you/page.tsx` · `_components/thank-you-maker.tsx` | "Couldn't read", not "isn't on sale". | Same shape. |
| 7 | A3·S-01 | `studio/_components/addon-detail-view.tsx` | A failed price or order read shows "Couldn't read" and never offers "Get" again. **Do not touch `studio/setnayan-ai/page.tsx` (R2); the price disagreement there dies with the page.** | An unread order never renders the buy press. |
| 8 | A3·I-02 | `invitation/actions.ts` `updateEventSlug` · `invitation/page.tsx` (`SLUG_ERROR_COPY`) · `lib/slug-availability.ts` | The refusal is a plain sentence, never the key `needs_custom_address`. The 🔒 with the catalogue price before Save follows the SW-NOPRICE pattern (batch 5); 🟠 if it needs a new checkout door. | Every key the action can return has a sentence in `SLUG_ERROR_COPY`. |
| 9 | A3·N-04 | `studio/save-the-date` (Step 4) · `website/site-chrome/page.tsx` · `website/hero-photo/page.tsx` · the shared `FileUpload` | One song limit from one constant; the limit is said once, in plain words ("MP3 or M4A, up to 20 MB"); "Event Hub", not "wedding-site". 🟠 the owner picks 20 or 40 MB if the two cannot be read from one existing limit. | Both pages import the one limit; the upload box prints no MIME type. |
| 10 | A3·N-09 | `guests/send/_components/send-run.tsx` · `guests/send/page.tsx` | The frame shows the invitation picture the guest receives (or nothing, never an empty white frame); the line under the name is the guest's email, not a phone number. | No phone number is rendered under the name; an absent picture renders no frame. |
| 11 | A3·N-10 | `studio/save-the-date/_components/StdBuilderClient.tsx` (Step 5) · `reveal-preview-card.tsx` | **Add 18 (owner ruled):** Step 5 no longer picks a reveal. It shows the current reveal's name as one status line and a link "Choose your reveal in the Event Hub" (deep link to the Maker's reveal part). Held PR #8222 must follow this. | `reveals-are-picked-only-in-the-event-hub.test.ts`: no file outside `launch/` renders a pickable `REVEAL_LIBRARY` list. |

### Batch 5 · shared sweep SW-NOPRICE (area 3 is named first, so area 3 builds it) · `claude/fc-fix-a3-b5`

IDs: **A3·I-09** · A5-G4-07 · A5-G5-09 · A5-G6-12 · A5-G6-15 · A6-B18 (details for the area 5 and 6 IDs are in `area-5.md` and `area-6.md`).

- The fix, once, as one shared part: every lock or "See plans" names the plan and its price read from the catalogue (`platform_retail_catalog_v2` for couples, `vendor_billing_catalog` for suppliers), with one button (Add 4). A failed price read says "Couldn't read". Never a typed price.
- Area 3 files: `monogram/animate-rows.tsx` (price on the page; a dropped connection says so) · `studio/save-the-date/stamp/wax-stamp-maker.tsx` and `apps/web/app/_actions/stay-registry/stdStamp.ts` (the seal says "Saved").
- Order: build the shared lock line → area 3 → area 5 → area 6.
- Test: `every-lock-names-its-plan-and-price.test.ts` walks the lock call sites and fails on one with no plan name or no catalogue price read. It tests the rendered words, not a class name.
- 🟠 Which plan unlocks the Event Hub look (A3·E-04 · E-12 · M-04) is lane C. Do not pick a plan name in this batch; where the plan is disputed, leave the lock as it is and list it in the PR.

### Area 3 IDs that other areas build (skip here)

SW-PHP (E-14 · L-07 · S-03) · SW-WORDS (E-06 · E-18 · L-10 · M-07 · I-08) · SW-BOOKED (S-06) · SW-PROMISE (M-01 · P-04) · SW-RETNAME (S-08) · SW-RAWDB (P-09 · S-07) · SW-URI (S-04) · SW-500 (B-02; N-12 folds into it).
Lane B sweeps: SW-K2 (L-11) · SW-K1 (P-10 · S-09, and the three "add" controls on Memories) · SW-DIALOG (E-07) · SW-SKEL (E-19 · M-10) · SW-DARK (A-01 · M-09) · SW-CONFIRM (I-10).
Lane C: S-02 · E-04 / E-12 / M-04 · N-01. Lane R: P-02 · N-13 (R6).

## Lane B · 12 drawn screens, 2 held

Drawing file: `prototypes/final-check-area-3_2026-11-25/final-check-area-3_2026-11-25.html` in `iscasasola/Setnayan-specs`. Each section shows Now beside Proposed at 375 and 1280, light and dark. Rule 0: only the change differs.

| Drawing | ID | Screen | The change in one line | Status |
|---|---|---|---|---|
| B1 | A3·M-11 | Story Assignments (`alaala/assignments`) | Rises as a full-screen layer over Alaala; ✕ returns to the row. | APPROVAL: pending controller |
| B2 | A3·N-03 | Memories › More from your day (`galleries`) | At 375 each source card stacks: words on top, button under. | APPROVAL: pending controller |
| B3 | A3·I-11 | Send invites (`guests/send`) | The hand-built layer becomes the shared RiseScreen; ✕ returns to where the person was. | APPROVAL: pending controller |
| B4 | A3·I-11 | Make your wax seal (`studio/save-the-date/stamp`) | Rises over Save the Date; ✕ returns to the row. | APPROVAL: pending controller |
| B5 | A3·N-05 | Memories first-visit tour (`memories`) | The tour stops blocking the page (no dim, no blocking panels). | APPROVAL: pending controller · planner recommends lane C |
| B6 | A3·N-06 | The phone dock in dark (seen on `memories`) | The grey active pill is lifted to a visible grey (3:1); stays grey per the owner. | APPROVAL: pending controller |
| B7 | A3·E-08 | Photos you add · the Story switch · Make it move | House main button, danger token, knob moves by transform, loop respects reduced motion. | APPROVAL: pending controller |
| B8 | A3·P-11 | One code for everyone (`studio/papic/crew`) | Becomes a small popup (Sheet) over the page that opened it. | APPROVAL: pending controller |
| B9 | A3·E-09 | Hero photo · Make it move · Photos you add (`website/*`) | Each rises over the Maker; ✕ returns to the row. | APPROVAL: pending controller |
| B10 | A3·E-20 | Set the mood and five more editor sub-pages (`website/*`) | Each rises over the Maker; ✕ returns to the row. | APPROVAL: pending controller |
| B11 | A3·L-12 | Live controller Setup (`panood/control`) | Full screen on a phone (`<Sheet full>`); the side panel stays on a computer. | APPROVAL: pending controller |
| B12 | A3·N-07 | The event badge in the side rail (768 and up) | The initials stay on one line inside the badge. | APPROVAL: pending controller |
| — | A3·P-11 (moderation) | Photo moderation (`studio/papic/moderation`) | No drawing. Moving moderation onto the photo in Memories moves a function. | HELD · planner recommends lane C |
| — | A3·S-10 | Patiktok template pick and booth camera | No drawing. Patiktok is a retired name and opens for an owner only. | HELD · planner recommends lane R |

### Build order for lane B (after approval)

1. **B6, B12, B2** — three small, separate fixes (one token, one text rule, one row). They can ship as one batch.
2. **B1, B4, B9, B10** — the rise conversions. One pattern for all: an intercepted route (`@rise/(.)page`) that draws the SAME page inside the shipped `RiseRoute`; a typed address still opens the page. Build B1 first as the reference, then the rest. B10 only after its two doubtful doors (photo-moments, widgets) are confirmed reachable; if not, they move to lane R.
3. **B3** — the send run onto `RiseScreen` (it has its own swipe and Back handling; keep both tests `the-send-run-is-the-simple-page` and `send-invite-is-honest` green).
4. **B8, B11** — the two sheets.
5. **B7** — the motion and legacy pieces (run `scripts/lint-motion-raw.mjs`; the baseline only shrinks).
6. **B5** — only if the owner rules on the tour.

### Proof each lane B build owes

- A 375 px shot in light and in dark (the dark shot shows the glow on the top block: the top bar, or the head of the risen screen) and one at 1280.
- ✕, Esc and the phone's Back each close only the top layer and return to the same scroll, with focus on the row that opened it.
- One layer at a time: nothing opens a popup over a popup.
- Every press is 44 px on a phone. Motion uses the named tokens only (Tap 100 · Quick 200 · Release 280 · Move 320 · Rise 700 · settle), transform and opacity only, with the 120 ms fade under reduced motion.
- Loading inside a risen screen is the Ghost skeleton of that page (the title shows at once).

## Notes for the controller

- **B5 (N-05) is a rule, not only a look.** The Spotlight tour is the house first-visit pattern for every role (standard D3) and the owner asked for more stops on this very tour on 25 Oct. Making it non-blocking changes one shared part for all areas. Recommend lane C.
- **B6 (N-06): the finding's EXPECTED conflicts with an owner ruling.** It asks for the terracotta pill in dark; the owner picked a grey active tab in dark on 18 Nov. The drawing keeps grey and fixes the contrast (the pill is about 1.1:1 against the bar today).
- **P-11 (moderation)** removes a page and moves delete / hide / Photo Notes onto the photo. Recommend lane C with its own drawing.
- **S-10 (Patiktok)** is a retired name behind an owner-only door. Recommend lane R (Add 17).
- **E-20:** photo-moments and widgets may have no door; confirm before building.
- **Dark frames:** only Memories is dark-ready on main. The other "Now · dark" frames are drawn in the house dark so that only the section's change differs; their real dark arrives with SW-DARK.
