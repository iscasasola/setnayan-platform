## 2026-11-04 · feat(photo-frame): Frame step — suppliers frame each photo and clip before it is marked; every place shows it from the stored framing (Photo Frame Template A1b)

The owner-approved Photo Frame Template (`photo_frame_template_2026-11-04_fable.html`), ported. Stacked on A1a (Seal and plate).

- **One step, opened by FileUpload.** The props are `frame="square" | "circle"`, `previews` and `mark`, and they open a shared `<FrameStep>`. It is loaded with `dynamic` and portalled, so page weight is unchanged until the first framed pick (12.3 KB gzip).
  - Gestures: drag, pinch about its centre, ctrl+wheel and Safari gesture events, two-finger pan, mouse drag and the zoom slider. A double-tap resets.
  - Snapping: the centre snaps with a gold line and the zoom snaps to 1×, with `vibrate(8)`.
  - Other behaviour: a device-adaptive ⓘ, `touch-action:none` on the stage, and the live mark on the stage.
  - Per-use previews: Find card, service card, sheet and full photo; the portfolio grid; inspiration tiles; and shop-logo circles at 20, 32, 48 and 96 px.
  - "Looks good" accepts. Tapping a tile re-opens it in place.
- **Framing is stored in the object name.** The key is `<uuid>-fr-<fx>-<fy>-<zoom>-<w>x<h>.<ext>`, built by `framedFileName` and read back by `framingFromRef`.
  - Displays need zero extra reads.
  - Re-framing makes a new key, so a CDN copy is never stale.
  - The original is kept: the private clean copy from A1a. Re-open reads it via `getPhotoOriginalUrl`, which is signed for 600 s, and never re-frames the marked copy.
- **The mark is laid in the frame.** `layoutMarkInFrame` places it in the frame's square, bottom-right, or bottom-centre for a circle. The clip is cropped in ffmpeg (`crop` before `scale`, `evenCrop`) to 720×720 with the mark burned in. Re-framing a clip re-encodes it.
- **Display sites derive from the framing.** This is `lib/photo-frame.ts` `deriveRect`.
  - A wider place widens from the frame.
  - A taller place grows downward, and when the photo runs out it cuts from the top, keeping the frame's bottom edge.
  - A narrower place keeps the frame's right edge, the mark side.
  - The sites: `FramedImg` (service card cover, sheet photos, VendorAvatar's 9 logo surfaces, the FileUpload tiles) and `MarkedPhoto` (Find banner, shop heroes).
- **Uses wired.**
  - Service card cover and showcase photos (Maker, services manager, wizard).
  - The showcase clip.
  - Portfolio.
  - Shop logo, as a circle with no mark, in the profile row and the open-shop wizard. The server's logo coin is now cropped to the stored circle framing.
  - Inspiration (client path).
- **A1a fix: a shop name shrinks before it is cut.** `photo-mark-geometry.ts` `NAME_FLOOR = 0.7`: the plate may grow, then the name steps down to 0.7× before any ellipsis. "Bloom & Vine Studio" shows whole at 1200×1600, 1600×1200, 1080², 2048×1536 and 720×960, with the same result in the browser and on the server.
- The clean copy's stall now records `UPLOAD_STALLED` (it was a silent `() => {}`).

**Guards.**
- `the-photo-frame-is-one-framing.test.ts` (12) covers:
  - the geometry, the frame staying inside the photo, and the mark square in view at every place aspect;
  - the name round-trip, `rectImageStyle`, snapping, the pinch-centre invariant and `evenCrop`;
  - the call sites, the FileUpload order and re-open source, FrameStep's gestures and `touch-action`, and the display sites.
- `the-seal-and-plate-is-in-the-bytes.test.ts` adds a "Bloom & Vine Studio" whole-name test.
- `photos-two-ways` and `a-photo-on-its-way-is-a-pie` now allow the pressable re-frame tile (`data-reframe`), per "Rows: tap opens".

**Sabotage runs.** Each went red and was then restored:
1. `NAME_FLOOR = 1`;
2. cutting from the bottom in `deriveRect`;
3. dropping the portfolio `previews`;
4. re-framing from the marked `displayUrl`;
5. dropping `touch-action:none`.

**Proof** (WebKit 390×844, touch, DPR 2):

| Proof | Open | Mark | Looks good → result |
|---|---|---|---|
| Tall cover 1200×1800 | 350 ms | 47 ms | 151 ms |
| Wide cover 1920×1080 | 386 ms | 58 ms | 157 ms |
| Logo | 348 ms | — | 56 ms |
| 6 s clip | 680 ms | — | encode 9.8 s → H.264 720×720, 580 KB |

**Deviations from the prototype.**
- The framing lives in the object name (adds w×h), not in a column. `supplier_photo_originals.frame` stays unwritten.
- Narrow places anchor to the right edge.
- The circle mask uses `closest-side`, because the prototype's 50 % mask sat inside its ring.
- Not built:
  - a poster picker;
  - a coin preview in the logo step.
- The Find card previews use skeleton text.
- Not framed:
  - inspiration (server path);
  - the admin sample library.
- There is no shop-cover upload: the hero is a portfolio pick.
- The clip cap stays at 30 s.
- A clip can be re-framed only within the same session, because clip originals are not kept.
- Portfolio display sites other than the sheet still use `object-cover`.

Fix-up after the merge with the updated A1a (2026-11-04):
- The Frame step uses the app's colour and corner tokens, not raw hex and px radii, so light and dark follow the app. Its ⓘ is the house `<Explain>`, which replaces the hand-drawn "i" and its own dark sheet. The dialog runs on `useModalA11y` (focus trap, Esc, focus restored). The drawn "i" beside "How to adjust" is gone; the words stay.
- "Gallery picker" now reads "Inspiration picker" (owner 2026-10-23: no "gallery" in the UI).
- Re-open signs the clean copy through `displayUrlForPrivateStoredAsset`, held to the shop's own `vendor-originals/<shop>/` root, not the raw signer. It is the `'original'` op of A1a's one `photoMark` action, not a new export.
- The Frame step and `lib/photo-frame.ts` are listed as upload pipeline in the Maker preload guard.
- Bundle: `FrameShape`, `FRAME_ASPECT` and `Box` moved to a leaf module, `lib/photo-frame-shape.ts`, which `photo-mark-geometry` re-exports. A supplier avatar (`FramedImg` → `photo-frame`) used to pull the mark's whole geometry into every event page's shared chunk: +4.2 KB gzipped in the Maker's first load. The Frame step now imports the painter statically, inside its own lazy chunk, instead of as one more lazy chunk.
- The display half of the framing (`framingFromRef` → `framedImageStyle`) is its own module, `lib/photo-frame-display.ts`, re-exported by `lib/photo-frame.ts`. `FramedImg` and `MarkedPhoto` import only that half, so the gestures and snapping stay out of every event page. FileUpload reaches the Frame step, its framing math and `photoMark` through ONE lazy module, `app/_components/upload-mark.ts`, and the Frame step paints with `lib/watermark.ts`'s painter. The supplier upload therefore adds one lazy chunk, not three; each one is an entry in the webpack runtime every page loads.

SPEC IMPACT: None. No schema change; the framing is encoded in the R2 object name.
