## 2026-11-04 · feat(photo-mark): Seal and plate supplier mark — shared geometry, fail-closed uploads, never cropped off (Photo Frame Template A1a)

The owner-approved supplier mark (`supplier_photo_mark_2026-11-04_fable.html`, direction A "Seal and plate") replaces the old stamp on every supplier marketplace photo and clip.

- **One geometry, two painters.** `lib/photo-mark-geometry.ts` is pure and imported by both the browser painter (`lib/photo-mark-canvas.ts`, canvas + bundled Jost/Cormorant via FontFace) and the server painter (`lib/photo-mark-server.ts`, sharp + SVG of opentype glyph PATHS — never librsvg `<text>`). The tiers are full ≥180 px, compact 120–180 px and text <120 px, all inside the centred safe square.
- **The server decides the mark.** `getPhotoMark(kind, pathPrefix)` derives `{verified, shopName, slug, logo}` from the active shop (`shopMarkFacts`). FileUpload takes no spec props.
- **Fail-closed.** `FileUpload mark="supplier" | "setnayan"`: a painter, font, clip-encode or clean-copy failure refuses the upload with a Try-again tile. The unmarked original is never uploaded. The legacy `watermark` path now refuses too.
- **Clip.** The showcase video gets the mark burned into the ffmpeg.wasm web720 encode (canvas PNG overlay via `scale2ref` + `overlay`).
- **Inspiration** (server path) draws the supplier Seal and plate. **Admin category samples** carry the Setnayan-only mark.
- **Private clean copy.** Each supplier photo also uploads a compressed clean copy to `r2://setnayan-vendor-verification/vendor-originals/<shop>/…`, paired in the new `supplier_photo_originals` table. A dry-run-only re-mark script counts what would change when a shop gains or loses Verified; it was never run against prod.
- **Never cropped off.** The Find card banner (358×128) and both shop heroes now render a square-framed photo whole over a blurred fill (`MarkedPhoto`), because they sit outside the square band 5:7–1.91. The tour-shortlist and budget heroes are inside the band; their price badge moved to the top-left so it no longer covers the mark.

Guards: `the-seal-and-plate-is-in-the-bytes.test.ts` decodes the stored JPEG and finds the navy seal, the gold, the ivory name ink and the plate. `the-supplier-mark-is-wired.test.ts` covers the call sites, fail-closed, the server spec, re-mark idempotence, MarkedPhoto and the badge position. Each sabotage was run and went red, then was restored:
1. dropping the portfolio `mark`;
2. falling back to `file = rawFile` on a mark failure;
3. setting the vendor-card `displayAspect={1}`;
4. removing the geometry fit check;
5. putting the badge back at the bottom-right.

Deviations from the prototype:
- When a long shop name or slug overflows the 0.6S plate, the address keeps shrinking (down to 6 px) instead of overflowing. In the text tier it falls back to `setnayan.com`.
- The showcase clip cap stays at the existing 30 s; the prototype says 15 s.
- No clean copy is kept for clips or for inspiration, whose storage is Supabase rather than R2.
- The booth poster and category art are not marked.

Fix-up after the merge with main (2026-11-04):
- The stale copy of #7241's card-maker work is dropped; main's merged version is kept.
- `supplier_photo_originals_owner_all` asks `(SELECT is_admin())` once per statement, not once per row.
- The upload actions are ONE server action, `photoMark('mark' | 'pair', …)`, instead of two exports. This keeps the route budget at +1.
- The shop's renewal date is read on the service role in the mood-board upload and in the re-mark dry run.
- A stall of the private clean-copy upload is recorded like any other stall.
- `vendor-originals` is declared in the upload-prefix guard. The photo-mark modules are listed as upload pipeline in the Maker preload guard.
- `Font.ascender` is added to the opentype.js ambient types.

Re-port onto the supplier release (2026-11-08, lane R2, `claude/supplier-reports-r2`; owner 8 Nov "We keep the photo mark? yes"):
- **Migration re-allocated** with `pnpm migration:new`: `20271306190866_supplier_photo_originals` → `20271329241008_supplier_photo_originals`. Same SQL, RLS at CREATE TABLE. The exposure baseline gains exactly this table's 10 facts (1 tpriv, 8 col, 1 policy) and nothing else.
- **Ugat:** the table is claimed on J34 (vendor → services): the table, its FK to `vendor_profiles`, UNIQUE `public_ref`, `frame`, and both CHECKs.
- **The Maker's first load no longer carries the mark.** The whole pipeline (ask the server, paint the photo, burn the clip, keep the private clean copy, pair it) moved out of `FileUpload.uploadOne` into ONE lazy door, `app/_components/upload-mark.ts`, which FileUpload reaches only through `import()` after a pick. The door never catches; every failure throws and FileUpload refuses (`refuseUnmarked`). The fail-closed guards moved with it, plus two new ones (the door never swallows; FileUpload never imports the mark statically). Sabotaged three ways (a caught paint failure, a static import, keep() before pairing): each went red, then was restored.
- **Today's upload paths:** the new Card Maker's cover (`canvas-maker.tsx`, rebuilt by Build 1) now passes `mark="supplier"`. The portfolio uploader is still `gallery-media.tsx` (the Portfolio page links to its fold). The new Form Maker's files (`vendors/<shop>/forms`, built after the matrix was approved) are EXEMPT and flagged for the owner: they go privately to the couples a form is sent to, with PDFs, not to the marketplace.
- **Server-action ceiling** 1238 → 1239 (owner 8 Nov "Ok to raise it"): `photoMark` is the one export.

SPEC IMPACT: None. This implements the approved 2026-11-04 Seal and plate design. New table `supplier_photo_originals` (RLS owner/admin, no anon). New private R2 root `vendor-originals`.
