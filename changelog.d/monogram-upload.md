# Changelog fragment — claude/monogram-upload

## 2026-07-17 · feat(monogram): upload your own mark — SVG/PNG deciphered into animatable elements (owner override of benchmark §9)

Owner: "upload your own png/svg/eps file and we will decypher it and create elements of each item and help them animate it" — an explicit override of the benchmark council's upload deferral, annotated in the verdict.

- **New dependency-free tracer** (`lib/monogram-studio/trace.ts`): transparent PNGs trace via the alpha channel (opaque scans via luminance) — connected-component labeling → marching-squares contours → chained loops → RDP simplification → **one evenodd compound path per piece**, coloured by the piece's average pixel colour. Every piece of the artwork becomes its own element, so Bloom/Petal Fall/Handwriting/the Medallion animate an uploaded mark piece-by-piece, exactly like a studio mark. Holes (ring counters, letter bowls) survive via evenodd.
- **Decode helper** (`lib/monogram-studio/upload.ts`): SVG accepted through the same reject-don't-repair sanitizer the studio uses; PNG/WebP traced client-side (the file never leaves the page until save); **EPS/AI declined honestly** — browsers can't read PostScript — with convert-first guidance.
- **Dashboard maker** gains an "Already have a mark?" section: upload → "deciphered into N pieces" → preview any of the five reveals playing on the REAL uploaded mark (the live player) → save. The save action re-sanitizes server-side and writes the **long-dormant `events.monogram_uploaded_svg`** — the column that already outranks every other mark on the live hero — and merges the reveal pick into `monogram_studio_config.anim` (created minimal + seeded with the couple's names when absent). Remove restores the studio mark.
- **Public studio** gains the same door: upload → reveal preview through the portal → free traced-vector download.

Verified live on the v2 public studio with a synthesized 3-piece transparent PNG driven through the real file input: "Deciphered into 3 pieces", 3 paths in the preview, the ring's hole preserved (compound evenodd), and the Medallion Turn running on the uploaded mark at 750px perspective. A first run caught and fixed a lattice-stride collision that merged separate pieces into one. typecheck 0 · lint clean · 1,952 unit tests pass.

SPEC IMPACT: `Monogram_Studio_Benchmark_Council_Verdict_2026-07-17.md` §9 "uploads deferred" owner-overridden (annotated).
