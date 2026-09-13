# The Inspiration Gallery — MB17 … MB22

Planned 2026-09-04, from an owner working session. One session per file, one branch per session,
one PR, auto-merge armed, worktree pruned on merge. Same pattern as `MB0–MB15`.

## What already ships — do NOT rebuild any of it

MB10 (PR #5168 lineage, merged 2026-09-03/04) and MB11 built the whole chain. RULE 0 applies to
this plan itself: every session below is a DELTA on shipped code.

- **The pool** is `moodboard_library_assets` with `asset_type = 'supplier_gallery'`;
  `asset_subtype` carries the inspiration slot key (there is deliberately no `slot_key` column —
  Ugat joint J44 claims that absence).
- **The trade gate** is `slotUploadVerdict` in `lib/moodboard-gallery-upload.ts`, reading
  `canonicalServicesForSlot` → `MOODBOARD_SLOT_TRADES` → `lib/taxonomy.ts`.
- **The screen** is `lib/moodboard-gallery-screen.server.ts`: QR decode, the vendor's own contact
  values, own-logo pHash. Hard blocks, each naming what was found.
- **The mark** is `lib/watermark-server.ts` (sharp + satori + bundled Poppins), applied to the
  gallery copy only — never the couple's own photograph.
- **Approval** — every upload lands as a draft; an admin sets `approved_at` at
  `/admin/studio?tab=moodboard-library`.
- **The couple's side** — `shapeGalleryPage`, the paged picker, the `SavedPhotoMarker` on the
  vendor list.

## Owner decisions made 2026-09-04 — do not re-ask these

| Decision | Verbatim / settled |
|---|---|
| Back-catalogue is OPEN | *"all their previous work can be uploaded to us, until we have enough data of our own"* |
| The cap | **20 per vendor per category they cover** — every tier, free included |
| Seeded photos are NOT deleted | Owner accepted the demote-don't-delete argument: *"so they can upload. and they will not be deleted."* |
| Every inspiration photo carries a URL mark | `WWW.SETNAYAN.COM` |
| Setnayan-created photos stand out | *"we want the ones created with setnayan to stand out better than the ones not from setnayan"* — resolved as a discreet SEAL, not a heavier stamp |
| Upload content rule | *"No logos, no contact information, no names, no qr codes, no links, just plain photo"* — implemented as hard-block for the deterministic set, admin queue for the rest |
| Questionable photos | *"sent to the admin for manual resolution where to accept or reject"* |

## Owner decisions still OPEN — these gate MB18 and MB20

| # | Question | Gates |
|---|---|---|
| 1 | Does `overall` keep `coordinator`, or is it replaced by reception + stylist + lights_sound? | MB18 |
| 2 | Does `reception_venue` stay `['reception']` alone? (Read as YES — the combination moved to `overall` instead.) | MB18 |
| 3 | Do `stage` and `backdrop` admit `lights_sound`? | MB18 |
| 4 | Which mark do MB9's kept RENDERS carry — plain stamp, celebration seal, or their own? | MB20 |
| 5 | Vendor showcase VIDEOS are unmarked today (`watermarkFile` is images-only). Leave, or mark? | MB20 |

## Deferred on purpose — not in this arc

**The 500 sunset.** When a category reaches 500 approved, un-retired event-linked photos,
back-catalogue intake for that category closes. Nothing is deleted; existing photos stay.
Not built now because the trigger is far away — an event-linked photo needs a completed,
confirmed booking where the shop was the couple's recommended pick, so 500 in one category is a
great many finished weddings. Build it when a category passes ~100.

## 🛑 COLLISION WITH MB16 — resolve before MB18 starts

`MB16 — Vendor Colour Access` is **live right now** (worktree `setnayan-mb16`, branch
`claude/mb16-vendor-colour-access`, two uncommitted migrations already written). Its **Part 1**
says it will *"Extend `MOODBOARD_SLOT_TRADES` in `apps/web/lib/moodboard-gallery.ts`"* — the exact
constant MB18 below rewrites. Checked 2026-09-04; the four stale `claude/vendor-*` branches that
also touch these files are 6 weeks old with no PR and are not a risk.

**Two things in MB16's Part 1 table will not compile against that constant:**

1. `walls`, `welcome_signage`, `entrance`, `photo_wall` are reception DESIGN PARTS, not inspiration
   slots. The map is typed `Record<MoodboardSlotKey, readonly WeddingTile[]>`, and
   `INSPIRATION_SLOT_FOR_PART`'s docblock says outright that those parts *"have no inspiration
   slot"*. Widening `MoodboardSlotKey` to admit them would cascade into the DB CHECK
   `event_inspiration_assets_slot_key_check`, `GALLERY_SLOT_LABEL`, the picker and MB19's quota.
2. `barong_tagalog_custom`, `barong_tagalog_rental`, `filipiniana_balintawak`,
   `filipiniana_maria_clara`, `filipiniana_terno` are CANONICAL SERVICE keys, not `WeddingTile`s.
   The map's values must be tiles. This is the same tile-vs-canonical confusion that left
   `filipiniana_barongs` inert — see MB18.

✅ **RESOLVED 2026-09-04** — a `⚠ CORRECTION TO PART 1` section was added to `build-sessions/MB16.md`
recording this. MB18 is therefore UNBLOCKED and may run in parallel with MB16.

**The resolution — the two sessions want different maps, and then do not overlap at all:**
MB16 Part 1 needs a **part → trade** map (a sibling of `INSPIRATION_SLOT_FOR_PART` in
`lib/moodboard-slots.ts`), because its job is giving the eight orphaned DESIGN PARTS a trade to
sign off MB12's handshake. MB18's job is giving INSPIRATION SLOTS the right trades for uploads.
Split that way, they can run in parallel. Left as written, they conflict in one file and encode
two different beliefs about what `MOODBOARD_SLOT_TRADES` is for.

⚠ **Migration prefixes.** MB16 holds `20271204557031` and `20271204966904` uncommitted. MB21 needs
a migration — allocate it forward with `pnpm migration:new` AFTER those land. The PGlite replay
applies in FILENAME order, which is the real reason to allocate forward (not the false
"a low prefix will not apply" belief — see the repo `CLAUDE.md`).

## Sequence

```
MB17 ─┬→ MB18 ─┐
      ├→ MB19 ─┼→ MB21
      └→ MB20 ─┴→ MB22
```

MB17 first and alone: until it lands, the trades this arc exists for cannot reach the page at all.

---

## MB17 — The door nobody can find

> ▶ **RUNNING as its own session (launched 2026-09-04).** The earlier note here proposed folding
> it into MB19; the owner launched it separately instead. It touches `shop/page.tsx`, which no
> other live session touches, so it is the one stream with zero overlap.

**Goal:** the suppliers MB11 opened the gate for can actually reach the upload page.

**Model:** Sonnet · medium effort — a one-predicate swap with a guard.
**Size:** ~1 hour. **Depends on:** nothing.

### The bug

MB11 widened the page gate AND the server action to every supplying trade. It did not widen the
only LINK to that page. `shopOwnerIsStylist()` in `app/vendor-dashboard/shop/page.tsx` still reads
`services.includes('reception_decor')`, so the "Moodboard library" card shows for
stylist/decorators only. A florist, cake maker or gown designer can upload solely by typing
`/vendor-dashboard/moodboard-library`. The bottom-nav entry is an `activeMatch` string, not a link.

🔑 **This is the same disease MB11 was written to cure, one layer out.** The gate opened and the
signage did not, so the widening is invisible — indistinguishable from never having shipped.

### Delivers

- `shopOwnerIsStylist()` replaced by the shared predicate — `uploadableSlotsForShop(profile.services).length > 0`,
  or `moodboardLibraryAccessForProfile(profile).allowed`. **One predicate for one question**
  (`lib/moodboard-library-access.ts`'s docblock says why; do not add a third).
- The card's `sub` copy stops saying "recolourable sets couples match to their palette" — that is
  the old stylist-library framing, not the supplier gallery.

### Verify

- `pnpm exec tsc --noEmit` from `apps/web`
- guard: a profile whose only service is `bridal_gown_custom` gets the Moodboard library card.
  Sabotage: restore the `reception_decor` check, confirm red, restore.
- ⚠ Anchor the guard on the SHOP-TOOLS render, not on the file containing the string — see
  [[a-source-guard-cannot-see-a-return-null]]. Assert the card is in the returned shelf.

### Owner decides first

Nothing.

---

## MB18 — The trade map says what the owner says

**Goal:** the slot → trade map matches the owner's own words.

**Model:** Sonnet · high effort — the map additions below are the whole job; no resolution fix
is needed (see the correction).
**Size:** half-day. **Depends on:** MB17 (so the change is reachable, merged).

### ⚠ CORRECTION, 2026-09-04/05 — the "inert tile" finding below this line was FALSE

**`filipiniana_barongs` is NOT inert. It never was.** Measured directly against `origin/main`,
twice, via both call paths, immediately before this correction was written:

```
node -e "require('tsx/cjs');console.log(require('./lib/vendor-counts.ts').canonicalServicesForTile('filipiniana_barongs'))"
→ 10 canonicals: filipiniana_terno, filipiniana_maria_clara, filipiniana_balintawak,
  barong_tagalog_custom, barong_tagalog_rental, maranao_wedding_attire, tausug_wedding_attire,
  yakan_wedding_attire, muslim_modest_bridal, inc_modest_bridal

node -e "require('tsx/cjs');console.log(require('./lib/moodboard-gallery.ts').canonicalServicesForSlot('bride'))"
→ includes every one of the 10 above
```

`lib/vendor-counts.ts` special-cases the tile with an explicit
`map.set('filipiniana_barongs', [...FILIPINIANA_BARONG_CANONICALS])` that bypasses the ordinary
per-canonical derivation — unusual, but real, and it already flows through
`canonicalServicesForSlot` correctly. **No resolution fix is needed anywhere.** This false claim
had already propagated once (into `build-sessions/MB16.md`, corrected there 2026-09-04 by MB16's
own session, which verified independently before building) and survived in THIS document because
nobody had reconciled the two. Re-measure before trusting either file again — see
`build-sessions/MB-OVERSIGHT.md`'s log for the earlier correction.

**What is still real and unaffected by this correction: the map additions below.** Whether the
tile appears on `entourage` and `guests` is a different question from whether the tile resolves
canonicals — it does the latter; it is missing from the former two slots. That is the actual job.

### Delivers

**The map, per the owner** — no resolution fix, only these additions:
- `entourage` += `filipiniana_barongs`
- `guests` += `filipiniana_barongs`
- `flowers` = `['florist', 'stylist_decorator']` — florist FIRST; order sets the credit line
- `overall` = `['reception', 'stylist_decorator', 'lights_sound']` — owner's order, verbatim
- `GALLERY_SLOT_LABEL` unchanged (no new slots)

⚠ **Consequence of the `overall` order, named rather than discovered later:** a shop listing both
reception and styling is credited "· Reception" on an overall photo, not "· Stylist / Decorator".
A pure stylist is unaffected.

### Verify

- `pnpm exec tsc --noEmit` from `apps/web`
- guard: **a shop whose only service is `barong_tagalog_rental` may upload to `entourage` and
  `guests`.** Sabotage: remove the tile from those two rows' map entries, confirm red, restore.
  This is the guard that proves the MAP ADDITION (not a resolution fix — none exists or is
  needed) actually reaches those two slots.
- guard: `canonicalServicesForSlot('bride')` still contains at least one
  `FILIPINIANA_BARONG_CANONICALS` member — a non-regression pin on the resolution that ALREADY
  worked before this session touched anything, so a future refactor cannot quietly break it.
- guard: the credit for a florist on `flowers` still reads "Florist" — assert
  `tradeLabelForCredit('flowers', ['florist'])`, and the stylist case separately.
- ⚠ Assert per row with a COUNT, not a file-level match — see [[a-guard-window-anchored-on-the-first-match-faces-the-wrong-cell]].

### Owner decides first

Open decisions **1, 2, 3** above. The four rows listed under Delivers are settled and can proceed
without them; the three open rows are additive and can ride in the same PR once answered.

---

## MB19 — Twenty per category, every tier

**Goal:** the gallery can actually fill up.

**Model:** Sonnet · high effort — the change is small, the unit change is easy to get wrong.
**Size:** half-day. **Depends on:** MB17.

### The change of UNIT, not just of number

`galleryBackCatalogPhotos` is counted **account-wide** today: `vendor_profile_id` +
`asset_type = 'supplier_gallery'` + `source_event_id IS NULL` + `retired_at IS NULL`. The owner's
rule is **per category**. Same field, different denominator.

### Delivers

- `TIER_CAPS[*].galleryBackCatalogPhotos` = **20** for all six tiers (was `0/0/0/20/100/100`)
- **Rename the field** to say what it now means — a name that says "photos" while the number means
  "photos per category" is the kind of lie nothing goes red over
- `countBackCatalogue` gains `.eq('asset_subtype', slot)` and takes the slot
- the refusal message names the category: *"You've used all 20 Flowers photos. Retire one, or add
  photos from a celebration you were booked on — those never count."*
- `backCatalogueQuotaVerdict`'s message copy loses "on your plan" (no longer a tier statement)
- update the assertions in `lib/moodboard-gallery-upload.test.ts` that pin `pro = 20`,
  `enterprise = 100`

⚠ **Event-linked stays unlimited and uncounted, at every tier.** Unchanged. The owner's earlier
*"1 event + 1 to gallery"* would have capped that side and was never defined — it is NOT in scope
here, and nothing in this session should make it harder to add later.

### Verify

- full db replay + both Ugat tests (no migration expected — confirm, don't assume)
- guard: **the quota is per category.** Sabotage: drop the `asset_subtype` filter, confirm red.
  Construct a shop holding 20 Flowers photos and assert it may still upload to Tables.
- guard: an event-linked insert is allowed at 20/20 in that same category
- guard: a free-tier shop may now back-catalogue at all
- ⚠ The counter reads `source_event_id IS NULL` AND `retired_at IS NULL` AND now `asset_subtype`
  — three narrowing predicates in one query. Build the row each one ALONE rejects; see
  [[one-query-many-predicates-tests-the-conjunction]].

### Owner decides first

Nothing.

---

## MB20 — Two marks, one URL

**Goal:** every inspiration photo carries `WWW.SETNAYAN.COM`; the ones that are genuinely
Setnayan's carry a seal instead of a stamp.

**Model:** Opus · high effort — a shared module with pixel-asserting tests on both sides.
**Size:** 1 day. **Depends on:** nothing (parallel-safe with MB18/MB19).

### The geometry bug this must fix FIRST

`watermarkLayers` sizes the plate as `fontSize * (WATERMARK_TEXT.length * 0.72 + 1.4)`. That
estimate was tuned for the 8-letter word. At 16 characters the rendered text **overflows its
plate on both ends** — measured on 2026-09-04 by rendering it. Fix by MEASURING the rasterised
wordmark (`sharp(...).trim()`, then size the plate to it), not by re-tuning the constant.

### Delivers

- `WATERMARK_TEXT` → `WWW.SETNAYAN.COM`, plate measured rather than estimated, type scaled so the
  mark keeps roughly the physical footprint the 8-letter word had (~62% of the current size)
- a **variant** parameter on `watermarkImageBytes` — `'stamp' | 'seal'` — threaded from the row:
  `source_event_id IS NULL` → stamp, else seal
- the seal: thin outlined badge, `SETNAYAN` over a hairline rule with `CELEBRATION` beneath, plus
  `WWW.SETNAYAN.COM` small and low-contrast in the corner. No filled plate.
- MB9's pixel baselines regenerated (they pin the current glyphs and WILL go red — that is the
  test working, not a failure to route around)

🔑 **The seal is SMALLER than the stamp, deliberately.** A heavier mark on Setnayan's own
celebrations would deface exactly the material it is meant to distinguish. The standing-out is
done in the picker (MB22), not in the pixels.

### Verify

- `pnpm exec tsc --noEmit` from `apps/web`
- guard: **every photo entering either pool carries a mark — assert on OUTPUT PIXELS**, never on a
  flag claiming it was applied. Sabotage: skip the composite, confirm the guard catches the
  unmarked image. See [[a-flag-in-an-object-is-not-ink-in-the-pixels]].
- guard: the mark fits INSIDE the image and inside its plate at the long text — assert the marked
  region's bounds, since the bug this session fixes is precisely an overflow that still composited
- guard: the seal appears only on `source_event_id IS NOT NULL`; the stamp only on NULL
- guard: **the couple's own private copy is still unmarked.** `moodboard-gallery-copy.ts` names
  both keys — assert the untouched one byte-for-byte.
- ⚠ `sharp`'s `.stats()` ignores a preceding `.extract()` — read regions with `.raw()`; see
  [[sharp-stats-ignores-extract]].

### Owner decides first

Open decisions **4** (renders' variant) and **5** (showcase videos). Neither blocks the stamp/seal
split; both can land after.

---

## MB21 — Questionable goes to a human

**Goal:** the content rule the owner stated, with the ambiguous half reaching a person instead of
bouncing an honest supplier.

**Model:** Opus · high effort — a migration plus two UIs, and the failure mode is a check that
runs and changes nothing on anyone's screen.
**Size:** 1–1.5 days. **Depends on:** MB17. **Runnable NOW** — allocate its migration prefix
ABOVE MB16's two uncommitted ones (`20271204966904` is the higher). `pnpm migration:new` in a
fresh worktree cannot see untracked files in another worktree, so it could otherwise duplicate a
prefix, which `scripts/check-migration-timestamps.mjs` enforces as UNIQUE.

### The rule

| | Outcome |
|---|---|
| QR code · any URL or social handle · any email address · the vendor's own name, phone or logo | **Hard block at upload**, message names what was found |
| Unfamiliar name, phone-shaped digit run, logo-ish mark, heavy text | **Flag → admin queue** |
| Clean | Draft → admin approval, as today |

🛑 **"No names" is NOT implemented as a block.** A very large share of legitimate inspiration
photos carry the couple's names by design — on the backdrop, the welcome sign, the monogram, the
stage lettering. Blocking names outright would gut the `backdrop` and `stage` categories. Names go
to the queue. The same reasoning kills generic phone-shaped matching, and
`lib/moodboard-gallery-upload.ts`'s docblock already records the false positives a generic
detector produces (table numbers, dates, menu prices, the couple's own mobile).
**Do not import `lib/chat-contact-filter.ts` here.** It is deliberately not imported.

### The two gaps this session closes

1. **The flag has nowhere to live.** The screen has exactly two outcomes today. A flagged photo
   would reach the admin queue looking identical to a clean one.
2. **Reject tells the vendor nothing.** Admin actions are `approveAsset`, `retireAsset`,
   `deleteAsset`. Retiring hides the photo; the vendor's editor goes on saying
   "draft (pending review)".

### Delivers

- **Migration:** a findings column on `moodboard_library_assets` (what was found + the text it was
  read from) and a rejection reason. Follow the `rights_warranted_at` / `rights_warranty_version`
  precedent — pair them with a CHECK so a reason cannot exist without a rejection, or vice versa.
  ⚠ A new column inherits the public grant — see [[a-new-column-inherits-the-public-grant]]. These
  hold screening internals and a reviewer's words; they must not be anon-readable.
- **The widened hard blocks:** any URL, any social handle, any email. Cheap — the vision model
  already transcribes all text; only the judgement is new, and it belongs in the pure module.
- **Admin:** findings shown on the photo, and a reject-with-reason action beside approve.
- **Vendor:** the rejection reason surfaced in their own library editor, worded like the hard-block
  messages — *"We couldn't publish this: there's a phone number on the sign behind the cake."*
- Both surfaces already exist (`/admin/studio?tab=moodboard-library`, the vendor library editor).
  **Extend them. No new pages.**

### Verify

- full db replay + both Ugat tests + `node apps/web/scripts/lint-events-column-grants.mjs`
- guard: **a flagged photo's finding reaches the ADMIN RENDER**, not merely the row. Sabotage:
  store the finding and drop it from the component, confirm red. This is the whole session —
  a log line never changed a pixel.
- guard: **a rejection reaches the VENDOR'S render**, same sabotage.
- guard: a URL / handle / email is hard-blocked with a message naming it
- guard: **a photo whose only text is a couple's name is NOT blocked** — it is flagged. Sabotage:
  make names a block, confirm this test catches it, restore.
- guard: the text screen still FAILS OPEN and visibly (`textScreen: 'unavailable'`) when the key
  is unset — unchanged behaviour, re-pinned because this session moves the code around it

### Owner decides first

Nothing — the rule is settled above.

---

## MB22 — Yours stand out

**Goal:** the standing-out happens where the couple is actually comparing photos.

**Model:** Sonnet · high effort. **Size:** half-day. **Depends on:** MB20.

### Delivers

- Event-linked photos rank FIRST in the gallery picker, before back-catalogue
- A visible badge in the picker — *"A Setnayan celebration"* — on those rows
- ⚠ Ordering must not break the paging. `GalleryPage` already distinguishes `total`, `withheld` and
  `hasMore`, and `hasMore` is offset-based precisely because a page may legitimately drop rows.
  A re-sort that reads `assets.length` re-introduces the bug that shape was built to avoid.

### Verify

- guard: an event-linked photo sorts above a back-catalogue photo in the same slot
- guard: the badge reaches the picker render, and only on event-linked rows
- guard: paging still terminates with a page whose rows are all withheld

### Owner decides first

Nothing.
