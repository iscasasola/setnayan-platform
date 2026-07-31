## 2026-07-31 · perf(assets): simple_event.webp was 1.45 MB on a first-paint grid

`apps/web/public/event-types/simple_event.webp` shipped at **1024×1280, 1,521,018 bytes, quality 100**. Every sibling tile is **880×1100 at 33–77 KB** — `wedding.webp` is 45,562 B. It was ~25× the weight of the tiles beside it.

That weight is pure waste, because of where it renders. `event-type-photo-picker.tsx` draws these tiles at roughly **50vw on mobile / 20vw on desktop** — a few hundred pixels wide. A 1024-wide source was already more than the surface could use, and `q=100` on a photograph buys nothing the eye can see. It is the create-event picker: a **first-paint** surface, on the path every new event takes, frequently over Philippine mobile data.

Re-encoded to the house geometry:

```
magick simple_event.webp -resize 880x1100^ -gravity center -extent 880x1100 tmp.png
cwebp -q 82 tmp.png -o simple_event.webp
```

**1,521,018 B → 48,796 B — 3.2% of the original, 1.4 MB saved on one tile.**

Both the source and the target are exactly 4:5, so the `^` + `-extent` pair performed **no crop** — the framing is untouched, this is a pure downscale. `aspect-[4/5]` on the tile means it was never cropped in the browser either.

### Verified, not assumed

| | |
|---|---|
| `magick identify` | `880x1100`, `48,796 B` — inside the 40–70 KB target band and inside the siblings' 33–77 KB range |
| PSNR vs the original downscaled to the same 880×1100 | **39.1 dB** (>35 dB is the usual visually-lossless threshold) |
| Side-by-side at render size | Indistinguishable — string lights, dusk gradient and shadow detail all hold |

A first PSNR reading of 12 dB was measured against a **mismatched size** (440×550 vs 880×1100) and was meaningless; the number above compares like with like.

**No other asset in the folder was touched**, and no code changed — `eventTypePhotoSrc()` already resolves `<key>.webp` by convention, so the filename and path are unchanged.

SPEC IMPACT: None.
