# Maps and connections audit (24 Nov 2026)

> READ-ONLY audit. Owner, 23 Nov: "connect all maps and connections to the database, if any."
> This lane finds problems and groups them into fix batches. **No app code is changed here.**
> Checked against `origin/main` at `7021d15d2` (this branch's base).

## Summary

**107 findings.** Each one was confirmed by reading the code on this checkout. Nothing was run in a browser, and nothing touched a database.

| severity | count | what it means |
|---|---|---|
| money/sign-in | **22** | A wrong peso figure, a paid state shown as unpaid (or the reverse), a lost payment, or a real link that reads as dead. |
| wrong data | **53** | The screen states something false: a count of 0, "none yet", the wrong place or status, or a second copy of a shared fact. |
| not saved | **7** | A Save can overwrite or lose what is stored, or a write's failure is never seen. |
| look | **25** | Works today, but drifts from the one source: a typed constant, a local peso formatter, a link through a redirect stub, or banned copy. |

| part | findings | money/sign-in | wrong data | not saved | look |
|---|---|---|---|---|---|
| Maps (MAP) | 8 | 0 | 4 | 0 | 4 |
| Supplier (SUP) | 29 | 7 | 17 | 1 | 4 |
| Guest and live day (GST) | 19 | 7 | 5 | 2 | 5 |
| Couple (CPL) | 22 | 2 | 14 | 1 | 5 |
| Admin, public, onboarding (ADM) | 25 | 6 | 13 | 3 | 3 |
| Doors to retired pages (DOOR) | 4 | 0 | 0 | 0 | 4 |

**The main cause, seen in every area.** A Supabase read *resolves* with `{ error }`; it does not throw. Many render files and `lib/` readers bind only `data`, then write `?? []` or `?? 0`, or wrap the read in a `try/catch` (or a caller's `.catch(() => null)`) that never fires. The refused read then shows as "none", "0", "Free" or a 404. The honest-reads guards (`app/vendor-dashboard/reads-are-honest.test.ts`, `app/dashboard/reads-are-honest.test.ts`, `lib/guests-read-is-honest.test.ts`) only match `const { data … } = await`. They miss `[{ data: x }] = await Promise.all(…)`, `xRes.data ?? []`, `.catch(() => [])` on a reader, and `lib/` readers that swallow the error. Batch **T1** below widens them.

**Maps in one line.** The pins themselves are saved and read back. The faults are around them:
- A distance helper overwrites the couple's own venue pin (MAP-1).
- `events.timezone` is never written (MAP-2).
- One guest page reads a retired door position (MAP-3).
- A changed supplier address can keep the old pin (MAP-4).
- The city list is still typed in code while its table sits unread (MAP-5).

**Not verified:** no page was rendered; no RLS policy was checked live; the `/[slug]/print` 404 lasting 5 minutes rests on Next.js `revalidate = 300` behaviour, not a test.

---

## Findings

Columns: **ID** · **area** · **route** · **file:symbol** (path from `apps/web/`) · **shows now** · **real value already lives in** · **severity** · **fix** (S/M/L). Every table and column named is in `supabase/security/prod-schema.snapshot.txt`; **no fix needs a new column**.

### Maps (MAP)

| ID | area | route | file:symbol | shows now | real value already lives in | severity | fix |
|---|---|---|---|---|---|---|---|
| MAP-1 | couple · guest | `/[slug]` Venue scene · `/dashboard/[eventId]/launch` Details › Venues · Find distance chips | `lib/events.ts:recomputeReceptionAnchor` (called from `app/(shell)/explore/actions.ts`, `app/onboarding/wedding/actions.ts`, `app/dashboard/[eventId]/vendors/actions.ts`, `lib/vendor-couple-invite.ts`) | Writes `events.venue_latitude/longitude` from a shop's HQ when the reception is only shortlisted (`source: 'considering'`). It keeps that pin after the pick is removed ("leaves the existing anchor untouched"). It never uses the couple's own hand-added reception pin. The same columns are the couple's own pin (Details › Venues via `lib/hub-draft.ts`) and the Event Hub's reception when nothing is booked (`lib/event-venues.ts:resolveEventVenues`). A guest can be routed to a venue the couple only looked at. | Couple's pin: `events.venue_latitude/longitude`. Hand-added venue pin: `event_manual_vendors.address_latitude/longitude`. The distance anchor is already computed by `resolveReceptionAnchor`. | wrong data | M: inside `lib/events.ts` only, persist a **locked** reception's pin and never a `considering` one, and include the manual reception pin in `resolveReceptionAnchor`. Explore already falls back to `regionPin`. |
| MAP-2 | couple · guest | `/dashboard/[eventId]` Home countdown and day-of times · `/[slug]/print` · Papic capture windows | Readers of `events.timezone`: `lib/home-facts.ts:homeFacts`, `app/dashboard/[eventId]/page.tsx`, `app/[slug]/print/page.tsx:printedStampLine`, the Papic RPCs (`e.timezone`) | `events.timezone` has **no writer**, so it is always its default `'Asia/Manila'`. The Event Hub derives the zone from the venue pin instead (`lib/event-timezone.server.ts:eventTimezoneFromCoords`), giving two clocks for one event once the venue is outside UTC+8. | `events.timezone` (exists, NOT NULL); the rule is `lib/venue-zone.ts:venueZoneFromCoords` | wrong data | S: write `events.timezone = venueZoneFromCoords(pin)` where the reception pin is saved (`lib/hub-draft.ts` apply, `lib/onboarding/event-insert.ts`, `lib/events.ts`) |
| MAP-3 | guest | `/[slug]/find-my-table` | `app/[slug]/find-my-table/page.tsx:resolveEntrance` | Reads only the legacy `events.venue_entrance_x/y`, which nothing writes since the blueprint editor moved (`lib/one-door-one-answer.test.ts`). The walking route starts at the default door, not the one the couple placed. Its comment says `fetchEntrance` needs the RLS client, but it takes any client (`/[slug]/seat` passes admin). | `event_floor_plan.entrance_enabled/entrance_x/entrance_y` via `lib/indoor-blueprint.ts:fetchEntrance` | wrong data | S |
| MAP-4 | supplier | `/vendor-dashboard/shop` Company address, then `/v/[slug]` map and couples' venue pins | `app/vendor-dashboard/actions.ts` `case 'hq_address'` and the follow-up `geocodeNominatim` update | A new address typed without re-pinning, whose geocode misses, keeps the **old** `hq_latitude/longitude` ("Admin-supplied coords aren't clobbered on a miss"), and the save says nothing. The shop map, every couple venue that follows this shop's pin, and the distance chips stay on the old place. The follow-up `update` drops its `error`. | `vendor_profiles.hq_latitude/longitude` (the editor already has the map to place it) | wrong data | S: on a miss for a changed address, return a "place the pin" note; bind the error |
| MAP-5 | couple · supplier | `/onboarding/wedding` Where step and Top-30 carousel · Details city pick · Suppliers place sheet · `/dashboard/create-event` · supplier landing | `app/onboarding/wedding/_data/wedding-cities.ts:CITIES/TOP30/REGION_CENTROID`; `lib/region-source.ts` static table (`hydrateRegionsFromRows` is never called) | The city list, Top-30 order, nuggets, coordinates and region centres are TS literals used by about 12 files, including `readAreaSupplierCounts(CITIES…)`. They match the seed today, but an admin edit to either table changes nothing on screen. `wedding_destinations` has no app reader at all. The file's own docblock calls this a "DEFERRED FOLLOW-UP". | `wedding_destinations` (`city_key`, `display_name`, `lat`, `lon`, `rank`, `nugget`, `photo_key`, `region_code`, `region_label`); `regions.centroid_lat/centroid_lon` | look (drift) | L |
| MAP-6 | couple · supplier | every pin map before a pin exists | `app/dashboard/[eventId]/_components/address-pin-field.tsx:PH_FALLBACK` · `app/vendor-dashboard/shop/_components/editable-row.tsx:PH_FALLBACK` · `app/vendor-dashboard/shop/_components/branch-panel.tsx:branchMapCenter` · `app/open-shop/_components/city-pin.tsx:DEFAULT_CENTER` · `app/onboarding/wedding/_components/wedding-venues.tsx` (`center`) · `app/onboarding/wedding/_components/location-step.tsx:NCR_FALLBACK` · `app/dashboard/[eventId]/launch/_components/details-city-pick.tsx:NCR_FALLBACK` | Seven hand-typed Manila centres. A couple in Cebu opens an unpinned venue map over Manila although `events.region` says Cebu. | `events.region` → `lib/region-source.ts:regionCentroid` (`regions.centroid_lat/lon`); supplier: `vendor_profiles.location_city` | look | S each |
| MAP-7 | supplier | `/vendor-dashboard/shop` Company address · `/open-shop` | `app/vendor-dashboard/shop/_components/editable-row.tsx:HqAddressControl` · `app/open-shop/_components/city-pin.tsx` | A second pin-picker engine (Leaflet) beside the shipped `BranchPinMap`. The shop editor also calls Nominatim straight from the browser, with a personal contact address in the query string, and skips the rate-limited server proxy. The report-only CSP `connect-src` does not list that host, so the day the policy is enforced, "Find on map" fails silently. | `app/vendor-dashboard/_components/branch-pin-map.tsx:BranchPinMap` + `app/open-shop/city-actions.ts:locateShopAddress` | look | M |
| MAP-8 | couple · supplier | appointment cards | `app/_components/appointments-section.tsx:directionsUrl` | Builds its own Google Maps search link. `lib/map-directions.ts` names `nav-links.tsx` (`DirectionsMenu`) as the one builder, so appointments get no Android chooser, Waze or Apple Maps. | `app/_components/nav-links.tsx:DirectionsMenu` / `lib/geo.ts:googleMapsSearchByQuery` | look | S |

### Supplier (SUP)

| ID | area | route | file:symbol | shows now | real value already lives in | severity | fix |
|---|---|---|---|---|---|---|---|
| SUP-1 | plan label | every `/vendor-dashboard/*` | `app/vendor-dashboard/layout.tsx:tierProbePromise` → `_components/vendor-rail-context.tsx` `TIER_LABEL[asVendorTier(tier)]` | `tier: row?.tier_state ?? null` (`tierRes.error` never read), so `asVendorTier(null)` labels a Pro or Ultra shop **"Free"** on every page | `vendor_profiles.tier_state`; draw "Couldn't read" | money/sign-in | S |
| SUP-2 | Deep Search | `/vendor-dashboard/deep-search` | `app/vendor-dashboard/deep-search/page.tsx:VendorDeepSearchPage` | `const { data: tierRow }` with no error, so `deepSearchIncluded(null)` is false and a paid shop sees the "not included" pitch | `vendor_profiles.tier_state` → `loadDeepSearchOffer` | money/sign-in | S |
| SUP-3 | payments to confirm | `/vendor-dashboard/messages/[threadId]` · `/vendor-dashboard/clients/[eventId]` | `lib/vendor-service-payment-schedules.server.ts:fetchPendingVendorPayments` | `const { data: bookings }` / `const { data: rows }` then `(rows ?? [])` gives `paymentsToConfirm` 0; a payment the couple logged vanishes from the supplier's view | `event_vendor_payments.vendor_confirmed_at` (return null when unread) | money/sign-in | S |
| SUP-4 | team seats | `/vendor-dashboard/team` | `lib/vendor-seats.ts:fetchExtraAgentSeats` → `team-screen.tsx` `seatLine` | `if (error \|\| !data) return 0;` shows "3 of 3 seats used" to a shop that bought seats (`plan-screen.tsx` handles null; Team does not) | `vendor_profiles.extra_agent_seats` | money/sign-in | S |
| SUP-5 | day-of headcount | `/vendor-dashboard/on-the-day/live/[eventId]` | `app/vendor-dashboard/on-the-day/live/[eventId]/page.tsx:VendorOnTheDayLivePage` | `const attending = brief?.pax.attending ?? 0;` shows "0 / 0 attending · pulled live from RSVPs" | `get_vendor_event_brief` pax; pass null as `on-the-day/page.tsx` does | money/sign-in | S |
| SUP-6 | invite door | `/vendor-invite/[slug]` · `/vendor/fit/[ref]` · `/vendor/lock/[token]` | `lib/vendor-couple-invite.ts:listHostEvents` | `const { data: memberRows }` / `{ data: modRows }` with no error leads to `hostEvents.length === 0` and "Create your event first", so a host makes a duplicate event | `event_members.member_type`, `event_moderators.role_subtype` | money/sign-in | S |
| SUP-7 | how to pay | `/proposals/[publicId]` | `lib/vendor-payment-methods.server.ts:fetchProposalPaymentMethods` | `const { data: rows }`, then `paymentMethods.length > 0 ? …How to pay`: the section silently disappears | `vendor_payment_methods.moderation_status` / `is_shown` | money/sign-in | S |
| SUP-8 | invite QR | `/vendor-invite/[slug]` | `app/vendor-invite/[slug]/page.tsx:VendorInvitePage` | `const { data: vendor }`, then `if (!vendor \|\| !isShopLive(vendor)) notFound();`: a passing error 404s a live shop's printed QR | `vendor_profiles` (ReadFailed + Try again) | wrong data | S |
| SUP-9 | chat header | `/vendor-dashboard/messages/[threadId]` | `app/vendor-dashboard/messages/[threadId]/page.tsx:eventRead` | `event?.display_name ?? 'Couple'` and Target date "Not set yet" on a refused read | `events.display_name`, `events.event_date` | wrong data | S |
| SUP-10 | The Day tile | `/vendor-dashboard/on-the-day` | `app/vendor-dashboard/on-the-day/page.tsx:onTheDayBody` | `(handoverRes.data ?? [])`, `(mediaRes.data ?? [])`, `completionRes.data` give "0% · Not started yet", "0 clips", "0 photos" (on the guard's list, yet passes it) | `event_vendors.completion_status`, `booking_handovers.couple_acknowledged_at`, `editorial_vendor_media.media_type` | wrong data | S |
| SUP-11 | analytics by source | `/vendor-dashboard/shop#analytics` | `lib/vendor-funnel.ts:fetchViewsBySource` / `fetchInquiriesBySource` / `fetchBookedBySource` | `buildSourceSlices((data ?? [])…)`; the caller's `safeRead(…, null)` expects a throw that never comes | `vendor_profile_views.source`, `chat_threads.inquiry_source`, `event_vendors.source` | wrong data | S |
| SUP-12 | share your work | `/vendor-dashboard/shop/promote#share` | `lib/recap-vendor.ts:loadVendorRecaps`, `lib/realstories-vendor.ts:loadVendorFeaturedStories`, `app/vendor-dashboard/shop/promote/_components/share-your-work-data.ts:loadShareYourWork` | readers `return []` on error, so the `.catch(() => null)` is dead and the page shows "none yet" | `event_recaps.status`; `fetchVendorPoolBookingsDetailed().complete` | wrong data | S |
| SUP-13 | Instagram card | `/vendor-dashboard/collections` | `lib/vendor-instagram-status.ts:fetchVendorIgConnection` | `if (!data) return null;` shows "Connect Instagram" to a connected shop; `collections-data.ts` `unavailable: true` is never reached | `vendor_ig_connections.status` | wrong data | S |
| SUP-14 | recommendations | `/vendor-dashboard/recommendations` | `app/vendor-dashboard/recommendations/page.tsx` | `[{ data: recRows }, …]` with no error shows "No recommendations for your categories yet"; titles fall back to the raw `service_code` with no price | `vendor_service_recommendations.tile_id`, `platform_retail_catalog_v2.retail_price_php` | wrong data | M |
| SUP-15 | quotes fold | `/vendor-dashboard/customers?seg=money&open=proposals` | `app/vendor-dashboard/proposals/surface.tsx` | `{ data: templateRows }`, `{ data: packageRows }`, `fetchVendorPoolBookings` give "No booked clients yet…" and "Save your first template below" | `vendor_proposal_templates.template_name`, `vendor_schedule_pool_bookings.released_at` | wrong data | S |
| SUP-16 | song bank | `/vendor-dashboard/repertoire` | `app/vendor-dashboard/repertoire/page.tsx` → `lib/songs.ts:fetchVendorSongs`, `fetchCuratedSongs` | `fetchVendorSongs` returns `.rows` and drops `failed`; `fetchCuratedSongs` does `return (data ?? [])`; shows "No songs yet." | `vendor_songs` via `readVendorSongs().failed` | wrong data | S |
| SUP-17 | Deep Search history | `/vendor-dashboard/deep-search` | `app/vendor-dashboard/deep-search/page.tsx:VendorDeepSearchPage` | `const status = d?.status ?? 'running';`: every past search says "Running" on a refused read | `vendor_web_dossiers.status` | wrong data | S |
| SUP-18 | creators | `/vendor-dashboard/creators` | `lib/creator-offers.ts:fetchVendorSentOffers` (+`fetchEligibleCreators`) | `(data ?? [])`, so `pendingCreatorIds` is empty and the send form shows again for a creator already offered | `vendor_creator_offers.status` | wrong data | S |
| SUP-19 | admin votes | `/vendor-dashboard/team` | `lib/vendor-team.ts:fetchOpenAdminMotions` | `(motions ?? [])`, `(votes ?? [])`: an open vote, or the person's own vote, is missing | `vendor_admin_motions.status`, `vendor_admin_motion_votes.approve` | wrong data | S |
| SUP-20 | thread stage | `/vendor-dashboard/messages/[threadId]` | `lib/vendor-thread-stage.ts:deriveThreadStage` | `event_vendors` read with the error unread: a contracted booking reads "Inquiry" and the ＋ menu says "open once they book you" | `event_vendors.status` via `rowReadsBooked` | wrong data | S |
| SUP-21 | "booked" copies | supplier pages, `/v/[slug]/guest-review`, emails | `app/v/[slug]/guest-review/page.tsx:BOOKED`, `lib/vendor-activity.ts:FINALIZED_STATUSES`, `lib/supplier-where.ts:WHERE_BOOKED_STATUSES`, `lib/papic-supplier-way-in.ts:SUPPLIER_BOOKED_STATUSES`, `lib/coordinator-trade.ts:BOOKED_EVENT_VENDOR_STATUSES` (a second export with the same name), `lib/vendor-overview-desk-reads.ts`, `lib/badge-earned.server.ts`, `lib/supplier-night-before-email.ts:BOOKED_STATUSES` | `['contracted','deposit_paid','delivered','complete']` typed by hand eight times | `lib/vendor-funnel.ts:BOOKED_EVENT_VENDOR_STATUSES` | wrong data | S |
| SUP-22 | paid-plan test | `/vendor-dashboard/subscription` | `app/vendor-dashboard/subscription/_components/plan-screen.tsx:isPaid` / `PAID_TIERS` | `currentTier === 'solo' \|\| 'pro' \|\| 'enterprise'` retypes the plan list | `lib/vendor-tier-caps.ts:isPaidSize` / `VENDOR_TIERS` | wrong data | S |
| SUP-23 | imported-couple Invite | `/vendor-dashboard/clients/[eventId]` | `app/vendor-dashboard/clients/[eventId]/page.tsx:OverviewTab` ("Invite them to Setnayan — free") | `<Link href="/vendor-dashboard/clients">Invite →</Link>` goes through the stub to the client list; nothing invites | `/vendor-dashboard/invite`, or drop the hint | wrong data | M |
| SUP-24 | chat quote picker | `/vendor-dashboard/messages/[threadId]` | `app/vendor-dashboard/messages/[threadId]/page.tsx:proposalTemplates` | `(tplRes.data ?? [])`, `(pkgRes.data ?? [])` give empty template and package pickers | `vendor_proposal_templates`, `vendor_packages` | wrong data | S |
| SUP-25 | voice match (switch off) | `/vendor-dashboard/shop#voice-match` | `app/vendor-dashboard/shop/_components/voice-match-section.tsx:VoiceMatchSection` | `const { data: cfg }` falls back to `HOUSE_VOICE` drawn as editable, so Save overwrites the real profile; a refused plan read says "Upgrade" to Ultra | `vendor_bot_config.voice_profile`, `vendor_profiles.tier_state` | not saved | S |
| SUP-26 | local peso formatters | many supplier pages | `branch-manager.tsx:peso`, `shop-wallet-sheet.tsx:peso`, `portfolio-credits-card.tsx:peso`, `offer-editor.tsx:peso`, `offer-maker.tsx`, `vendor-payment-live.tsx:peso`, `clients/[eventId]/page.tsx:fmtPeso`, `payment-asks-panel.tsx`, `gig-card.tsx`, `vendor-prep-add.tsx`, `locked-qr-generator.tsx`, `plan-screen.tsx`, `today-welcome.tsx`, `app/open-shop/_components/first-card-draft.tsx`, `lib/supplier-billing.ts:PESO`, `lib/supplier-event-lines.ts`, `lib/vendor-service-public.ts` | `'₱' + n.toLocaleString('en-PH')` and similar | `lib/php.ts:formatPhp` / `formatCentavosPhp` | look | M |
| SUP-27 | links through redirect stubs | `/vendor-dashboard/lines`, `/activities`, `/manpower`, `/clients/[eventId]`, `/challenge-photos`, calendar save | `lines/page.tsx`, `activities/page.tsx`, `manpower/surface.tsx` `redirect('/vendor-dashboard/verify')`; `clients/[eventId]/page.tsx`, `clients/[eventId]/challenge-photos/page.tsx` `redirect('/vendor-dashboard/clients')`; `calendar/actions.ts` ``redirect(`/vendor-dashboard/calendar/${date}?…`)`` | each lands on a stub that only redirects again | `/vendor-dashboard/profile#docs`, `customerLandingHref`, `daySheetHref` | look | S |
| SUP-28 | editorial photo limit | `/vendor-dashboard/clients/[eventId]` · `/vendor-dashboard/on-the-day` | `clients/[eventId]/page.tsx` ("add up to 3 photos and 3 short clips"), `on-the-day/page.tsx:MAX_MEDIA_PER_TYPE` | `const MAX_MEDIA_PER_TYPE = 3; // mirrors …` | `lib/editorial-vendor-media.ts:MAX_PER_TYPE` | look | S |
| SUP-29 | role and branch names | `/vendor-dashboard/customers` | `app/vendor-dashboard/customers/page.tsx:rolesWhereRead` | `fetchVendorRoleNames(…).catch(() => ({}))` plus `(branchesRes.data ?? [])` give the default names and "Main" for a shop that renamed them | `vendor_role_names.display_name`, `vendor_branches.branch_label` | look | S |

### Guest and live day (GST)

| ID | area | route | file:symbol | shows now | real value already lives in | severity | fix |
|---|---|---|---|---|---|---|---|
| GST-1 | Papic order | `/papic/order/[token]` | `app/papic/order/[token]/page.tsx:PapicGuestOrderPage` | `<PayRailsBlock … amountPhp={amount ?? 0}>`: the header says "—", but the pay block says "Exact amount ₱0.00", Copy copies `0.00`, and the QR caption names ₱0.00 | `orders.requested_total_php` (already read into `amount`) | money/sign-in | S: skip the pay block when `amount === null` |
| GST-2 | Papic order | `/papic/order/[token]` | `app/papic/order/[token]/page.tsx:PapicGuestOrderPage` | `[{ data: payments }, settings]`, then `(payments ?? []).length > 0`: a refused read hides the guest's logged transfers and asks them to log the payment again | `payments.amount_php`, `payments.status` by `order_id` | money/sign-in | S |
| GST-3 | E-Gifts | `/[slug]/pabuya` (and the Welcome page's E-Gifts) | `app/[slug]/pabuya/_lib/gift-page.server.ts:loadGiftPage` | `fetchEgiftMethods(…)` returns `.methods` and drops `read`: a refused read says "{host} hasn't set up e-gifts yet" | `event_egift_methods.is_enabled` via `lib/egift.ts:readEgiftMethods` | money/sign-in | S |
| GST-4 | Papic QR entry | `/papic/join/[token]` | `app/papic/join/[token]/page.tsx:resolveKind` (`isSeat`, `isGuest`) | `const { data } = …; return Boolean(data);`: a refused read on a printed QR says "This link isn't active." | `paparazzi_seats.claim_qr_token`, `guests.qr_token` | money/sign-in | S |
| GST-5 | co-host invite | `/host/accept/[token]` | `app/host/accept/[token]/page.tsx:HostAcceptPage` | `const { data: inviteRaw }` then `notFound()`: a valid emailed invite 404s | `event_moderators.invitation_token` | money/sign-in | S |
| GST-6 | group invite | `/samahan/join/[token]` | `lib/communities.ts:fetchPendingCommunityInvite` | `if (!data) return { status: 'not_found' }` shows "This invite link doesn't work"; `member_count: count ?? 0` shows "0 members" | `community_invite_tokens.token`; count of `community_members` | money/sign-in | S |
| GST-7 | loved-ones claim | `/claim/[token]` | `app/claim/[token]/page.tsx:ClaimAlagaPage` | `const { data: row }` then "This link isn't active. It may have expired…" | `dependents.claim_token` | money/sign-in | S |
| GST-8 | story numbers | `/[slug]` Editorial "By the numbers" · `/[slug]/print` | `app/[slug]/_components/editorial/data.ts:loadEditorialDataUncached` (`ahead.guestsAttending`) | `attending = att ?? 0` in a `try/catch` that never fires prints "0 invited / 0 said yes" on a keepsake; it is also a second headcount reader with its own filters | `lib/guests.ts:fetchGuestsByEventMeasured` → `computeGuestStats` / `countsTowardEvent` | wrong data | M |
| GST-9 | print keepsake | `/[slug]/print` | `app/[slug]/print/page.tsx:fetchEvent` | `const { data } = …; return data;` then `notFound()` with `revalidate = 300` | `events` by slug, via `guestRead('print (event)', …)` | wrong data | S |
| GST-10 | shared photos | `/papic/pool` | `app/papic/pool/page.tsx:PapicPoolPage` | `if (!ev?.pool_gallery_open) notFound();` on a refused read | `events.pool_gallery_open` | wrong data | S |
| GST-11 | door pass | `/[slug]/find-seat` · `/[slug]/seat` | `app/[slug]/find-seat/page.tsx:FindSeatPage`; `app/[slug]/seat/page.tsx:PersonalPass` | `{ data: checkin }` unbound: an already checked-in guest is told "Show this at the door" | `guest_checkins.checked_in_at` | wrong data | S |
| GST-12 | guest columns | `/[slug]` "The paper" | `app/[slug]/_components/guest-column-card.tsx:GuestColumnCard` | `[{ data: mine }, { data: approved }]` in a `try/catch` that never fires: an empty "Write one" form over a column already sent | `guest_columns` (own row; `status='approved'`) | not saved | S |
| GST-13 | photos of you | `/[slug]` | `app/[slug]/_components/photos-of-you-gallery.tsx:PhotosOfYouGallery` | `(gallery?.total ?? 0).toLocaleString()` prints "0" beside "We couldn't load your photos just now" | `getGuestLiveGallery` (null on failure) | wrong data | S |
| GST-14 | camera "running low" | `/papic/guest` | `app/papic/guest/_components/papic-guest-capture.tsx:PapicGuestCapture` (`low`) | uses `DEFAULT_EVENT_POOL_CONFIG.softStopPct` (the missing-table fallback); an admin change to the soft stop never reaches the warning | `papic_event_pool_config.soft_stop_pct` via the pool reader | look | S |
| GST-15 | Live Studio films | `/panood/control/[eventId]` | `app/panood/control/[eventId]/page.tsx:LiveStudioControlPage` (`filmRows`) | a refused read shows no films above "Add film", so the host adds them again | `event_films` | not saved | S |
| GST-16 | seat pass (no door) | `/[slug]/seat` | `app/[slug]/seat/page.tsx:SeatPassPage` | Nothing builds this URL. Printed QRs encode the hub root; every hub seat door goes to `/find-seat`; `CUSTOM_QR_GUEST` is off sale. It is a second seat reader. | `/[slug]/find-seat` (`lib/find-your-seat.ts`) | look | M: retire it (redirect to `/find-seat`); don't add a door |
| GST-17 | everyone list (no door) | `/[slug]/everyone` | `app/[slug]/everyone/page.tsx:EveryonePage` | The link was removed on purpose (owner, 26 Sep), but the "Also coming" list is drawn only here | `guests.rsvp_status` via `lib/entourage.ts` | look | M: **owner/controller call** — inline under `#site-entourage`, or redirect |
| GST-18 | light probe (no door) | `/papic/lightcheck` | `app/papic/lightcheck/page.tsx` | its own comment: "THROWAWAY … DELETE THIS ROUTE once the numbers are recorded" | — | look | S: delete or move under `app/dev/` |
| GST-19 | app install notice | `/papic/join/[token]` | `app/papic/join/[token]/_components/app-install-banner.tsx:AppInstallBanner` | with no store URL set: "The app is coming soon…" (brand rules 8 and 9) | `NEXT_PUBLIC_IOS_APP_STORE_URL` / `NEXT_PUBLIC_ANDROID_PLAY_STORE_URL` | look | S: render nothing |

### Couple (CPL)

| ID | area | route | file:symbol | shows now | real value already lives in | severity | fix |
|---|---|---|---|---|---|---|---|
| CPL-1 | Pakanta | `/dashboard/[eventId]/studio/pakanta` | `app/dashboard/[eventId]/studio/pakanta/page.tsx` (`const owned = await eventSkuActive(…).catch(() => false)`) | a refused read shows the NOT OWNED buy form with its price and hides the finished song; active-only, so a couple whose payment is under review can buy again | `lib/entitlements.ts:eventOwnsSku` (counts a pending order) + `eventSkuActive`; `orders.status` | money/sign-in | S |
| CPL-2 | documents | `/dashboard/[eventId]/documents` | `app/dashboard/[eventId]/documents/page.tsx` (`receiptsRes`) | `fetchOrdersForEvent(…).catch(() => [])`, `fetchEventContracts(…).catch(() => [])`, `(receiptsRes.data ?? [])` say "No paid orders yet." / "No transaction receipts yet." / "No contracts yet." | `orders.status`, `receipts.order_id`, `vendor_contracts.event_id` | money/sign-in | M |
| CPL-3 | meaningful dates | `/dashboard/[eventId]/date-selection` | `app/dashboard/[eventId]/date-selection/page.tsx` (`meaningfulRes`) + `actions.ts:setMeaningfulDates` | `(meaningfulRes.data ?? [])` seeds the form; Save deletes every row then inserts, so Save after a refused read **wipes** the saved dates | `event_meaningful_dates.meaningful_date` | not saved | S |
| CPL-4 | date lock | `/dashboard/[eventId]/date-selection` | `app/dashboard/[eventId]/date-selection/actions.ts:lockEventDate`; `app/dashboard/[eventId]/wizard-actions.ts:completeSetWeddingDateTask` | `const { count } = …; if ((count ?? 0) > 0) throw`: a refused read lets the date move while suppliers are booked | `event_vendors.status` in `CONFIRMED_VENDOR_STATUSES`; the sibling in `[eventId]/actions.ts` refuses with "We could not check your booked suppliers." | wrong data | S |
| CPL-5 | mood board share | `/dashboard/[eventId]/studio/mood-board` | `studio/mood-board/_components/mood-board-editor.tsx:bookedVendorCount` | counts any row with a marketplace link ("no status filter") for "Notify your N booked vendors", but the share action notifies only `standing === 'booked'`; also says "vendor" | `readCoupleBookingStandings` (the share action's own filter) | wrong data | S |
| CPL-6 | emcee picks | `/dashboard/[eventId]/schedule` | `schedule/_components/emcee-picks.tsx:EmceePicks` | a shortlisted MC shows as the booked host; `(pickRes.data ?? [])` unbound shows every segment unticked | `lib/booked-host.ts:findBookedHost`; `event_activity_picks.activity_id` | wrong data | S |
| CPL-7 | unread | `/dashboard/[eventId]` Planning tools | `_components/event-dashboard.tsx:unreadCount` | `fetchEventUnreadCounts(…).then((m) => m.get(eventId) ?? 0)`: "All caught up" | `readEventUnreadCounts` (null on refusal) | wrong data | S |
| CPL-8 | program | `/dashboard/[eventId]` Planning tools | `_components/event-dashboard.tsx:scheduleBlocks` | `.catch(… return [])`: "No program yet — map out your ceremony…" | `event_schedule_blocks.block_id` | wrong data | S |
| CPL-9 | hosts | `/dashboard/[eventId]` Planning tools | `_components/event-dashboard.tsx:hostAccounts` | `(membersRes.data ?? [])`, `(modsRes.data ?? [])`: "It's just you so far — invite your partner…" | `event_members.member_type`, `event_moderators.user_id` | wrong data | S |
| CPL-10 | requests | `/dashboard/[eventId]/schedule` | `schedule/page.tsx:openSuggestions` | `(suggestionsRes.data ?? [])`: "Requests 0" / "Nothing waiting." | `event_schedule_suggestions.suggestion_id` | wrong data | S |
| CPL-11 | disputes | `/dashboard/[eventId]/disputes` | `disputes/page.tsx:CoupleDisputesPage` | `(flagsRes.data ?? [])`: "Existing flags (0)"; the supplier list retypes statuses (drops `complete`, adds shortlisted) | `force_majeure_flags.flag_id`; `BOOKED_EVENT_VENDOR_STATUSES` | wrong data | S |
| CPL-12 | contracts, paperwork, preparation | `/dashboard/[eventId]/contracts` · `/paperwork` · `/schedule?view=preparation` | `lib/contracts.ts:fetchEventContracts`, `lib/paperwork.ts:fetchEventPaperwork`, `lib/preparation.ts` | `if (error) { …; return []; }`: "No contracts yet"; paperwork offers the first-visit seed again | `vendor_contracts.event_id`, `event_paperwork.document_type` | wrong data | S |
| CPL-13 | details lock | `/dashboard/[eventId]/launch` Details | `lib/events.ts:getConfirmedVendorCount` (+`.catch(() => 0)` in `launch/_components/details-your-event-load.tsx`) | `if (error) return 0;` makes date and ceremony editable (the server re-checks) | `event_vendors.status` in `CONFIRMED_VENDOR_STATUSES`; return `number \| null` | wrong data | S |
| CPL-14 | Panood cameras | `/dashboard/[eventId]/studio/panood/cameras` · `/broadcast` | `studio/panood/cameras/page.tsx` (`cameras`) | `.catch(() => [])`: "0 of 0 connected" / "No cameras yet." | `panood_camera_operators` (the reader already throws) | wrong data | S |
| CPL-15 | face profile | `/dashboard/profile` | `app/dashboard/(account)/profile/page.tsx:faceProfileOptedIn` | a refused read draws the biometric switch OFF ("Off means no face profile is saved") — on the guard's `KNOWN_UNBOUND` list | `user_face_profiles.revoked_at` | wrong data | S |
| CPL-16 | claims | `/dashboard/[eventId]/guests/claims` | `guests/claims/page.tsx` (`groupsRaw`) | `(groupsRaw ?? [])`: the Keep form offers no groups (the ternary dodges the guard) | `guest_groups.label` | wrong data | S |
| CPL-17 | "booked" copies | `/vendors`, `/vendors/[vendorId]/review`, `/studio/playlist`, Home (nikah) | `vendors/_components/plan-budget-accordion.tsx`, `build-locked.tsx:LOCKED`, `workspace/_components/promote-coordinator-card.tsx:BOOKED`, `vendors/page.tsx:PLAN_LOCKED`, `_components/nikah-imam.ts:OFFICIANT_LOCKED_STATUSES` (its `officiantRowsRes` is also unbound), `review/page.tsx`, `studio/playlist/page.tsx` | `new Set(['contracted','deposit_paid','delivered','complete'])` typed seven times | `lib/vendor-funnel.ts:BOOKED_EVENT_VENDOR_STATUSES` | wrong data | M |
| CPL-18 | local peso formatters | `/vendors/[vendorId]/workspace` and about 18 files | `workspace/page.tsx:formatPHP` (`?? '₱0'`), `change-order-trail.tsx`, `accordion-build`, `quote-fill`, `build-compare`, `reuse-bookings-panel`, `payment-asks-card`, `quote-bridge`, `reservation-terms-ack`, `accordion-lock`, `inline-checkout-drawer`, `date-selection/_components/candidate-date-picker.tsx`, `manpower/page.tsx`, `credit-stepper`, `studio/papic/_components/papic-buy-form.tsx`, `setnayan-ai/page.tsx`, `studio/pakanta/_components/pakanta-music-form.tsx`, `(account)/create-event/event-type-picker` | pesos formatted by hand, and a typed '₱0' fallback | `lib/php.ts:formatPhp` / `formatPhpRounded` | look | M |
| CPL-19 | wasted reads | `/dashboard/[eventId]` | `_components/event-dashboard.tsx:seatedGuests`, `paperworkSummary` | computed and never read: two queries per load | — (remove) | look | S |
| CPL-20 | widget links via stubs | `/dashboard/[eventId]/story` · `/website/widgets` | `story/_components/editorial-editor.tsx` ("Thank-you note" link); `lib/invitation-widgets.ts:editor_subroute` | links to `/website/special-message`, `'what-to-bring'` (stubs) and `'dress-code'` (redirected to studio/mood-board) | `website/editor?open=<row>`, `studio/mood-board` builders in `lib/routes.ts` | look | S |
| CPL-21 | "coming" copy | `/studio/panood/setup` · `/dashboard/profile` | `studio/panood/setup/page.tsx:STYLE_PACK_MODES = 4`; `(account)/profile/page.tsx` "Legacy contact" | "4 broadcast looks…", "coming with the rollout", "Legacy contact … Coming soon." (brand rules 5 and 9) | corpus `MARKETING_RESEARCH_BRIEF_2026-11-24.md` § 3 | look | S |
| CPL-22 | story upsell | `/dashboard/[eventId]/story` | `story/page.tsx:addsManyAtOnce` | `eventSkuActive(…).catch(() => false)` upsells Event Plus to an Event Plus couple | `orders.status` via `eventSkuActive`; hide on failure | look | S |

### Admin, public, onboarding (ADM)

| ID | area | route | file:symbol | shows now | real value already lives in | severity | fix |
|---|---|---|---|---|---|---|---|
| ADM-1 | price removal | `/admin/pricing` (Remove for good) | `lib/admin/pricing-removability.ts:computeRetailRemovabilityMap` | `new Set((ordersRes.data ?? []).map(…))`; no `.error` read on the 6 reads; `recheckRetailRemovability` passes and the delete runs | `orders.service_key`, `bundle_components`, `event_software_activations_v2`, `papic_tier_config.rate_service_code` | money/sign-in | S: any error → `safeToRemove:false` |
| ADM-2 | revenue | `/admin/money` | `app/admin/money/_components/revenue-summary.tsx:RevenueSummary` + `lib/admin/revenue-statement.ts:splitPaidRevenue` | unpaged `orders` read (PostgREST caps at 1,000 rows with `error: null`) summing `requested_total_php` before voucher and confirmation; receipts and refunds also unpaged | `lib/orders.ts:orderGrossOwed` (`confirmed_total_php`, `voucher_discount_centavos`), paged or a SQL sum | money/sign-in | M |
| ADM-3 | booking-fee disputes | `/admin/disputes` | `app/admin/disputes/_components/booking-fee-disputes-section.tsx` | `(threads.data ?? [])`, `(saves.data ?? [])` print "No chat was started from Setnayan." / "No save from Find." — the waive/keep evidence | `chat_threads.inquiry_source`, `event_vendors.source` | money/sign-in | S |
| ADM-4 | receipt on approve | `/admin/payments` | `app/admin/payments/actions.ts:issueReceiptForOrder` | the `receipts` insert and the `orders` breakdown update never read their error (both in `supabase-unread-error.baseline.txt`); Approve reports success with no receipt | `receipts`; `orders.vendor_net_centavos` / `gateway_fee_centavos` | not saved | S |
| ADM-5 | fee for payouts | `/admin/payments` → payouts | `lib/payouts.ts:getSetnayanFeeBps` | `if (error) { …; return DEFAULT_SETNAYAN_FEE_BPS; }`: a guessed fee written into `vendor_net_centavos` and payout rows (rule 3) | `platform_settings.setnayan_pay_fee_pct` | money/sign-in | S: on error, skip the breakdown and say so |
| ADM-6 | subscriptions desk | `/admin/subscriptions` | `app/admin/subscriptions/page.tsx` | `Number(p.amount_php ?? 0)` shows ₱0 and feeds `pendingTotal`; `{ data: vendors }` unbound shows "Unknown supplier" | `vendor_subscriptions.amount_php` (null → "—") via `formatPhp`; `vendor_profiles.business_name` | money/sign-in | S |
| ADM-7 | plan quiz | `/pricing/plan` | `app/(shell)/pricing/plan/_plan-steps.ts:EVENT_TYPES` | `{ band: 'B', label: 'A debut, corporate or gala' }` typed; an admin band change quotes the wrong Setnayan AI price | `event_type_vocab.ai_price_tier` + `label_en` via `lib/setnayan-ai-band-source.ts` | money/sign-in | M |
| ADM-8 | verify checks | `/admin/verify` | `app/admin/verify/page.tsx` (`regRows`, `dossierRows`, `expRows`) | `.then((r) => (r.error ? { data: null } : r))` then `needsReview ?? false`: a refused read makes the duplicate-permit check come out clean | `vendor_profiles.registration_number_needs_review`, `.registration_number_raw`, `vendor_web_dossiers` | wrong data | S |
| ADM-9 | concierge abuse | `/admin/concierge-abuse` | `app/admin/concierge-abuse/page.tsx` (users read) | `<StrikePill count={… ?? 0} level={… ?? 'none'}>` beside "Confirm abuse (+1 strike)" | `users.concierge_abuse_strike_count`, `.concierge_enforcement_level` | wrong data | S |
| ADM-10 | receipt reads | `/admin/payments` | `app/admin/payments/page.tsx` (`receiptReads`) + `_components/desk.tsx:ReceiptReadCard` | `{ data: reads }` unbound: "Nobody has read this picture yet."; amounts hand-formatted | `payment_receipt_reads`; `lib/php.ts:formatPhp` | wrong data | S |
| ADM-11 | supplier admin pages | `/admin/vendors/[id]/edit` · `/plan` · `/team` | `edit/page.tsx`, `plan/page.tsx`, `team/page.tsx` | `const { data: profile } … if (!profile) notFound();`: a refused read 404s | `vendor_profiles` (ReadFailed before `notFound()`) | wrong data | S |
| ADM-12 | rating sort | `/?browse=1` sort by highest rated / most reviews | `app/(shell)/explore/_lib/marketplace-view.tsx` (`ratingOf`, `lensCandidates`, `.order('avg_rating_overall')`) | sorts on `vendor_market_stats` while cards print `trusted_avg_rating`: the order disagrees with the stars | `vendor_trusted_review_stats` (already read as `trustedReviewStatsByVendorId`) | wrong data | M |
| ADM-13 | compare stars | `/explore/compare` | `lib/reviews.ts:fetchTrustedReviewStatsForMany`; `app/(shell)/explore/compare/page.tsx` (`rowsRaw`) | `if (error) return m;` (empty Map) shows every column as new; `{ data: rowsRaw }` unbound silently bounces | `vendor_trusted_review_stats`; return null like marketplace-view | wrong data | S |
| ADM-14 | category count | `/?q=…` signed out | `app/_components/frontdoor/front-door-results.tsx` | "…across every shop and all 192 categories.": the typed count `no-typed-category-count.test.ts` bans, outside its folder | `getTaxonomy()` over `canonical_service_taxonomy`, or drop the number | wrong data | S + widen the guard |
| ADM-15 | keep months | `/` signed-out plan cards · `/pricing` Ultra tip | `app/_components/frontdoor/front-door-landing-data.ts:proMore` / `ULTRA_PEEK`; `app/(shell)/pricing/page.tsx` | "Your full-size photos kept 6 months…", "…12 months…" typed | `platform_retail_catalog_v2.fullres_extra_keep_days` (add to `PlanFacts`) | wrong data | S |
| ADM-16 | home JSON-LD | `/` | `app/(hub)/page.tsx:softwareAppJsonLd` | "…Event Plus or Event Pro … the Setnayan AI planner comes inside both" (false since the 18 Nov re-cut); "0% commission on verified supplier bookings." (only "Hosts pay 0% commission." is allowed) | `lib/event-plans.ts:AI_PLAN_SKUS` | wrong data | S |
| ADM-17 | coordinator sample card | `/for-coordinators` | `app/(shell)/for-coordinators/page.tsx` (sample `ServiceFace`) | `rating={{ avg: …, count: … }}` and a literal peso amount passed to `formatPhpRounded(…)`: a typed price and review count | `SAMPLE_SHOP`'s real card: `vendor_services.starting_price_php`, `vendor_trusted_review_stats` | wrong data | M |
| ADM-18 | waitlist | `/waitlist` (no door; in `app/sitemap-static.xml/route.ts` at 0.7) | `app/(shell)/waitlist/page.tsx:WaitlistPage` | a retired page still served: "…0% commission on bookings.", "No waitlist, no commission on bookings", "Pre-register your business today" | retire like `/pakanta` (`redirect('/start')`); drop from sitemap, `DOORWAY_BLEED_PATHS`, `lib/seo/health-checks.ts`, `routes.waitlist` | wrong data | S |
| ADM-19 | partnership badges | `/?browse=1` | `marketplace-view.tsx:SHORTLIST_STATUSES` | `['shortlisted','contracted','deposit_paid','delivered','complete']` retypes the booked list | `['shortlisted', ...BOOKED_EVENT_VENDOR_STATUSES]` | wrong data | S |
| ADM-20 | onboarding bill | `/onboarding/*` services step | `lib/onboarding-services-orders.ts` (`abandon`) | `.from('orders').update({ status: 'cancelled' })` with no error check (baseline): an empty order can stay open as a bill | `orders.status` | not saved | S |
| ADM-21 | signup You card | `/signup/you` | `app/signup/you/page.tsx` + `actions.ts:saveYou` | `(profile ?? {})` draws a blank card on a refused read; Save then writes over the stored name and phone; `{ data: mine }` in the action drops its error | `users.first_name`, `last_name`, `phone`, `slug` | not saved | S |
| ADM-22 | gifts search | `/admin/gifts` | `app/admin/gifts/page.tsx` | `vendorResults = data ?? []`: "No suppliers match "X"." for a refused search | `vendor_profiles.business_name`, `users.email` | wrong data | S |
| ADM-23 | footer word | every page | `app/_components/marketing/reskin-footer.tsx:ReskinFooter` | `<Link href="/monogram">Monogram maker</Link>` (word rule) | — (say Logo Maker) | look | S |
| ADM-24 | JSON-LD count | `/?browse=1` | `marketplace-view.tsx:buildVendorsItemListJsonLd` | "The 12 wedding-supplier categories…" typed beside `numberOfItems: folders.length` | `getTaxonomy().folderOrder.length` | look | S |
| ADM-25 | local peso formatters | onboarding total · admin money desks | `app/onboarding/_shared/services-step.tsx` (`peso`, rounds away centavos on "Your total today"), `app/admin/disputes/_components/*-disputes-section.tsx`, `app/admin/pax-changes/page.tsx`, `app/admin/vendor-partnerships/page.tsx` | `` `₱${Math.round(n).toLocaleString('en-PH')}` `` | `lib/php.ts:formatPhp` | look | M |

### Doors to retired pages (DOOR)

Found with `scripts/audit/dead-paths.mjs`, which asks the middleware's own table (`lib/legacy-redirects.ts`) and the screens map. **No link or redirect anywhere points at a route that does not exist.** These four reach a live page only through a redirect.

| ID | area | route | file:symbol | shows now | real value already lives in | severity | fix |
|---|---|---|---|---|---|---|---|
| DOOR-1 | supplier notification | payout notice | `lib/payouts.ts` (`relatedUrl: '/vendor-dashboard/earnings'`) | opens a stub that redirects to Customers › Money | `customerLandingHref` (Money) | look | S |
| DOOR-2 | supplier notification | dispute notice | `app/dashboard/[eventId]/disputes/actions.ts` (`relatedUrl: '/vendor-dashboard/bookings'`) | opens a stub that redirects to Customers | `customerLandingHref` | look | S |
| DOOR-3 | supplier notification and tips | reusable bookings · growth tips | `lib/reusable-bookings.server.ts` (`relatedUrl: '/vendor-dashboard/proposals'`); `lib/vendor-growth-recs.ts` (`ctaHref: '/vendor-dashboard/calendar'` ×2) | stubs that redirect to Customers | `customerLandingHref`; `daySheetHref` | look | S |
| DOOR-4 | couple | `/dashboard/[eventId]/paperwork` (Chinese date) | `app/dashboard/[eventId]/paperwork/page.tsx` (`baziSpecialistHref`, `` `/explore?category=date_fengshui_consultant` ``) | the retired `/explore`, forwarded by the middleware to `/?category=…` | the Discover builder (`lib/discover-href.ts`) | look | S |

---

## Fix batches, by file area

**Rules.** Within a wave, no two batches share a file. A wave starts after the previous wave merges. Order follows the owner's ruling: suppliers and payments, then couples and guests, then admin. Every batch carries its own guard test (copy `lib/guests-read-is-honest.test.ts`: a stubbed refused read must render "Couldn't read", never the empty or zero face). A file named in a sweep row (SUP-21, SUP-26, CPL-17, CPL-18, ADM-25) but owned by an earlier batch is fixed by that earlier batch, as listed.

### Wave 1 · suppliers and payments

| batch | owns (from `apps/web/`) | findings | size |
|---|---|---|---|
| **S1 · plan, rail, team** | `app/vendor-dashboard/layout.tsx`, `app/vendor-dashboard/_components/vendor-rail-context.tsx`, `app/vendor-dashboard/deep-search/page.tsx`, `app/vendor-dashboard/subscription/_components/plan-screen.tsx`, `app/vendor-dashboard/team/**`, `lib/vendor-seats.ts`, `lib/vendor-team.ts` | SUP-1, SUP-2, SUP-4, SUP-17, SUP-19, SUP-22, + SUP-26 in `plan-screen.tsx` | M |
| **S2 · chat, client, quotes** | `app/vendor-dashboard/messages/[threadId]/page.tsx`, `lib/vendor-service-payment-schedules.server.ts`, `lib/vendor-thread-stage.ts`, `app/vendor-dashboard/clients/[eventId]/page.tsx`, `app/vendor-dashboard/clients/[eventId]/challenge-photos/page.tsx`, `app/vendor-dashboard/proposals/surface.tsx` (use `fetchVendorPoolBookingsDetailed`; do not edit `lib/vendor-schedule.ts`), `lib/reusable-bookings.server.ts` | SUP-3, SUP-9, SUP-15, SUP-20, SUP-23, SUP-24, SUP-27 (clients and challenge-photos), SUP-28 (clients copy), SUP-26 (`fmtPeso`), DOOR-3 (reusable bookings) | M |
| **S3 · on the day** | `app/vendor-dashboard/on-the-day/**` | SUP-5, SUP-10, SUP-28 (`MAX_MEDIA_PER_TYPE`) | S |
| **S4 · place and pins** | `app/vendor-dashboard/actions.ts`, `app/vendor-dashboard/shop/_components/editable-row.tsx`, `app/vendor-dashboard/shop/_components/branch-panel.tsx`, `app/open-shop/_components/city-pin.tsx` | MAP-4, MAP-7, MAP-6 (supplier half) | M |
| **S5 · shop content readers** | `lib/vendor-funnel.ts` (the three `fetch…BySource` only), `lib/recap-vendor.ts`, `lib/realstories-vendor.ts`, `app/vendor-dashboard/shop/promote/_components/share-your-work-data.ts`, `lib/vendor-instagram-status.ts`, `app/vendor-dashboard/collections/collections-data.ts`, `app/vendor-dashboard/shop/_components/voice-match-section.tsx`, `app/vendor-dashboard/recommendations/page.tsx`, `app/vendor-dashboard/repertoire/page.tsx`, `lib/songs.ts`, `lib/creator-offers.ts`, `app/vendor-dashboard/customers/page.tsx`, `lib/vendor-growth-recs.ts`, `app/vendor-dashboard/lines/page.tsx`, `app/vendor-dashboard/activities/page.tsx`, `app/vendor-dashboard/manpower/surface.tsx`, `app/vendor-dashboard/calendar/actions.ts` | SUP-11, SUP-12, SUP-13, SUP-14, SUP-16, SUP-18, SUP-25, SUP-29, SUP-27 (lines, activities, manpower, calendar), DOOR-3 (growth tips) | M |
| **S6 · public supplier doors** | `app/vendor-invite/[slug]/page.tsx`, `lib/vendor-couple-invite.ts`, `lib/vendor-payment-methods.server.ts` | SUP-6, SUP-7, SUP-8 | S |
| **P1 · payments and money desks** | `app/papic/order/[token]/page.tsx`, `lib/admin/pricing-removability.ts`, `app/admin/money/_components/revenue-summary.tsx`, `lib/admin/revenue-statement.ts`, `app/admin/disputes/_components/*-disputes-section.tsx`, `app/admin/payments/actions.ts`, `app/admin/payments/page.tsx`, `app/admin/payments/_components/desk.tsx`, `lib/payouts.ts`, `app/admin/subscriptions/page.tsx`, `lib/onboarding-services-orders.ts` | GST-1, GST-2, ADM-1, ADM-2, ADM-3, ADM-4, ADM-5, ADM-6, ADM-10, ADM-20, DOOR-1, ADM-25 (disputes sections) | M |

### Wave 2 · couples and guests

| batch | owns (from `apps/web/`) | findings | size |
|---|---|---|---|
| **C1 · purchases, documents, story** | `app/dashboard/[eventId]/studio/pakanta/**`, `app/dashboard/[eventId]/documents/page.tsx`, `app/dashboard/[eventId]/story/**`, `lib/contracts.ts`, `lib/paperwork.ts`, `lib/preparation.ts`, `app/dashboard/[eventId]/paperwork/page.tsx`, `lib/invitation-widgets.ts` | CPL-1, CPL-2, CPL-12, CPL-20, CPL-22, DOOR-4, CPL-18 (`pakanta-music-form.tsx`) | M |
| **C2 · venue, pin and date** | `lib/events.ts`, `lib/hub-draft.ts`, `lib/onboarding/event-insert.ts`, `app/dashboard/[eventId]/date-selection/**`, `app/dashboard/[eventId]/wizard-actions.ts`, `app/dashboard/[eventId]/launch/_components/details-your-event-load.tsx`, `app/dashboard/[eventId]/launch/_components/details-city-pick.tsx`, `app/dashboard/[eventId]/_components/address-pin-field.tsx` | MAP-1, MAP-2, MAP-6 (couple half), CPL-3, CPL-4, CPL-13, CPL-18 (`candidate-date-picker.tsx`) | M |
| **C3 · Home, schedule, studio, profile** | `app/dashboard/[eventId]/_components/event-dashboard.tsx`, `app/dashboard/[eventId]/schedule/page.tsx`, `app/dashboard/[eventId]/schedule/_components/emcee-picks.tsx`, `app/dashboard/[eventId]/studio/mood-board/**`, `app/dashboard/[eventId]/disputes/**`, `app/dashboard/[eventId]/guests/claims/page.tsx`, `app/dashboard/[eventId]/studio/panood/**`, `app/dashboard/(account)/profile/page.tsx`, `app/_components/appointments-section.tsx` | CPL-5 … CPL-11, CPL-14, CPL-15, CPL-16, CPL-19, CPL-21, MAP-8, DOOR-2 | M |
| **G1 · guest sign-in and gift doors** | `app/[slug]/pabuya/_lib/gift-page.server.ts`, `app/papic/join/[token]/**`, `app/host/accept/[token]/page.tsx`, `lib/communities.ts`, `app/claim/[token]/page.tsx` | GST-3, GST-4, GST-5, GST-6, GST-7, GST-19 | S |
| **G2 · Event Hub and Papic reads** | `app/[slug]/_components/editorial/data.ts`, `app/[slug]/print/page.tsx`, `app/papic/pool/page.tsx`, `app/[slug]/find-seat/page.tsx`, `app/[slug]/seat/**`, `app/[slug]/_components/guest-column-card.tsx`, `app/[slug]/_components/photos-of-you-gallery.tsx`, `app/[slug]/find-my-table/page.tsx`, `app/[slug]/everyone/page.tsx`, `app/papic/guest/_components/papic-guest-capture.tsx`, `app/papic/lightcheck/**`, `app/panood/control/[eventId]/page.tsx` | GST-8 … GST-18, MAP-3 (GST-17 waits on the owner's call) | M |

### Wave 3 · sweeps, admin and public

| batch | owns (from `apps/web/`) | findings | size |
|---|---|---|---|
| **X-C · couple sweep: one booked list, one peso formatter** | the files listed in CPL-17 and CPL-18 not already fixed in C1 and C2 (all under `app/dashboard/**`) | CPL-17, CPL-18 | M |
| **X-S · supplier sweep: one booked list, one peso formatter** | the files listed in SUP-21 and SUP-26 not already fixed in S1 and S2 (`app/vendor-dashboard/**`, `app/v/[slug]/guest-review/page.tsx`, `app/open-shop/_components/first-card-draft.tsx`, the supplier `lib/` files named) | SUP-21, SUP-26 | M |
| **A1 · admin desks** | `app/admin/verify/page.tsx`, `app/admin/concierge-abuse/page.tsx`, `app/admin/vendors/[vendorProfileId]/{edit,plan,team}/page.tsx`, `app/admin/gifts/page.tsx`, `app/admin/pax-changes/page.tsx`, `app/admin/vendor-partnerships/page.tsx` | ADM-8, ADM-9, ADM-11, ADM-22, ADM-25 (pax-changes, partnerships) | S |
| **PB1 · public pages and claims** | `app/(shell)/explore/_lib/marketplace-view.tsx`, `lib/reviews.ts`, `app/(shell)/explore/compare/page.tsx`, `app/_components/frontdoor/front-door-results.tsx`, `app/_components/frontdoor/front-door-landing-data.ts`, `app/(shell)/pricing/page.tsx`, `app/(shell)/pricing/plan/_plan-steps.ts`, `app/(hub)/page.tsx`, `app/(shell)/for-coordinators/page.tsx`, `app/(shell)/waitlist/page.tsx`, `app/sitemap-static.xml/route.ts`, `lib/seo/health-checks.ts`, `lib/routes.ts` (`waitlist` only), `app/_components/marketing/reskin-footer.tsx`, `app/(shell)/explore/no-typed-category-count.test.ts` | ADM-7, ADM-12, ADM-13, ADM-14, ADM-15, ADM-16, ADM-17, ADM-18, ADM-19, ADM-23, ADM-24 | M |
| **PB2 · onboarding and signup** | `app/signup/you/**`, `app/onboarding/_shared/services-step.tsx`, `app/onboarding/wedding/_components/wedding-venues.tsx`, `app/onboarding/wedding/_components/location-step.tsx` | ADM-21, ADM-25 (services step), MAP-6 (onboarding) | S |
| **M5 · cities from the database** (after C2, PB2 and X-C merge) | `app/onboarding/wedding/_data/wedding-cities.ts`, `lib/region-source.ts`, `app/onboarding/wedding/page.tsx`, and the consumers it passes the rows to (`lib/your-place.ts`, `lib/listed-place.ts`, `lib/onboarding/one-picked-place.ts`, `lib/supplier-landing.ts`, `lib/crew-elsewhere.ts`, `app/dashboard/(account)/create-event/**`) | MAP-5 | L |
| **T1 · widen the honest-reads guards** (tests only, after waves 1 and 2) | `app/vendor-dashboard/reads-are-honest.test.ts`, `app/dashboard/reads-are-honest.test.ts` (new shapes: `[{ data: x }] = await Promise.all(…)`, `xRes.data ?? []`, `.catch(() => [])` on a reader, `lib/` readers that `return []` on error) | the cause behind about 60 rows | M |

---

## Checked and rejected (so nobody re-checks them)

**Maps**
- The guest Hub's venue maps: `lib/event-venues.ts:loadVenueBookings` reads `event_manual_vendors`, `venue_directory` and `vendor_profiles.hq_*`. A refused read falls back to the event's own columns and is logged.
- Hand-added supplier pin: `AddressPinField` → `workspace/actions.ts` → `event_manual_vendors.address_*`, pre-filled back.
- Branch pins (`branches/actions.ts`, both-or-neither) and the open-shop pin (`open-shop/actions.ts`, `parseCoordPair`).
- Service radius: `shop/radius-actions.ts` writes it; Suppliers, category search, area counts and the public shop read it.
- Public shop map, ring and branch line: `app/v/[slug]/page.tsx`.
- Get directions sheet: `lib/map-directions.ts`.
- `papic_photos.geo_*`: write-only by design (privacy control, never returned).
- `vendor_ad_subscriptions.radius_km`: no writer or reader, already in `tests/db/ugat-both-ends.baseline.txt`.
- Branch radius `BRANCH_RADIUS_MAX_KM`: owner ruling 19 Nov ("range is automatic").
- `platform_settings.drive_speed_kmh`: admin-set and read honestly (`fetchDriveSpeed`).

**Supplier**
- `sample-shop-*`: only `app/dev/shop-plan-lab` mounts them.
- Menu-lighting entries in `vendor-nav-destinations.ts` and `vendor-bottom-nav.tsx`: every real menu link opens a real page.
- The `booking-fees/[orderId]` charge line, the `/v/[slug]` experience probe, `live-reviews.tsx`, `stage-script.tsx`.
- `services/[serviceId]` and `vendor-feature-gate.ts` plan reads: behind the paywall switch, which is off.
- `SETNAYAN_PAY_FEE_PCT` and `convenienceFeePhp`: never called. `VENDOR_AI_ADDON_FALLBACK_PHP`: the sale is retired. Partner badge thresholds: owner rules with no table.
- `canvas-maker.tsx` "Coming soon": not pickable. `ComingSoonBanner`: a true status.
- `countIncompatibleShortlist`: fails open by design.
- The Bookings badge: hidden on error.
- `fetchAddOnExtras`, `/vendor-dashboard/real-stories` (retired by ruling), the redirect-only calendar and clients pages, chat meeting cards (already carry `refused`), `fetchVendorTrackRecord`.
- `actions.ts` files that fail closed.

**Guest**
- Guest Hub reads, RSVP, seat, schedule, redeem: pinned by `a-failed-read-is-not-an-absence` and `an-unread-seat-is-not-an-empty-one`.
- Membership reads that fail closed. The doorway E-Gift count (hides the door).
- `isRecapPublished` (a known publishing gate). Optional editorial decorations.
- `SAMPLE_EDITORIAL_IDS` and the site-body fixtures: only the samples, tests and labs reach them.
- `GUEST_CAPTURE_CREDITS = 150`: matches the SQL constant in `papic_record_guest_capture`. Moving it to a table is a migration, not a reader fix.
- `fetchGuestQuota` fallbacks (pinned by `papic-guest-ceiling-display.test.ts`), `/papic/me`, the `/wall` gate, the `/join` flow re-checks, `/pay` and `/receipts` (pinned).
- `/[slug]/hub`: a stub kept so old printed passes land.

**Couple**
- The budget page `paidOrdersRes` and the details legacy money: behind the `budgetTruth` switch, which is on.
- `handoversRes`, `share-link-panel`, guests `arrived` (measured), people counts, the vendors ripe sweep (pre-delivery statuses on purpose), caterer and seating `rsvp_status`.
- our-photos `proActive` (draft on purpose). The memories thank-you SKU (free for all).
- `HostQuestions`, packages `pkgRow` (fails closed), access requests, internal-host checks, pending orders (measured).
- `SAMPLE_TODO`: labelled "Example". `lib/wedding-essentials.ts:primaryHref` → `/settings`: never read.
- `revalidatePath` calls to stubs: cache keys, not doors.

**Admin and public**
- `/onboarding/simple`: its door is data (`event_type_vocab.onboarding_href`).
- `/sample/[...rest]`: a deliberate 404 guard.
- `/pakanta` and `/patiktok` stubs: nothing links to them.
- All 380 admin nav hrefs resolve.
- Data-driven "Coming soon" tiles. `FocusHome` counts: unread shows as unread.
- Payouts, booking fees, account card, verify list, dispute stats, receipts: pinned by `admin-reads-say-couldnt-read.test.ts`.
- The `/papic` set-up discount default (owned by `readOnboardingDiscountPct`), `/for-suppliers` (pinned by `supplier-front-reads-its-numbers.test.ts`), `features/_story-sample-moments.tsx` (an approved illustration), `EXPLORE_HERO_CHIPS` (a fallback only), the compare tier gate (does nothing today), label-only name lookups, `min_fee_centavos ?? 5000`.
- The admin visits tab's demo figures (`lib/visits/visit-stats.ts:buildDemoVisitStats`): shown only with demo mode on, under "Illustrative demo data".
- `app/admin/app-performance/_components/action-center.tsx` `/admin/${c.key}`: all 15 keys have a page.

**Doors:** no `href="#"`, `onClick={() => {}}` or `console.log` handler anywhere in production code; `/[slug]/everyone`, `/[slug]/seat`, `/papic/lightcheck`, `/waitlist`, `/onboarding/simple`, `/sample/[...rest]` judged above.

**Also noticed, outside this audit's scope** (for the copy or design lanes):
- Hand-typed prices in comments: the panood control page and the seat page docblock (rule: never write a price into a comment).
- "Pabuya" on the E-Gifts header.
- "Kept safe on Setnayan" on the gift page (brand rule 10).
- Hex colours on `/live`.
- `text-[12px]` in the pin fields.

---

## How to re-run the scans

The helpers under `scripts/audit/` touch no database, no network and no app file. Each prints candidates; only what is in the tables above was confirmed by reading the code.

```bash
node scripts/audit/location-columns.mjs
```

```bash
node scripts/audit/dropped-read-errors.mjs --area app/dashboard
```

```bash
node --experimental-strip-types --no-warnings scripts/audit/dead-paths.mjs
```

`dead-paths.mjs` imports `lib/legacy-redirects.ts` (the middleware's own table) through `scripts/audit/ts-alias-hooks.mjs`, so it never keeps a second copy of the retired-page list.
