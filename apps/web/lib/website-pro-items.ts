/**
 * apps/web/lib/website-pro-items.ts
 *
 * THE PRO ITEMS — one list, named the way the couple sees them. Count the
 * array, never a sentence (the sentences that speak for it compute the number).
 *
 * 🔄 2026-10-22 — SAY EVERYTHING PRO COVERS BEFORE "APPLY". Owner, "Yes to all"
 * (`Setnayan/prototypes/journey_fixes_2026-10-22.html` § Host 5, DECISION_LOG
 * "THE PRO LIST NAMES EVERY GATE"). Pro already gated six more things elsewhere
 * in the code, and a host first met each of them at the Apply sheet: each part's
 * style and animation (`HUB_ELEMENT_PRO_FIELDS`, lib/hub-look-pro.ts) ·
 * decorations (`ART_KIT_IS_PRO`, lib/art-kit-pro.ts) · the story past
 * `FREE_MOMENT_CAP` and its photos (lib/love-story-moments.ts) · uploads past the
 * free allowance (`MAKER_EVENT_MEDIA_BYTES_CAP`, lib/maker-media-limits.ts) ·
 * print files in a Pro theme (`isProPrint`, lib/print-pieces.ts) · the all-guests
 * download (`isAllInOnePrint`). Later the same day (owner, "Yes to all" — DECISION_LOG "THE PRO LIST SAYS THE
 * REAL GATE") three of those lines were reworded to say the gate as it is: Pro's per-event upload space (computed),
 * photos in ANY Love Story moment, and every all-in-one download by name. They join the list in the prototype's words, and
 * "Editorial editing" LEAVES it — it has been free for every couple since
 * 2026-08-23 (`EDITORIAL_PRO` in `FREE_FOR_ALL_SKUS`), so naming it told a couple
 * they were buying something they already had. NO GATE MOVED: this is the list
 * the couple reads, and `the-pro-list-names-only-real-gates.test.ts` holds every
 * line to the gate that refuses a free couple — flip a gate and it fails.
 *
 * 🔄 2026-10-22, LATER STILL — FREE IS READY, PRO IS PERSONAL (owner, verbatim: *"the goal of the free is to keep
 * everything minimum ready but no personalization."* · *"they pay to customize it."* · *"my issue is the data storage
 * if i keep accepting free photos which uses more data."*; DECISION_LOG row of that name). ONE GATE MOVED: every
 * guest's ticket in one file and the Guest QR sheet download free (`isAllInOnePrint`). Four lines say it: "More
 * upload space — 500 MB per event" (computed) · "Photos in your Love Story, and more than 5 moments" (computed) ·
 * "One download of the whole designed set" · "Prints in your Event Hub look".
 *
 * 🔄 TEN → NINE, 2026-09-28 — THE FREE-VS-PRO REDRAW. Owner, verbatim: *"free
 * to change design, change text, size, color, background color, only when you
 * start adding themes will it be pro. adding media for background."* So
 * "Background color" and "Button color" left the list (both are free for every
 * couple now — `HUB_FREE_LOOK_EVENT_COLUMNS` in `lib/hub-look-pro.ts`), and the
 * thing he named instead joined it: "Photo and video backgrounds" — media behind
 * a scene or behind the whole page, which the Maker has gated since 2026-09-24.
 *
 * 🔄 EIGHT → NINE, 2026-09-24. Owner ("A then", DECISION_LOG "Event Hub Pro
 * includes the logo animation"): `COUPLE_WEBSITE_PRO` now also confers
 * `ANIMATED_MONOGRAM` (SKU_OWNERSHIP_ALIASES in lib/entitlements.ts). The ₱500
 * standalone stays on sale; this list names the inclusion so the Pro offer
 * says what it buys.
 *
 * 🔄 SEVEN → EIGHT, 2026-09-11. Owner (Q3 = A, DECISION_LOG "the seven
 * invite-theme questions"): *"the invite theme becomes the eighth Event Hub Pro
 * item. Price and SKU unchanged."* It is not a new unlock and not a new SKU —
 * `COUPLE_WEBSITE_PRO` already gates the four Pro invite themes
 * (`app/[slug]/invite/_lib/load-invite-look.ts`), and this list is what the
 * couple is SHOWN. Until today the umbrella withheld something it did not name.
 *
 * These names shipped inside `app/dashboard/[eventId]/website/editor/
 * _components/pro-panels.tsx`, which is a `'use client'` component file. The
 * Event Hub controller needs the SAME names on the server, and a resolver
 * that imported them from a client component would drag `next/link` and
 * `lucide-react` into a pure module and into every test that touches it.
 *
 * 🔑 SO THE LIST MOVED HERE AND `pro-panels.tsx` NOW IMPORTS IT — it is not
 * copied. Two lists of the same eight strings is precisely the failure this repo
 * has paid for most often: two mechanisms that disagree about one fact, each
 * passing its own suite. `WEBSITE_PRO_ITEMS` is still exported from
 * `pro-panels.tsx` under its old name so nothing that already imports it moves.
 *
 * ⛔ NO PRICE LIVES HERE. `COUPLE_WEBSITE_PRO` (titled "Event Hub Pro") is the
 * ONE unlock that opens every item, and its figure is read live from
 * `platform_retail_catalog_v2` via `formatV2Sku` — never typed into source. The
 * `couple-website-pro.ts` docblock records why: three different figures for one
 * product once lived in a single file.
 */
