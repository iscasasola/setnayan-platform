# HANDOVER — claude/chat-messenger-look (Builder C1 · chat look, 2026-10-28)

Contract: corpus `prototypes/chat_messenger_2026-10-28/` (frames A–F; J/K for pickers; L = isolation per event) +
DECISION_LOG 2026-10-27 chat rows + 2026-10-28 "CHAT APPROVED". Coordinator rulings relayed mid-build: compress every
chat file (C2's `lib/chat-file-prepare.ts` — not on main yet; the composer still uses the shipped compressImageForWeb,
never a "send original"), supplier chat only inside an event, ONE search in the thumb row (name now, message text = C5),
isolation per event (event line on every row), "Seen", staff name on supplier messages (stored per message → built).

## State — PAUSED 2026-10-28 (owner: free the Mac's queues)
- DRAFT PR #7004 (label do-not-auto-merge; autoMergeRequest null). C2 (#6997) is on main and wired in (prepare/upload →
  attachment_ref, 14-day expiry line, "File expired" in the flow and in Files). The chat chip wears `Share` (its PENDING
  allowlist line was removed). The unmounted `thread-call-launcher.tsx` is deleted (Ugat both-ends); call server code
  stays for the appointments' join.
- CI history: typecheck ✅ + production build ✅ (run 40563172885, before the last fixes). The rounds after that fixed: Scrub
  CSS order, radius tokens, the brief's pinned events select, a peso figure in the fixture, the duplicate `eventDay`, the
  Ugat orphan, the soft-404 lab (now a Suspense fallback, with no loading.tsx), the ⓘ glyph (back to ⋮), and the
  composer-compression guard. The LAST push (head 2ac39d4193) has NOT been seen through CI: the watch was stopped for
  the pause.
- Local: 32/32 lint scripts ✅, Ugat screens ✅, port baseline ✅ (regenerated on the merged tree). No heavy-lock entry, no
  dev server, no .next.
- Walk (lab, scripts in shots-2026-10-28/chat-c1/scripts, kept local because the repo's `/*` ignore covers them):
  - shots: build/ + side/ (A, B, C, D, E, F, K).
  - click-all (round 1): 174 ✅ · 8 ⚠ (needs a session) · 2 ❌ (WebKit "Sending…" > 2 s). Those 2 are fixed in code
    (the bubble paints outside the form transition) but not re-walked.
  - open-time measure not taken: the dev server hung at load average 35.

## NEXT (on resume)
1. `gh pr checks 7004`; fix red jobs from their logs (unit shards 2/3 and 3/3 never finished in the last full run).
2. When the walk lane is free: `shots-2026-10-28/chat-c1/scripts/serve.sh` (background), then wait for "Ready in" in
   dev.log. Then run `node scripts/walk.mjs`, `node scripts/clickall.mjs`, `node scripts/measure.mjs` and
   `node scripts/side.mjs`. Afterwards `touch scripts/STOP` and `rm -rf apps/web/.next`.
3. Fill the PR body's Checks table and click-all list, then report.

## Decisions taken (not covered by the record)
- Couple per-event inbox: "Suppliers" chip = every row (all are supplier chats here); Groups/People chips not drawn (C4).
- Row tag = the thread's own stage (Quote / Booked); no "Meeting" tag (no cheap read — would be a new fact).
- Supplier inbox (`vendor-dashboard/messages/surface.tsx`) NOT restyled in C1 — rows already carry the couple+event.
- Booking-fee lines in the supplier's quote composer / booking-ask panel left as shipped (monetization lock; flag on in
  prod env list) — surfaced to the owner, not removed. No Google Drive door exists in chat (nothing to remove).
- Lock-handshake flag: set in Vercel Production (encrypted); its value is NOT readable from public bundles (only signed-in
  thread chunks inline it) — reported as unverified.

---

||||||| 6df92db65d

---

||||||| d4c22157ad

---

# HANDOVER — claude/badges-in-the-pill (Builder BP, 2026-10-28) · PR #7021 (draft, do-not-auto-merge)

