## 2026-08-19 · feat(papic): this day, as a flash

**SPEC IMPACT:** None — a doorway onto an engine that already shipped.

The last piece of the owner's 2026-08-19 Alaala design. The whole-life Life-Flash
sits at the top of Alaala; opening an album now offers **the same film pointed at
the one day**.

**The engine was already there.** The per-event scope type, the `e<eventId>` key,
the parser, and the slice have shipped since Life-Flash launched. What did not
exist was **any way in from the event** — a mapped grep for a per-event flash
entry point returned nothing, and the Papic studio had zero Life-Flash
references. This is the doorway, not the engine.

### Three gates, and they are not the same gate

1. **The flag.** The Life-Flash route calls `notFound()` when the flag is off, so
   an ungated card is a door onto a 404. Unlike the Alaala tile, this card says
   **nothing** when the flag is off — a tile can tell a story about a feature; a
   keepsake card on a gallery page cannot.
2. **The viewer.** The moment graph only contains events where the viewer is a
   **couple** member. This page deliberately admits more — a promoted coordinator
   sees a partial album — so without this check they would follow the link to a
   page showing them nothing.
3. **Three moments** (`SCOPE_MIN_MOMENTS.event`, read, never re-typed). ⚠ That
   constant gates the **scope chip**, not the URL: below it the link still works
   and renders a thin flash, and at **zero** the page says "Nothing gathered in
   this stretch yet" **with no chip for this event** — a dead end with no way
   back. Gating the card at the same number makes card and chip agree.

### The count had three wrong sources, all already on that page

A new `countEventMoments` lives beside the filters it must match, because:
- **the gallery's own count** uses a **deny-list** (`!== 'nsfw_blocked'`), wider
  than the graph's `=== 'clean'`, and counts **vendor** media the graph never
  reads — it can say 3 while the flash has nothing;
- **preservation totals** count the **retention** filter, reading 0 six months on
  for a flash that is full;
- **the moment graph itself** reads the viewer's **whole life** — up to 2,400 rows
  across every event — to answer a question about one.

⚠ **It fails closed on an unmeasured count.** A rejected Supabase query resolves
with `{ error }` and a **null** count; it never throws. `null` means "not
measured", never "zero".

🪤 **The first cut passed the FUNCTION instead of its result** — `viewerIsCouple={viewerSeesCoupleScopedPapic}` — which is truthy, and would have opened this door to **everyone the page admits**. `tsc` caught it because the resolved value lives in a different component further down. The card now asks for itself, as its sibling cards do.

🛡 8 assertions; **5 sabotages measured by occurrence count as landed** (1→0 ×5)
and each confirmed RED: flag gate, viewer gate, null-is-not-zero, the scope key
the parser actually understands, and the card being mounted at all.

Verified: `tsc` clean · 8713/8717 (4 pre-existing missing-module failures) ·
lost-controls ✅ 402 routes.