import { PRO_THEMES } from '@/lib/invite-themes';
import { formatCount } from '@/lib/format-number';
import { coupleMediaCapBytes, formatMakerMediaMB } from '@/lib/maker-media-limits';
import { FREE_MOMENT_CAP } from '@/lib/love-story-cap';

/**
 * 🎨 THE PRO THEMES, COUNTED — never typed. Owner 2026-09-29, *"Okay use modern
 * and cyber FREE"*: Modern and Cyber Neon joined Classic as free themes, and
 * this item — which said "9" as a typed digit — would have gone on selling two
 * themes every couple already has. The number is the registry's count of
 * shipped Pro themes (`PRO_THEMES` in `lib/invite-themes.ts`), so a tier flip
 * rewrites the sentence instead of leaving it to rot.
 */
export const PRO_THEMES_ITEM = `${formatCount(PRO_THEMES.length)} Event Hub themes, invite link included` as const;

/**
 * 📦 THE UPLOAD LINE, COMPUTED — never typed. Owner 2026-10-22 ("Yes to all", DECISION_LOG "THE PRO LIST SAYS THE REAL
 * GATE"): the gate is a per-EVENT allowance (Free 10 MB · Pro 500 MB, `coupleMediaCapBytes`), not a per-file size, so the
 * line names Pro's allowance — and reads it from the ONE cap function, written the way the meter writes it
 * (`formatMakerMediaMB`). Move the allowance and the sentence moves with it.
 */
export const UPLOAD_SPACE_ITEM = `More upload space — ${formatMakerMediaMB(coupleMediaCapBytes(true))} per event` as const;

/**
 * 📖 THE LOVE STORY LINE, COMPUTED — never typed. Owner 2026-10-22 (DECISION_LOG "FREE IS READY, PRO IS PERSONAL — ALL TICKETS AND
 * THE QR SHEET ARE FREE"): *"they pay to customize it."* A free event keeps `FREE_MOMENT_CAP` word-only moments; a photo on ANY
 * story, and a story past the cap, are Pro (`momentCapRefusal` → 'photos_pro' · 'more_stories_pro'). The number is the cap's.
 */
export const LOVE_STORY_ITEM = `Photos in your Love Story, and more than ${formatCount(FREE_MOMENT_CAP)} moments` as const;

/**
 * 🎟 THE DOWNLOAD LINE (owner 2026-10-22, same row): every guest's ticket in one file and the Guest QR sheet are FREE now (a free
 * event is "minimum ready"); what Pro buys is the DESIGNED set in one file — the whole set, Everything and the place-card pack
 * (`isAllInOnePrint`). The guard holds that set to the gate both ways.
 */
export const DESIGNED_SET_ITEM = 'One download of the whole designed set' as const;

/** 🎨 THE PRINT LINE (owner 2026-10-21 "Themes that follows the event hub is pro"; reworded 2026-10-22): `printLookForEvent`. */
export const PRINT_LOOK_ITEM = 'Prints in your Event Hub look' as const;

