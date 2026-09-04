## 2026-09-04 · feat(moodboard): two marks, one URL — and the plate is measured, not estimated (MB20)

Owner directive: every inspiration photo carries `WWW.SETNAYAN.COM`, and photos from a celebration Setnayan actually ran carry a discreet SEAL instead of the stamp.

**The geometry bug, fixed FIRST, because the rename would have shipped on top of it.** `watermarkLayers` sized the plate as `fontSize * (WATERMARK_TEXT.length * 0.72 + 1.4)` — an estimate tuned against the 8-letter word, where it left 33–46px of slack. At 16 characters it goes the other way. Measured by rendering it (2026-09-04):

| short edge | font | text | plate | ink | |
|---|---|---|---|---|---|
| 600 | 33 | `SETNAYAN` | 236 | 203 | −33px slack |
| 600 | 33 | `WWW.SETNAYAN.COM` | 426 | **441** | **+15px overflow** |
| 700 | 39 | `WWW.SETNAYAN.COM` | 504 | **524** | **+20px overflow** |
| 800 | 44 | `WWW.SETNAYAN.COM` | 568 | **581** | **+13px overflow** |

satori was handed a canvas the size of the estimated plate, so 7–10px was sheared off **each end** by the SVG viewport — and then everything succeeded. sharp composited, the corner stopped being flat, the bytes changed, the content type was right. 🔑 **An overflow is not a crash**, and every test that only asked "is there ink in the bottom-right third" stayed green while a public gallery carried `WW.SETNAYAN.CO`.

Fixed by MEASURING, not by re-tuning: the wordmark is rasterised, `sharp().trim()` reports the ink that actually exists, and the plate is sized to that. `rasterizeText` also detects its OWN clipping (a trim that fills its canvas is a shear, not a measurement) and retries on a bigger canvas before throwing. `assertInside` then refuses to composite a mark that does not fit — the failure is a throw, never a silent shear, because a throw already means "this photograph gets no gallery copy" and never "publish it unmarked".

**Two marks.** `watermarkImageBytes(bytes, variant)` takes `'stamp' | 'seal'`, defaulting to `'stamp'`.

- **stamp** — the filled pill, now carrying `WWW.SETNAYAN.COM` at ~62% of the old type size so the mark keeps roughly the physical footprint the 8-letter word had (900×600: was 236×69, now 281×40).
- **seal** — a thin OUTLINED badge: `SETNAYAN` over a hairline rule with `CELEBRATION` beneath, plus the URL small and low-contrast in the opposite bottom corner. No filled plate. 🔑 **Deliberately SMALLER than the stamp** (measured 8,418 vs 11,240 px² at 900×600) — a heavier mark on Setnayan's own celebrations would deface exactly the material it exists to distinguish.
- ⚠ **No plate means no contrast guarantee**, so every seal element is drawn twice: a near-black copy offset a pixel, then the light one on top. White ink alone vanishes on an overexposed sky, which is the failure the stamp's dark pill exists to prevent and the seal cannot borrow. Verified on grey 12 and grey 248.

**Threaded from the row, not the caller.** `markVariantForSource(source_event_id)` — `NULL` → stamp, otherwise seal — read in `storeScreenedAsset`, so both vendor upload routes (back-catalogue file, editorial import) get the right mark from the same column that already decides the back-catalogue quota. No second source of truth for "is this one of ours".

**Guards — four, each sabotage-proven, each on OUTPUT PIXELS.** New `lib/mark-fits-and-marks.test.ts` (12 tests):

1. *Both marks put real ink on the produced image.* Sabotage: dropped `.composite()` — it still returns a populated `geometry`, the right dimensions and a valid JPEG. **6 tests red**, including one that consults no geometry at all.
2. *The wordmark has clear plate on all four sides*, plus *nothing is drawn outside the plate*. Sabotage: reinstated the estimated plate and its plate-sized canvas, i.e. the exact code MB20 replaced. **11 of 12 tests stayed green** — only this one went red, on `padding 1px` where the sheared `W` runs into the plate edge. Measured with the fix: 11–15px horizontally, 13–18px vertically.
3. *The seal only on `source_event_id IS NOT NULL`.* Two halves, because either alone passes a sabotage: values (`markVariantForSource` both directions) and wiring (`every-upload-is-screened.test.ts` — the call site must be fed the column). Sabotage: hard-coded `'stamp'` at the call site → the wiring guard red, **all 35 pixel guards green**, every celebration silently losing its seal.
4. *The couple's own copy comes back byte-for-byte untouched* (`moodboard-gallery-copy.test.ts`). Nothing asserted this before: the existing tests prove the GALLERY copy is marked and say nothing about the buffer handed in — the same buffer the caller uploads to `renders/`. Sabotage: wrote the JPEG back over `input` → red on the byte comparison. Two neighbours also went red, but on `VipsJpeg: premature end of JPEG image` several steps downstream, which reads like a broken fixture rather than a defaced master.

The stamp/seal split is also asserted on pixels rather than on `plate: null` — a filled pill is 0.80 dark across its box, an outlined badge 0.07.

**MB9's baseline, regenerated.** `the wordmark is SETNAYAN, spelled out` went red on the rename — the test working, as the plan predicted. It now asserts the URL, and keeps the brand lock it was actually holding (spelled out, never STNYN), which survives intact because the URL contains the full word. Every other MB9/MB11 pixel threshold passed unchanged with real headroom (tightest: 15.17 against a threshold of 12).

⚠ **`result.geometry` is a MAP, NOT A RECEIPT**, and both the module and the tests say so: a sabotage that skipped the composite returns it fully populated. It only chooses where a `.raw()` read points; the verdict always comes from the pixels at those coordinates.

🔑 **FLAGGED, NOT CHANGED — an adjacent surface still carries the bare word.** `lib/watermark.ts` (the 2026-05-21 client-side Canvas marker for vendor MARKETPLACE uploads) has its own local `text: 'SETNAYAN'` default, unrelated to this module. The owner's directive names inspiration photos, and the marketplace listing gallery is a different pool, so it is left alone rather than swept in. Whether the URL should reach it too is an owner call.

Two owner questions from `MB-GALLERY-PLAN.md` remain open and are deliberately untouched: which mark MB9's kept RENDERS carry (they keep the stamp by default), and whether vendor showcase VIDEOS get marked at all (`watermarkFile` is still images-only).

SPEC IMPACT: None — the mark's wording and the stamp/seal split are implementation of the owner's 2026-09-04 directive already recorded in `build-sessions/MB-GALLERY-PLAN.md` § MB20. No locked decision moves; the brand lock (SETNAYAN spelled out, never STNYN) is unchanged and now asserted in two places.