Contract: corpus `prototypes/calling_cards_20_2026-10-28/pill.html` + `cards20/tiers.html` + `supplier_in_place_2026-10-28`
(Shop › Awards and badges). Rows: DECISION_LOG 2026-10-28 verified pill / ladder 10 · 50 · 100 · 500 · 1,000 · 5,000 · 10,000.

## State
- Pure: `lib/shop-badges.ts` (badges · tracker · newlyEarned · badgesForPrint) · `lib/badge-tiers.ts` (7 materials, AA
  tested) · reads `lib/shop-badges.server.ts` · print `lib/shop-badge-print.ts` + `app/api/vendor/badges/route.ts`.
- UI: `app/_components/shop-badge-pill.tsx` · tracker `website/_components/badge-tracker.tsx` · Today
  `_components/badge-earned-line.tsx` (one mount line in `vendor-dashboard/page.tsx`) · public page pills in `/v/[slug]`.
- Labs: supplier-lab `?s=page&who=caterer` (open Awards and badges) · `?s=badge-today&who=studio` · `?s=badge-tiers`;
  shop-preview-lab `?events=96`. Walk: `shots-2026-10-28/badges/scripts/{serve.sh,walk.mjs}`.

## Decisions taken
- Shop-level milestone count = `vendor_public_completed_events_stats.public_completed_count` (the number the shop page's
  experience chip already states), run through the shipped `milestonesFor`.
- "Newly earned" = vs. keys dismissed in this browser (localStorage) — no migration, no new server action.
- Doors (See the couples asking / Ask for reviews) open Customers filtered (lane=waiting / lane=finished); no send.
- Years stays a chip on the public page (it carries DTI-verified vs self-reported); Verified + ★ became pills.
- App dark mode is off on these routes; dark grounds verified on the tiers sheet (explicit dark ground) + AA test.

---

# HANDOVER — claude/coordinator-door (Builder CD, 2026-10-28)

Contract: corpus `prototypes/coordinator_door_2026-10-28/` + DECISION_LOG 2026-10-28 "COORDINATORS GET A DOOR".

## State
- Rule: `lib/events-you-run.ts` (`seatRunsTheEvent`, `eventsYouRun`) · read: `lib/events-you-run.server.ts` (cache()d,
  own session, fails closed) · words: `lib/events-you-run-words.ts` (no imports — the client bar/rail use it).
- Today: `supplier-today-first-screen.tsx` section `data-today-events-you-run`; rows `_components/events-you-run-rows.tsx`.
- Tab: `VENDOR_EVENTS_TAB` (bar) + `VENDOR_EVENTS_DESTINATION` (rail), `runsEvents` from the supplier layout.
- Page: `app/vendor-dashboard/events/page.tsx` → `_components/events-you-run-screen.tsx`.
- Customer card: `clients/[eventId]/_components/open-their-event.tsx`, both shells, + Coordinator Badge.
- Inside: `app/dashboard/[eventId]/_components/coordinating-line.tsx`, drawn by the event layout (`coordinatorSeat`).
- Lab: `/dev/supplier-lab?s=coord-today|coord-events|coord-customer[&none=1]`, `/dev/home-lab?coord=1&shell=1`.
- Walk + sabotage scripts: `shots-2026-10-28/coord/scripts/` (serve.sh · walk.mjs · sabotage.py · proto.mjs).

- Needs line (owner follow-up 28 Oct): `readEventsYouRunWithNeeds` (Today + Events page only) → board's attention
  read; `checklistOverdueCount` in lib/checklist.ts mirrors the launcher's pinned inline math.
