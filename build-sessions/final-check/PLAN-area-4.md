# Final check · PLAN · Area 4 · Guest (Event Hub, pass, camera)

**Date:** 25 Nov 2026 · planner: Fable (plan and drawings only; no app code changed) · main read at `7c14361159` · findings from `ALL-FINDINGS.md` on `final-check/brief` and `area-4.md` on `final-check/area-4` (`c652639641`).

**Counts.** Lane A: 75 findings in 6 batches (64 area-4 entries + 11 area-4 members of 8 shared A sweeps). Lane B: 20 drawn screens covering all 20 lane B findings (7 area-4 entries + 13 members of 6 shared B sweeps). LIVE: none in area 4.

**Drawings:** specs repo `prototypes/final-check-area-4_2026-11-25/final-check-area-4_2026-11-25.html` (one section per lane B screen; Now beside Proposed; 375 and 1280; light and dark) · https://github.com/iscasasola/Setnayan-specs/blob/main/prototypes/final-check-area-4_2026-11-25/final-check-area-4_2026-11-25.html

**Not in this plan.** Lane C: none filed for area 4 (two candidates are flagged at the foot). Lane R: A4-73 (`/papic/lightcheck`, R9): fixers skip it.

## How the lane A batches work

- One batch = one PR from its own worktree of `origin/main`. Batches run in the order below; inside a batch, rows are fixed top to bottom.
- Every row names the test that holds its claim. A guard tests the claim itself (the rendered string, the real href, the returned state), uses `lib/strip-comments.ts` for source scans, and is shown failing before the fix.
- No lane A row changes how a screen looks. A "Couldn't read" line or a Try again uses the shipped `ErrorState` / `EmptyState` / `DoorShell tone="dead_end"` / the route's `error.tsx` as they are.
- Sweep members (tagged SW-…) are listed so nothing is lost. If the controller runs a sweep as one cross-area batch, strike the row here and keep its test.
- Paths are under `apps/web/` (`lib/` = `apps/web/lib/`, `public/` = `apps/web/public/`).
- Lane B waits. Every lane B line reads `APPROVAL: pending controller`; start a line only when the controller changes it to approved.

### Batch `a4-1-opens-and-doors` (13)

The blocker, every "broken", and the three money-signin items. Ships first.

**IDs, in order:** A4-B01 · A4-B09 · A4-B02 · A4-24 · A4-70 · A4-60 · A4-26 · A4-57 · A4-52 · A4-02 · A4-04 · A4-06 · A4-78

