## 2026-09-04 · feat(mood-board): kept renders become a browsable inspiration gallery (MB9)

Every Make-It-Real render a couple keeps can now appear, watermarked, as a
pickable reference photo in section 01 — a third source beside MB10's supplier
gallery and the couple's own uploads.

**⛔ The cache is cancelled, and this is what replaced it.** The original MB9
matched a new brief against a prior render's `config_digest` and served that
render back as a FREE OUTPUT. Owner, 2026-09-03: *"no need to give free
renders. always charge for renders."* Nothing shipped here reads
`config_digest`, scores similarity, or returns a price. `20271200273322`'s
header still describes the cache ("MB9's key must be COARSE") — applied
migrations are never edited, so that text stays wrong; the new migration's
header says so explicitly.

**What is free is LOOKING.** Picking a shared render costs nothing because it
produces nothing: `applyRenderPick` writes one `event_inspiration_assets` row
and touches no credit table and no provider. **Generating** a render still
always costs the stated credits from `moodboard_render_config`, through MB8's
Gemini pipeline, every time — no lookup, no substitution, no discount.

- **New migration `20271202349564_moodboard_render_inspiration_pool.sql`**
  - `event_renders.gallery_image_key` — the WATERMARKED copy, at a key that is
    not `image_key`. The couple's own copy stays unmarked; they paid for it.
  - `moodboard_attach_gallery_copy(render, key)` — the only writer of that
    column. Refuses a render with no image, a failed one, and one that already
    has a gallery copy (a second attach would orphan the first object).
  - `moodboard_inspiration_pool(event, part_ids, limit, offset, render_id)` —
    the sanctioned cross-event read `20271200273322` said MB9 owed. Requires
    `reusable` AND the source event's share consent AND a gallery key; excludes
    the caller's own event; returns nothing that would say whose wedding it
    was. `p_render_id` re-checks ONE render through the identical predicate at
    save time, so browse and save cannot drift.
  - `event_inspiration_assets.source_kind` gains `'render_pick'`, paired with a
    new `source_render_id` by a biconditional CHECK — MB10's shape. **ON DELETE
    CASCADE, not SET NULL:** nulling would violate that CHECK and make the FK
    behave like RESTRICT, blocking the source couple's account deletion.
- **`lib/watermark-server.ts`** — the `sharp` equivalent of `lib/watermark.ts`,
  which is Canvas-based and cannot touch bytes a browser never saw. Output is
  always JPEG; unreadable bytes THROW rather than passing the original through.
- **`lib/moodboard-gallery-copy.ts`** — returns the gallery key and the marked
  bytes together, so no call site can pair a `render-gallery/` key with unmarked
  bytes.
- **`lib/bucket-routing.ts`** — `render-gallery/` routes to the PRIVATE bucket.
  It does not start with `renders/`, so without its own rule it would have
  fallen through to the public `media` default and published every render,
  consented or not, at the moment it was made.
- **`lib/moodboard-render-pool.ts` + `render-pool-picker.tsx`** — MB10's paged,
  server-capped shape reused rather than a second picker. The slot → render-part
  map is DERIVED from the render-part registry, never listed.

**Guards, all sabotage-tested:**
`tests/db/the-inspiration-pool-shows-only-what-was-shared.db.test.ts` builds one
row per independently-droppable predicate (unconsented · quarantined ·
note-bearing · unwatermarked) so removing any one of them goes red on its own;
`lib/watermark-server.test.ts` and `lib/moodboard-gallery-copy.test.ts` decode
the OUTPUT and read its pixels — a flat-grey fixture in, ink measured in the
marked corner and absent from the opposite one, so a "marked: true" flag or a
bare JPEG re-encode cannot pass; `the-render-pool-pick-is-free.test.ts` slices
each pick function's own body and refuses every symbol that spends money or
makes an image.

**Observed, not changed:** `event_inspiration_assets.source_render_id` carries
the same `anon=SIU` column grant every other column of that table already has.
That table's wide default predates MB9 and is policed by RLS; narrowing it is a
separate change with its own blast radius.

SPEC IMPACT: None. The cancelled cache was never written into the corpus as a
locked decision — `MB-PLAN.md`'s owner-decision #2 ("render cache-key
coarseness") is retired by the 2026-09-03 always-charge call and MB9's brief
already records it as superseded. Pricing is unchanged: 1 credit per part, 5 for
the whole look, read from `moodboard_render_config` at spend time.
