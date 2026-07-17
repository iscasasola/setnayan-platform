# Changelog fragment — claude/monogram-premium-pass

## 2026-07-17 · feat(monogram): premium pass — letter flip/tilt/rotate, frame colours, Petal Fall + 3D Turn reveals (owner refinement)

Owner direction while reviewing the v2 studio ("more dynamic and 3d rotating reveals … wreath falling in like petals into place … frame colors changeable … letters: flip, tilt in perspective, rotate … make it feel a premium service"):

- **Letter transforms:** `st[i]` gains `rot` / `skew` / `flipX` (sanitizer-clamped; wrap-at-serialize like D8). The gold handle now **rotates while it resizes** (the symbol-handle math, finally making the old copy's promise true — the verdict's P2 "real letter rotation" pulled forward); the v2 letter box adds a Rotate slider, a **Tilt · perspective lean** slider (affine shear — the honest tilt paper.js can do), and a **⇋ Flip** toggle. Double-click reset clears them. All applied before the boolean pipeline, so weave/merge keep working on transformed letters.
- **Frame colours:** the applied-frame box gains a swatch row (gold · champagne · deep gold · silver · mulberry · ink · dusty rose) + a custom colour input per frame — a two-tone woven ring/diamond is now two taps.
- **Two new reveals (7 total):** **Petal Fall** — every piece drifts down with a little spin and settles, staggered (canvas + per-path WAAPI parity in `studio-reveal-player`); **3D Turn** — the live player runs a real CSS `rotateY(450°)` perspective spin; the 2D studio canvas fakes it with a cosine scaleX. Both respect the tempo chips, the stagger budget, tap-to-skip, and reduced-motion.
- Upsell label map + copy updated for the seven-reveal taxonomy (also aligns "Droplet"→"Bloom" from PR-6).

Verified live on the flag-on demo: real-click letter select auto-jumps Reveal→Letters with selection held; rotate/tilt/flip each repaint the canvas; a mulberry frame swatch repainted the ring band to exactly #5C2542 at the sampled pixel; Petal Fall and 3D Turn play and tap-to-skip. typecheck 0 · lint clean · unit tests pass.

SPEC IMPACT: `Monogram_Maker_Council_Verdict_2026-07-17.md` — P2 "real letter rotation" shipped early; §8.3 flipX kill owner-overridden; reveal taxonomy now 7 kinds.