| # | ID | Fix | Files | Test that holds the claim |
|---|---|---|---|---|
| 1 | A4-B01 (blocker · SW-500) | Every Event Hub renders, or shows the honest "didn't load · Try again" inside 2 s, never HTTP 500 after 20–24 s. Find the read that stalls; bound it; a stalled optional read drops its section, not the page. (Add 14 caveat: re-measure when the copy is quiet.) | app/[slug]/page.tsx · app/[slug]/_lib/loaders.ts · lib/read-limit.ts · lib/invitation-retry.ts · app/[slug]/error.tsx | Unit: one optional Hub read never resolves → the page renders without that section inside the deadline. Timing: 4 seeded Hubs × 3 viewers × 3 runs, all 200 under 2 s; `/[slug]/everyone` under 2 s. |
| 2 | A4-B09 | After set-password, Skip and Save land a guest on the event's Event Hub (`/<slug>`), never the host's `/dashboard/<eventId>`. A host still lands on the dashboard. | app/join/[eventId]/set-password/page.tsx (and its action) | Unit: role guest → both hrefs are `/<slug>`; role host → dashboard. Walk on the copy as `guest`. |
| 3 | A4-B02 | A dead crew QR offers one way on (the wordmark home), like the other dead doors. Uses the shipped `ActionButton` already on `CrewSignIn`. | app/join/crew/[token]/_components/crew-screens.tsx `CrewStatus` · lib/crew-pass.ts `CREW_STATUS_WORDS` | Render test: `/join/crew/zzz` has exactly one link and its href is a real route. |
| 4 | A4-24 | The installed tile opens the saved Event Hub: `start_url` is an address the worker keeps (the bare `/<slug>`). | app/[slug]/manifest.webmanifest/route.ts · app/[slug]/hub/route.ts · public/sw.js `isDayOfGuestNavigation` | Unit: `isDayOfGuestNavigation(start_url)` is true for every event's manifest. Browser, offline: the tile opens the Hub copy. |
| 5 | A4-70 | The camera's exit lands on the Hub's saved copy when offline (the exit address matches a kept key; `&added=N` no longer misses the cache). | app/[slug]/_components/hub-tabs.ts `cameraExitHref` · public/sw.js | Unit: `cameraExitHref(...)` with and without shots matches the worker's cache-key rule. |
| 6 | A4-60 | Every camera refusal has a way back to this event's Event Hub, also with no `?from=`. | app/papic/guest/page.tsx · lib/page-home.ts `ownHubSlug` · app/[slug]/_components/public-event-day-bar.tsx | Render test per refusal state with no `from`: a back link to `/<slug>` exists. |
| 7 | A4-26 | A failed save on the welcome door says so and keeps what was typed (no silent redirect). | app/[slug]/welcome/actions.ts · app/[slug]/welcome/page.tsx | Action test: the write rejects → returns the failure key plus the typed values; the page renders them. |
| 8 | A4-57 | The Papic demo says "the demo expired" or "that shot didn't save" instead of doing nothing. | app/papic/demo/[token]/_components/demo-join-flow.tsx | Unit: `recordDemoShot` throws / returns expired → the matching line renders with `role="alert"`. |
| 9 | A4-52 | The promise "We'll let you know on this device if your table changes" is true: add the reader/sender for the stored subscription, or remove the prompt until it exists. Planner's pick: hide the prompt behind its sender (no new look). | app/[slug]/seat/_components/guest-push-prompt.tsx · app/[slug]/seat/actions/guest-push-actions.ts | Guard: the prompt renders only when a sender for its table exists in code (`git grep` for the table's reader ≠ 0), or is not rendered. |
| 10 | A4-02 | One service worker owns scope `/`: the media queue worker registers under its own scope or folds into `sw.js`. | app/_components/offline-daemon-mount.tsx · app/layout.tsx · public/sw-offline.js · public/sw.js | Unit over both register calls: scopes differ. Browser with the flag on: one worker controls `/` and the Hub copy is served offline. |
| 11 | A4-04 (money-signin) | Claiming a profile moves the profile and its godparent records together, or tells the person it did not finish (no half move). | app/claim/[token]/actions.ts | Action test: the second write fails → the first is undone or the result is `partial` and the page says so. |
| 12 | A4-06 (money-signin) | A connect request is never a way in: `/connect/confirm` applies the same request-only guard as `connect/route.ts`. | app/join/[eventId]/connect/confirm/page.tsx · app/join/[eventId]/connect/route.ts · lib/event-account-link.ts | Unit: an "Anyone, I approve" event with a pending request → confirm offers no seat. Seed one such event on the copy and walk it (not reproduced in phase B). |
| 13 | A4-78 (money-signin) | A failed read of logged payments says "Couldn't read your logged payments"; it never looks like "none yet". | app/papic/order/[token]/page.tsx | Unit: the read errors → the couldn't-read state, and the log form is not offered as if empty. (Behind NEXT_PUBLIC_PAPIC_GUEST_BUY.) |

### Batch `a4-2-hub-reads` (13)

The Event Hub and its seat and people pages: one reader per fact, honest failed reads.

**IDs, in order:** A4-B11 · A4-B13 · A4-21 · A4-22 · A4-28 · A4-30 · A4-31 · A4-33 · A4-34 · A4-37 · A4-38 · A4-25 · A4-27

