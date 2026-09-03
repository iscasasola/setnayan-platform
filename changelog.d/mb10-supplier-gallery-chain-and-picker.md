## 2026-09-03 · feat(mood-board): a supplier's photo carries their shop from the library to the vendor list

MB10. Migration first, feature second.

**THE HOLE.** A photo on a couple's inspiration board had no idea where it came from —
`event_inspiration_assets` recorded a `source_kind` of `url_paste` or `file_upload` and an
`image_url`, and nothing else. So when a couple saved a bouquet they loved, there was no supplier
at the other end of it, and the only reason a florist would ever bother uploading their portfolio
is that the couple who saves it can find them.

**THE APPLY-A-TEMPLATE PATH ALREADY PROVED IT.** `applyMoodboardTemplate` has been copying library
photos into empty inspiration slots since the theme gallery shipped, writing them as
`source_kind = 'url_paste'` — a Setnayan library asset permanently recorded as something the couple
pasted off the internet — because that was the closer of the only two modes that existed. Nothing
rendered differently, which is why it lasted. It now records `gallery_pick` + the asset id like
every other library-sourced row.

### Migration — `20271202093185_moodboard_supplier_gallery_chain.sql`

- `event_inspiration_assets.library_asset_id` → `moodboard_library_assets`, plus a third
  `source_kind`: `gallery_pick`.
- **The wiring is enforced by the database.**
  `event_inspiration_assets_gallery_pick_has_provenance` is a BICONDITIONAL between
  `source_kind = 'gallery_pick'` and `library_asset_id IS NOT NULL`. A future edit that drops the
  id cannot merely lose the credit quietly — the INSERT fails. Both directions, so the mode and
  the provenance can never disagree.
- `moodboard_library_assets.vendor_profile_id` → `vendor_profiles`. `uploaded_by` is a USER; the
  credit a couple reads is a SHOP, and one user may hold more than one.
- The rights warranty MB11 needs, landed HERE so MB11 is not a second migration:
  `rights_warranted_at` + `rights_warranty_version`, paired by a CHECK. Half a warranty is
  unusable — a timestamp cannot say what was agreed to.
- `asset_type` gains `supplier_gallery`, and for that type `asset_subtype` carries the inspiration
  slot. **No new `slot_key` column** (RULE 0 §3): `idx_moodboard_library_assets_published` is
  already `(asset_type, asset_subtype) WHERE approved_at IS NOT NULL AND retired_at IS NULL`,
  which is the picker's query verbatim. The Ugat map claims that absence as a `no_column` so a
  later "let's just add slot_key" turns red instead of creating a second source of truth.
- `moodboard_library_assets_supplier_gallery_shape` refuses a gallery row with no shop, a subtype
  that is not one of the 18 real slots, or — once `approved_at` is set — no rights warranty. That
  predicate is literally the public-read policy's, so the CHECK and the policy open the same door:
  an un-warranted draft may exist and can never be published.
- **Both new FKs are ON DELETE CASCADE, and SET NULL was the wrong first instinct.** SET NULL would
  turn a pick into a `gallery_pick` with a null id, fail the biconditional, and thereby *block* the
  delete; since `users → vendor_profiles` already cascades, an account deletion could be refused
  because of a photo on a stranger's mood board. Retiring (`retired_at`) is the soft path and does
  not touch either FK — a retired photo keeps rendering, credited. Hard-deleting removes the
  storage object too, so the tile has to go with it.

### The feature

- **The picker** (`_components/gallery-picker.tsx`), copying `template-gallery.tsx`'s shape: asks
  for nothing until tapped, one page at a time by `offset`, a quiet "Show more (N left)", a
  shown-and-retryable failure. **Capped on the SERVER**, not by the caller — every request goes
  through `normalizeGalleryQuery` and then `.range()` unconditionally, so a client that asks for a
  million rows gets `GALLERY_MAX_LIMIT`. The theme gallery's client-passed limit could not prevent
  the unbounded read PR #5113 had to kill.
- **THREE EMPTIES, THREE SENTENCES.** A dead fetch, a slot no supplier has stocked, and a slot
  whose photos we hold but may not credit are three separate facts. `withheld` counts the last one
  — a photo whose shop is not publicly readable, or which carries no sampled colours — because a
  gallery photo with no shop on it is a stock photo, and the Canvas extractor returns CREAM
  DEFAULTS on a tainted cross-origin canvas rather than throwing.
- **The credit reaches the BOARD, not just the picker.** `page.tsx` resolves
  `"Bloom & Vine · Florist"` server-side through the provenance, and the tile renders it. Otherwise
  the credit lasts exactly as long as the modal.
