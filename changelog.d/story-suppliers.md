## 2026-11-13 · feat(post-event): the story lists every supplier by plan — rich card, one scene per Supplier Ultra, album share

Owner rulings 13 Nov 2026 (specs DECISION_LOG "every booked supplier is tappable", "order by supplier plan",
"story with many suppliers", "Supplier Ultra scenes", "Supplier Ultra shares its album", "album share — default",
"Free adds event photos one at a time"), drawn in `prototypes/approved_2026-11-13/story-suppliers-fable.html` v6 and
approved "yes to all". Extends the Post Event story from #7596.

**The story (couples and guests)**
- `lib/story-suppliers.ts` (pure, tested): the order Ultra → Pro → Plus → Verified → Free → added by the hosts; top 8
  + "See all N"; the full sheet grouped by plan with counts (Free folded); search over 20; at most 3 tags a moment;
  the tap — rich card (Supplier Pro / Ultra), the shop (Plus / Verified / Free), or a plain name (no shop). Every link
  decided once, on the server (`toStorySupplierViews`).
- `app/[slug]/_components/story/story-suppliers.tsx`: "The people who made it" scene, the "In this story · N
  suppliers" sheet, the rich card (cover · trusted ★ rating · best work · Book = the shop's own Inquire pop-up · Visit
  the shop), and `UltraSupplierScene` — one per Supplier Ultra that shared its album, with ⓘ.
- `data.ts` + `lib/story-suppliers.server.ts`: card facts read from the shop's portfolio and
  `vendor_trusted_review_stats`; each Ultra's SHARED album (screened, unhidden), plan re-checked at read. A failed read
  keeps the plain credits; an empty album draws no scene. Replaces the article's old "Team Behind the Day" list.
- Free couples add "From the Day" photos one at a time (`FileUpload pickOneAtATime`); Event Plus / Pro / Ultra many
  at once — read with the shipped gates (`EVENT_PLUS_SKU`, editorial Pro).

**The supplier (Supplier Ultra)**
- Migration `20271345189965`: `vendor_event_album_shares` (OFF by default, `asked_at` = asked once), album
  `media_kind` / `video_r2_key` / `size_bytes`, album bytes summed into `vendor_storage_used_bytes`.
- "Share this album to the event's story" switch on the private album (Ultra); lower plans see the locked row with
  Problem → Solution; an Ultra that never answered is asked once after the event. One op (`albumshare`) on the existing
  `eventFilesAction` dispatcher — no new server-action export.
- Photo import checks the plan's storage first (`checkSupplierStorage`) and records `size_bytes`.

**Guards and maps**
- `lib/a-tap-from-the-story.test.ts` rewritten to the 13 Nov ruling (was: "only paid tiers link"; now: every booked
  supplier links by plan, a supplier with no shop never does). `editorial-gold-reads` reads the moved eyebrows too.
- Port baseline, Ugat screens and the exposure baseline regenerated (exposure diff = the share table + 3 album columns,
  the supplier's own rows only).
- Help: `story-suppliers`, `share-album-to-story`. Tour: Post Event "The people who made it".
- `/dev/story-suppliers-lab` (dev-only) for the 390 px shots.

**Not in this change:** videos in the album wait on the owner (credit cost of an imported video is not set).

SPEC IMPACT: None — builds the approved 13 Nov rows as drawn. Flag: the a-tap guard's old rule was retired by the
owner's 13 Nov ruling, not weakened.