| # | ID | Fix | Files | Test that holds the claim |
|---|---|---|---|---|
| 1 | A4-B11 | A signed-in seat holder sees their own table and pass on `/find-my-table`, `/seat`, the pass-card and QR routes, and the camera doors, the same way `/find-seat` and `?tab=me` already read the account. | app/[slug]/find-my-table/page.tsx · app/[slug]/seat/page.tsx · app/api/guest/pass-card · app/api/guest/qr · app/papic/guest/page.tsx · app/papic/decorate/page.tsx (one shared "who is this guest" reader) | Unit: account holds the seat, no invite cookie → each page and route answers the guest's own data (200), not the "Open this from your invitation" card. |
| 2 | A4-B13 | One clock per screen: the ceremony card and THE PROGRAM show the same time basis, or each is labelled with its zone. | app/[slug]/_components/schedule-widget.tsx · the ceremony card in site-body.tsx · guest-me.tsx ("Arrive by") | Unit with TZ=UTC: card time and program time for the same block are equal, or both carry a zone label. |
| 3 | A4-21 | Hub counts come from `lib/guests.ts` (`computeGuestStats` / `headcountForBasis`); a failed read shows "—", never 0. | app/[slug]/_components/editorial/data.ts · editorial-content.tsx · lib/guests.ts | Unit: counts equal `computeGuestStats` for a mixed fixture; read error → "—". Guard: no count query of its own in `data.ts`. |
| 4 | A4-22 | The supplier desk says "Couldn't read" when the run-of-show read is refused (null), not an empty schedule. | app/[slug]/_lib/supplier-desk.server.ts · app/[slug]/_components/supplier-desk.tsx | Unit: `fetchRunOfShowBlocks` → null renders the couldn't-read line; `[]` renders the empty line. |
| 5 | A4-28 | `/avatar` fails honestly when the guest read errors (no redirect to the Hub as if signed out). | app/[slug]/avatar/page.tsx | Unit: guest read error → throws to the error boundary. |
| 6 | A4-30 | "Also coming" lists only people who count toward the event (`countsTowardEvent`); an unapproved request is not listed. | app/[slug]/everyone/page.tsx · lib/entourage.ts · app/join/[eventId]/actions.ts | Unit: fixture with a pending request and a declined guest → neither name renders. |
| 7 | A4-31 | A failed "who is looking" read on `/everyone` is a failure state, not "you are a stranger". | app/[slug]/everyone/page.tsx | Unit: the read errors → error boundary; a real stranger still gets the invited-guests line. |
| 8 | A4-33 | `/find-my-table` draws the door through the one reader `fetchEntrance`. | app/[slug]/find-my-table/page.tsx · lib/indoor-blueprint.ts | Guard: no local `resolveEntrance` in the page. Unit: both seat pages give the same entrance for a fixture. |
| 9 | A4-34 | Tables come from `lib/seating.ts` `fetchTables` (its order and clean-up) on all three seat pages. | app/[slug]/find-my-table/page.tsx · find-seat/page.tsx · seat/page.tsx · lib/seating.ts | Guard: no raw `.from('event_tables')` in the three pages. Unit: order equals `sortTables`. |
| 10 | A4-37 | A failed check-in read never claims "Show this at the door" / not checked in; it says it couldn't check. | app/[slug]/find-seat/page.tsx · app/[slug]/seat/page.tsx (`PersonalPass`) | Unit: check-in read errors → the neutral line, not the not-checked-in one. |
| 11 | A4-38 | The invite door shows a failure state when its three reads fail (no default questions drawn as if real). | app/join/[eventId]/_components/join-flow.tsx · app/[slug]/invite/page.tsx | Unit: each of the three reads erroring → the failure state. |
| 12 | A4-25 | The welcome door never draws a made-up inviter name; a failed read says "Couldn't read" or the page fails honestly. | app/[slug]/welcome/page.tsx | Unit: inviter read errors → no "+1 of the inviting guest" text in the HTML. |
| 13 | A4-27 | Only known error keys draw a message on the welcome door; URL text is never printed. | app/[slug]/welcome/page.tsx · welcome/actions.ts (redirect with a key) | Unit: `?error=<b>x` and `?error=%` render with no alert; each known key renders its sentence. |

### Batch `a4-3-hub-pages` (12)

The rest of the `/[slug]` pages, the offline words and the claim link.

**IDs, in order:** A4-44 · A4-45 · A4-46 · A4-49 · A4-50 · A4-51 · A4-53 · A4-35 · A4-23 · A4-01 · A4-03 · A4-05

