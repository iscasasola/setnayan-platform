# Setnayan — Project Status

> Living checkpoint. Refreshed 2026-05-22 (Task #13 — day-of PWA Phase 1).
> Anchor doc — if you're opening this repo cold in a new Claude session, start here.

**Owner deadline anchor:** December 2026 wedding

---

## Where we are right now

V1 web surface is **functionally complete**. Pre-launch sprint closed 2026-05-13 (19 iterations). 2026-05-14 then landed **28 PRs** across two waves.

**2026-06-03 — wedding onboarding caters all faiths (0016).** Owner ("fix all gaps… cater all different religious weddings"). Faith-adaptive ceremony venue — `ceremonyOptsFor(faith)` swaps the house of worship (Catholic/Christian→Church · INC→Chapel · Muslim→**Mosque** · Chinese→**Temple** · Cultural→outdoor/ancestral) + universal Garden/Beach/Civil/Same; two matching photos generated via Recraft. De-churched copy ("A faith ceremony" / "Where will you hold your ceremony?" / venue blurb / groom role). Chinese activation = #889 (deduped on merge; my redundant migration dropped). `tsc --noEmit` exit 0.

**2026-06-03 — per-religion wedding traditions guide (0043).** Owner: "create onboarding that follows the traditions of each religion." Built on the existing per-religion doc/deadline engine (`lib/paperwork.ts` already gives each ceremony_type its own documents + lead-time deadlines flowing into /paperwork + the /schedule agenda + Home reminders). New `lib/wedding-traditions.ts` (`WEDDING_TRADITIONS_GUIDE` per ceremony_type) drives a "What to expect — your {religion} wedding" section on /paperwork — overview + officiant/ceremony/food/custom items + "confirm with your {officiant}." Chinese seeded forward-compat. Content is honest STARTER guidance (NEEDS owner/clergy validation, flagged for Cowork). typecheck + lint green. No migration.

**2026-06-03 — event_type enum guarantee + create-event copy aligned to "all live" (0000/0041).** Follow-up to "keep everything live." Migration `20260805000000` (owner-push) belt-and-suspenders the event_type enum (`ADD VALUE IF NOT EXISTS` debut + gender_reveal — already in prod per #884 — plus NEW seedable anniversary/graduation/reunion). `create-event/page.tsx` copy de-stale'd: the header + `invalid_type` error no longer say "only weddings live" or "tap to be notified" (no notify flow exists). The 3 new types are enum-only (not in the picker roster). typecheck + lint green. **Owner action: push `20260805000000`.** Spec-0000 reconciliation (all-live, no notify) logged for Cowork.

**2026-06-03 — Chinese wedding added as a coming-soon ceremony type (0043).** Owner: "on weddings, also add chinese wedding." Chinese (Tsinoy — tea ceremony + Chinese customs) joins the wedding-type lineup as the lone **coming_soon** faith (the others were unlocked the same day) — surfaced in the create-event picker (greyed + notify-me) and onboarding (greyed chip), gated until vendor density can cater it. Migration `20260804000000` (owner-push) widens the 4 ceremony CHECK constraints to permit `chinese` + seeds its launch-status row coming_soon (widening-only → activation later is migration-free). 9 code touchpoints (shared radio options, picker secondary label, notify list, launch-status fallback, onboarding faith type/photo/chip, edit-modal disable, admin venue constants + label map) + new hero `public/onboarding/wed_chinese.webp`. Admins can already tag Chinese-compatible venues/vendors to build supply. typecheck + lint green. **Owner action: push `20260804000000`.**

**2026-06-03 — in-app service tiles made clickable for checking (0004/0010/0021).** Owner directive ("for now we want to unlock all to check"). After religions + events, the remaining services-catalog locks were 3 coming-soon tiles: **Monogram Creator** repointed to the real `animated-monogram` studio (0004), **Mood Board** surfaced from its real `/add-ons/mood-board` route (0010, was built-but-unsurfaced), and **Landing Page** + **Music Creator** made clickable to their polite `[addon]` info pages. Catalog-only (`lib/add-ons-catalog.ts`) → propagates to the /add-ons grid + the Services-tab rails. `tsc --noEmit` exit 0. **Left intentionally gated** (hide unbuilt/partial features — flipping would surface stubs/broken flows): the 8 not-built pricing SKUs, Concierge (`CONCIERGE_ENABLED=false`, retired), OAuth sign-in (needs real credentials), offline daemon (upload stubs). Those need building, not a flag flip.

**2026-06-03 — one-click "Create demo vendors" on /admin/demo-vendors (chunked seed · admin console 0023).** Creating demo vendors was CLI-only (Regenerate just cleaned + printed the command). Now a Create button clicks once → the browser loops category-by-category against a new chunked API (`/api/admin/demo/seed` · start+chunk) until the marketplace is seeded, with a progress bar. Refactored the seed core to be importable WITHOUT moving it: extracted `export seedCategory()` + exported the fetch/cleanup helpers + `isNonProdUrl`, and guarded the CLI entrypoint so importing never auto-runs (per-category RNG ⇒ chunked output == CLI output; CLI behavior preserved). Non-prod-gated (refuses prod → 403 on the live deploy; works on staging). No migration. typecheck + lint green; refactor-safety smoke tests pass. **Owner:** on staging, click Create on /admin/demo-vendors. CI gates the production build (route bundles the scripts/ import).

**2026-06-03 — onboarding completion hang fixed (0016).** The final "Creating your personalized dashboard" overlay could strand a couple forever (owner report, production iPhone): `handleFinish` awaited the commit server action with no try/catch, so a rejected action (500 / serverless function timeout / dropped RSC transport on mobile) left the blocking overlay up with the retry guard locked. Fixed across the three weak points — try/catch around the commit (unwind + show the existing retry error on reject) + a hard-`window.location.assign` watchdog if the client router wedges or `router.push` no-ops + a 2s `AbortController` on the awaited PostHog `captureEvent` fetch (it could drag the serverless function to its timeout) + the post-insert shortlist/anchor seed wrapped non-fatal (a throw there rejected the commit *after* the event existed → duplicate-on-retry). typecheck + lint green. SPEC IMPACT none. Follow-up flagged: the commit is still non-idempotent on the other failure branches (needs a client idempotency key + server dedup).

**2026-06-03 — all event types unlocked (0000/0041).** Owner directive ("unlock all events"): the seven "Coming soon" event types (Gender Reveal · Birthday · Celebration · Travel · Corporate · Tournament · Christening) are now creatable alongside Wedding + Debut. Two code gates: `EVENT_TYPES[].enabled` (event-types.ts — drives both the create-event picker AND the add-event sheet) + `ALLOWED_TYPES` (create-event/actions.ts server validation). No migration — the `public.event_type` enum already held all 9 values (verified against prod); the `isWedding` branch already NULLs wedding-only fields for non-wedding events; they redirect to the standard dashboard (the path debut already exercises). `tsc --noEmit` exit 0. **Downstream caveat:** non-wedding events get the wedding-tailored planning surfaces until per-type flows land (V1.2+).

**2026-06-03 — all wedding faiths unlocked (0043/0016).** Owner directive ("unlock all religions first"): Christian / INC / Muslim / Cultural flipped from "Coming Soon" to **active** across all five gates — the onboarding faith chips (`FAITH_CHIPS` `soon:false`), both `ALLOWED_CEREMONIES` server constants (the onboarding commit no longer silently coerces non-Catholic → catholic), the create-event launch-status fallback, and the canonical `wedding_type_launch_status` table (migration `20260803000000`, every row → active; verified applied to prod by direct query). The DB CHECK requiring a Muslim/Cultural tradition sub-type is satisfied in onboarding by defaulting (`general_muslim` / `other`) since onboarding has no tradition picker (create-event collects it). Overrides the per-region vendor-density activation gate (global unlock). Full CI green. No owner action (migration already applied).

**2026-06-03 — in-app services nested INTO the Vendors-tab category rails (0021).** Retired the standalone in-app-services launcher grid; Setnayan services now render as ✦ Setnayan supplementary cards (float-to-top) inside their canonical category — Save-the-Date/Papic/Panood → Photography & Video · Patiktok → Photobooth · LED → LED Background · Animated Monogram → a new Design › Digital Services rail — with a compact "Tools & extras" strip for non-category tools. Single `category` field on the add-ons catalog drives placement. typecheck + lint + runtime partition check green; visual check on the Vercel preview. **Follow-ups:** §3 vendor-model convergence + fleshing out the Digital Services rail (Pakanta / Pro Website / Live Wall need catalog entries + routes).
**2026-06-03 — event-type picker → swipeable hero-photo carousel (0000).** Owner ask (screenshot of the add-event sheet): *"we want a carousel but like hero photos. let them scroll all the possible events."* New shared `event-type-carousel.tsx` — a horizontal scroll-snap filmstrip of full-bleed Recraft hero photos (one per event type), swipe to browse all; arrows + dots track the centred card. Live types (Wedding/Debut) = colour + gold "Available" + tap-to-continue; coming-soon = grayscale + inert + "Coming soon". Both the event-switcher sheet AND the full `/dashboard/create-event` page now use it (old emoji-tile `Tile`/`ArrowButton` deleted). 9 hero photos at `public/event-types/` (15.5 MB → 541 KB). Switcher subtitle copy de-promised the never-built "notify me" line. `tsc --noEmit` + `next lint` clean; live preview not run (auth+DB-gated, no `NEXT_PUBLIC_SUPABASE_*` here). No migration.

**2026-06-03 — customer top nav slimmed: Marketplace + Switch View icons removed (0000/0021).** Owner directive ("remove these 2 on top nav", both circled on mobile): dropped the 🏪 Marketplace (`/vendors`) link + the 👤﹀ Switch View `RoleSwitchPill` from the customer **top bar** — event-scoped (`[eventId]/layout.tsx`) AND non-event routes (`outer-dashboard-header.tsx`). Top bar is now event-switcher monogram · Messages · Bell · Profile-monogram. The desktop **left sidebar** keeps both per the owner's scope choice. Nothing orphaned (Marketplace via the home tease-strip / "Browse matched services" / plan cards / sidebar; role-switch via the event-switcher dropdown + sidebar). `next lint` + `tsc --noEmit` clean. No migration.

**2026-06-03 — admin song dedup/merge tool · COMPATIBILITY BUILD COMPLETE (PR 6 · 0023/0006).** `/admin/songs`: search the master catalogue + merge near-duplicates (Duplicate ID → Canonical ID; `mergeSongs` re-points repertoires + picks then deletes the dup) + remove junk. `requireAdmin`-gated actions; "Songs" nav item by Taxonomy. typecheck + lint + build green. **This completes the compatibility build (PRs 1–6)**: schema+seed · vendor "Your repertoire" · couple picks → event_song_picks · the overlap score+cue on the music cards · the admin dedup tool. **Owner action remains: push migration `20260731000000`.** Open refinements: explicit Best/Next-best section-headers, the marketplace/Category-Search cue, the catering food-look parallel.

**2026-06-03 — music compatibility score live on the wizard music cards (compatibility PR 4 · 0006/0016).** `fetchWizardVendorRecommendations` now (for music categories with a matched event) re-ranks vendors by song overlap (couple `event_song_picks` ∩ vendor `vendor_songs`) — matches float to the top, never excluded — and each card shows "♪ Best match · plays N of your M songs" (≥90% = best). Optional `matchEventId` arg + optional score fields (24 callers safe); over-fetch→stable-sort→trim; the 2 music cards + in-card search pass it through. typecheck + lint + build green. **Owner action:** push migration `20260731000000` to light it up. Next: PR 6 admin dedup. (Explicit Best/Next-best section-headers + the marketplace/Category-Search cue = noted refinements.)

**2026-06-03 — couple onboarding music picks → event_song_picks (compatibility PR 3 · 0016/0006).** The onboarding music picker now also writes the couple's chosen songs to `event_song_picks` (the couple side of the music overlap), alongside the display-only `music_playlist_seed`. `lib/songs.ts` `syncEventSongPicks` (find-or-create each "Title|Artist" → upsert), called from `commitOnboardingWedding` with the service-role client, wrapped so it can never fail the commit (graceful before the 20260731000000 migration is pushed). typecheck + lint + build green. Data only. Next: the compatibility score in the recommender + the 90% split.

**2026-06-03 — vendor "Your repertoire" capture (compatibility PR 2 · 0022/0006).** Music acts (band/choir/orchestra/singer/DJ) now build their song set list at `/vendor-dashboard/repertoire` — search the master library (the seeded MUSIC100), add existing or new songs (new ones join the deduped catalogue), manage/remove. The vendor side of the music compatibility overlap. `lib/songs.ts` helpers (RLS-safe select-then-insert find-or-create) + the page/actions + a Pipeline nav item; gated to music vendors with a clear explainer for others. typecheck + lint + build green. Next: onboarding picker → event_song_picks → the score.

**2026-06-03 — chrome monogram = the full framed onboarding monogram + exact fonts + event logo (0000/0021).** Follow-up to PR #863 closing the 3 parked items: the switcher icon + the upper-right profile avatar now render the couple's ACTUAL framed onboarding monogram (gold frame webp + initials in the chosen font + ink — the onboarding medallion scaled down), not letters-forward; the exact display faces (Cinzel · Playfair · Great Vibes) are loaded in the chrome; and the profile avatar is now the event's logo (owner "that will be the logo of the event"). typecheck + lint + build green. Flagged for owner eyeball (frame legibility at the small 28/36px switcher sizes; the 44px avatar reads best).

**2026-06-03 — vendor-compatibility build started: master song list foundation (PR 1 · 0006/0044).** Owner-locked the compatibility model (corpus `Vendor_Compatibility_and_Master_Songlist_2026-06-03.md`): vendors place the songs they perform → compiled into a shared **master song list**; couples pick from it; music-vendor **compatibility = song overlap**, matches float up, nobody hidden, `<90%` = "next best options." PR 1 lands the substrate — migration `20260731000000`: `songs` (master, seeded from the curated MUSIC100, deduped), `vendor_songs` (repertoire), `event_song_picks` (couple picks); RLS at create. This is the data the parked **"best-match recommender (PR D)"** needed. Foundation only — no app behavior change. **Owner action:** push `20260731000000`. Next: vendor "Your repertoire" capture → picker→master → the score.

**2026-06-03 — Admin demo-vendor inquiry responder + unique demo emails (admin console 0023 · chat 0019).** So the team can test the customer↔vendor inquiry round-trip from one place. Demo vendors were unclaimed (no one receives inquiries) AND shared one contact_email (ambiguous `.maybeSingle()` lookup → couples couldn't start a thread). Now: (1) the seed gives each demo vendor a unique `${slug}@demo.setnayan.local` so a couple's Message flow resolves to exactly one; (2) new `/admin/demo-vendors/inquiries` (+ `/[threadId]`) lists demo-vendor inquiry threads and lets an admin Accept/Decline/reply **as the vendor** via the service-role client — double-gated (admin + is_demo only). Reply posts `sender_role='vendor'`; Accept fires the existing name-reveal trigger. No migration; reuses chat tables. typecheck + lint green. **Owner action:** re-seed staging, then run the round-trip (couple Message → admin responds). **Parked:** best-match recommender (PR D) until taxonomy settles.

**2026-06-03 — onboarding free monogram → event-switcher icon (0000).** The couple's free onboarding monogram (chosen frame + font, persisted `events.monogram_frame_key`/`monogram_font_key`) now renders as their **event-switcher icon** instead of a plain initials circle — `EventMonogram` renders letters-forward in the couple's chosen font + ink (the ornate gold frame is illegible at ~28px, so it's reserved for the larger onboarding medallion / Website editor). Threaded the two columns through the switcher data path (`lib/events.ts` · both `/dashboard` layouts · `outer-dashboard-header` · `event-switcher`); all new fields optional → admin chrome + non-onboarding events unchanged. typecheck + lint + build green. **Open fork:** initials-in-font+ink vs the literal framed mini-monogram (fast follow). Spec correction logged in `COWORK_INBOX.md` (corpus rows name `events.monogram_svg`; real columns are `monogram_frame_key`/`monogram_font_key`).

**2026-06-03 — Demo-vendor testing tools: calendar blocks + claim helper + 20–50 default (marketplace simulation · follow-up).** Unblocks testing the two real flows with demo data. (1) The seed now gives each demo vendor 2–8 full-day `vendor_calendar_blocks` so the **mutual-schedule narrowing** (`lib/vendor-availability.ts`) is exercisable — previously demo vendors had no blocks (always free) so the intersection never narrowed. (2) New `scripts/claim-demo-vendors.ts` claims ONE demo vendor to a vendor user (`user_id`+`is_demo=false`+unique `contact_email`; 1:1-guarded) so it can **receive/reply to inquiries** — demo vendors are otherwise unclaimed (`user_id=NULL`) and inquiries orphan. (3) Seed default bumped 5–10 → **20–50 vendors/category** (owner's testing target; ~4–9.6k/run). Seed/scripts only, no migration. typecheck+lint green; block harness confirms the 30-min/zero-second CHECK holds across timezones. **Owner action:** re-seed staging; for Q5 lock 2–3 demo vendors and watch the schedule narrow; for Q4 run the claim helper + the inquiry round-trip. **Next:** best-match recommender (PR D).

**2026-06-03 — Demo vendors get reviews/ratings, district addresses & real names (marketplace simulation · follow-up).** So demo vendors can exercise find → compare → "pick the best." Seed-only (no migration): each vendor gets a hidden baseline quality + 0–10 synthetic reviews (five 1-5 sub-axis ratings, ~60% with a Filipino-voice body, ~20% vendor reply) — `couple_user_id=NULL` (self-review trigger short-circuits) reusing the archived `TEST-REVIEW · %` event pool (migration 20260607000000) for the NOT-NULL event_id, bulk-inserted so the `vendor_review_stats` matview refreshes only a few times; ratings now differentiate vendors (per-vendor mean ⭐ spread 3.0–5.0). Addresses go district-level (`{District}, {City}, Philippines`); the `Demo ·` name prefix is dropped (is_demo flag unchanged). typecheck + lint green; offline harness clean. **Owner action:** re-run the seed on staging, then check `/vendors?demo=1&sort=highest_rated` + compare + a demo `/v/[slug]`. **Next:** the "best match" recommender (4th ask) builds on these ratings.

**2026-06-03 — Demo vendors get real per-category details, richer packages & images (marketplace simulation · 0044/0022).** Owner flagged that the admin Demo Vendors seed should make synthetic vendors *"provide the details and customization for each of the categories."* The seed (`scripts/seed-demo-vendors.ts`) was writing one generic 5-field blob for all 192 categories + hard-coding `completeness_score:75`/`meets_visibility_minimum:true` (and never filling the real `service_regions` minimum field). Now: a **schema-driven generator** loads each `canonical_service_schemas` row + inherited shared groups and fills realistic, schema-valid per-field values, with **honest** completeness + visibility scoring (minimum fields always filled → still visible, now earned; ~18% of optional fields left unset → ~80-100 variance). **Richer packages** — 7 new `priceProfileFor()` buckets so niche categories (booths/stations, keepsakes, accessories, rentals, ceremony paperwork, wellness, food carts) get category-appropriate tiers instead of the generic catch-all. **Images** — seed sets `logo_url` + `portfolio_r2_keys` to deterministic picsum URLs; `vendor-card.tsx`'s image guard now allows picsum (already in `next.config.ts`). **Public profile render** — `/v/[slug]` gains a **Details** section (per-category attributes) + a **Portfolio** gallery (reuses `fetchVendorServiceAttributes`/`fetchSchemaWithSharedGroups`/`displayUrlForStoredAsset`); benefits real vendors too. typecheck + lint green; offline generator harness confirms minimum-fields filled + honest scoring + `required_if`. **Owner action:** run the seed on **staging** (`SUPABASE_URL` + service key for a non-prod project; the script refuses prod) to repopulate the demo batch, then spot-check `/vendors?demo=1` + a demo `/v/[slug]`.

**2026-06-03 — Typed Preparation items: meeting & payment schedules (couple + vendor · 0021/0022/0007).** Owner follow-up to PR #845. The hand-added prep items on the couple's `/schedule` **Preparation** agenda can now be **typed**: a couple or a booked vendor places a **Task**, a **Meeting**, or a **Payment**. Meeting rows render with the SAME Meeting tag/icon as the autofilled `vendor_meetings`; Payment rows render with the SAME Payment tag/icon **+ the ₱ amount** (formatted like autofilled vendor-payment rows); Task rows keep the prior manual style. Both add modals gain a shared Task/Meeting/Payment segmented picker (`prep-kind-picker.tsx`) + a conditional Amount (₱) field (Payment only); the couple + vendor actions validate amount > 0 and stamp `kind`/`amount_php`. Backed by NEW additive migration `20260730000000_event_preparation_item_kinds.sql` (**owner-push** — adds `kind` + `amount_php` columns, **no RLS change**; #845's policies already cover them). **GRACEFUL DEGRADE preserved:** `SELECT *` + `kind ?? 'task'` / `amount_php ?? null` so pre-migration rows coalesce to plain tasks, and the whole source still returns `[]` if the #845 table is absent. Autofill + Event Day mode untouched; no 4th Home block. **Schema reason:** typed items live on `event_preparation_items` (correct `vendor_profile_id` RLS) because `event_vendor_line_items` + `vendor_meetings` key to the TEXT-named `event_vendors.vendor_id`, which a platform vendor can't be RLS-scoped to. **Limitation:** prep-payments show on the schedule only, NOT the couple Budget ledger (0007) — candidate follow-up. typecheck + lint + build green. **Owner action:** push `20260730000000`.

**2026-06-03 — Onboarding congrats vendor stat → REAL marketplace counts (onboarding · 0015/0016).** The `/onboarding/wedding` "You did the hard part" congrats screen's third stat tile no longer fabricates **"N best-fit vendors from 2,400+"** (was `picked-categories × 5` floored at 12 + a hardcoded "2,400+"). New criteria-based server action `getOnboardingVendorCounts` returns two real `vendor_market_stats` head-counts — `matched` (published vendors in the couple's picked categories that fit their ceremony/venue) and `total` (the published pool for those categories) — using the **same published-pool definition as the `/vendors` marketplace** (`lib/vendor-counts.ts`), so the tile matches reality. Renders "{matched} that fit your wedding · from {total}" and **auto-hides** when uncomputable (never fabricates). Money + hours tiles unchanged. Ships the never-merged `4af4f6c` (cherry-picked onto fresh `main`; the original branch had no PR and went 66 commits stale). typecheck + lint green. **No migration.**

**2026-06-03 — Photo Delivery "Release to Drive" made functional (cron-free).** The release action now drains via Next 15 `after()` instead of the dormant `photo-delivery-tick` cron (which never had a scheduler), so releasing actually copies to Drive. Pairs with Phase 2's capture auto-sync — the whole Drive surface is cron-free. `oauth-refresh` cron left dormant (redundant; consumers refresh on-demand).

**2026-06-03 — Schedule Preparation is now HYBRID (couple + vendor manual items · 0021/0006/0022).** Completes the fast-follow #840 deferred. The couple's `/schedule` **Preparation** agenda gains a write path on top of the read-only autofill: couples can **+ Add to schedule** their own dated items (modal: label / date / notes; bottom-sheet on mobile) and delete items (incl. dismissing vendor-added ones); booked vendors get an **Add to prep schedule** control on each **accepted** booking in `/vendor-dashboard/bookings` (+ a delete list of their own additions). Backed by NEW table `event_preparation_items` (migration `20260729000000`, **owner-push**) with RLS-at-create: couple full CRUD via `current_couple_event_ids()`; vendor SELECT on accepted-thread events, INSERT only for accepted threads stamping their own `vendor_profile_id`, UPDATE/DELETE own rows only. New `'manual'` source in `lib/preparation.ts` merges into the date-sorted agenda and **graceful-degrades** (catches `42P01` → autofill-only) so the deploy is safe pre-migration. Autofill + Event Day mode untouched; Home 3-block rule respected. typecheck + lint + build green. **Owner action:** push `20260729000000`.

**2026-06-03 — Drive-copy Phase 2 (Papic auto-sync, cron-free).** Papic captures (paparazzo + guest camera) now `enqueueDriveCopy('papic')` + drain in the background via Next 15 `after()` → couple's Drive (same folder as the manual release, deduped). No cron (the repo's existing cron endpoints have no scheduler anyway). 5 other feeders await their services' pipelines. `readR2Object` now strips `r2://` prefixes (latent fix).

**2026-06-03 — Messages icon unread badge (delta #2 follow-up · 0019/0021).** The icon-only `MessageSquare` link from PR #837 now carries an unread count, mirroring the bell. New per-user/per-thread read marker `chat_thread_reads` + `count_unread_message_threads()` RPC (NEW migration `20260728000000_chat_thread_reads.sql` — additive, RLS-at-create, **owner-push**). `countUnreadMessages()` (`lib/chat.ts`) drives the badge; `markThreadRead(threadId)` (`lib/chat-actions.ts`) stamps `last_read_at` on render of both the couple + vendor thread pages; new client component `unread-messages-badge.tsx` resyncs via Realtime on `chat_messages` INSERT. **Graceful-degrades to 0 pre-migration** (mirrors `countUnread`) so the deploy is safe before the owner applies it — badge reads 0, opening a thread never fails. One SQL fix vs draft: `current_vendor_ids()` (a NULL stub) → `current_vendor_profile_ids()` for the vendor-side count. typecheck + lint + build green.

**2026-06-03 — Schedule Preparation⇄Event Day toggle (chrome redesign delta #3 · 0021).** The couple's `/schedule` page now carries a URL-driven `Preparation | Event Day` segmented toggle. **Event Day** = the existing editable day-of blocks UI (untouched — lifted verbatim into an `EventDayView` helper). **Preparation** = a NEW read-only, month-grouped agenda that auto-fills from EXISTING dated data via new `lib/preparation.ts`: vendor **payment** due dates (`event_vendor_line_items`, fully-paid lines dropped), **paperwork** "complete by" deadlines (`event_paperwork` + `lib/paperwork.ts`), vendor **meetings** (`vendor_meetings`), and statutory **milestones** (PSA/license/Pre-Cana windows computed from `event_date`+`ceremony_type`). **No new table/migration** — pure aggregation. **Deferred:** manual user-added prep items (needs a table → `COWORK_INBOX`). **Absent (documented):** orders have no due-date column (`expires_at` is renewal billing, omitted); Concierge/Today's Focus has no per-step dated milestone. **Home untouched** — the lean-home 3-block rule is respected. Final delta of the **4-delta** 2026-06-03 chrome-redesign port. typecheck + lint green.

**2026-06-03 — In-app add-ons surfaced inside Services tab (chrome redesign delta #4 · 0006/0021).** The "Services" tab (`/vendors`) now shows a compact "In-app services & add-ons" section (horizontal-scroll mini-card grid on mobile, 4-col on desktop) below the vendor plan+budget accordion. Reuses shared `lib/add-ons-catalog.ts` (extracted from add-ons/page.tsx). Canonical `/add-ons` route untouched. All 4 chrome-redesign deltas are now shipped. typecheck + lint green.

**2026-06-03 — Drive-copy Phase 0 (OAuth consolidation).** Collapsed the two per-event Google Drive connections (Papic `provider='drive'` + Photo Delivery `provider='drive_photo_delivery'`) into ONE: the Photo Delivery connect now routes through the canonical Drive consent + redirect URI + `provider='drive'` grant; release worker + disconnect + the drive-copy layer all read the one grant. Migration `20260727000000` is a safety-net data backfill. **Owner action:** push `20260727000000`; register only `GOOGLE_DRIVE_OAUTH_REDIRECT_URI` (retire `PHOTO_DELIVERY_OAUTH_REDIRECT_URI`). Next: Phase 2 (wire the 6 feeders).

**2026-06-03 — Messages icon in top bar (chrome redesign delta #2 · 0019/0021).** `MessageSquare` link added to the event-scoped top bar right cluster, adjacent to the bell, linking to `/dashboard/[eventId]/messages`. No unread badge (no `read_at` column in `chat_messages` in V1 — badge deferred to a follow-up). typecheck + lint green.

**2026-06-03 — Home "Your wedding details" card (chrome redesign delta #1 · 0021).** Event Home now surfaces the couple's onboarding details as one compact kv card (Location · Venue · Guests · Budget · Style · Cuisine · Photo & video) with a "See all wedding settings →" link to `/details`. Reshapes the existing `PersonalizedMenu` preview (chips → card); `/for-you` unchanged. First of **4 deltas** porting the 2026-06-03 chrome redesign to live — an audit found most of the redesign (5-tab nav, Website tab, `/details` settings, Messages, top-bar Switch/bell) was **already shipped**; the remaining 3 deltas are the top-bar Messages icon, the Schedule Preparation⇄Event Day toggle, and the Service+Add-ons merge. typecheck + lint green.

**2026-06-03 — Drive-copy layer keystone (storage lock).** Shipped Phase 1 of the 2026-06-03 storage architecture: R2 = system of record, Google Drive = the couple's permanent copy of 6 artifacts (Papic · Patiktok · Pabati · Pakanta · Monogram · QR codes; Panood carved out → YouTube only). New `lib/drive-copy.ts` `pushToDriveCopy()` + `drive_copy_folders`/`drive_copy_artifacts` schema (migration `20260726000000`), plus a behavior-identical extraction of the R2→Drive primitives into `lib/drive-upload.ts` (shared with the live 0009 flow). Additive + pilot-safe; no feeders wired yet. **Owner action:** push migration `20260726000000`. Follow-ups: OAuth consolidation (Phase 0), 6 feeders, cron tick, R2 3-month compress, Drive quota fallback. Design + worklist: corpus `Storage_and_Drive_Copy_Architecture_2026-06-03.md`.

**2026-06-03 — mobile Guests carousel reshaped (0001).** Customize panel is now select-and-assign (tap Select → card checkboxes → select-all + live count + Assign → bottom sheet: Side / Role / Group, with create-new-group); the View/Groups/Tags filters folded into Search & sort; sort gains Side/Role/Group; mobile header removed (Summary carries the count); carousel docked as a clean raised sheet (no doubled border). Desktop unchanged. Spec follow-up logged in `COWORK_INBOX.md` (`[PENDING] 2026-06-03`).

**2026-06-03 — bride & groom are the event foundation (0001).** Couple auto-Attending (DB trigger `20260725000000` + app read-coercion), can't be deleted (single + bulk guard), still renamable, and Bride/Groom hidden from the role pickers (role + RSVP locked on their detail page). Owner action: push the migration (`OWNER_ACTIONS.md` 2026-06-03) so the stored RSVP matches the UI.

**2026-06-03 — couple detail kept simple (0001).** The briefly-shipped editorial live-view iframe was reverted per owner clarification — the bride/groom detail just shows their info, like any other guest (foundation locks retained: auto-Attending, can't-delete, role/RSVP locked). "Editorial" = the `/[slug]` page's post-wedding recap state (day-of lifecycle, 0031), which activates at the end of the wedding — nothing separate to build.

**Task #13 (2026-05-22) — day-of PWA Phase 1.** Public guest surface at `/[slug]` flipped from `force-dynamic` to ISR (`revalidate = 60`); day-of-mode lifecycle branches (`pre` / `live` / `post`) wired via `getDayOfPhase`; new `GuestPreload` client component posts `PRELOAD_ASSETS` to the SW on hydration so guest at venue with weak WiFi sees the invitation from SHELL_CACHE on reload instead of a blank page. Live phase pins schedule + green "Live now" banner to top; post phase shows quiet "Thank you for celebrating" header. Manual offline test recipe added to `OWNER_ACTIONS.md` (Playwright deferred — no test infrastructure in repo yet). Phase 2 per-guest table-assignment preload deferred to V1.1 per Task #9 audit.

**Wave 1 — launch hardening (PRs #1–#23):** landing-page conversion upgrades, full observability (Sentry + PostHog), R2 storage migration, day-of mode + event-day pre-load, account-lifecycle redesign (Delete vs Blacklist), persistent login, caching foundation, Services → Add-ons rename, Phase 1 placeholder routes, 7 of 10 V1 email templates wired through Resend, status doc refresh.

**Wave 2 — Phase 2 closed (PRs #24–#28, merged 08:40–08:43Z):** 5 background agents shipped in parallel:
- **#24** vendor marketplace at `/vendors` + reviews system (couple form, vendor reply, public profile section)
- **#25** vendor dashboard expansion — services editor + bookings inbox + 4-role team + earnings rollup
- **#26** admin force-majeure queue + couple-side dispute filing + admin funnel analytics (`/admin/funnels`)
- **#27** read-only public API (`/api/v1/events|guests|vendors`) + scope-gated `sk_live_*` keys
- **#28** EN/TL dashboard locale toggle + 2 more email templates (event-wired count 7 → 9)

Email-wired count is now **9 of 10** V1 templates. Only Phase 3 decision-gated items below remain.

> **🔴 Active prod-deploy gap (Task #49, 2026-05-22):** Guest-list edit form throws `invalid input value for enum guest_role: "bride"` / `"groom"` because `20260530020000_guest_role_add_bride_groom.sql` (committed 2026-05-21) hasn't been applied to prod. Run `supabase migration list --linked` from your local checkout to see all unpushed migrations from the last 12 days, then `supabase db push --linked` to apply them. Full step-by-step in `OWNER_ACTIONS.md` punch-list item #9.

> **🔴 Before next session:** run `npx supabase db push --db-url "$SUPABASE_DB_URL"` to apply 6 unpushed migrations (`blacklisted_emails`, `vendor_reviews`, `vendor_dashboard_expansion`, `force_majeure_flags`, `notification_type_additions`, `api_scopes`). The new surfaces will 500 against prod DB until pushed.

---

## 2026-05-14 — full PR run

Merged commits on `main`, newest first:

| PR | Commit | What |
|---|---|---|
| #28 | 9a966d0 | 0025+0028 — EN/TL dashboard locale toggle + 2 more email templates (`help_ticket_replied`, `vendor_inquiry_received`) |
| #27 | 0fbd6f7 | 0033 — read-only public API (`/api/v1/events|guests|vendors`) + scope-gated `api_keys` |
| #26 | 4bc0af3 | Admin force-majeure queue + couple disputes + 3 Supabase funnels + 4 PostHog funnel links at `/admin/funnels` |
| #25 | 9f44813 | 0022 — vendor dashboard expansion (services editor + bookings inbox + 4-role team + earnings rollup) |
| #24 | cfa9402 | 0006 + vendor-reviews — public marketplace at `/vendors`, couple review form, vendor one-time reply, public profile section |
| #23 | c6d45ca | docs(status): EOD 2026-05-14 refresh (anchor doc) |
| #22 | e74b169 | Phase 1 placeholder routes + nav (10 new surfaces, 2 add-ons grid entries) |
| #21 | 4833541 | Landing page conversion upgrades — split CTA, trust signals, pricing transparency |
| #20 | 4941a6f | 0028 RSVP-received email + in-app notification |
| #19 | 124b6e4 | PostHog wiring + 3-event funnel (signup_completed, event_created, order_paid) |
| #18 | 351715b | R2 storage migration (uploads off Supabase Storage) |
| #17 | 835aeef | Sentry error tracking wired |
| #16 | 7349666 | Add-ons status pills (Web V1 / Coming soon) + admin-only dev mode |
| #15 | 7dc9aa2 | CI build job — catches Next compile-time errors before merge |
| #14 | eec8fd2 | Vercel build fix — split client-safe query keys out of server-only event-preload |
| #13 | 65f8f68 | Services → Add-ons rename across the couple dashboard (308 redirects) |
| #12 | b049f99 | 0036 event-day pre-load — couple + vendor (T-3d → T+1d CTA, T-24h auto) |
| #11 | 327b489 | 0031 day-of live mode — auto-activation + 6 cards |
| #10 | c582a4d | Caching foundation — TanStack Query + persister + route-scoped SW |
| #9 | fac3e75 | Account lifecycle redesign — Delete vs Blacklist + migration |
| #8 | 865ea46 | Resend env var name fix + signup post-confirm redirect |
| #7 | 4e41f83 | Delete users from /admin/users (superseded by #9) |
| #6 | fade56a | Persistent login hardening — cookie defaults + proactive refresh + client-aware sessions |
| #5 | 8f761d6 | Auto-format BIR TIN with dashes |

Earlier 2026-05-14 work (before the PR run): public-repo flip + AGPL-3.0 + security hardening (#4), short-URL alias (#3), QR auto-crop (#2), monogram QR fix (#1).

---

## Phase 3 — decision-gated (waiting on owner)

Each of these requires a strategic call from the owner before code can ship:

| Item | The decision | Effort once decided |
|---|---|---|
| **Save-the-Date render pipeline** | Browser-canvas + MediaRecorder (free, ~1 day) OR server FFmpeg (needs Workers Paid plan + Hetzner VM pool, ~3 days) | 1–3 days |
| **Panood (live stream)** | Provision Cloudflare Stream Live + YouTube Data API + master `@SetnayanWeddings` channel | 5–7 days |
| **Marketplace commission model** | Free-listing forever / commission per booking / paid tier — pick before launch advertising | Pricing call only |
| **Daily.co video meetings (0019)** | Sign up + paste API key | 2 days code |
| **Anthropic Claude API (0032 Contract Intelligence)** | Sign up + spend cap → unblocks paid SKU | 3 days code |
| **Apple Developer Program** | $99/yr enrollment | 2-5 day approval; signed `.dmg` + future iOS Papic |
| **Render pipeline infra** | Cloudflare Workers Paid ($5/mo) + Hetzner Cloud VMs (€15/mo) — shared by 0011 / 0012 / 0017 / 0024 | 2 days code once provisioned |
| **Public website visual redesign** | Owner provides direction on what to change. Current state (post PR #21): split-CTA hero + trust signals + pricing table + compact roadmap — functional but generic. Owner queued this for a later session — needs a specific brief ("hero feels weak", "want a hero image not a device mock", "needs a how-it-works section", etc.) before code can ship | 0.5–2 days depending on scope |
| **Monogram tier system + AI-automated Bespoke flow (queued for new session)** | Owner locked the 3-tier model + Bespoke pricing + UX rules 2026-05-14 (reference images shared). **Free / Basic**: 2 letters + `&` (e.g. `J & S`), 1-2 default fonts, simple geometric frame. **Pro (₱99 widget upgrade per 0004)**: 2 letters OR full names, ornamental + heritage frames, 8+ premium fonts. **Bespoke (₱2,999, NEW SKU)**: AI-generated interlocked letterforms — DALL-E 3 HD behind the scenes, branded as **"Setnayan AI"** in all customer-facing copy (DALL-E never named in the UI). Replaces the old `Custom Monogram Pack — remove watermark` SKU. **CUSTOMER UX (in-app, live render — no external tools)**: (1) Guided brief form: initials/names + 3 personality words + motif preference + style direction + **reference image upload area** for couples to share inspiration. (2) Pay ₱2,999. (3) App fires the first generation server-side — DALL-E 3 HD × 4 variations stash to R2 — customer sees live thumbnails in ~30 sec. (4) **Refinement loop, up to 30 re-renders included in the SKU**: customer types text feedback ("more delicate", "more gold", "swap wreath for crest") + each refinement re-fires DALL-E with the SAME locked brief + appended feedback. Counter visible: "X refinements left." (5) After 30 re-renders OR customer hits "Accept final": top result auto-vectorizes via vectorizer.ai → SVG goes live event-wide. **🔴 ANTI-ABUSE RULE**: the brief inputs (initials/names/connector) **lock after the first generation** and cannot be edited. Re-renders REFINE the existing concept; they do NOT restart from scratch. This prevents 1 transaction → multiple distinct logos (e.g., logo for self + logo for sister + logo for friend). **Optional add-on SKU (V2)**: `+10 re-renders` pack at ₱199 (multi-buy allowed) if a customer exhausts their quota. **Cost ceiling**: 30 × $0.08 HD = ~₱135 max per customer; avg ~₱45 (most use 5-15 rerenders) → 95% margin at ₱2,999. **Owner signups needed**: OpenAI Platform (`OPENAI_API_KEY`), Vectorizer.ai (`VECTORIZER_API_KEY`). **Branding**: all UI strings say "Setnayan AI" not "DALL-E" or "OpenAI"; server-side calls only; no API key in client bundle | 5-7 days code once API keys are in Vercel |

---

## Locked architectural decisions (no further owner input needed)

### Time-limited services — **no cron**

For services with a paid time budget (Panood live stream, Papic camera-seat session, future limited-duration SKUs), use database-state + on-access checks. Owner locked 2026-05-14: no Vercel Cron, no Supabase `pg_cron`, no Cloudflare Cron Triggers.

**Pattern:**
- `service_sessions` row stores `scheduled_for`, `start_window_opens` (= `scheduled_for - 30 min`), `start_window_closes` (= `scheduled_for + 2 hours`), `duration_minutes`, `started_at`, `expires_at`, `status`
- Couple hits **Start** between `start_window_opens` and `start_window_closes` → server sets `started_at = now()`, `expires_at = now() + duration_minutes`, flips status to `active`
- Every read of the service surface validates `now() < expires_at` server-side; flips status to `expired` lazily on next access if exceeded
- Client tracks the countdown locally from `expires_at` for the visible timer; polls every 30 sec to revalidate
- When countdown hits 0 client-side, UI swaps to "session ended" state immediately
- **Resource teardown** (stopping the Cloudflare Stream broadcast, releasing Papic seats, etc.): hybrid client-driven + lazy admin sweep:
  - **Client-driven (primary)**: countdown hits 0 → client fires `/api/sessions/[id]/teardown` → server calls the external API (Cloudflare, etc.) to stop the resource
  - **Lazy sweep (backup)**: any couple/admin page load sweeps `WHERE expires_at < now() AND status = 'active'` and fires teardown — covers the case where the broadcaster's browser is offline

Applies to: 0011 Panood, 0012 Papic, future time-budgeted SKUs. **Does NOT** apply to bookings or events themselves (those use absolute date scheduling).

---

## Owner-side blockers (must act, no code can replace)

- **🔴 BLOCKING — `supabase db push`** — 6 migrations on disk are not yet applied to prod: `blacklisted_emails` (#9), `vendor_dashboard_expansion` (#25), `api_scopes` (#27), `notification_type_additions` (#28), `vendor_reviews` (#24), `force_majeure_flags` (#26). New surfaces will 500 until pushed. Run `npx supabase db push --db-url "$SUPABASE_DB_URL"` once to apply all in one shot.
- **Sentry / PostHog smoke test** — trigger one error in production, sign up one fresh user, confirm both show up in their respective dashboards
- **Resend domain verification** — done; just confirm a fresh signup welcome email lands at a non-account-holder Gmail
- **Supabase Sessions config** — Inactivity timeout already at "never" by default (free plan); JWT expiry can be bumped to 7-30 days when found in dashboard
- **Cowork spec reconciliation** — `COWORK_INBOX.md` now carries `[PENDING]` entries for the full Phase 2 surface: 0006 reviews, 0019 force-majeure, 0022 vendor dashboard, 0025 locale, 0028 emails, 0033 API scopes, 0036 event-preload, caching strategy. Walk each via Cowork; tick `[DONE <YYYY-MM-DD>]` as you go.

---

## Stack quick-reference

- **Repo:** https://github.com/iscasasola/setnayan-platform (public, AGPL-3.0)
- **Hosting:** Vercel (Hobby plan), auto-deploys from `main`
- **Domain:** `setnayan.com` (Vercel-managed SSL)
- **DB:** Supabase (Singapore region) — **31 migrations on main as of EOD 2026-05-14** (last 6 are unpushed to prod, see Owner-side blockers)
- **Storage:** Cloudflare R2 — 4 PH-region buckets (live writes from PR #18), plus Supabase Storage for the `platform-assets` bucket (legacy)
- **Email:** Resend — domain `setnayan.com` verified, `noreply@setnayan.com` from-address, **9 of 10 V1 transactional templates wired**
- **Observability:** Sentry (errors) + PostHog (3 funnel events) + 3 Supabase-side funnels at `/admin/funnels` (signup→event→paid order, vendor signup→profile→booking, week-over-week)
- **Native:** Tauri 2 desktop wrapper (unsigned macOS .dmg on GitHub Releases v0.0.1); iOS/Android deferred to V1.0+

---

## Quick-jump anchor docs

- **`HANDOFF.md`** — cold-start handoff with the verification flow, all live routes, locked decisions
- **`OWNER_ACTIONS.md`** — step-by-step phased launch checklist (Phase 1-7)
- **`CHANGELOG.md`** — every meaningful commit with `SPEC IMPACT` callout
- **`COWORK_INBOX.md`** — `[PENDING]` worklist of spec-corpus updates owed back to `~/Documents/Claude/Projects/Setnayan/`
- **`README.md`** — public-facing overview
- **In the Cowork corpus at `~/Documents/Claude/Projects/Setnayan/`:**
  - `CLAUDE.md` — status anchors auto-load on every Cowork session
  - `App_Build_Status.md` — spec-vs-code audit (regenerated EOD 2026-05-14)
  - `V1_Gap_Analysis_Status.md` — Tier 1/2/3 spec landing audit
  - `Installed_Stack_Inventory.md` — 10-pass audit of installed deps, migrations, env vars
  - `API_Integration_Checklist.md` — external service prereqs

---

## Sprint 0 history (closed 2026-05-13)

Sprint 0 was the platform foundation — Next.js 15 + Tauri 2 + Supabase + Cloudflare R2 + GitHub. All Sprint 0 acceptance criteria passed:

- Vercel project connected, env vars set, deploys clean
- Supabase Singapore region, base schema migration `20260512000000`, 5 RLS helpers, on_auth_user_created trigger
- R2: 4 PH-region buckets (`setnayan-media`, `-thread-files`, `-vendor-contracts`, `-samples`)
- Auth: email/password + magic-link; owner email auto-flagged `is_internal=TRUE`
- Tauri 2 scaffold, GitHub Actions matrix building `.dmg` + `.msi` artifacts
- PWA manifest + service worker scaffolded (replaced in PR #10 with the full caching foundation)

Verification probes that passed: `/health` 200, `/`, `/login`, `/manifest.json`, all icons, RLS denies anon, `generate_public_id` produces valid S89X- IDs.

Then the 19-iteration pre-launch sprint (closed 2026-05-13) shipped the couple/vendor/admin core surfaces. Then 2026-05-14 happened (see PR run above).
