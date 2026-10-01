# Brief — write verified /features/<slug> entries (Setnayan)

Repo worktree (work ONLY here): /Users/icecasasola/Documents/Claude/Projects/setnayan-platform/.claude/worktrees/agent-a8e490ed604864a01
Web app: <repo>/apps/web. Use /usr/bin/grep (bare `grep` returns nothing in this worktree).

## What you are doing
The owner (2026-10-01) wants one public, search-engine-friendly page per Setnayan feature at
/features/<slug> plus a Tagalog/Taglish twin at /tl/features/<slug>. The page RENDERER is already
being written by the lead. YOUR job: fill ONE registry file with verified content for the features
assigned to you.

- Type to satisfy: apps/web/lib/feature-pages/types.ts (READ IT FIRST — every field's rules are in its comments).
- Your file: given in your task (e.g. apps/web/lib/feature-pages/plan-a.ts). It already exports an empty
  array with the right name — replace `[]` with your entries, in the order given. Write ONLY that file.
- Do NOT run tsc, lint, tests or builds (several sessions share this machine; the lead runs them). Be
  careful with types instead: `steps` is exactly 3 strings; `slug`/`worksWith[].slug` must be from
  FEATURE_SLUGS; `tryHref` only from FeatureTryHref; `icon` from EventMenuIconName (see
  lib/customer-menu.ts EVENT_MENU_ICONS keys: overview papic galleries editorial team budget mood-board
  logo pakanta guests hosts hub schedule checkin seat plan3d live patiktok ai suite refer details product)
  or FeatureExtraIconName in types.ts.
- Do NOT git commit, stash, or touch any other file.

## THE ONE RULE: only what ships
Every sentence must be TRUE of the code on this branch today. This project has been burned repeatedly by
marketing copy that described "the next version of the truth" (see
apps/web/app/features/features-page-says-what-ships.test.ts for the list of false claims that were caught:
subscribable calendar feeds, OCR, couples uploading contracts, three aspect ratios, delivery preferences,
"arrives the next morning", "receipts download together"). Before you write a claim, find the code that
does it (app/**, lib/**, supabase/migrations/**). If you cannot find it, do not write it.

Sources to read for each feature (in this order):
1. The existing product page if one exists: apps/web/app/(shell)/<route>/page.tsx (+ _sections) — these
   were already traced against code; reuse their FACTS (but write fresh sentences — do not copy their FAQ
   verbatim, the two pages must not duplicate each other).
2. apps/web/lib/studio-apps.ts (product names + one-liners — if your feature has an entry, `name.en` MUST
   equal its `name`, and the hub `line.en` should be its `railLine` or a ≤12-word version of it).
3. apps/web/lib/help.ts (public help answers — already vetted).
4. The shipped code itself (dashboard / vendor-dashboard routes, lib modules).
5. Guards that police copy for your feature: `/usr/bin/grep -rl "<feature name>" apps/web --include=*.test.ts`
   — e.g. lib/papic-copy-guardrails.test.ts (Papic copy must NOT spell photo/clip counts or caps),
   lib/commission-promise.ts (a supplier-facing "0% commission" OWES the booking-fee sentence — read it and
   follow it, or don't say 0% commission), lib/public-price-literals.ts. Obey them.

Event types: Setnayan has 17 live event types (wedding, debut, christening, birthday, corporate, reunion,
wake, anniversary, graduation, …). Do NOT write wedding-only copy unless the feature IS wedding-only
(check `surface` gates in lib/add-ons-catalog.ts / lib/event-type-profile.ts — e.g. the monogram / Logo
Maker is wedding-only). Say "your event" / "celebration" where the feature is general.

## Copy rules (owner-locked)
- Plain English. Short sentences. No jargon, no SKU codes, no internal names (no "iteration", "RLS", table names).
- "Event Hub", never "website". "supplier", never "vendor" (in ALL copy, EN and TL). Pro is written "◆ Pro" if mentioned.
- NO peso figures, counts that can drift, percentages of discounts, or prices anywhere in the text. Price
  is ONLY the `price` field (the page reads the live catalogue). You may say "free" ONLY when the feature
  is genuinely free (price.kind 'free' or 'free-plus').
- No competitor names, no disparaging "other apps". "What makes it different" = concrete facts about
  Setnayan (e.g. "Guests need no app download — they scan a QR in their phone's camera").
- `answer` is answer-first: sentence one says what it is and who uses it, in the words a person would
  search. AI answer engines quote this paragraph.
- FAQ questions in the words people actually search (e.g. "Is there a free wedding guest list app in the
  Philippines?", "How do I collect RSVPs for a debut?"). 3–5 per feature. Answers ≤ 60 words, factual.
- `title` ≤ 60 chars, no " · Setnayan" suffix, unique across all features. `description` 70–160 chars.
- `line` ≤ 12 words. `forWho` ≤ 35 words. Each step ≤ 25 words. Each "different" item ≤ 25 words.
- `worksWith`: 2–5 links to OTHER feature slugs, each `how` = one short TRUE sentence of the hand-off
  (e.g. guest-list → seat-plan: "Every guest on the list is ready to drag into a seat."). Verify the
  hand-off exists in code (they really read the same data).
- `keywords`: 4–8 search phrases per locale.
- Typography: use ’ (curly apostrophe) inside single-quoted strings, or use double quotes. Never break the TS string.

## Tagalog twin (`tl`)
Write natural Taglish, the register of apps/web/app/features/_sections/*.tsx `tl` dictionaries and
apps/web/app/tl/about — Tagalog sentence structure with everyday English nouns (guest list, RSVP,
supplier, budget, QR). Not stiff deep Tagalog, not just English. Same facts, same number of
steps/FAQ/different items as `en` (the guard checks the counts match). Product names stay as-is.

## Pictures (`shots`, 0–3)
Only files already on disk: apps/web/public/add-ons/demo/stills/*.jpg (src '/add-ons/demo/stills/<f>.jpg')
or apps/web/public/demo/maria-jose/*.webp (src '/demo/maria-jose/<f>.webp'). OPEN EVERY IMAGE WITH THE
READ TOOL AND LOOK AT IT before naming it — a picture is a claim (one still prints "3 couples" inside the
JPEG; animated-monogram-1.jpg is BANNED because it shows a price; read
apps/web/app/_components/marketing/spotlights-are-real.test.ts BANNED_STILLS). Never use a frame that
shows a price, or a paid upsell on a free feature, or a different feature than the page is about. Alt text
describes what is actually in the frame (EN + TL). If no real picture fits, use `shots: []` — never a
stand-in.

## Price (`price`) — from the live catalogue, never a number
Live catalogue snapshot (prod, 2026-10-01) — use the CODES, never the figures:
- Host (catalogue 'retail', table platform_retail_catalog_v2), ACTIVE: ANIMATED_MONOGRAM, COUPLE_WEBSITE_PRO
  ("Event Hub Pro"), MOODBOARD_RENDER_PACK, PAKANTA ("Music Maker"), PAPIC_ADDON_THANK_YOU,
  PAPIC_GUEST_100 … PAPIC_GUEST_100K + PAPIC_GUEST (Papic credit ladder), PATIKTOK_COMPILER, SETNAYAN_AI.
  INACTIVE (do not sell): CUSTOM_QR_GUEST, LIVE_STUDIO, LIVE_STUDIO_HOSTED_CHANNEL, PAPIC_CAMERA_*,
  SEATING_3D (3D Plan is FREE), SETNAYAN_AI_RENEW. SETNAYAN_AI_B/_C/_D are inactive BY DESIGN (price
  source for the per-event-type ladder) — only the setnayan-ai entry may list them, with
  `inactiveRowsArePrices: true`.
- Supplier (catalogue 'supplier', table vendor_billing_catalog), ACTIVE: solo_vendor_monthly/_annual,
  pro_vendor_monthly/_annual, enterprise_vendor_monthly/_annual, vendor_3d_booth, vendor_3d_booth_event,
  vendor_additional_branch, vendor_ai_addon, vendor_custom_*, vendor_deep_search, vendor_extra_seat,
  vendor_papic_portfolio_pack, vendor_photo_challenge ("Papic Challenges").
- `{ kind: 'free' }` · `{ kind: 'paid', catalogue, codes }` (page shows the lowest; "From" when >1 code)
  · `{ kind: 'free-plus', catalogue, codes }` (free to use, optional upgrade from the lowest code).
  Decide from the code (lib/add-ons-catalog.ts `tier`/`serviceKey`, lib/entitlements.ts
  FREE_FOR_ALL_SKUS, the product page). If a host feature is free to use and has a paid ◆ Pro/upgrade,
  that is 'free-plus'. Supplier features included in the free shop are 'free'; if a supplier feature needs
  a paid plan, say which (codes) — check the plan gating in the vendor-dashboard code.

## tryHref / moreHref / guides
- `tryHref` ONLY if one of: '/papic' '/panood' '/pa3d/try' '/pawebsite' '/explore' '/explore/compare'
  genuinely lets a stranger try THIS feature. Otherwise omit.
- `moreHref` = the feature's existing public product page if one exists (apps/web/app/(shell)/<x>/page.tsx,
  or /for-suppliers, /open-shop, /alaala, /realstories …) — verify the page file exists. Else omit.
- `guides` = 0–3 slugs from apps/web/lib/blog.ts BLOG_ARTICLES that genuinely relate (check they exist
  and are not future-dated). Optional.

## evidence
List 2–6 repo paths (relative to apps/web, e.g. 'app/dashboard/[eventId]/guests/page.tsx',
'lib/guest-rsvp.ts') of the shipped files that make the page's claims true. The guard fails if any
disappears. Every path must exist (check with ls).

## When done, reply with
1. The slugs you wrote (and any assigned slug you OMITTED because it does not really ship — explain).
2. Each paid/free decision with the code that proves it.
3. Any tempting-but-FALSE claim you found (something an earlier page/design/doc says that the code does
   not do), with the file that proves it false — the lead adds these to the banned-phrase guard.
4. Any surprising fact (e.g. a feature that is wedding-only, flag-gated or not reachable by strangers).
Keep the reply under 500 words.