| # | ID | Fix | Files | Test that holds the claim |
|---|---|---|---|---|
| 1 | A4-44 | E-Gifts: a failed methods read is "Couldn't read" (or the error boundary), never "no gift methods". | lib/egift.ts `readEgiftMethods` / `fetchEgiftMethods` · app/[slug]/pabuya/page.tsx | Unit: the reader's failure flag reaches the page; the page renders the couldn't-read state. |
| 2 | A4-45 | `/print` sends a failed event read to the error boundary, not a 404 for an event that exists. | app/[slug]/print/page.tsx (use `guestRead`) | Unit: read error → throws; a missing slug → 404. |
| 3 | A4-46 | `/print` shows a failure state when its editorial or story reads fail (no `.catch(() => [])`). | app/[slug]/print/page.tsx | Unit: `loadEditorialData` rejects → failure state. |
| 4 | A4-49 | `/request` shows a failure state when the key read errors (no redirect home). | app/[slug]/request/page.tsx · lib/request-key.server.ts `readRequestKeyByToken` | Unit: reader errors → failure state; a truly unknown token → the shipped redirect. |
| 5 | A4-50 | `/seat` says "We couldn't load your seat pass" when the tables read failed (`tablesFailed`). | app/[slug]/seat/page.tsx | Unit: `tablesFailed` true → that line, not a pass with no table. |
| 6 | A4-51 | `/seat` reads with `throwOnReadError: true`, as `/find-seat` and `/find-my-table` do. | app/[slug]/seat/page.tsx | Guard: both reader calls on the page pass `throwOnReadError: true`. |
| 7 | A4-53 | No price written into code or comments on `/seat` ("CUSTOM_QR_GUEST SKU" header). | app/[slug]/seat/page.tsx | Typed-price guard (₱ / digits beside a SKU) covers the file, comments included via `strip-comments` off. |
| 8 | A4-35 | The seat frame says "Open your invitation", not "Confirm your Booking". | app/[slug]/find-seat/_components/seat-frame.tsx · lib/ugat/baselines/wrong-words.baseline.txt (remove the line) | The wrong-words guard passes with the baseline entry deleted. |
| 9 | A4-23 | The day-of banner's offline words match what ships (no "they work offline" for parts that are not kept). | app/[slug]/_components/day-of-banner.tsx | Words test: the banner's detail names only addresses `isDayOfGuestNavigation` keeps. |
| 10 | A4-01 | `/offline.html` promises only what the phone kept (the invitation and Find my table), not "any pages you've already opened". | public/offline.html | String test on the file against the kept-address list in `lib/offline-copy-addresses.ts`. |
| 11 | A4-03 | A failed claim read is "Couldn't read · Try again"; a valid link is never called dead. | app/claim/[token]/page.tsx · claim/[token]/actions.ts | Unit: read error → the retry state; an unknown token → "This link isn't active." |
| 12 | A4-05 | After a claim, the landing page shows a small success toast (the shipped toast; `?claimed` is read). | app/(hub)/dashboard/page.tsx · app/claim/[token]/actions.ts | Unit: `?claimed=1` → the toast text renders once. |

### Batch `a4-4-papic-guest` (14)

The guest camera and its doors: failed gates never hand out a camera, failed reads never look empty.

**IDs, in order:** A4-67 · A4-66 · A4-65 · A4-61 · A4-63 · A4-54 · A4-71 · A4-82 · A4-B03 · A4-74 · A4-75 · A4-B08 · A4-79 · A4-80