- **"You saved 2 of their photos" in the vendor list** — `SavedPhotoMarker`, mounted first in the
  result row's badge line. This is what turns inspiration into discovery. `null` is UNKNOWN, not
  zero: a failed tally leaves every count null and the overlay says so ONCE in its header, because
  a dead read that renders as a clean "you saved none of theirs" is this repo's signature defect.
- **The slot → trade map is a LOOKUP over `lib/taxonomy.ts`**, not a new list.
  `Record<MoodboardSlotKey, readonly WeddingTile[]>` makes a new inspiration slot a compile error
  until classified; every value is tile-typed so a renamed tile fails `tsc`; the canonical service
  keys are derived via `canonicalServicesForTile` for MB11's gate to read. `palette` maps to an
  EMPTY array and gets no button — a colour reference is nobody's portfolio, and guessing a trade
  would send a couple to florists for a paint chip. A shop whose trades don't reach the slot gets
  no trade label at all rather than the slot's first tile as a stand-in.

### Guards, all sabotage-tested

- `tests/db/the-gallery-chain-keeps-its-credit.db.test.ts` — 13 real inserts against the replay:
  both directions of the biconditional, the three shape refusals, all 18 slots accepted,
  warrant-then-approve, and both delete paths. It also proves a supplier's erasure (through
  `erase_vendor_seats`, the one door past `VENDOR_LAST_ADMIN`) is never blocked by a couple's
  saved photo.
- `lib/moodboard-gallery.test.ts` — 24 tests on the map's *properties* (exhaustive, tile-typed,
  no tile resolving to zero canonicals), the clamp (a million rows, a MISSING limit, NaN,
  negatives), and every withholding rule.
- `_components/the-gallery-picker-is-paged.test.ts` — pins the whole line: page.tsx → board →
  picker → action → normalizer → `.range()`, with counted assertions and windows anchored on the
  declaration each is about.
- `_components/the-saved-photo-marker-reaches-the-render.test.ts` — a REAL render of the marker
  (copy, pluralisation, 0 and null paint nothing) plus the mount pinned to
  `count={r.savedGalleryPhotoCount}`.

Ugat: `TYPE-GALLERY` on `moodboard_library_assets`, joints J44 and J45, 33 schema claims, no
baseline line added. The node's count is the WHOLE library, not the gallery slice — stated on the
node, because reading it as "supplier photos uploaded" would be wrong.

The admin and vendor library editors' `asset_type` unions were widened to four values: both pages
read every asset_type and cast the column to that union, so a fourth DB value with a three-value
type is a cast that lies. Deliberately not added to their `<select>` — gallery rows are authored
by the supplier upload page (MB11), and they carry a warranty those forms cannot capture.

SPEC IMPACT: **Yes.** New migration `20271202093185_moodboard_supplier_gallery_chain.sql` adds
`event_inspiration_assets.library_asset_id` + the `gallery_pick` source mode, and
`moodboard_library_assets.vendor_profile_id` + `rights_warranted_at` + `rights_warranty_version`,
with a new `supplier_gallery` asset_type whose `asset_subtype` is the inspiration slot key.
Iteration 0010's mood-board spec gains the supplier-gallery chain (library → board → vendor list)
and the rule that a publicly-readable supplier photo must carry a rights warranty. Corpus edits
applied under the 2026-06-04 direct-edit authorization.

### Follow-up in the same PR — the per-slot photo cap moves out of `wizard-actions.ts`

`MOODBOARD_SLOT_POSITIONS` / `MoodboardSlotPosition` / `MOODBOARD_MAX_PHOTOS_PER_SLOT` moved to
`lib/moodboard-slots.ts`, beside the slot keys MB2 moved there for the same reason.

🛑 **AND MB10 IS WHAT PROVED THE REASON IS REAL.** `wizard-actions.ts` is a `'use server'` module,
and Next refuses to build when one server module imports a non-function VALUE out of another:

    A "use server" file can only export async functions, found object.

The const had sat exported from there for months without complaint, because its only
value-importer was a CLIENT component — a direction Next permits. The moment
`studio/mood-board/actions.ts` (also `'use server'`) needed it to validate a gallery pick's
position, the whole `/dashboard/[eventId]/studio/mood-board` route failed to collect.

🔑 **`tsc --noEmit`, 12,593 unit tests and a full 2,166-assertion db replay were ALL GREEN through
it.** Only `next build` can see this class, which is why it reached CI. Now proven locally with
`pnpm --filter @setnayan/web build` before the re-push.
