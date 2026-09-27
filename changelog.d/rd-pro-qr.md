## 2026-09-28 · feat(qr): every guest QR wears a look — the Setnayan mark for free, the couple's logo · shape · pattern · colour on Event Hub Pro; "Custom QR per guest" folds into Pro

Owner (2026-09-27, verbatim): *"QR is free with Setnayan Logo on the center. all Guest QR must
have Setnayan Logo on the center. QR on Pro makes the logo use their logo on the center. and change
the shape, pattern style."* · *"shape allows square or circle"* · *"Fold into Event Hub Pro"*.
Brought forward from "after Apple" by the 2026-09-28 row "EVERY EVENT HUB BUILD FINISHES BEFORE
THE APPLE CHECK".

**What the couple sees.** On the Maker's Details page, under the Event Hub address, a new **Your QR
code** block. Free: *"Every guest QR carries the Setnayan mark in the centre…"* and three dropdowns
(Shape · Pattern · Colour) each wearing the padlock; a tap goes to Event Hub Pro. Pro: the diamond,
the couple's own logo (their Maker Logo, resolved by the same `resolveEventMonogramSvg` the hero
uses; their lettered lockup when they have no drawn logo) in the centre of every code, and the three
dropdowns live — **Square · Circle**, **Classic · Rounded · Dots**, **Ink + every Mood Board colour
that clears a 4.5:1 contrast floor**. Each is ONE dropdown on the shared `PickMenu`. Saves live and
says so (`HubSavesImmediately`); the preview beside it is the real `/api/website/qr/<slug>` PNG with a
version stamp so it redraws at once. First visit gets a MiniTour (`customer_pro_qr_v1`).

**Where it lands.** One `QrLook` (`lib/qr-look.ts`), resolved in ONE place
(`lib/qr-look.server.ts` — reads `eventCoupleWebsiteProActive`, so §10a internal-hosted events show
the Pro side), drawn by ONE renderer (`lib/qr-style-svg.ts`, raster twin `lib/qr-style-raster.ts`),
and handed to every guest-facing QR: `/api/website/qr/[slug]` · `/api/website/qr/guest/[guestId]` ·
`/api/guest/qr` · the Invitation page + its print sheet · the guest's Event Hub, invite door, hub and
plus-one passes · the print set (corner QR + every pass, `lib/print-set.server.ts`) · the free QR
sheet · the seating pack's table signs and place cards · the seating PDF · the Mood Board concept PDF
· the join-link QR · the poster. Non-guest codes (Papic crew claims, supplier QRs, payment codes,
the crew pairing QR) are untouched.

**Scannability.** Level H always; the three finders are solid squares whatever the pattern; the
quiet zone survives inside the circle (radius = (n/2 + 4)·√2); the centre badge is capped at
0.135 of the side; a pale ink is refused by the choices, the sanitizer and the composer.
`lib/every-qr-look-decodes.test.ts` renders all 18 shape × pattern × centre combinations as PNG and
DECODES each with the repo's own detector (jsQR) — full size and after a 320-px JPEG "forwarded"
copy — counts the gold mark in the free look's centre pixels, checks the finder geometry and the
circle's radius, and greps every guest-facing surface for a `look` argument. A style that fails to
decode cannot merge. (`lib/qr-decode.ts` now flattens onto white first: a see-through corner read as
black to the detector but is paper to a phone.)

**Storage.** `events.style_preferences.qr` (`{ shape?, pattern?, ink? }`), beside the onboarding
keys already there — no new `events` column, so no grant block, `events_host` rebuild or exposure
widening (Rule 0: a flag flip beats new schema). Written only by `updateQrStyle`
(`app/dashboard/[eventId]/launch/qr-look-actions.ts`), which refuses a non-Pro event server-side.

**CUSTOM_QR_GUEST retires INTO Pro.** Migration
`20271250752713_custom_qr_guest_folds_into_event_hub_pro.sql` sets the catalogue row
`is_active = FALSE` (never applied by hand — the pipeline pushes it); the llms fixture flips with it;
the code leaves `REQUIRED_RETAIL` and the llms prose; the Suite/App-Store entry (`lib/add-ons-catalog.ts`),
its detail copy, demo scenes, vignette, recommendations weight, store-shell key, routes/route-meta
entries and the onboarding `custom_qr` pick are removed; `/dashboard/[eventId]/studio/custom-qr-guest`
(+ print) is DELETED; the guest routes stop asking about the SKU. ⚠ The KEY stays in
`FREE_FOR_ALL_SKUS` for one reader — the seat pass (`lib/seat-pass.ts`), which the owner ruled free
and which `rd/find-your-seat` owns; the comment there says when to delete it. `WEBSITE_PRO_ITEMS`
gains "Your logo on every QR code" (the buy surface now says "all of it", not "all nine").

**The select scanner learns the composite.** `QR_LOOK_COLUMNS` is
`` `${HERO_MONOGRAM_COLUMNS}, role_palette, style_preferences` `` — one list extended, never copied — and
`lib/security/select-column-scan.ts` could not resolve that shape, so eight live selects went dark to T1 and
T20 went red. A literal copy resolved but made dup-rule file 52 facts about a "new canonical list". Per T20's
own message ("fix the resolver"), the scanner now reads `${A_COLUMNS}, literal` composites
(`extractSelectConstantComposites` / `resolveConstantComposites`, positive control T19b, seen red once by
sabotage). `WEBSITE_PRO_ITEMS` is ten, so every sentence that counted nine now says ten
(`Unlock all ten`, `One unlock covers all ten`).

**Guards touched.** `every-qr-carries-the-strip` and `event-viewer` lose the deleted page's rows;
`suite-doorway-guardrails` and `seat-rooms-need-seating` lose their custom-qr-guest tests (the entry
is gone, not re-gated); `every-maker-form-drafts-or-says-so` gains the QR controls as a marked
no-form writer; the four generated baselines (dup-rule, no-card, masthead, port-control) are
regenerated for the deleted files.

SPEC IMPACT: DECISION_LOG.md 2026-09-27 rows "FREE QR = THE SETNAYAN LOGO…", "QR LOGO: AFTER APPLE…", "QR SHAPE ON PRO = SQUARE OR CIRCLE" — implemented; the "circle" reading shipped is the whole code inside a round badge (Shape) with round dots as a Pattern, i.e. both readings the row asked to show. Recorded in the corpus by the builder.