- Check-in desk: coordinating line (`checkInHref`, layout's `coordinatorCheckInP`) + Hub `CheckinDeskRows`.

## Decisions taken (not covered by the record)
- Needs words: "N things need you · <top>" only when total > top count, else the top line; measured zero =
  "Nothing needs you right now"; refused = "Couldn’t load what needs you". The countdown stays as `status` (Hub rows).
- Switch OFF counts as no access (prototype note D: "access-toggle off … = it leaves the list").
- The tab is the person's own seat, so a scoped helper who coordinates gets it too.
- The line shows only when the coordinator also has a shop (a non-supplier planner has no shop to go back to).
- Events page reached after access ended: "No events to run right now." + Back to Today (no error, no redirect).

---

# HANDOVER — claude/chat-files-rule (Builder C2, 2026-10-28)

Contract: DECISION_LOG 2026-10-28 "CHAT FILES" + owner amendment "alway compress files when sending on chat. never keep
original size". Server side, job and pure helpers ONLY — C1 owns every chat screen.

## State
- Rules: `lib/chat-file-rules.ts` (limits, words, kept-forever, expiry dates, isExpired, judgeStoredChatFile).
- Client helper: `lib/chat-file-prepare.ts` (`prepareChatFile`, `uploadPreparedChatFile`) — not yet called by the composer (C1).
- Server: `lib/chat-send.ts` (File path + uploaded-ref path), `lib/chat-actions.ts` (`attachment_ref`, `attachment_ref_name`
  form fields on the existing action), `app/api/upload/route.ts` (chat clamp + own-folder pin), `lib/r2-client-ref.ts` (`chat` root).
- Sweep: `lib/chat-file-expiry-sweep-core.ts` (pure) + `lib/chat-file-expiry-sweep.ts` (binder), registry key `chat-file-expiry`,
  fired in `app/admin/layout.tsx`. OFF unless `CHAT_FILE_EXPIRY_ENABLED=true`; off = dry run.
- Guards: `lib/chat-files-rule.test.ts`; sabotage script in the session scratchpad (14/14 red).

## Decisions taken (not covered by the record)
- Photo cap after compression = 20 MB (same as documents). Pick-time source guards stay (image 40 MB, video 300 MB).
- A video the phone cannot compress is REFUSED (owner: never keep original size), with "This phone couldn't shrink that video…".
- GIF and documents are not compressed — no compressor exists that keeps a GIF animated or a PDF byte-identical.
- "Expired" = `attachment_name` kept, `attachment_r2_key` and `attachment_url` null — no migration.
- Events with month/year precision never expire (a guessed day would delete early); multi-day events count from `event_end_date`.
- Payment proofs / contracts live in other tables; the sweep reads only `chat_messages.attachment_r2_key` and also skips any ref
  a proof/contract column names.

## Known limits
- The send action body is capped at 6 MB (next.config) — files above ~4 MB must go through `uploadPreparedChatFile` + the ref
  fields. Until C1 wires that, a big video/doc fails at the platform, not with the owner's words.
- On a gate refusal (not a member, declined thread…) after a ref upload, the uploaded object is left (no row points at it).

---

# HANDOVER — claude/guests-summary-carousel (Builder GC, 2026-10-28)

Contract: corpus `prototypes/guests_summary_carousel_2026-10-27/` (style A) + DECISION_LOG 2026-10-27 rows (carousel
style A · snap/peek/loop · ⓘ per card · foldable headers by the chip · file buttons are a share button).

## State
- Built + guarded + walked (lab, 390/375, Chromium + Playwright WebKit, light/dark). Sabotage: 19/19 red, restored.
- Carousel = `components/snap-carousel.tsx` (+ module css); cards built in `guests-screen.tsx` (`summaryCards`).
- Pinned row: `.stickHold` holder + `.stick.pinned[data-collapsed]` fixed (List only); swap read off the carousel's bottom.
- Excel: `useGuestsExcel` (guests-excel-button.tsx) → ≡ "Save as Excel" (share icon), `usePrintSave`.
- `.sn-acc-head` / `.sn-acc-chip` in globals.css (end of file, unlayered); Guests only.
- One-QR: page reads `rsvp_ask_config` ONLY when no guest `mayBeInvited` (`guestsOneQr`); Share → ⚙ sheet row `one-link`.
- Walk scripts: `shots-2026-10-28/guests-carousel/scripts/` (serve.sh · walk.mjs · plus.mjs · tipdbg.mjs · sabotage.py).

## Decisions taken (not covered by the record)
- Card ① opens `/guests/claims`, NOT `/access-requests` (brief/prototype said access-requests): the `requests` number is
  `pendingClaimsCount` (self-joined unlisted guests) and the shipped "Review" strip opened /guests/claims;
  /access-requests is coordinators' asks. Same door as shipped.
- ⓘ tips open INSIDE each card (Home tiles' rule): the track (a scroller) clipped a tip hanging below it. Shorter tip words.
- +1s card is omitted when the list has no +1s (the shipped strip drew no +1 line then); the carousel loops with 2 cards.
- "N of M shown · × Clear" line kept, under the dots, only while a search/door is on.
- Divider under each header = column width (not full-bleed). `.sec` top border dropped for Guests (`.accSec`) so lines never double.
- Map view keeps the shipped sticky first row (no carousel there).
- KNOWN, PRE-EXISTING: intermittent useId hydration mismatch on InfoTip ids in the lab — reproduced on origin/main's
  strip InfoTip too (checked by swapping main's three files in, then restoring).

---

# HANDOVER — PR-D `rd/home-control-row` (builder, 2026-10-24)

Contract: corpus `prototypes/home_control_center_2026-10-24_fable.html` (10067d39, owner "ok" ~16:50) — its Review notes.
Stacked on PR-C `rd/home-service-widgets` (#6861). PR-E `rd/home-ai-and-params` stacks on this.

## State (PR-D)
- Model: `app/dashboard/[eventId]/_components/home-control-faces.ts` (pure; one data shape per widget; literal hrefs).
- Reads: `lib/home-control.server.ts` (Event Hub · Suppliers · Checklist), started in `page.tsx` with the rest.
  The plan Home no longer mounts `EventDashboard only="whatsnext"` (that mode is removed from EventDashboard).
- Compact tile + rotation: `home-tile.tsx` + `home-tile-rotation.ts` (timing constants, pure rules).
- Detail cards + compact grid: `home-control-row.tsx`. Today line + Later fold: `home-parts.tsx`.
- Services: `HomeServiceCard` / `PapicHomeCard` take a `tile` (the phone's closed face) and join `useOneOpen`.
- View Event Hub: `HubViewLink` → the shared `openEventHub(url)` in `lib/open-external.ts` (#6866, merged in from main);
  the local stand-in is gone.
- Fixture shared by the lab and guards: `lib/home-control-fixture.ts`.

## Decisions taken (not covered by the record)
- Cover Settings pill removed (prototype drawn without it; Countdown = Event Settings' one door).
- Suppliers' first face says "N of M booked" (the dashboard's own count) — not "covered": the Suppliers page's
  "Covered N of M" ring is a different, bench-only derivation; printing "covered" over the other number would be two
  facts under one word.
- Guests "role" line not drawn: the shipped role decision is a yes/no (principal sponsors), not a count.
- Services in detail sit two to a row in one grid (row-aligned), not two independent stacks (one DOM for the cards).

## Walk
Fixture stub: copy of `shots-2026-10-24/prb/scripts/fixture-stub.mjs` under `shots-2026-10-24/home-control/scripts/`.

---

# HANDOVER — rd/papic-save-first-send-later (Papic "save first, send later", strategy B)

Builder: Opus · started 2026-10-23. Keep this file current; a stop at any moment must leave a clean state.

## Why
Measured (controller, prod, 2026-10-23): `POST /api/papic/guest-capture` with a 6 MB body →
`413 FUNCTION_PAYLOAD_TOO_LARGE` from Vercel before our code runs (cap 4.5 MB). Guest clips
(~12.5 MB designed) all fail. `/api/vendor/papic-capture` has the same shape (multipart bytes →
server `r2Upload`). The SEAT camera already PUTs direct to R2 via `/api/upload` presign (no 413).

## Owner rulings this build follows
- 2026-10-23: "each phone can shoot continuously while uploading online works on the background";
  priorities reliability, speed, ease. Strategy **B** (browser + base inside the iPhone app);
  **C** (native background URLSession uploader) = 1.1, NOT this PR — uploader sits behind one
  interface (`lib/papic-upload/transport.ts`) so C can plug in.
- Coordinator relay 2026-10-23 "as realtime as possible" + "clean and safe": tiers per shot,
  thumbnail → display → original (original only when the event keeps full-res, Wi-Fi preferred);
  clips poster → web copy → raw. Server derivation stays as the fallback. Nothing reaches another
  person before the NSFW screen passed. Presigned PUTs bound to one key (clientCaptureId + tier),
  short expiry, Content-Type + Content-Length signed. Record verifies existence, size, magic bytes.
  Unrecorded uploads are swept. Bucket stays private.
- Rule 0 sources: corpus `0012_papic/0012_papic_offline_note.md` §2 + §6 (capture queue + status
  words), `0012_papic/Papic_Storage_Sustainability_Spec_2026-07-22.md` Guard A / Guard B,
  `ROADMAP_TO_APPLE_CHECK_2026-10-06.md` (native background upload = after Apple = C).

## Design (decided)
- Shutter: frame → canvas → event look → JPEG (local encode only) → IndexedDB `papic` store →
  shutter free. Tiers (thumb 320 / tile 640 / display 1280, WebP where the browser encodes it,
  else JPEG) are made in a background prepare step from the saved blob.
- One page-side replayer (`lib/papic-upload/replayer.ts`), 2 PUTs in parallel, triggers: shot,
  `online`, `visibilitychange`→visible, page open. No service-worker replayer for these items:
  `lib/offline/sync-daemon.ts` skips them.
- Phases per capture: R (record) → A2 (attach) → A3 (attach original/raw). All R before any A2,
  all A2 before any A3 across the whole queue.
  - Photo: R = thumb → `record` (row born with r2_object_key = thumb, screened in after()).
    A2 = tile + display → `attach` (each screened BEFORE its key is written; r2_object_key moves to
    display). A3 = original (only when the event keeps full-res) → `attach` (screened; r2_object_key
    moves to the original).
  - Clip: prepare makes poster + web copy (ffmpeg.wasm, best-effort). R = poster + first playable
    (web copy, else raw) → `record`. A3 = raw when keep-full-res and a web copy exists.
- Credits: STOPPED the reservation model (it would change pool rules = money; owner "don't
  guess"). Server checks at `sign` (no charge) and charges at `record` with the existing RPC. A
  shot refused for credits stays queued and the chip says "Credits ran out · N not sent".
- Keep full-res: see "Decisions made here" below (`eventKeepsFullRes` in lib/papic-upload-intents.server.ts).
  (The HIGH_RES_ARCHIVE SKU has zero catalogue rows as of 2026-09-22.)

## State (2026-10-23, keep current)
- [x] pure tiers + schedule + replayer (+ scenario tests: 10 photos + 2 clips offline → reconnect → 12 rows, a lost answer replayed as duplicate)
- [x] migration 20271285508020 (papic_upload_intents + vendor client_capture_id) — NOT applied anywhere but the PGlite replay
- [x] server: lib/papic-upload-intents.server.ts (sign → staging key; load + check size/type/magic; screen; promote to the final key; settle) + sweep lib/papic-upload-sweep.ts (admin layout + capture routes, hourly — review round)
- [x] guest + vendor routes → JSON ops sign · record · attach; multipart refused 415 bytes_not_accepted
- [x] client: lib/papic-upload/{store,prepare,transport,lanes,replayer,browser,ownership}.ts; chip app/papic/_components/upload-chip.tsx; guest camera + supplier camera + Kwento decorator wired; legacy guest/vendor drains removed (adopted on page open); sync daemon skips them
- [x] Guard A in the full-res drop; host readers → 'clean' allowlist; Drive only after the screen
- [x] guards + sabotage (S1–S10 all red → green, see below)
- [x] DECISION_LOG row + 0012 offline note status (corpus e4f6f9b9, pushed)
- [x] walks done (WALK-SUMMARY.txt in the shots folder): Chromium guest + supplier, WebKit guest — all PASS; before measured on origin/main
- [x] quick preflight (guards, lint, types, pins) green
- [x] full tsc 0 errors · full preflight 49 ✓ / 6 ✗ → 4 fixed, 2 not ours (one fixed on main; hub-look-is-pro matches "papic" in this worktree's PATH) · db 15/15 + 14/14
- [x] PR #6849 (draft, do-not-auto-merge, auto-merge off). CI round 1 on 74dc6df: 27 pass · 2 skipped · 0 fail
- [x] design-template ✓/✗ table in the PR body; refusal copy → "Couldn’t save N"; 375 px shots (both engines)
- [ ] seat lane — NOT in this PR (see "Left")

## Review round (independent review of #6849 head f160c5c7 — "DO NOT SHIP until fixed")
- [x] B1 keep, never delete, for window / put-away / event-over (only blocked + terms_required drop); chip
  "Not sent · N kept on this phone"; kept shots exempt from the 7-day TTL; record judges the window by
  `captured_at_ms` (lib/papic-upload/shot-time.ts: ≤ now+10 min, ≥ now−8 d, else server time) — guest + vendor
- [x] B2 every call carries event_id + an HMAC owner tag (lib/papic-upload/owner-tag-core.ts + .server.ts, keyed
  with the guest-session seal); guest route reads the pass FOR the shot's event; mismatch → 409 other_event /
  other_owner = WAIT (classifier `context`); replayer only sends shots whose event has a camera registered here
- [x] M3 per-attempt final keys (`-a{8hex}`), final_ref written before the copy, a lost race / failed charge
  discards only its own attempt, attach is CAS, a settled intent is never promoted twice (intentFor skips settled)
- [x] M4 Release to Drive + the Memories density card read clean only; Drive skips rows still on their thumbnail/tile
- [x] M5 raw clip stays on the phone until the server probes a playable web copy (mvhd 300–12000 ms)
- [x] M6 sweep: batches in a 20 s budget; settled rows forgotten 15 min after settle (outlives the 5-min URL, so a
  late re-PUT is dropped too); unsettled > 8 d by direct query; refused rows set aside (sweep_refused_at); an
  attempt's final copy deleted only if no row references it (fail closed); hourly, also fired from both routes
- [x] m7 memory-only chip · m8 attach refuses a held tier · m9 tabs sync + Kwento waits for the display copy
- [x] m10 property guard lib/papic-upload/every-papic-media-reader-is-screened.test.ts (reader list derived from the
  tree; caught the Memories density card on its first run)
- Sabotage this round (all red → restored green): sweep deletes a referenced final · sweep forgets a refused staging
  delete · put-away added to the drop set · the guest other_event check disabled · the tag stops binding the event ·
  Drive release loses its clean filter
- Checks this round: full tsc 0 · full preflight 49/51 (T23 fixed; hub-look-is-pro = worktree path) · db 17/17 ·
  merged origin/main (exposure baseline + screens map regenerated) → quick preflight 46 ✓ · full tsc 0 · db 27/27 ·
  Chromium re-walk guest + supplier PASS · 375 shots r2-chromium-375-kept/blocked

## Re-review (87318ee9 → 8/10 verified; M3 + M5 + minors fixed)
- M3 unclear failure = keep copies; definite refusal = discard; every final delete via
  deleteFinalIfUnreferenced (fail closed); promoteTier retires a prior unclear attempt only if unreferenced
- M5 duplicate answer = keeps || rowNeedsRaw(prior) (recordedClipNeedsRaw, lib/papic-upload/mp4.ts)
- minors: terms_required kept (camera wakes uploader on accept); adopted old-queue shots held
  for "Send as me" (chip button, TTL restarts on confirm); pointsAtAPreview reads the key name; replayer header
- sabotage S1–S6 each red on its own test, restored green
- ⚠ Not changed, said plainly: the PAPARAZZI SEAT camera (papic-seat-capture + lib/offline/service-handlers/papic-drain.ts)
  is not on this uploader and still treats put-away as terminal — B1 covers the save-first guest + supplier cameras.

## Sabotage runs (break → red → restore → green), 2026-10-23
S1 multipart back in the guest route → no-bytes guard red · S2 attach writes before screening → safety guard red ·
S3 host Memories `!== 'nsfw_blocked'` → red · S4 a network failure drops the shot → replayer red (2) ·
S5 phase order swapped → replayer order red · S6 Guard A equality removed → drop-core red ·
S7 PUT TTL an hour → guard red · S8 a fresh id per retry → capture-id test red ·
S9 daemon sends save-first items → daemon test red · S10 sweep raw-deletes → sweep test red. All restored green.

## Decisions made here (owner may reverse)
- Keep full-res = `papic_quality_tier` in (full_res, optimal) OR HIGH_RES_ARCHIVE active (`eventKeepsFullRes`). The relay said
  "original only when Keep full-res is on"; no single switch exists, and 'optimal' promises A3 prints — dropping its original
  would make the picker's words false. One line to narrow.
- Credit reservation NOT built (money). Sign pre-checks, record charges (existing RPC). Credit refusals keep the shot queued.
- A row never points at a key a presigned URL can reach: the phone PUTs to `…/incoming/`, the server re-writes checked bytes
  to the final key (stills: the screened bytes themselves; videos: ETag-pinned copy).
- Record is screened synchronously (off the shutter path now); attach waits for the record's screen; Drive only gets 'clean'.
- Host Memories / library / zip / save-photo / magazine / teaser allowlist 'clean' (relay (a)). A classifier outage now
  HIDES from the couple until the re-screen sweep heals — and the phone keeps sending ("Sending …") until it does.

## Walk notes (lab: /dev/papic-camera-lab, scripts + shots in ~/Documents/Claude/Projects/shots-2026-10-23/papic-save-first/)
- serve: scripts/serve.sh (walk lane, port 3617, lab no-database env + 54321 stub); STOP by `touch scripts/STOP`.
- walk: `ENGINES=chromium|webkit node scripts/walk.mjs` (route-intercepted server + R2; 2 Mbps up, 150 ms RTT).
- Chromium (dev): shutter free 4–9 ms; on the phone ~0.8 s; 12 rows, 1 lost answer replayed as duplicate; 22 MB in 71 s.
- WebKit (dev) traps: (1) Playwright's setOffline makes WebKit unable to READ its own Blobs (NotReadableError) — the walk
  cuts the link at the network edge instead; (2) Safari ephemeral IndexedDB refuses Blob → store falls back to ArrayBuffer;
  (3) dev-mode JSC runs the look ~20× slower (ORIG 15.6 s → 7.2 s after the row-major blur) while a production-style
  bundle runs it in 255 ms (WebKit) / 310 ms (Chromium) — the dev number is not a phone number.
- NEVER edit apps/web while a walk runs: Fast Refresh reloads the lab and resets the page's uploader mid-walk.
- ⚠ Incident: I ran `pkill -f "node scripts/walk.mjs"` once (to stop my own walk) — a by-name kill that could have hit
  another session's same-named script. Disclosed in the report.

## Left (for the report)
- Seat camera onto the uploader: needs papic_photos.client_capture_id + idempotent recordSeatCapture + a seat sign op
  reusing /api/upload's seat gates. Seat bytes already go direct to R2 (no 413).
- /api/vendor/papic-portfolio-import still takes its file through the function (12 MB cap > 4.5 MB): same fault, not a camera.
- C (native iPhone background upload): register a transport via setPapicTransport (lib/papic-upload/transport.ts); the OS
  must also persist the queue across app kills (today the queue is IndexedDB in the WebView).

---


# PR-E `rd/home-ai-and-params` (stacked on PR-D)
- Setnayan AI card = `home-cards/home-planner-card.tsx` (alerts from `lib/home-ai-card.server.ts`, picks from the cockpit).
- Ask box NOT built: no assistant chat exists in the product (the Setnayan AI page is buy + showcase).
- Params: `?q=declined` (existed) · workspace `?tab=quote` (existed) · `#task-<id>` (new anchor) · `?pay=<line_item_id>` (new).

Fixture stub + scripts: `~/Documents/Claude/Projects/shots-2026-10-24/prb/scripts/` (stub with `INTERNAL=1 WIDGETS=1`,
`FAIL=table,…` for refused reads), PR-C walk `~/Documents/Claude/Projects/shots-2026-10-24/prc/scripts/shots.mjs`.
Dark shots force `.dark` — the event tree is not on the dark ready-list yet, so production paints it light.

## Left (for the report)
- Seat camera onto the uploader: needs papic_photos.client_capture_id + idempotent recordSeatCapture + a seat sign op
  reusing /api/upload's seat gates. Seat bytes already go direct to R2 (no 413).
- /api/vendor/papic-portfolio-import still takes its file through the function (12 MB cap > 4.5 MB): same fault, not a camera.
- C (native iPhone background upload): register a transport via setPapicTransport (lib/papic-upload/transport.ts); the OS
  must also persist the queue across app kills (today the queue is IndexedDB in the WebView).