| # | ID | Fix | Files | Test that holds the claim |
|---|---|---|---|---|
| 1 | A4-67 | A failed block-list read does not hand out the camera. | app/papic/guest/page.tsx (`event_blocked_users`) | Unit: the gate read errors → the "couldn't check" door, no capture surface. |
| 2 | A4-66 | An unknown used-count is not drawn as a full allowance. | lib/papic-guest.ts | Unit: `countError` set → `remaining` is unknown (null), not the full credit. |
| 3 | A4-65 | The soft-stop threshold is the pool's live `softStopPct`, not the last-resort constant. | app/papic/guest/_components/papic-guest-capture.tsx · lib/papic-event-pool.ts | Unit: config 70 → the warning starts at 70 %. Guard: no numeric threshold literal in the component. |
| 4 | A4-61 | "My shots" says "Couldn't read your earlier shots" when `getGuestOwnShots` returns null. | app/papic/guest/_components/papic-guest-capture.tsx · my-shots-sheet.tsx | Unit: null → the couldn't-read line; `[]` → "Your shots land here as you take them." |
| 5 | A4-63 | Never a popup on a popup: opening Add credits closes My shots first (and the reverse). | app/papic/guest/_components/papic-guest-capture.tsx | Unit: with `shotsOpen` true, opening the buy panel sets it false; at most one `role="dialog"` in the tree. (Its Sheet look is lane B screens 9 and 10.) |
| 6 | A4-54 | A failed crew-seat claim is a retryable "we couldn't check just now · your link is fine", not the terminal "This link isn't active". | app/papic/actions.ts · app/papic/claim/[token]/page.tsx | Action test: a read error redirects to `?state=unreadable`; only a missing token gives `invalid`. |
| 7 | A4-71 | `/papic/join` tells a failed check from a dead link the same way. | app/papic/join/[token]/page.tsx | Unit: reader error → "We couldn't check · your link is fine"; unknown token → the dead-link door. |
| 8 | A4-82 | `/papic/seat` says "We couldn't check your seat · Try again" on a failed read (forward to claim's `?state=unreadable`). | app/papic/seat/[token]/page.tsx | Unit: read error → redirect target carries `state=unreadable`. |
| 9 | A4-B03 | A link that opens nothing says so on arrival, before any sign-in or press: the camera-operator invite, the crew-seat claim and the crew seat. | app/panood/cam/[token]/page.tsx · app/papic/claim/[token]/page.tsx · app/papic/seat/[token]/page.tsx | Unit: an unknown token renders the dead-link door on GET, signed out and signed in; no "Sign in to join" / "Start shooting" in the HTML. |
| 10 | A4-74 | My photos says "Couldn't read your photos" when the gallery read failed, distinct from having none. | app/papic/me/[token]/page.tsx `GuestGallery` · lib/guest-live-gallery.ts | Unit: `getGuestLiveGallery` → null renders the couldn't-read line; an empty gallery renders nothing (shipped). |
| 11 | A4-75 | Make my Story says "Couldn't load your photos" when its count read failed (not 0 photos). | app/papic/me/[token]/actions.ts `prepareGuestStory` · _components/guest-story-maker.tsx | Action test: read error → `{ ok: false, reason: 'unreadable' }`; the maker renders that line. |
| 12 | A4-B08 | `/papic/pool` with no Papic session shows the same door as the camera and Decorate ("Open your invitation first."), not the site 404. | app/papic/pool/page.tsx | Unit: no session → the DoorShell door, HTTP 200; album switched off → the shipped 404. |
| 13 | A4-79 | A failed event read on `/papic/pool` is a "couldn't load" state, not a 404. | app/papic/pool/page.tsx | Unit: read error → the couldn't-load state (reuse `initialUnreadable`). |
| 14 | A4-80 | "Load more" keeps its button and says "Couldn't load more · Try again" on a failed page. | app/papic/pool/_components/pool-grid.tsx | Unit: fetch throws → button present, message with `role="status"`; next press retries the same cursor. |

### Batch `a4-5-screens-and-words` (13)

Venue screens (Live Watch, the wall), Live Watch camera, community join, and Papic's public words.

**IDs, in order:** A4-09 · A4-15 · A4-10 · A4-11 · A4-B07 · A4-12 · A4-13 · A4-08 · A4-16 · A4-B06 · A4-56 · A4-58 · A4-83

| # | ID | Fix | Files | Test that holds the claim |
|---|---|---|---|---|
| 1 | A4-09 | A refused read keeps the last picture with "Reconnecting…"; it is never treated as unpaired. | app/live/_lib/load-screen.ts · lib/live-studio-window-server.ts `checkOrderActive` | Unit: `checkOrderActive` throws → state `reconnecting`, not `unpaired`. |
| 2 | A4-15 | The wall freezes on the last collage with the amber dot when the snapshot read fails (no "coming soon" white-out). | lib/live-wall.ts `getWallSnapshot` · app/wall/[eventId]/_components/wall-projection.tsx | Unit: the read fails after a good snapshot → tiles unchanged, state `stale`. |
| 3 | A4-10 | A failed camera join says "Couldn't reach Setnayan · Try again" with Join still there; only a bad token is "invalid". | app/panood/actions.ts · app/panood/cam/[token]/page.tsx | Action test: a network error → `?state=down`; the page for `down` keeps the Join button. |
| 4 | A4-11 | The camera pill agrees with the footer's link state ("Connected" only when the stream is up). | app/panood/cam/[token]/_components/panood-camera-publish.tsx | Unit: local camera open + link down → the pill does not say "Connected". |
| 5 | A4-B07 | A wall address that is not an event says "This screen link is wrong, open it again from the host's dashboard"; no form is drawn for it. | app/wall/[eventId]/page.tsx · _components/wall-claim.tsx · the `/api/wall/claim` route | Unit: `/wall/zzz` renders the wrong-link line, no form; a 404 from claim maps to it, not "Something hiccuped". |
| 6 | A4-12 | A failed community-invite read is "Couldn't read · Try again", not "This invite link doesn't work." | lib/communities.ts · app/samahan/join/[token]/page.tsx | Unit: reader error → retry state; unknown token → the dead-link line. |
| 7 | A4-13 | A failed member count hides the count (or shows "—"), never "0 members". | lib/communities.ts · app/samahan/join/[token]/page.tsx | Unit: count error → no "0 members" in the HTML. |
| 8 | A4-08 | `/live` uses the event's own words (`eventWordsForEvent`), not "the couple". | app/live/page.tsx (the lead line and `ERRORS.locked`) | Words guard: no "couple" literal in the file; unit: a debut reads its host word. |
| 9 | A4-16 | The wall claim page uses the event's own words. | app/wall/[eventId]/_components/wall-claim.tsx · app/wall/[eventId]/page.tsx | Same words guard over both files. |
| 10 | A4-B06 | `/wall` and `/live` words fit every event type, and `/wall` carries its own tab title. | app/wall/[eventId]/page.tsx (metadata) · app/live/page.tsx | Render test: title is not the generic site title; no "couple" in the rendered text for a birthday fixture. |
| 11 | A4-56 | The Papic demo never claims Papic is unlimited; the guard's file list covers the demo. | app/papic/demo/[token]/_components/demo-join-flow.tsx · lib/papic-page-says-only-what-is-true.test.ts (`PAPIC_PAGE_*` list) | The existing guard, with the demo files added, fails before and passes after. |
| 12 | A4-58 | The demo's shot count comes from `DEMO_SHOT_CAP`, not a typed second copy. | app/papic/demo/[token]/_components/demo-join-flow.tsx · lib/demo-sessions.ts | Guard: no numeric cap literal in the component; unit: changing the constant changes the rendered count. |
| 13 | A4-83 | `/papic/try` drops the line that implies Papic does not cap shots. | app/(shell)/papic/_papic-scan.tsx | The same true-words guard covers the file. |

### Batch `a4-6-sweep-members` (10)

Area 4's members of the shared A sweeps (SW-500's member, A4-B01, leads batch 1).

