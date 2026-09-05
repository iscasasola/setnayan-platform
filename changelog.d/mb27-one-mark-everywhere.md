## 2026-09-05 · fix(watermark): one mark everywhere, and it is the web address

The two watermark paths had drifted apart with nothing comparing them. Measured
on `origin/main` this morning: `lib/watermark-server.ts` marked with
`WWW.SETNAYAN.COM` (MB20), while `lib/watermark.ts` — the browser marker behind
every **marketplace** upload, the most-scraped pool on the platform — still
defaulted to the bare word `SETNAYAN` from 2026-05-21. Both suites were green,
because each asserted its own side's string. Per owner ruling 2026-09-05, every
marked photograph now carries the web address: a word is not something a
stranger can type into a browser.

The string moved to a new, import-free `lib/watermark-text.ts` that BOTH markers
import. `watermark-server.ts` could not simply be imported by the browser side —
it pulls `sharp`, a native addon — which is why the constant needed a home of its
own rather than a re-export. A guard reads both modules' source (through the
repo's shared `stripComments` lexer, not a regex) and fails if either
re-introduces a literal of its own.

**The browser stamp is now a measured plate, not unchecked lettering.** It used
to draw stroked text anchored `margin` in from the corner with nothing verifying
it fit; `file-upload.tsx` enforces no minimum image dimension (it validates MIME
and byte size only), so a small showcase photo would have had the front of a
16-character URL clipped off the canvas edge — silently, since canvas clips and
reports success. That is MB20's server-side defect, one platform over. Geometry
now comes from `ctx.measureText`'s actual bounding box and lives in a pure,
exported `stampGeometry`, using MB20's padding ratios unchanged. Where the server
THROWS on a mark that will not fit, this path shrinks to fit instead — a throw
here is caught by `uploadOne` and uploads the ORIGINAL, so on the client an
exception means an unmarked photograph on R2.

Videos: **Phase 2 by owner ruling, recorded not built.** Both markers now refuse
video loudly rather than passing a clip through unmarked — by container sniff on
the server (brand-aware, so AVIF and HEIC are still marked) and by MIME/extension
in the browser.

The admin library path was checked for double-marking and does **not** mark on
the server (`app/admin/moodboard-library/actions.ts` passes
`await file.arrayBuffer()` straight to `.upload(objectKey, arrayBuffer, …)`), so
the client mark stays and is now guarded from BOTH directions — a later server
mark, or a deleted client mark, each go red.

Guards: `apps/web/lib/one-mark-everywhere.test.ts` (13),
`apps/web/lib/the-client-stamp-is-pixels.test.ts` (8, against a compositing
canvas double — real glyph rasters, real alpha, stated limits), plus one variant
assertion added to `moodboard-gallery-copy.test.ts`. Nine sabotages reproduced
red, including restoring the pre-MB27 no-shrink geometry and marking renders with
`'seal'`.

SPEC IMPACT: `DECISION_LOG.md` — two owner rulings of 2026-09-05 recorded: (1)
one mark everywhere, the web address, retiring the bare-word mark on the
marketplace pool; (2) video watermarking deferred to Phase 2. No iteration `.md`
changes: neither ruling alters a shipped iteration's scope.
