## 2026-08-13 · fix(alaala): the wall was serving 320px thumbnails into 380px tiles — owner: "the photos are pixelated"

Reported by the owner on the live site, which is the only reason it was caught: **it renders perfectly, it is just soft.** Nothing errors, nothing logs, every test was green.

### The arithmetic, not an impression

`papic-derivatives.ts` builds two derivatives, and its own comment says which is which:

```
display_r2_key — long-edge 1280, AVIF q60   (lightbox / full view)
thumb_r2_key   — long-edge  320, AVIF q50   ("Grid tiles use thumb_r2_key (320px)")
```

The wall hand-rolled a ref picker preferring `thumb_r2_key`. Measured against its real grid:

| surface | tile | needed @DPR | thumb gives | upscale |
|---|---|---|---|---|
| home `lg:grid-cols-6` | 192 CSS px | 383 px @2× | 240 px | **1.6×** |
| library `lg:grid-cols-6` | 155 CSS px | 310 px @2× | 240 px | **1.3×** |
| phone `grid-cols-3` | 105 CSS px | 314 px @3× | 240 px | **1.3×** |

🔑 **The killer is `object-cover` on an `aspect-square` tile.** A landscape thumb is 320×240, and covering a square scales it by its **240px HEIGHT**, not its 320px width — so the effective source is a quarter smaller than the number in the constant, on top of quality 50. Every breakpoint upscaled.

**The thumb was not wrong; the reuse was.** 320px is correct for what it was built for — the 4-across album peek strip, ~80 CSS px. The wall is a different presentation of the same rows and quietly inherited the wrong derivative.

### The fix

`resolveLargeStillRef()` joins `resolveStillRef` / `resolvePlayRef` in `lib/papic-display-ref.ts`, the canonical, dependency-free resolver module — so it inherits the two rules that live there and must never be re-derived: **a dropped original is never handed to a presigner** (`r2_object_key` survives as a dead Drive-matching pointer, and `null` beats a guaranteed 404), and **a clip never resolves to its raw MP4** in an image chain.

```
photo: display_r2_key ?? thumb_r2_key ?? r2_object_key (unless dropped)
clip : display_r2_key ?? poster_r2_key ?? thumb_r2_key  (never the raw MP4)
```

**Both halves of the wall had to move, and this is the part that is easy to half-do.** Owned frames resolve here. **Attended frames arrive already presigned from `getGuestLiveGallery`**, so their resolution is chosen inside that function — it now takes an optional `prefer: 'thumb' | 'display'`, **defaulting to `'thumb'`, unchanged**, because forcing 1280px tiles onto the wedding-day page would push ~10× the bytes over venue WiFi on the one surface where that matters most. Fixing only the owned half would have left the wall sharp in some tiles and soft in others — harder to notice than all of it being soft.

### Why not `next/image`

The optimizer would resize the 1280 copy to exactly the rendered size, which is the textbook answer. It is the wrong one here: **presigned URLs are never stable**, so `next/image` re-transforms on every render and Vercel bills per transformation. That is already recorded as a known cost/design call, not a bug fix, and this change must not quietly commit to it.

### Guards

- **The two resolvers must DISAGREE** on a row carrying both derivatives. If they ever agree, someone has "simplified" them into one and every wall tile is a 320px thumbnail again. That assertion is the whole defect in one line.
- Both owned reads resolve large (`=== 2`, so fixing one and forgetting the other fails), no hand-rolled `thumb_r2_key as string` picker returns, attended asks for `prefer: 'display'`, and the day-of page's preference stays **optional** so it keeps the small copy without naming it.
- Plus the resolver's inherited rules: dropped-original → `null`, clip → never the MP4, in both capture-table spellings.

**7 sabotages, each occurrence-counted before → after, all 7 caught** — including reverting each half of the wall separately, collapsing the two resolvers, and forcing the venue page onto the big copy.

Full suite: **7,811 unit tests green**, typecheck clean, all 21 `lint-*.mjs` guards + `lint:dup-rule` green.

SPEC IMPACT: None — no SKU, price, schema or migration. Same rows, same access; a different derivative of the same photo.