**IDs, in order:** A4-64 · A4-77 · A4-42 · A4-43 · A4-B12 · A4-72 · A4-14 · A4-B10 · A4-47 · A4-48

| # | ID | Fix | Files | Test that holds the claim |
|---|---|---|---|---|
| 1 | A4-64 (SW-PHP · money) | Pesos only through `lib/php.ts`; no rate typed in Papic tier copy. | lib/papic-tier-copy.ts · lib/php.ts | The typed-peso guard covers the file; unit: a missing price reads "couldn't read", not ₱0. |
| 2 | A4-77 (SW-PHP · money) | No ₱0 on the guest order page; the copy control hides when the amount is unknown. | app/papic/order/[token]/page.tsx | Unit: amount null → "—" and no copy button. |
| 3 | A4-42 (SW-WORDS) | "E-Gifts" only; "Pabuya" never visible. | app/[slug]/pabuya/page.tsx · app/_components/pabuya/* (rendered strings and metadata) | House-words guard over rendered strings of these files. |
| 4 | A4-43 (SW-WORDS) | No "safe" promise about Setnayan on E-Gifts. | app/[slug]/pabuya/page.tsx | Same guard ("Safe" as a product word fails). |
| 5 | A4-B12 (SW-PROMISE · money) | Drop "No commission, no middleman, no fees."; if a 0 % line stays it is exactly "Hosts pay 0% commission."; "the couple" becomes the event's own word. | app/_components/pabuya/pabuya-card-list.tsx | The commission-line guard and the promise-words guard cover the file. |
| 6 | A4-72 (SW-COMING) | No app or coming-feature claim on the Papic join banner before it is live: hide it until then. | app/papic/join/[token]/_components/app-install-banner.tsx | Coming-soon guard; render test: the banner is absent while its flag is off. |
| 7 | A4-14 (SW-RAWDB) | Community join shows a plain reason plus Try again, never raw database text. | app/samahan/join/[token]/page.tsx (and its action) | Action test: a database error returns a fixed message key; the raw message is absent from the HTML. |
| 8 | A4-B10 (SW-PLACE) | "Time to follow", not "Time TBD". | app/[slug]/_components/supplier-desk.tsx | String test; the placeholder guard ("TBD") covers `app/[slug]`. |
| 9 | A4-47 (SW-WEDDING) | `/print` uses the event type's own words. | app/[slug]/print/page.tsx | Words test with a birthday fixture: no wedding words in the HTML. |
| 10 | A4-48 (SW-WEDDING) | The request key uses the event's own word, never "the couple" on every type. | lib/request-key.ts | Unit per event type; guard: no "couple" literal in the file. |

## Lane B · 20 drawn screens

One line per screen. Drawing = the section number in `final-check-area-4_2026-11-25.html`. Each section shows Now (from the shipped component) beside Proposed (only the change) at 375 and 1280, light and dark, with what it removes.

Rules the drawings follow: popup or page per Add 1 (Sheet = small popup, RiseScreen = full-screen popup; never a popup on a popup) · K1 one main button · K3 one shared backdrop · motion tokens Tap 100 · Quick 200 · Release 280 · Move 320 · Rise 700 with Settle · 44 px touch floor on a phone, denser on desktop · dark keeps the coloured glow on the top block of app-look screens (the Event Hub wears the couple's look and never the app glow, as shipped; screens that paint their own dark stage look the same in both).

| # | ID | Screen | The change (one line) | Drawing | Approval |
|---|---|---|---|---|---|
| B1 | A4-B05 | `/[slug]` cover and venue block | Pointer screens read "Scroll for the event"; the venue photo and words share one frame; 24 px before "The entourage". | § 01 | APPROVAL: pending controller |
| B2 | A4-32 | `/[slug]/everyone` | Opens as a RiseScreen over the invitation; the foot link "Back to the invitation" goes. | § 02 | APPROVAL: pending controller |
| B3 | A4-41 | `/[slug]/invite/reply` | On a phone the reply card opens in a RiseScreen ("Your reply"); desktop stays the shipped Sheet. | § 03 | APPROVAL: pending controller |
| B4 | A4-B04 | `/live` Connect | The button shows pressed at once ("Connecting…", locked), then the shipped answer line. | § 04 | APPROVAL: pending controller |
| B5 | A4-55 | `/papic/decorate` | Opens as a RiseScreen over My photos; the back link and the two-hop navigation go. | § 05 | APPROVAL: pending controller |
| B6 | A4-81 | `/papic/pool` | Opens as a RiseScreen over My photos; desktop grid uses the width. | § 06 | APPROVAL: pending controller |
| B7 | A4-69 | `/papic/guest` from the Hub bar | The camera rises over the Event Hub (RiseScreen); ✕ returns to the same scroll and tab, no reload. | § 07 | APPROVAL: pending controller |
| B8 | A4-68 (SW-SKEL) | `/papic/guest` · `/papic/seat/[token]` loading | The skeleton is the dark camera stage, not a card grid or a form. | § 08 | APPROVAL: pending controller |
| B9 | A4-62 (SW-DIALOG) | Camera · My shots | The hand-built 72 % panel becomes the shared Sheet. | § 09 | APPROVAL: pending controller |
| B10 | A4-62 (SW-DIALOG) | Camera · Add credits | The hand-built panel becomes the shared Sheet (body and prices unchanged). | § 10 | APPROVAL: pending controller |
| B11 | A4-07 (SW-TAP) | `/join/crew/[token]` name field | The typed white box becomes the shared `.input-field`; the error line uses the danger token. | § 11 | APPROVAL: pending controller |
| B12 | A4-17 (SW-POPPOP) · A4-19 (SW-DIALOG) | `/[slug]` Face tagging selfie camera and its Details | The camera is a RiseScreen; ⓘ opens the Details as the note under its head (one layer); spinners become a Ghost block. | § 12 | APPROVAL: pending controller |
| B13 | A4-18 · A4-19 (SW-DIALOG) | `/[slug]` story: Relive it · suppliers · Open the gallery | Three hand-built full screens become RiseScreen; Back returns to the story. | § 13 | APPROVAL: pending controller |
| B14 | A4-20 (SW-DIALOG) | `/[slug]` My QR · plus-one ticket · story minute · Open in your browser | Four hand-built panels become the shared Sheet. | § 14 | APPROVAL: pending controller |
| B15 | A4-29 (SW-DIALOG) | `/[slug]/avatar` | The page wears the couple's look (no self-forced dark); Save is the one main button. | § 15 | APPROVAL: pending controller |
| B16 | A4-36 (SW-DIALOG) | `/[slug]/find-seat` Show at the door | The hand-built modal becomes a RiseScreen; the pass card is unchanged. | § 16 | APPROVAL: pending controller |
| B17 | A4-39 (SW-K1) | `/[slug]/invite/enter` ticket section | "Save my ticket" is the one main button; "Yes, save to my account" turns neutral. | § 17 | APPROVAL: pending controller |
| B18 | A4-40 (SW-DIALOG) | `/[slug]/invite/enter` ticket popup | The hand-built centred card becomes the shared Sheet. | § 18 | APPROVAL: pending controller |
| B19 | A4-59 (SW-K2) | `/papic/demo/[token]` card | The typed white card becomes the house frame (surface token, hairline, no shadow). | § 19 | APPROVAL: pending controller |
| B20 | A4-76 (SW-K1) | `/papic/me/[token]` | "Open my camera" stays the one main button; "Make my Story" turns neutral. | § 20 | APPROVAL: pending controller |

**Order to build once approved:** B11, B17, B19, B20 (one-file token and button changes) → B4, B8 → the Sheets B9, B10, B14, B18 → the RiseScreens B2, B5, B6, B13, B16, B12 → B3 → B15 → B1 → B7 last (it moves two owner-pinned tests).

**Lane A rows that land with a lane B screen:** A4-63 with B9/B10 · A4-B08, A4-79, A4-80 with B6 · A4-61 with B9 · A4-74, A4-75 with B20.

## Flags for the controller (planner's view; nothing built on these)

1. **A4-B05 part (d) reads as lane C.** "At 1280 and 768 the Event Hub is the phone column in a wide white page." Fixing it is a new desktop and tablet layout for every couple theme (a design the owner approves per theme), not a small look fix. § 01 draws parts (a)–(c) only.
2. **A4-69 (B7) needs the owner's word before a build.** `the-camera-tab-is-the-camera.test.ts` #6 and `the-camera-is-the-whole-screen.test.ts` pin today's page shape on the owner's earlier ruling; moving the camera into a layer over the Hub reverses that ruling. Treat as lane C until he says so; the drawing is ready.
3. **A4-41 (B3)** keeps the address for emails and QR links (it opens the invitation with the layer up). If the owner prefers the reply to stay a page on phones (people do arrive by link), it drops out of lane B with no other change.
4. **A4-52 (lane A)**: the plan hides the "we'll let you know" prompt until a sender exists. Building the push sender instead is a feature (lane C).
5. **Dark on the Event Hub.** The Hub wears the couple's look and, as shipped (`globals.css` guest islands, `--color-band-glow: none`), never the app glow. The drawings follow that; the coloured top glow is drawn only on app-look screens (My photos, Decorate, Everyone's photos, the demo card).
