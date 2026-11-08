# Save in place — audit (2026-11-08)

Owner, 2026-10-26 (DECISION_LOG "A SAVE NEVER RESETS THE SCREEN — APP-WIDE"): *"saving minimum and maximum on papic resets the whole screen. this should not happen"* · *"and same to the rest of the buttons and functions"* · *"same to the rest of the website. avoid resetting the whole screen"*.

**How this list is made — never typed.** `lib/stay-ratchet.ts` reads every `'use server'` module under `app/ lib/ components/` with the TypeScript parser and lists each exported action whose body (or a same-file helper it calls) reaches a `redirect()` that is not a bare sign-in (`/login…`, `/sign…`) or not-on-the-event (`/dashboard`) guard. `app/dev/` and `app/admin/` are outside this audit (admin is handled last). The BEFORE list is that scan on `origin/claude/supplier-1build` at `1604c6b8d`; the AFTER column is the same scan on this branch.

Re-measure: `pnpm tsx lib/stay-ratchet.ts --json` (from `apps/web`).

## Counts

| | before | after |
|---|---:|---:|
| server actions that redirect (outside admin and dev) | 379 | 379 |
| … of which navigation on purpose, each with a reason (`lib/stay-ratchet.navigation.ts`) | 68 | 95 |
| … of which already saved in place before this change (Papic, #6970) | 18 | 18 (folded into the app-wide door) |
| **… of which a save that redirects back and resets the screen** | **293** | **91** |
| converted to a stay door in this change | — | 175 |
| found to be navigation or a gate-only bounce, reason added | — | 27 |
| admin (out of scope, ratcheted in the baseline) | 190 | 190 |

Every action still in the last row is in `lib/a-save-never-resets-the-screen.baseline.txt`, which may only shrink — a NEW redirecting action fails `lib/a-save-never-resets-the-screen.test.ts`.

## Client-side reloads after a save

Searched every non-admin source file for `location.reload()` and `router.push/replace(pathname)`: **none follows a save.** The 21 that exist are "Try again" buttons on a failed read, a new deployment / stale bundle, a preview iframe, a finished background job, or another account signing in — each listed with its reason in `RELOAD_ALLOWED` (`lib/a-save-never-resets-the-screen.test.ts` › (5)), which fails on a new one. `router.refresh()` is not a reset: it re-renders the server parts in place and keeps the scroll and open sheets — it is how a save stays in place.

## Every save that redirected back to its screen (before) — and what it is now

`door` = saves in place now (`<area>.<action>` in `lib/stay-doors/`) · `nav` = moving is the point, reason in the navigation list · `left` = not converted yet, with the reason · `gone` = no longer redirects.

### account: account

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/dashboard/(account)/api-keys/actions.ts` › `createApiKey` | `/dashboard/api-keys` | `/dashboard/api-keys` | nav — create key → `?just_created=<key>` shows the new key ONCE; in place it would never be shown |
| `app/dashboard/(account)/creator/actions.ts` › `createChapter` | `/dashboard/creator` | `(computed)` | door |
| `app/dashboard/(account)/creator/actions.ts` › `deleteChapter` | `/dashboard/creator` | `(computed)` | door |
| `app/dashboard/(account)/creator/actions.ts` › `finalizeChapterTeaser` | `/dashboard/creator` | `(computed)` | left — returns a download URL to its caller; a door answers only ok/error |
| `app/dashboard/(account)/creator/actions.ts` › `setChapterAudience` | `/dashboard/creator` | `(computed)` | door |
| `app/dashboard/(account)/creator/actions.ts` › `updateChapter` | `/dashboard/creator` | `(computed)` | door |
| `app/dashboard/(account)/creator/offer-actions.ts` › `acceptCreatorOffer` | `/dashboard/creator` | `(computed)` | door |
| `app/dashboard/(account)/creator/offer-actions.ts` › `declineCreatorOffer` | `/dashboard/creator` | `(computed)` | door |
| `app/dashboard/(account)/creator/offer-actions.ts` › `linkCreatorOfferDeliverable` | `/dashboard/creator` | `(computed)` | door |
| `app/dashboard/(account)/people/actions.ts` › `proposeSamahanConnection` | `/dashboard/people` | `/dashboard/people` | door |
| `app/dashboard/(account)/people/dependent-actions.ts` › `addDependent` | `/dashboard/people` | `/dashboard/people` | door |
| `app/dashboard/(account)/people/dependent-actions.ts` › `addGodparent` | `/dashboard/people` | `/dashboard/people` | door |
| `app/dashboard/(account)/people/dependent-actions.ts` › `createHandoverLink` | `/dashboard/people` | `/dashboard/people` | door |
| `app/dashboard/(account)/people/dependent-actions.ts` › `deleteDependent` | `/dashboard/people` | `/dashboard/people` | door |
| `app/dashboard/(account)/people/dependent-actions.ts` › `deleteGodparent` | `/dashboard/people` | `/dashboard/people` | door |
| `app/dashboard/(account)/people/dependent-actions.ts` › `emailHandoverLink` | `/dashboard/people` | `/dashboard/people` | door |
| `app/dashboard/(account)/people/dependent-actions.ts` › `revokeHandoverLink` | `/dashboard/people` | `/dashboard/people` | door |
| `app/dashboard/(account)/people/dependent-actions.ts` › `setDependentSharing` | `/dashboard/people` | `/dashboard/people` | door |
| `app/dashboard/(account)/profile/actions.ts` › `cancelAccountDeletionRequest` | `/dashboard/profile` | `/dashboard/profile` | door |
| `app/dashboard/(account)/profile/actions.ts` › `requestAccountDeletion` | `/dashboard/profile` | `/dashboard/profile` | door |
| `app/dashboard/(account)/profile/actions.ts` › `updateDiscoverableByName` | `/dashboard/people`, `/dashboard/profile` | `/dashboard/profile` | door |
| `app/dashboard/(account)/profile/actions.ts` › `updatePersonalInfo` | `/dashboard/profile` | `/dashboard/profile` | door |
| `app/dashboard/(account)/profile/actions.ts` › `updatePublicGreeting` | `/dashboard/profile` | `/dashboard/profile` | door |
| `app/dashboard/(account)/profile/actions.ts` › `updatePublicProfileEnabled` | `/dashboard/profile` | `/dashboard/profile` | door |
| `app/dashboard/(account)/profile/actions.ts` › `updateSharePhotoWithHosts` | `/dashboard/profile` | `/dashboard/profile` | door |
| `app/dashboard/(account)/profile/actions.ts` › `updateUserSlug` | `/dashboard/profile` | `/dashboard/profile` | door |
| `app/dashboard/(account)/profile/face-profile-actions.ts` › `forgetMyFaceEverywhere` | `/dashboard/profile` | `(computed)` | door |
| `app/dashboard/(account)/profile/face-profile-actions.ts` › `setAccountFaceProfileConsent` | `/dashboard/profile` | `(computed)` | door |
| `app/dashboard/(account)/samahan/actions.ts` › `deleteSamahanMessage` | `/dashboard/samahan/[x]` | `(computed)` | door |
| `app/dashboard/(account)/samahan/actions.ts` › `demoteMember` | `/dashboard/samahan/[x]` | `(computed)`, `/dashboard/samahan/[x]` | left — success and the not-an-organizer bounce both land on `?tab=members` |
| `app/dashboard/(account)/samahan/actions.ts` › `postSamahanMessage` | `/dashboard/samahan/[x]` | `(computed)` | door |
| `app/dashboard/(account)/samahan/actions.ts` › `promoteMember` | `/dashboard/samahan/[x]` | `(computed)`, `/dashboard/samahan/[x]` | left — success and the not-an-organizer bounce both land on `?tab=members` |
| `app/dashboard/(account)/samahan/actions.ts` › `removeMember` | `/dashboard/samahan/[x]` | `(computed)`, `/dashboard/samahan/[x]` | door |
| `app/dashboard/(account)/samahan/actions.ts` › `rotateInviteToken` | `/dashboard/samahan/[x]` | `(computed)`, `/dashboard/samahan/[x]` | door |
| `app/dashboard/(account)/samahan/actions.ts` › `updateCommunityIdentity` | `/dashboard/samahan/[x]` | `(computed)` | door |

### account: launcher

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/dashboard/(launcher)/incoming-request-actions.ts` › `answerIncomingRequest` | `/dashboard` | `(computed)`, `/dashboard` | door |
| `app/dashboard/(launcher)/incoming-request-actions.ts` › `muteInviter` | `/dashboard` | `/dashboard` | door |

### app: _actions

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/_actions/booking-fee-dispute-actions.ts` › `bookingFeeDispute` | `/admin/disputes`, `/vendor-dashboard/booking-fees/[x]` | `(computed)`, `/admin/disputes` | left — posted only from admin and supplier screens that are not converted yet |
| `app/_actions/favorite-actions.ts` › `favoriteAction` | `/`, `/[x]`, `/dashboard/library` | `/[x]` | left — bound to an object input a form cannot rebuild; the heart also calls it directly |

### app: _components

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/_components/appointments-actions.ts` › `proposeAppointment` | `/` | `(computed)` | left — chat appointments/negotiation: the gate bounce lands on the same thread path as success, posted from both sides' threads |
| `app/_components/appointments-actions.ts` › `respondAppointment` | `/` | `(computed)` | left — chat appointments/negotiation: the gate bounce lands on the same thread path as success, posted from both sides' threads |
| `app/_components/negotiation-actions.ts` › `counterAmendmentFromChat` | `/` | `(computed)` | left — chat appointments/negotiation: the gate bounce lands on the same thread path as success, posted from both sides' threads |
| `app/_components/negotiation-actions.ts` › `createAmendmentFromChat` | `/` | `(computed)` | left — chat appointments/negotiation: the gate bounce lands on the same thread path as success, posted from both sides' threads |
| `app/_components/negotiation-actions.ts` › `createScheduleRequestFromChat` | `/` | `(computed)` | left — chat appointments/negotiation: the gate bounce lands on the same thread path as success, posted from both sides' threads |
| `app/_components/negotiation-actions.ts` › `lockDeal` | `/` | `(computed)` | left — chat appointments/negotiation: the gate bounce lands on the same thread path as success, posted from both sides' threads |
| `app/_components/negotiation-actions.ts` › `markAmendmentItemDelivered` | `/` | `(computed)` | left — chat appointments/negotiation: the gate bounce lands on the same thread path as success, posted from both sides' threads |
| `app/_components/negotiation-actions.ts` › `respondAmendmentFromChat` | `/` | `(computed)` | left — chat appointments/negotiation: the gate bounce lands on the same thread path as success, posted from both sides' threads |

### app: open-shop

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/open-shop/claim-actions.ts` › `finishClaimDoor` | `/open-shop` | `(computed)`, `/open-shop`, `/vendor-dashboard/profile`, `/vendor/claim/[x]`, `/vendor/claim/[x]/finalize` | nav — claim a shop → the claim's finalize step / the shop profile — a claim flow |

### app: panood

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/panood/control/[eventId]/actions.ts` › `addEventFilm` | `/panood/control/[x]` | `(computed)` | door |
| `app/panood/control/[eventId]/actions.ts` › `addRoamZone` | `/panood/control/[x]` | `(computed)` | door |
| `app/panood/control/[eventId]/actions.ts` › `clearControlFacebookUrl` | `/panood/control/[x]` | `(computed)` | door |
| `app/panood/control/[eventId]/actions.ts` › `clearControlManualAir` | `/panood/control/[x]` | `(computed)` | door |
| `app/panood/control/[eventId]/actions.ts` › `clearControlWatchUrl` | `/panood/control/[x]` | `(computed)` | door |
| `app/panood/control/[eventId]/actions.ts` › `clearMainStage` | `/panood/control/[x]` | `(computed)` | door |
| `app/panood/control/[eventId]/actions.ts` › `createChannelJoinLink` | `/panood/control/[x]` | `(computed)` | door |
| `app/panood/control/[eventId]/actions.ts` › `cutToMainStage` | `/dashboard/[x]`, `/panood/control/[x]` | `(computed)` | left — also posted by Home's Live card — both posters must convert together, with Home's gate bounces checked |
| `app/panood/control/[eventId]/actions.ts` › `deleteHighlight` | `/panood/control/[x]` | `(computed)` | door |
| `app/panood/control/[eventId]/actions.ts` › `deleteRoamZone` | `/panood/control/[x]` | `(computed)` | door |
| `app/panood/control/[eventId]/actions.ts` › `markHighlight` | `/panood/control/[x]` | `(computed)` | door |
| `app/panood/control/[eventId]/actions.ts` › `reissueChannelJoinLink` | `/panood/control/[x]` | `(computed)` | door |
| `app/panood/control/[eventId]/actions.ts` › `removeEventFilm` | `/panood/control/[x]` | `(computed)` | door |
| `app/panood/control/[eventId]/actions.ts` › `renameRoamZone` | `/panood/control/[x]` | `(computed)` | door |
| `app/panood/control/[eventId]/actions.ts` › `saveControlFacebookUrl` | `/panood/control/[x]` | `(computed)` | door |
| `app/panood/control/[eventId]/actions.ts` › `saveControlWatchUrl` | `/panood/control/[x]` | `(computed)` | door |
| `app/panood/control/[eventId]/actions.ts` › `setControlManualAir` | `/panood/control/[x]` | `(computed)` | door |
| `app/panood/control/[eventId]/actions.ts` › `setEventQrOverlay` | `/dashboard/[x]`, `/panood/control/[x]` | `(computed)` | left — also posted by Home's Live card — both posters must convert together, with Home's gate bounces checked |
| `app/panood/control/[eventId]/actions.ts` › `setFeaturedRoamZone` | `/panood/control/[x]` | `(computed)` | door |
| `app/panood/control/[eventId]/actions.ts` › `setGuestPick` | `/dashboard/[x]`, `/panood/control/[x]` | `(computed)` | left — also posted by Home's Live card — both posters must convert together, with Home's gate bounces checked |
| `app/panood/control/[eventId]/actions.ts` › `setLowerThird` | `/dashboard/[x]`, `/panood/control/[x]` | `(computed)` | left — also posted by Home's Live card — both posters must convert together, with Home's gate bounces checked |
| `app/panood/control/[eventId]/actions.ts` › `setMonogramOverlay` | `/dashboard/[x]`, `/panood/control/[x]` | `(computed)` | left — also posted by Home's Live card — both posters must convert together, with Home's gate bounces checked |
| `app/panood/control/[eventId]/screens-actions.ts` › `addLiveScreen` | `/panood/control/[x]` | `(computed)` | door |
| `app/panood/control/[eventId]/screens-actions.ts` › `reissueLiveScreenCode` | `/panood/control/[x]` | `(computed)` | door |
| `app/panood/control/[eventId]/screens-actions.ts` › `removeLiveScreen` | `/panood/control/[x]` | `(computed)` | door |
| `app/panood/control/[eventId]/screens-actions.ts` › `renameLiveScreen` | `/panood/control/[x]` | `(computed)` | door |
| `app/panood/control/[eventId]/screens-actions.ts` › `setAllLiveScreensMode` | `/panood/control/[x]` | `(computed)` | door |
| `app/panood/control/[eventId]/screens-actions.ts` › `setLiveScreenMode` | `/panood/control/[x]` | `(computed)` | door |

### app: papic

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/papic/buy/actions.ts` › `releaseGuestDedicatedShots` | `/` | `(computed)` | left — the confirmation shows the count moved, which only exists in `?papic_release=N` |

### event: disputes

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/dashboard/[eventId]/disputes/actions.ts` › `fileForceMajeureFlag` | `/dashboard/[x]/disputes` | `/dashboard/[x]/disputes` | door |

### event: guests

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/dashboard/[eventId]/guests/[guestId]/actions.ts` › `inviteGuestByEmailAction` | `/dashboard/[x]/guests` | `(computed)`, `/dashboard/[x]` | left — bound to (event, guest) and landing on `/guests/<guest>` from the in-place card; rides the Guests actions context (lab stand-ins) — next pass |
| `app/dashboard/[eventId]/guests/[guestId]/actions.ts` › `releaseGuestClaim` | `/dashboard/[x]/guests` | `(computed)`, `/dashboard/[x]/guests/[x]` | left — bound to (event, guest) and landing on `/guests/<guest>` from the in-place card; rides the Guests actions context (lab stand-ins) — next pass |
| `app/dashboard/[eventId]/guests/[guestId]/actions.ts` › `updateGuest` | `/dashboard/[x]/guests` | `(computed)`, `/dashboard/[x]/guests` | left — the guest card's autosave already saves in place (`quiet=1` returns); the redirect is only the no-JavaScript path |
| `app/dashboard/[eventId]/guests/claims/actions.ts` › `keepGuestAction` | `/dashboard/[x]/guests/claims` | `/dashboard/[x]/guests/claims` | left — Claims' `?done=kept` landing draws the send-invite step — that state must move into the answer first (as #6975 found) |
| `app/dashboard/[eventId]/guests/claims/actions.ts` › `linkGuestAction` | `/dashboard/[x]/guests/claims` | `/dashboard/[x]/guests/claims` | left — Claims' `?done=kept` landing draws the send-invite step — that state must move into the answer first (as #6975 found) |
| `app/dashboard/[eventId]/guests/claims/actions.ts` › `removeGuestAction` | `/dashboard/[x]/guests/claims` | `/dashboard/[x]/guests/claims` | left — Claims' `?done=kept` landing draws the send-invite step — that state must move into the answer first (as #6975 found) |
| `app/dashboard/[eventId]/guests/claims/actions.ts` › `undoRequestAction` | `/dashboard/[x]/guests/claims` | `/dashboard/[x]/guests/claims` | left — Claims' `?done=kept` landing draws the send-invite step — that state must move into the answer first (as #6975 found) |
| `app/dashboard/[eventId]/guests/groups-actions.ts` › `bulkApplyRoleAndGroup` | `/dashboard/[x]/guests` | `(computed)` | door |
| `app/dashboard/[eventId]/guests/groups-actions.ts` › `createGuestGroup` | `/dashboard/[x]/guests` | `(computed)` | door |
| `app/dashboard/[eventId]/guests/groups-actions.ts` › `deleteGuestGroup` | `/dashboard/[x]/guests` | `(computed)` | left — no form posts them — the ONE Group dropdown uses `editGuestGroupInPlace` (dead redirecting twins) |
| `app/dashboard/[eventId]/guests/groups-actions.ts` › `updateGuestGroup` | `/dashboard/[x]/guests` | `(computed)` | left — no form posts them — the ONE Group dropdown uses `editGuestGroupInPlace` (dead redirecting twins) |
| `app/dashboard/[eventId]/guests/pair-actions.ts` › `unpairGuestAction` | `/dashboard/[x]/guests` | `(computed)` | left — no form posts it in the app today |

### event: hosts

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/dashboard/[eventId]/hosts/actions.ts` › `inviteHost` | `/dashboard/[x]/vendors/[x]/workspace` | `(computed)` | left — its landing shows the one-time invite link from `?token=` — in place it would never be shown |
| `app/dashboard/[eventId]/hosts/actions.ts` › `removeHost` | `/dashboard/[x]/details` | `(computed)` | door |
| `app/dashboard/[eventId]/hosts/actions.ts` › `revokeHostInvite` | `/dashboard/[x]/vendors/[x]/workspace` | `(computed)` | door |

### event: invitation

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/dashboard/[eventId]/invitation/actions.ts` › `markGuestInvitationSent` | `/dashboard/[x]/invitation` | `/dashboard/[x]/invitation` | left — bound to (event, guest) and posted through the shared invite modal / reissue confirm — next pass |
| `app/dashboard/[eventId]/invitation/actions.ts` › `reissueGuestToken` | `/dashboard/[x]/invitation` | `/dashboard/[x]/invitation` | left — bound to (event, guest) and posted through the shared invite modal / reissue confirm — next pass |
| `app/dashboard/[eventId]/invitation/actions.ts` › `updateEventSlug` | `/dashboard/[x]/invitation`, `/dashboard/[x]/launch` | `(computed)` | left — posted by the shared SlugField (Invitation and the Launch hub), which awaits it itself — next pass with both posters |
| `app/dashboard/[eventId]/invitation/actions.ts` › `updateMonogram` | `/dashboard/[x]/invitation` | `/dashboard/[x]/invitation` | door |

### event: live

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/dashboard/[eventId]/live/actions.ts` › `setWallMode` | `/dashboard/[x]/live` | `/dashboard/[x]` | nav — gate only: not a host of the event → its Home; the save returns in place |
| `app/dashboard/[eventId]/live/actions.ts` › `toggleFlashAutoWall` | `/dashboard/[x]/live` | `/dashboard/[x]` | nav — gate only: not a host of the event → its Home; the save returns in place |

### event: manpower

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/dashboard/[eventId]/manpower/host-actions.ts` › `cancelGigFromHost` | `/dashboard/[x]/manpower` | `/dashboard/[x]/manpower` | door |

### event: monogram

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/dashboard/[eventId]/monogram/studio-actions.ts` › `clearStudioAction` | `/dashboard/[x]/monogram` | `/dashboard/[x]/monogram[x]` | door |
| `app/dashboard/[eventId]/monogram/studio-actions.ts` › `saveStudioAction` | `/dashboard/[x]/monogram` | `/dashboard/[x]/monogram[x]` | door |
| `app/dashboard/[eventId]/monogram/upload-actions.ts` › `clearUploadedMarkAction` | `/dashboard/[x]/monogram` | `/dashboard/[x]/monogram[x]` | door |

### event: orders

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/dashboard/[eventId]/orders/actions.ts` › `logPayment` | `/dashboard/[x]/orders` | `/dashboard/[x]/orders/[x]` | left — dead — no form posts it (Budget's own logPayment is the live one) |

### event: schedule

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/dashboard/[eventId]/schedule/activity-picks-actions.ts` › `applyActivityPicks` | `/dashboard/[x]/schedule` | `(computed)` | door |
| `app/dashboard/[eventId]/schedule/activity-picks-actions.ts` › `toggleActivityPick` | `/dashboard/[x]/schedule` | `(computed)` | door |
| `app/dashboard/[eventId]/schedule/question-answers-actions.ts` › `saveHostAnswers` | `/dashboard/[x]/schedule` | `/dashboard/[x]/schedule` | door |
| `app/dashboard/[eventId]/schedule/stage-note-actions.ts` › `sendStageNoteFromEvent` | `/dashboard/[x]/schedule` | `/dashboard/[x]/schedule` | door |

### event: sponsors

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/dashboard/[eventId]/sponsors/actions.ts` › `addSponsor` | `/dashboard/[x]/sponsors` | `/dashboard/[x]/sponsors` | door |
| `app/dashboard/[eventId]/sponsors/actions.ts` › `markResponse` | `/dashboard/[x]/sponsors` | `/dashboard/[x]/sponsors` | door |
| `app/dashboard/[eventId]/sponsors/actions.ts` › `removeSponsor` | `/dashboard/[x]/sponsors` | `/dashboard/[x]/sponsors` | door |
| `app/dashboard/[eventId]/sponsors/actions.ts` › `sendInvitation` | `/dashboard/[x]/sponsors` | `/dashboard/[x]/sponsors` | door |
| `app/dashboard/[eventId]/sponsors/actions.ts` › `updateSponsor` | `/dashboard/[x]/sponsors` | `/dashboard/[x]/sponsors` | door |

### event: studio/mood-board

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/dashboard/[eventId]/studio/mood-board/dress-code-actions.ts` › `updateDressCode` | `/dashboard/[x]/website/editor` | `/dashboard/[x]/studio/mood-board` | left — rides the Mood Board actions context and the Maker's dress-code panel — next pass |
| `app/dashboard/[eventId]/studio/mood-board/dress-code-actions.ts` › `updateDressCodeLists` | `/dashboard/[x]/studio/mood-board` | `(computed)` | left — rides the Mood Board actions context and the Maker's dress-code panel — next pass |

### event: studio/panood

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/dashboard/[eventId]/studio/panood/setup/actions.ts` › `clearPanoodFacebookUrl` | `/dashboard/[x]/studio/panood/setup` | `/dashboard/[x]/studio/panood/setup` | door |
| `app/dashboard/[eventId]/studio/panood/setup/actions.ts` › `clearPanoodWatchUrl` | `/dashboard/[x]/studio/panood/setup` | `/dashboard/[x]/studio/panood/setup` | door |
| `app/dashboard/[eventId]/studio/panood/setup/actions.ts` › `savePanoodFacebookUrl` | `/dashboard/[x]/studio/panood/setup` | `/dashboard/[x]/studio/panood/setup` | door |
| `app/dashboard/[eventId]/studio/panood/setup/actions.ts` › `savePanoodWatchUrl` | `/dashboard/[x]/studio/panood/setup` | `/dashboard/[x]/studio/panood/setup` | door |

### event: studio/papic

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/dashboard/[eventId]/studio/papic/actions.ts` › `activatePapicLimited` | `/dashboard/[x]` | `(computed)` | left — dead on purpose — no form posts them; kept to REFUSE an old page's form with words (`lib/papic-sells-only-credits.test.ts`) |
| `app/dashboard/[eventId]/studio/papic/actions.ts` › `clearMomentChallengeAction` | `/dashboard/[x]/studio/papic/run-of-show` | `(computed)` | door |
| `app/dashboard/[eventId]/studio/papic/actions.ts` › `purchasePapicCameras` | `/dashboard/[x]` | `(computed)` | left — dead on purpose — no form posts them; kept to REFUSE an old page's form with words (`lib/papic-sells-only-credits.test.ts`) |
| `app/dashboard/[eventId]/studio/papic/actions.ts` › `purchasePapicExtras` | `/dashboard/[x]` | `(computed)` | left — dead on purpose — no form posts them; kept to REFUSE an old page's form with words (`lib/papic-sells-only-credits.test.ts`) |
| `app/dashboard/[eventId]/studio/papic/actions.ts` › `setPapicStyle` | `/dashboard/[x]` | `(computed)` | nav — the no-JavaScript fallback only — every tap is answered in place by `setPapicStyleInPlace` (style-picker.tsx) |
| `app/dashboard/[eventId]/studio/papic/moderation/actions.ts` › `approveScreenedCapture` | `/`, `/dashboard/[x]/studio/papic/moderation` | `(computed)`, `/dashboard/[x]` | door |
| `app/dashboard/[eventId]/studio/papic/moderation/actions.ts` › `blockUploader` | `/`, `/dashboard/[x]/studio/papic/moderation` | `(computed)`, `/dashboard/[x]` | door |
| `app/dashboard/[eventId]/studio/papic/moderation/actions.ts` › `deletePhotoForever` | `/`, `/dashboard/[x]/studio/papic/moderation` | `(computed)`, `/dashboard/[x]` | door |
| `app/dashboard/[eventId]/studio/papic/moderation/actions.ts` › `reportCapture` | `/`, `/dashboard/[x]/studio/papic/moderation` | `(computed)`, `/dashboard/[x]` | door |
| `app/dashboard/[eventId]/studio/papic/moderation/actions.ts` › `setCaptureHidden` | `/`, `/dashboard/[x]/studio/papic/moderation` | `(computed)`, `/dashboard/[x]` | door |
| `app/dashboard/[eventId]/studio/papic/moderation/actions.ts` › `setSeatPhotoHidden` | `/`, `/dashboard/[x]/studio/papic/moderation` | `(computed)`, `/dashboard/[x]` | door |
| `app/dashboard/[eventId]/studio/papic/moderation/actions.ts` › `unblockUploader` | `/`, `/dashboard/[x]/studio/papic/moderation` | `(computed)`, `/dashboard/[x]` | door |
| `app/dashboard/[eventId]/studio/papic/recap/actions.ts` › `publishRecap` | `/dashboard/[x]/studio/papic/recap` | `/dashboard/[x]` | nav — gate only: not a couple on the event → its Home; publish returns in place |
| `app/dashboard/[eventId]/studio/papic/recap/actions.ts` › `setRecapSocialFeatureAllowed` | `/dashboard/[x]/studio/papic/recap` | `/dashboard/[x]` | nav — gate only: not a couple on the event → its Home; the switch returns in place |
| `app/dashboard/[eventId]/studio/papic/recap/actions.ts` › `unpublishRecap` | `/dashboard/[x]/studio/papic/recap` | `/dashboard/[x]` | nav — gate only: not a couple on the event → its Home; take-down returns in place |
| `app/dashboard/[eventId]/studio/papic/vendor-visibility-actions.ts` › `setVendorCapturesHidden` | `/` | `(computed)` | door |

### event: studio/patiktok

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/dashboard/[eventId]/studio/patiktok/actions.ts` › `disconnectPatiktokTiktok` | `/dashboard/[x]/studio/patiktok` | `/dashboard/[x]/studio/patiktok` | door |
| `app/dashboard/[eventId]/studio/patiktok/actions.ts` › `savePatiktokBoothTemplates` | `/dashboard/[x]`, `/dashboard/[x]/studio/patiktok`, `/dashboard/[x]/studio/patiktok/booth` | `/dashboard/[x]`, `/dashboard/[x]/studio/patiktok/booth` | door |
| `app/dashboard/[eventId]/studio/patiktok/actions.ts` › `submitPatiktokRender` | `/dashboard/[x]/studio/patiktok` | `/dashboard/[x]/studio/patiktok` | door |

### event: studio/photo-delivery

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/dashboard/[eventId]/studio/photo-delivery/actions.ts` › `disconnectPhotoDelivery` | `/dashboard/[x]/studio/photo-delivery` | `(computed)`, `/dashboard/[x]/studio/photo-delivery` | door |
| `app/dashboard/[eventId]/studio/photo-delivery/actions.ts` › `releasePhotoDelivery` | `/dashboard/[x]/studio/photo-delivery` | `(computed)`, `/dashboard/[x]/studio/photo-delivery` | door |
| `app/dashboard/[eventId]/studio/photo-delivery/actions.ts` › `setPhotoDeliverySyncModeAuto` | `/dashboard/[x]/studio/photo-delivery` | `(computed)`, `/dashboard/[x]/studio/photo-delivery` | door |
| `app/dashboard/[eventId]/studio/photo-delivery/actions.ts` › `setPhotoDeliverySyncModeManual` | `/dashboard/[x]/studio/photo-delivery` | `(computed)`, `/dashboard/[x]/studio/photo-delivery` | door |

### event: studio/save-the-date

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/dashboard/[eventId]/studio/save-the-date/actions.ts` › `cancelScheduledLaunch` | `/dashboard/[x]/launch`, `/dashboard/[x]/studio/save-the-date` | `/dashboard/[x]/studio/save-the-date` | nav — gate only: a draft account → sign up, not this couple's event → `?std_error=not-found`; cancelling returns in place (save.run) |
| `app/dashboard/[eventId]/studio/save-the-date/actions.ts` › `chooseRevealTemplate` | `/dashboard/[x]` | `/dashboard/[x]/studio/save-the-date` | nav — gate only: a draft account → sign up, not this couple's event → `?std_error=not-found`; the pick returns in place (save.run) |
| `app/dashboard/[eventId]/studio/save-the-date/actions.ts` › `launchSaveTheDate` | `/dashboard/[x]/launch`, `/dashboard/[x]/studio/save-the-date` | `/dashboard/[x]/studio/save-the-date` | nav — gate only: a draft account → sign up, not this couple's event → `?std_error=not-found`; launch returns in place (save.run) |
| `app/dashboard/[eventId]/studio/save-the-date/actions.ts` › `saveAllStdContent` | `/dashboard/[x]/studio/save-the-date` | `/dashboard/[x]/studio/save-the-date` | left — called with an object, not FormData, by the STD builder — needs a result answer instead of its redirect |
| `app/dashboard/[eventId]/studio/save-the-date/actions.ts` › `scheduleSaveTheDateLaunch` | `/dashboard/[x]/launch`, `/dashboard/[x]/studio/save-the-date` | `/dashboard/[x]/studio/save-the-date` | nav — gate only: a draft account → sign up, not this couple's event → `?std_error=not-found`; scheduling returns in place (save.run) |
| `app/dashboard/[eventId]/studio/save-the-date/wax-actions.ts` › `saveWaxSeal` | `/dashboard/[x]/studio/save-the-date/stamp` | `/dashboard/[x]/studio/save-the-date/stamp[x]` | door |

### event: vendors

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/dashboard/[eventId]/vendors/[vendorId]/review/actions.ts` › `coupleConfirmReceived` | `/dashboard/[x]/vendors/[x]/review`, `/dashboard/[x]/vendors/[x]/workspace` | `/dashboard/[x]`, `/dashboard/[x]/vendors/[x]/review` | door |
| `app/dashboard/[eventId]/vendors/[vendorId]/review/actions.ts` › `coupleReportNonDelivery` | `/dashboard/[x]/vendors/[x]/review`, `/dashboard/[x]/vendors/[x]/workspace` | `/dashboard/[x]`, `/dashboard/[x]/vendors/[x]/review` | door |
| `app/dashboard/[eventId]/vendors/[vendorId]/review/actions.ts` › `recommendVendor` | `/dashboard/[x]/vendors/[x]/review` | `/dashboard/[x]/vendors/[x]/review` | door |
| `app/dashboard/[eventId]/vendors/[vendorId]/review/actions.ts` › `submitReviewAppeal` | `/dashboard/[x]/vendors/[x]/review` | `/dashboard/[x]/vendors/[x]/review` | left — its landing draws "appeal filed" from `?appeal_filed=1` |

### event: website

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/dashboard/[eventId]/website/colors/actions.ts` › `updateSiteColors` | `/dashboard/[x]/details`, `/dashboard/[x]/website/editor` | `/dashboard/[x]/website/colors` | left — the Event Hub Maker saves through its own buffered draft pipeline (`SafeForm`, `draft=1` returns without redirecting); the redirect is the legacy standalone page's path |
| `app/dashboard/[eventId]/website/editor/actions.ts` › `setLaunchPhase` | `/dashboard/[x]`, `/dashboard/[x]/launch`, `/dashboard/[x]/website/editor` | `(computed)` | left — the Event Hub Maker saves through its own buffered draft pipeline (`SafeForm`, `draft=1` returns without redirecting); the redirect is the legacy standalone page's path |
| `app/dashboard/[eventId]/website/hero-photo/actions.ts` › `uploadHeroPhoto` | `/dashboard/[x]/launch`, `/dashboard/[x]/website/editor`, `/dashboard/[x]/website/hero-photo` | `(computed)` | left — the Event Hub Maker saves through its own buffered draft pipeline (`SafeForm`, `draft=1` returns without redirecting); the redirect is the legacy standalone page's path |
| `app/dashboard/[eventId]/website/our-photos/actions.ts` › `updateOurPhotos` | `/dashboard/[x]/website/editor`, `/dashboard/[x]/website/our-photos` | `/dashboard/[x]/website/our-photos` | left — the Event Hub Maker saves through its own buffered draft pipeline (`SafeForm`, `draft=1` returns without redirecting); the redirect is the legacy standalone page's path |
| `app/dashboard/[eventId]/website/our-story/actions.ts` › `loveStoryMomentAction` | `/dashboard/[x]/website/our-story` | `(computed)` | left — the Event Hub Maker saves through its own buffered draft pipeline (`SafeForm`, `draft=1` returns without redirecting); the redirect is the legacy standalone page's path |
| `app/dashboard/[eventId]/website/our-story/actions.ts` › `updateOurStory` | `/dashboard/[x]/launch`, `/dashboard/[x]/website/editor`, `/dashboard/[x]/website/our-story` | `/dashboard/[x]/website/our-story` | left — the Event Hub Maker saves through its own buffered draft pipeline (`SafeForm`, `draft=1` returns without redirecting); the redirect is the legacy standalone page's path |
| `app/dashboard/[eventId]/website/privacy/actions.ts` › `setShowcaseConsent` | `/dashboard/[x]/website/privacy` | `/dashboard/[x]/website/privacy` | left — the Event Hub Maker saves through its own buffered draft pipeline (`SafeForm`, `draft=1` returns without redirecting); the redirect is the legacy standalone page's path |
| `app/dashboard/[eventId]/website/site-chrome/actions.ts` › `updateSiteChrome` | `/dashboard/[x]/website/editor`, `/dashboard/[x]/website/site-chrome` | `/dashboard/[x]/studio/website-pro`, `/dashboard/[x]/website/site-chrome` | left — the Event Hub Maker saves through its own buffered draft pipeline (`SafeForm`, `draft=1` returns without redirecting); the redirect is the legacy standalone page's path |
| `app/dashboard/[eventId]/website/special-message/actions.ts` › `updateSpecialMessage` | `/dashboard/[x]/details`, `/dashboard/[x]/launch`, `/dashboard/[x]/website/editor` | `/dashboard/[x]/website/special-message` | left — the Event Hub Maker saves through its own buffered draft pipeline (`SafeForm`, `draft=1` returns without redirecting); the redirect is the legacy standalone page's path |
| `app/dashboard/[eventId]/website/stories/actions.ts` › `setChapterOnMyDay` | `/dashboard/[x]/website/stories` | `/dashboard/[x]`, `/dashboard/[x]/website/stories` | left — the Event Hub Maker saves through its own buffered draft pipeline (`SafeForm`, `draft=1` returns without redirecting); the redirect is the legacy standalone page's path |
| `app/dashboard/[eventId]/website/what-to-bring/actions.ts` › `updateWhatToBring` | `/dashboard/[x]/website/editor` | `/dashboard/[x]/website/what-to-bring` | left — the Event Hub Maker saves through its own buffered draft pipeline (`SafeForm`, `draft=1` returns without redirecting); the redirect is the legacy standalone page's path |
| `app/dashboard/[eventId]/website/widgets/actions.ts` › `addCustomSection` | `/dashboard/[x]/website/editor` | `(computed)`, `/dashboard/[x]/studio/website-pro` | left — the Event Hub Maker saves through its own buffered draft pipeline (`SafeForm`, `draft=1` returns without redirecting); the redirect is the legacy standalone page's path |
| `app/dashboard/[eventId]/website/widgets/actions.ts` › `moveWidgetDown` | `/dashboard/[x]/website/editor`, `/dashboard/[x]/website/widgets` | `(computed)` | left — the Event Hub Maker saves through its own buffered draft pipeline (`SafeForm`, `draft=1` returns without redirecting); the redirect is the legacy standalone page's path |
| `app/dashboard/[eventId]/website/widgets/actions.ts` › `moveWidgetUp` | `/dashboard/[x]/website/editor`, `/dashboard/[x]/website/widgets` | `(computed)` | left — the Event Hub Maker saves through its own buffered draft pipeline (`SafeForm`, `draft=1` returns without redirecting); the redirect is the legacy standalone page's path |
| `app/dashboard/[eventId]/website/widgets/actions.ts` › `saveCustomSection` | `/dashboard/[x]/website/editor` | `(computed)`, `/dashboard/[x]/studio/website-pro` | left — the Event Hub Maker saves through its own buffered draft pipeline (`SafeForm`, `draft=1` returns without redirecting); the redirect is the legacy standalone page's path |
| `app/dashboard/[eventId]/website/widgets/actions.ts` › `setSectionMode` | `/dashboard/[x]/website/editor`, `/dashboard/[x]/website/widgets` | `(computed)` | left — the Event Hub Maker saves through its own buffered draft pipeline (`SafeForm`, `draft=1` returns without redirecting); the redirect is the legacy standalone page's path |
| `app/dashboard/[eventId]/website/widgets/actions.ts` › `setWidgetBackground` | `/dashboard/[x]/website/editor` | `(computed)` | left — the Event Hub Maker saves through its own buffered draft pipeline (`SafeForm`, `draft=1` returns without redirecting); the redirect is the legacy standalone page's path |
| `app/dashboard/[eventId]/website/widgets/actions.ts` › `setWidgetCrop` | `/dashboard/[x]/website/editor` | `(computed)` | left — the Event Hub Maker saves through its own buffered draft pipeline (`SafeForm`, `draft=1` returns without redirecting); the redirect is the legacy standalone page's path |
| `app/dashboard/[eventId]/website/widgets/actions.ts` › `setWidgetMotion` | `/dashboard/[x]/website/editor` | `(computed)`, `/dashboard/[x]/studio/website-pro` | left — the Event Hub Maker saves through its own buffered draft pipeline (`SafeForm`, `draft=1` returns without redirecting); the redirect is the legacy standalone page's path |
| `app/dashboard/[eventId]/website/widgets/actions.ts` › `toggleWidgetVisibility` | `/dashboard/[x]/website/editor`, `/dashboard/[x]/website/widgets` | `(computed)` | left — the Event Hub Maker saves through its own buffered draft pipeline (`SafeForm`, `draft=1` returns without redirecting); the redirect is the legacy standalone page's path |

### guest: [slug]

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/[slug]/actions.ts` › `linkThisSeatAction` | `/[x]` | `(computed)` | left — the not-signed-in bounce and the success both land on bare `/<slug>` — cannot be told apart |
| `app/[slug]/actions.ts` › `setGuestFaceBlock` | `/[x]` | `/[x]` | left — bound to (event, guest, target) — needs a guest-bound door wrapper; next pass |
| `app/[slug]/actions.ts` › `setGuestScanTracking` | `/[x]` | `/[x]` | left — bound to (event, guest, target) — needs a guest-bound door wrapper; next pass |
| `app/[slug]/actions.ts` › `startAccountSaveAction` | `/[x]` | `(computed)` | nav — Save to my account → the Apple/Google sign-in hop (or the app's native sign-in) — a sign-in hop, never a same-screen save |
| `app/[slug]/actions.ts` › `submitRsvp` | `/[x]` | `(computed)`, `/[x]` | nav — RSVP reply commit → the reply's thank-you (`/<slug>?rsvp=<outcome>` or the invite's door 03) — the outcome in the URL draws the thank-you, so staying would lose it |
| `app/[slug]/actions.ts` › `withdrawFaceConsent` | `/[x]` | `(computed)` | left — bound to (event, guest, target) — needs a guest-bound door wrapper; next pass |
| `app/[slug]/invite/actions.ts` › `submitInviteReply` | `/[x]/invite/reply` | `(computed)` | nav — invite door 02 (reply) → door 03, the thank-you (`/invite/enter?rsvp=`) — a wizard step |
| `app/[slug]/welcome/actions.ts` › `confirmPlusOneName` | `/[x]/welcome` | `/[x]`, `/[x]/welcome` | nav — +1 welcome step → the event page (or `?pass=1`, their pass) — a wizard step that claims the seat |

### lib

| file › action | posted from | lands on | now |
|---|---|---|---|
| `lib/account-security-actions.ts` › `changePassword` | `/dashboard/profile` | `(computed)` | left — the only feedback is the `?…=1` banner on a server page (change password also carries a one-use Turnstile token and three password boxes) |
| `lib/account-security-actions.ts` › `signOutOtherDevices` | `/dashboard/profile` | `(computed)` | left — the only feedback is the `?…=1` banner on a server page (change password also carries a one-use Turnstile token and three password boxes) |
| `lib/chat-actions.ts` › `acceptInquiry` | `/vendor-dashboard/customers`, `/vendor-dashboard/messages/[x]` | `(computed)` | left — posted from five supplier surfaces (Today, Customers, the roster, event lines, the thread) and the supplier lab — one pass for all of them |
| `lib/chat-actions.ts` › `archiveThread` | `/` | `(computed)` | door |
| `lib/chat-actions.ts` › `blockUser` | `/` | `(computed)` | door |
| `lib/chat-actions.ts` › `declineInquiry` | `/vendor-dashboard/customers`, `/vendor-dashboard/messages/[x]` | `(computed)` | left — posted from five supplier surfaces (Today, Customers, the roster, event lines, the thread) and the supplier lab — one pass for all of them |
| `lib/chat-actions.ts` › `reportUser` | `/` | `(computed)` | door |
| `lib/chat-actions.ts` › `sendChatMessage` | `/dashboard/[x]/messages/[x]`, `/dashboard/[x]/vendors`, `/vendor-dashboard/messages/[x]` | `(computed)` | left — the composer's JavaScript path already saves in place (it strips `return_to`); the redirect is only the no-JavaScript fallback |
| `lib/chat-actions.ts` › `unarchiveThread` | `/` | `(computed)` | door |
| `lib/chat-actions.ts` › `unblockUser` | `/` | `(computed)` | door |
| `lib/notification-actions.ts` › `markAllNotificationsRead` | `/`, `/admin/settings` | `(computed)` | left — the shared list already marks read optimistically on its own submit; also posted from admin |
| `lib/notification-actions.ts` › `markNotificationRead` | `/`, `/admin/settings`, `/dashboard/[x]` | `(computed)` | left — the shared list already marks read optimistically on its own submit; also posted from admin |
| `lib/tour-actions.ts` › `restartTour` | `/dashboard/profile` | `/dashboard/profile` | left — the only feedback is the `?…=1` banner on a server page (change password also carries a one-use Turnstile token and three password boxes) |

### supplier: activities

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/vendor-dashboard/activities/actions.ts` › `addActivity` | `/vendor-dashboard/activities` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/activities/actions.ts` › `reorderActivity` | `/vendor-dashboard/activities` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/activities/actions.ts` › `toggleActivityOffered` | `/vendor-dashboard/activities` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/activities/actions.ts` › `updateActivity` | `/vendor-dashboard/activities` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/activities/question-actions.ts` › `addQuestion` | `/vendor-dashboard/activities` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/activities/question-actions.ts` › `toggleQuestionAsked` | `/vendor-dashboard/activities` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/activities/question-actions.ts` › `updateQuestion` | `/vendor-dashboard/activities` | `(computed)`, `/vendor-dashboard` | door |

### supplier: attributes

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/vendor-dashboard/attributes/actions.ts` › `removeVendorServiceAttribute` | `/vendor-dashboard/attributes` | `/vendor-dashboard`, `/vendor-dashboard/attributes` | door |
| `app/vendor-dashboard/attributes/actions.ts` › `saveVendorServiceAttribute` | `/vendor-dashboard/attributes` | `/vendor-dashboard`, `/vendor-dashboard/attributes` | door |

### supplier: calendar

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/vendor-dashboard/calendar/actions.ts` › `addManualBlock` | `/vendor-dashboard`, `/vendor-dashboard/customers` | `/vendor-dashboard`, `/vendor-dashboard/[x]`, `/vendor-dashboard/calendar/[x]`, `/vendor-dashboard/customers` | door |
| `app/vendor-dashboard/calendar/actions.ts` › `createCalendar` | `/vendor-dashboard/customers` | `/vendor-dashboard`, `/vendor-dashboard/[x]`, `/vendor-dashboard/calendar`, `/vendor-dashboard/calendar/[x]`, `/vendor-dashboard/customers` | door |
| `app/vendor-dashboard/calendar/actions.ts` › `editCalendar` | `/vendor-dashboard/customers` | `/vendor-dashboard`, `/vendor-dashboard/[x]`, `/vendor-dashboard/calendar`, `/vendor-dashboard/calendar/[x]`, `/vendor-dashboard/customers` | door |
| `app/vendor-dashboard/calendar/actions.ts` › `importExternalClient` | `/vendor-dashboard/customers` | `/vendor-dashboard`, `/vendor-dashboard/[x]`, `/vendor-dashboard/calendar/[x]`, `/vendor-dashboard/customers` | nav — adds an outside booking → /vendor-dashboard/customers?notice=client_imported&block=<new id>#outside opens THAT new row with "Send their code" (owner 2026-10-28: the one-time code is offered right after Add outside booking) — create → open the new thing |
| `app/vendor-dashboard/calendar/actions.ts` › `notifyWaitlistSlot` | `/vendor-dashboard/customers` | `/vendor-dashboard`, `/vendor-dashboard/[x]`, `/vendor-dashboard/calendar/[x]`, `/vendor-dashboard/customers` | door |
| `app/vendor-dashboard/calendar/actions.ts` › `pickWaitlistCouple` | `/vendor-dashboard/customers` | `/vendor-dashboard`, `/vendor-dashboard/[x]`, `/vendor-dashboard/calendar/[x]`, `/vendor-dashboard/customers` | door |
| `app/vendor-dashboard/calendar/actions.ts` › `reassignCategoryPool` | `/vendor-dashboard/customers` | `/vendor-dashboard`, `/vendor-dashboard/[x]`, `/vendor-dashboard/calendar/[x]`, `/vendor-dashboard/customers` | door |
| `app/vendor-dashboard/calendar/actions.ts` › `removeBlock` | `/vendor-dashboard/customers` | `/vendor-dashboard`, `/vendor-dashboard/[x]`, `/vendor-dashboard/calendar/[x]`, `/vendor-dashboard/customers` | door |
| `app/vendor-dashboard/calendar/actions.ts` › `setCalendarDayState` | `/vendor-dashboard/customers` | `/vendor-dashboard`, `/vendor-dashboard/[x]`, `/vendor-dashboard/calendar/[x]`, `/vendor-dashboard/customers` | door |
| `app/vendor-dashboard/calendar/actions.ts` › `setServiceHalls` | `/vendor-dashboard/services/[x]` | `/vendor-dashboard`, `/vendor-dashboard/[x]`, `/vendor-dashboard/calendar/[x]`, `/vendor-dashboard/customers`, `/vendor-dashboard/shop` | door |
| `app/vendor-dashboard/calendar/actions.ts` › `updatePoolCapacity` | `/vendor-dashboard/customers` | `/vendor-dashboard`, `/vendor-dashboard/[x]`, `/vendor-dashboard/calendar/[x]`, `/vendor-dashboard/customers` | door |
| `app/vendor-dashboard/calendar/actions.ts` › `updateWaitlistSettings` | `/vendor-dashboard/customers` | `/vendor-dashboard`, `/vendor-dashboard/[x]`, `/vendor-dashboard/calendar/[x]`, `/vendor-dashboard/customers` | door |

### supplier: clients

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/vendor-dashboard/clients/[eventId]/actions.ts` › `createClientNote` | `/vendor-dashboard/clients/[x]` | `(computed)`, `/vendor-dashboard`, `/vendor-dashboard/clients` | door |
| `app/vendor-dashboard/clients/[eventId]/actions.ts` › `createVendorChallengeAction` | `/vendor-dashboard/clients/[x]` | `/vendor-dashboard`, `/vendor-dashboard/clients` | door |
| `app/vendor-dashboard/clients/[eventId]/actions.ts` › `deleteClientNote` | `/vendor-dashboard/clients/[x]` | `(computed)`, `/vendor-dashboard/clients` | door |
| `app/vendor-dashboard/clients/[eventId]/actions.ts` › `suggestScheduleChange` | `/vendor-dashboard/clients/[x]` | `(computed)`, `/vendor-dashboard`, `/vendor-dashboard/clients` | left — its main caller already saves in place (`quiet=1`) and needs the structured answer; only the no-JS call-time form redirects |
| `app/vendor-dashboard/clients/[eventId]/actions.ts` › `toggleClientNoteDone` | `/vendor-dashboard/clients/[x]` | `(computed)`, `/vendor-dashboard/clients` | door |
| `app/vendor-dashboard/clients/[eventId]/actions.ts` › `vendorAcknowledgeDeposit` | `/vendor-dashboard/clients/[x]` | `(computed)` | left — also posted from Today, where the redirect deliberately opens the client; the reject path lands on bare `/vendor-dashboard` |
| `app/vendor-dashboard/clients/[eventId]/actions.ts` › `vendorAgreeToDeletion` | `/vendor-dashboard` | `(computed)` | left — pressed on the supplier's Today and land on bare `/vendor-dashboard?…`, which the reader treats as a gate bounce |
| `app/vendor-dashboard/clients/[eventId]/actions.ts` › `vendorAgreeToLock` | `/vendor-dashboard/clients/[x]`, `/vendor-dashboard/messages/[x]` | `(computed)` | left — `?lock_agree=hall_taken&taken=…&free=…` drives the "offer free halls" step on the landing — multi-step state |
| `app/vendor-dashboard/clients/[eventId]/actions.ts` › `vendorAnswerDateChange` | `/vendor-dashboard` | `(computed)` | left — pressed on the supplier's Today and land on bare `/vendor-dashboard?…`, which the reader treats as a gate bounce |
| `app/vendor-dashboard/clients/[eventId]/actions.ts` › `vendorAskForPayment` | `/vendor-dashboard/clients/[x]` | `(computed)`, `/vendor-dashboard`, `/vendor-dashboard/clients` | door |
| `app/vendor-dashboard/clients/[eventId]/actions.ts` › `vendorDeclineDeletion` | `/vendor-dashboard` | `(computed)` | left — pressed on the supplier's Today and land on bare `/vendor-dashboard?…`, which the reader treats as a gate bounce |
| `app/vendor-dashboard/clients/[eventId]/actions.ts` › `vendorDeclineLock` | `/vendor-dashboard/clients/[x]`, `/vendor-dashboard/messages/[x]` | `(computed)` | left — `?lock_agree=hall_taken&taken=…&free=…` drives the "offer free halls" step on the landing — multi-step state |
| `app/vendor-dashboard/clients/[eventId]/actions.ts` › `vendorMarkServiceComplete` | `/vendor-dashboard/clients/[x]` | `(computed)`, `/vendor-dashboard` | left — also posted from Today, where the redirect deliberately opens the client; the reject path lands on bare `/vendor-dashboard` |
| `app/vendor-dashboard/clients/[eventId]/actions.ts` › `vendorPostHandover` | `/vendor-dashboard/clients/[x]` | `(computed)`, `/vendor-dashboard`, `/vendor-dashboard/clients` | door |
| `app/vendor-dashboard/clients/[eventId]/actions.ts` › `vendorRaiseChangeOrder` | `/vendor-dashboard/clients/[x]` | `(computed)`, `/vendor-dashboard`, `/vendor-dashboard/clients` | door |
| `app/vendor-dashboard/clients/[eventId]/actions.ts` › `vendorRejectDeposit` | `/vendor-dashboard/clients/[x]` | `(computed)`, `/vendor-dashboard` | left — also posted from Today, where the redirect deliberately opens the client; the reject path lands on bare `/vendor-dashboard` |
| `app/vendor-dashboard/clients/[eventId]/actions.ts` › `vendorRespondChangeOrder` | `/vendor-dashboard/clients/[x]` | `(computed)`, `/vendor-dashboard/clients` | door |
| `app/vendor-dashboard/clients/[eventId]/actions.ts` › `vendorWithdrawChangeOrder` | `/vendor-dashboard/clients/[x]` | `(computed)`, `/vendor-dashboard/clients` | door |
| `app/vendor-dashboard/clients/[eventId]/actions.ts` › `vendorWithdrawPaymentAsk` | `/vendor-dashboard/clients/[x]` | `(computed)`, `/vendor-dashboard/clients` | door |
| `app/vendor-dashboard/clients/[eventId]/production-sheet/actions.ts` › `addPortionRule` | `/vendor-dashboard/clients/[x]/production-sheet` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/clients/[eventId]/production-sheet/actions.ts` › `deletePortionRule` | `/vendor-dashboard/clients/[x]/production-sheet` | `(computed)` | door |

### supplier: contracts

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/vendor-dashboard/contracts/actions.ts` › `cancelContract` | `/vendor-dashboard/contracts/[x]` | `/vendor-dashboard` | door |
| `app/vendor-dashboard/contracts/actions.ts` › `publishContractToCouple` | `/vendor-dashboard/contracts/[x]` | `/vendor-dashboard` | door |

### supplier: creators

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/vendor-dashboard/creators/actions.ts` › `sendCreatorOffer` | `/vendor-dashboard/creators` | `(computed)`, `/vendor-dashboard` | door |

### supplier: invite

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/vendor-dashboard/invite/actions.ts` › `issueLockedQr` | `/vendor-dashboard/invite` | `/vendor-dashboard`, `/vendor-dashboard/invite` | nav — mints a one-use Booked QR → /vendor-dashboard/invite?mode=locked&issued=<token> draws THAT new code to show the couple (create → open the new thing); its delete mode (void_token) already answers in place and never redirects |

### supplier: lines

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/vendor-dashboard/lines/actions.ts` › `attachLineToActivity` | `/vendor-dashboard/lines` | `(computed)`, `/vendor-dashboard/verify` | door |
| `app/vendor-dashboard/lines/actions.ts` › `deleteLine` | `/vendor-dashboard/lines` | `(computed)`, `/vendor-dashboard/verify` | door |
| `app/vendor-dashboard/lines/actions.ts` › `updateLine` | `/vendor-dashboard/lines` | `(computed)`, `/vendor-dashboard/verify` | door |

### supplier: manpower

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/vendor-dashboard/manpower/actions.ts` › `postManpowerGig` | `/dashboard/[x]/manpower` | `/dashboard`, `/dashboard/[x]/manpower` | left — posted from the couple's Manpower page, and the action asks no limited-helper area — choosing one is an owner call |

### supplier: messages

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/vendor-dashboard/messages/[threadId]/outcome-actions.ts` › `recordInquiryOutcome` | `/vendor-dashboard/messages/[x]` | `(computed)`, `/vendor-dashboard`, `/vendor-dashboard/messages` | door |
| `app/vendor-dashboard/messages/[threadId]/proposal-actions.ts` › `sendCustomProposalFromChat` | `/` | `(computed)`, `/vendor-dashboard/messages` | nav — send a quote → the thread with `?notice=proposal_sent…` — the supplier_quote funnel's 'sent' step reads that URL (lib/telemetry/flows.ts) and the maker closes |
| `app/vendor-dashboard/messages/[threadId]/proposal-actions.ts` › `sendProposalFromChat` | `/vendor-dashboard/messages/[x]` | `(computed)`, `/vendor-dashboard/messages` | nav — send a quote → the thread with `?notice=proposal_sent|proposal_sent_no_card` — the outcome banner (incl. 'the in-chat card didn’t post') is the answer (same as sendProposal) |

### supplier: on-the-day

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/vendor-dashboard/on-the-day/live/[eventId]/_components/stage-notes-actions.ts` › `markStageNoteSeen` | `/vendor-dashboard/on-the-day/live/[x]` | `/vendor-dashboard/on-the-day`, `/vendor-dashboard/on-the-day/live/[x]${flash ` | left — were blocked by the door's event gate (now `false` for supplier doors) — ready for the next pass |
| `app/vendor-dashboard/on-the-day/live/[eventId]/_components/stage-notes-actions.ts` › `sendStageNote` | `/vendor-dashboard/on-the-day/live/[x]` | `/vendor-dashboard/on-the-day`, `/vendor-dashboard/on-the-day/live/[x]${flash ` | left — were blocked by the door's event gate (now `false` for supplier doors) — ready for the next pass |

### supplier: packages

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/vendor-dashboard/packages/actions.ts` › `savePackage` | `/vendor-dashboard/packages` | `/vendor-dashboard` | nav — its only redirects are the gates (signed out → /login, no shop → /vendor-dashboard); a save itself returns a SavePackageResult to the client editor and never leaves the screen |
| `app/vendor-dashboard/packages/actions.ts` › `setPackageActive` | `/vendor-dashboard/packages` | `/vendor-dashboard` | nav — its only redirects are the gates (signed out → /login, no shop → /vendor-dashboard); publish/unpublish returns a SavePackageResult in place |

### supplier: partnerships

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/vendor-dashboard/partnerships/actions.ts` › `acceptPartnership` | `/vendor-dashboard/partnerships` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/partnerships/actions.ts` › `changePartnershipKind` | `/vendor-dashboard/partnerships` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/partnerships/actions.ts` › `declinePartnership` | `/vendor-dashboard/partnerships` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/partnerships/actions.ts` › `proposePartnership` | `/vendor-dashboard/partnerships` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/partnerships/actions.ts` › `withdrawPartnership` | `/vendor-dashboard/partnerships` | `(computed)`, `/vendor-dashboard` | door |

### supplier: payment-options

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/vendor-dashboard/payment-options/actions.ts` › `addPaymentMethod` | `/vendor-dashboard/payment-options` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/payment-options/actions.ts` › `deletePaymentMethod` | `/vendor-dashboard/payment-options` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/payment-options/actions.ts` › `setPrimaryPaymentMethod` | `/vendor-dashboard/payment-options` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/payment-options/actions.ts` › `togglePaymentMethodShown` | `/vendor-dashboard/payment-options` | `(computed)`, `/vendor-dashboard` | door |

### supplier: proposals

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/vendor-dashboard/proposals/actions.ts` › `respondToProposal` | `/`, `/proposals/[x]` | `(computed)`, `/proposals/[x]${error ` | door |
| `app/vendor-dashboard/proposals/actions.ts` › `saveTemplate` | `/vendor-dashboard/proposals` | `(computed)`, `/vendor-dashboard` | door |

### supplier: recommendations

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/vendor-dashboard/recommendations/actions.ts` › `flagFeedback` | `/vendor-dashboard/recommendations` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/recommendations/actions.ts` › `setOptIn` | `/vendor-dashboard/recommendations` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/recommendations/share-actions.ts` › `suggestToCouple` | `/vendor-dashboard/recommendations` | `(computed)`, `/vendor-dashboard` | left — were blocked by the door's event gate (now `false` for supplier doors) — ready for the next pass |

### supplier: repertoire

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/vendor-dashboard/repertoire/actions.ts` › `addRepertoireSong` | `/vendor-dashboard/repertoire` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/repertoire/actions.ts` › `removeRepertoireSong` | `/vendor-dashboard/repertoire` | `/vendor-dashboard` | nav — gate bounce only (no shop → /vendor-dashboard); the delete answers {ok,error} to the set list's swipe in place |
| `app/vendor-dashboard/repertoire/actions.ts` › `setPerformanceLink` | `/vendor-dashboard/repertoire` | `(computed)`, `/vendor-dashboard` | door |

### supplier: services

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/vendor-dashboard/services/actions.ts` › `addServiceTimeSlot` | `/vendor-dashboard/services` | `(computed)`, `/vendor-dashboard` | left — dead — no screen posts them (named only in comments and tests) |
| `app/vendor-dashboard/services/actions.ts` › `createVendorService` | `/vendor-dashboard/services` | `(computed)`, `/vendor-dashboard` | nav — create a card from the `?add=` deep-link → My Shop with `?saved=1` (drops `?add=` so the add form closes; staying would leave the filled form to post a duplicate card) |
| `app/vendor-dashboard/services/actions.ts` › `deleteServiceTimeSlot` | `/vendor-dashboard/services` | `(computed)`, `/vendor-dashboard` | left — dead — no screen posts them (named only in comments and tests) |
| `app/vendor-dashboard/services/actions.ts` › `proposeCategory` | `/vendor-dashboard/services` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/services/actions.ts` › `setServiceLinks` | `/vendor-dashboard/services` | `(computed)`, `/vendor-dashboard` | left — dead — no screen posts them (named only in comments and tests) |
| `app/vendor-dashboard/services/actions.ts` › `setServicePaymentSchedule` | `/vendor-dashboard/services` | `(computed)`, `/vendor-dashboard` | left — its editor is mounted only `bare` (posts with the card's one Save), through a dynamic form tag |
| `app/vendor-dashboard/services/actions.ts` › `toggleVendorServiceActive` | `/vendor-dashboard/services` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/services/actions.ts` › `updateVendorService` | `/vendor-dashboard/services` | `(computed)`, `/vendor-dashboard` | left — dead — no screen posts them (named only in comments and tests) |
| `app/vendor-dashboard/services/addon-actions.ts` › `setServiceAddons` | `/vendor-dashboard/services` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/services/coverage-actions.ts` › `addCoverageForCard` | `/vendor-dashboard/services` | `/vendor-dashboard` | nav — gate bounce only (no shop → /vendor-dashboard); the add answers a result to the maker's ask in place |
| `app/vendor-dashboard/services/coverage-actions.ts` › `createCoverage` | `/vendor-dashboard/services` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/services/coverage-actions.ts` › `deleteCoverage` | `/vendor-dashboard/services` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/services/coverage-actions.ts` › `updateCoverageServes` | `/vendor-dashboard/services` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/services/coverage-actions.ts` › `updateCoverageServesInPlace` | `/vendor-dashboard/services` | `/vendor-dashboard` | nav — gate bounce only (no shop → /vendor-dashboard); answers the maker's useActionState in place |
| `app/vendor-dashboard/services/refinement-actions.ts` › `saveServiceRefinements` | `/vendor-dashboard/services` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/services/stay-on-actions.ts` › `pickServicesThatStayOn` | `/vendor-dashboard/services` | `(computed)`, `/vendor-dashboard`, `/vendor-dashboard/subscription` | door |

### supplier: subscription

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/vendor-dashboard/subscription/actions.ts` › `cancelScheduledPlanChange` | `/vendor-dashboard/subscription` | `/vendor-dashboard/subscription` | door |
| `app/vendor-dashboard/subscription/ultra-addon-actions.ts` › `buyUltraAddOn` | `/vendor-dashboard/subscription` | `(computed)` | nav — checkout → /pay |

### supplier: team

| file › action | posted from | lands on | now |
|---|---|---|---|
| `app/vendor-dashboard/team/actions.ts` › `cancelAdminMotion` | `/vendor-dashboard/team` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/team/actions.ts` › `inviteVendorTeamMember` | `/vendor-dashboard/team` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/team/actions.ts` › `proposeAdminMotion` | `/vendor-dashboard/team` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/team/actions.ts` › `removeVendorTeamMember` | `/vendor-dashboard/team` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/team/actions.ts` › `setVendorAgentServices` | `/vendor-dashboard/team` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/team/actions.ts` › `stepDownSelf` | `/vendor-dashboard/team` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/team/actions.ts` › `updateVendorTeamMember` | `/vendor-dashboard/team` | `(computed)`, `/vendor-dashboard` | door |
| `app/vendor-dashboard/team/actions.ts` › `voteAdminMotion` | `/vendor-dashboard/team` | `(computed)`, `/vendor-dashboard` | door |