/** The Pro items, named the way the couple sees them — in the prototype's order (2026-10-22). */
export const WEBSITE_PRO_ITEMS = [
  'Cinematic Reveal',
  'Save-the-Date video',
  'Photos you add',
  'Background music',
  // "Editorial editing" stood here until 2026-10-22 — free for every couple
  // (`EDITORIAL_PRO` ∈ `FREE_FOR_ALL_SKUS`), so it is not something Pro buys.
  // Media behind a scene or behind the whole page (owner 2026-09-28: "adding
  // media for background"). The COLOURS that stood here are free now.
  'Photo and video backgrounds',
  // The Pro themes (owner 2026-09-24/25: "themes are part of pro except
  // classic"; 2026-09-29: except Classic, Modern and Cyber Neon). Still names
  // the invite link, because the theme dresses the invite door too — and the
  // number is COMPUTED from the registry (`PRO_THEMES_ITEM` above), held by
  // `says-what-it-includes.test.ts` and `free-themes-are-free.test.ts`.
  PRO_THEMES_ITEM,
  // The logo animation (owner 2026-09-24, "A then"). Granted by the
  // ANIMATED_MONOGRAM ← COUPLE_WEBSITE_PRO alias; the couple meets it on the
  // Logo Maker, where the owned state reads "Included with Event Hub Pro".
  'Animated logo',
  // The Pro QR (owner 2026-09-27: "QR on Pro makes the logo use their logo on
  // the center. and change the shape, pattern style"). Free codes carry the
  // Setnayan mark; Pro puts the couple's own logo in the centre and opens Shape
  // (square · circle) · Pattern · Colour on the Maker's Details page. The old
  // "Custom QR per guest" product folded into this item (lib/qr-look.ts).
  'Your logo on every QR code',
  // ── The six gates the code already enforced, named 2026-10-22 (owner, "Yes to all").
  // Each is held to its gate by `the-pro-list-names-only-real-gates.test.ts`.
  // A part's Style and Animate (`HUB_ELEMENT_PRO_FIELDS`, owner 2026-10-16 "all animate, effects, styles, accents are pro").
  'Style and animation for every part',
  // The art kit (`ART_KIT_IS_PRO`, owner 2026-10-16 "the accents we added should be part of pro").
  'Decorations',
  // A photo on ANY story, and a story past `FREE_MOMENT_CAP`, are Pro (`momentCapRefusal` → 'photos_pro' · 'more_stories_pro').
  // Was "A 6th Love Story moment, with photos", then "Photos in your Love Story" (2026-10-22, both the owner's).
  LOVE_STORY_ITEM,
  // The per-event allowance (owner FINAL 2026-10-15 "Free 10MB" · "Pro is 500MB"), COMPUTED above — was "Uploads
  // over 10 MB", which described a per-file limit no code enforces.
  UPLOAD_SPACE_ITEM,
  // Every print in the event's own Hub look (`printLookForEvent`: a free event prints plain white, #6744). Was "Print
  // files in Pro themes" (`isProPrint`), which the Hub-look gate now says better (owner 2026-10-22).
  PRINT_LOOK_ITEM,
  // The DESIGNED set in one file (`isAllInOnePrint`: the whole set, Everything, the place-card pack). Every guest's
  // ticket in one file and the Guest QR sheet are free since 2026-10-22, so the line no longer names them.
  DESIGNED_SET_ITEM,
] as const;

export type WebsiteProItem = (typeof WEBSITE_PRO_ITEMS)[number];

/**
 * ⛔ THE ITEMS THE UMBRELLA MAY NOT BE SOLD ON — none, since 2026-10-22.
 *
 * Its one member was "Editorial editing": `EDITORIAL_PRO` joined
 * `FREE_FOR_ALL_SKUS` on 2026-08-23 and `lib/couple-website-pro.ts` says *"Event
 * Hub PRO may NOT be SOLD on this inclusion while it is free."* On 2026-10-22 the
 * item left the list itself (owner, "Yes to all" — a free thing is not on the list
 * of what Pro buys), which is the stronger form of the same rule. The mechanism
 * stays: if a listed item ever turns free before its line comes off, it goes here
 * and `resolveHubProOffer` refuses to lead on it. The free ruling is the owner's
 * to reverse; `the-pro-list-names-only-real-gates.test.ts` fails both ways.
 */
export const NOT_SOLD_ON: readonly WebsiteProItem[] = [];
