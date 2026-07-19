# Changelog fragment — claude/monogram-medallion

## 2026-07-17 · feat(monogram): the Medallion Turn + one-implementation preview + menu merge (benchmark P1 · PR-2)

The verdict §3 prescription, verbatim, CSS/WAAPI only:

- **MedallionTurn** in `studio-reveal-player.tsx`: parent `perspective: 750px` (600 mobile) with `perspective-origin: 50% 35%`; a compound `rotateX(8°)+rotateY(−78°→0)` turn on the 48-point spring; the angle-driven brightness track (0.78 → 0.72 → 1.06 catch → 1.0); the **4-copy deep-bronze `translateZ` thickness stack** (a medallion, not a sticker); **intra-mark parallax** when the export carries layer groups (frames −8px · letters 0 · pen +6px); the breathing contact shadow (loose→tight on the spring); the letterform-clipped specular traverse at 55–74% of the turn; one 4px sparkle ping 200ms after rest; Ceremonial adds the dim echo sweep; reduced-motion renders the still face.
- **Layer-grouped export:** `buildExportSVG` now emits three `<g data-mlayer>` groups (frames · letters · pen) — pure structure, passes the sanitizer unchanged; pre-group saved marks simply render without parallax.
- **One implementation, zero studio-vs-live drift (§3 "the preview becomes a promise"):** the studio previews EVERY reveal by portaling the identical live-site player over the canvas — both hosts (dashboard + public, which previously had no overlay at all). Draw-on kinds stage on paper, metals on the dark ground; previews auto-dismiss after the act + settle; ✕ stays. The paper.js canvas acts survive as the reduced-motion fallback.
- **Menu merge (§4):** Gold Turn + 3D Turn → **Medallion Turn**; **Trace** → a Quick-tempo Handwriting alias. Five doors today (Selyo + Tinta arrive in P2). Wire keys unchanged — saved `gold`/`trace`/`flip3d` configs upgrade automatically and light the right chips.

Verified live on the v2 public studio: 5 merged chips; Reveal-tab entry auto-plays through the portal (real player SVG on the paper stage); the Medallion runs at exactly 750px / 50% 35% with `preserve-3d` and 5 stacked layers (4 bronze rim + face). typecheck 0 · lint clean · 1,952 unit tests pass.

SPEC IMPACT: verdict §3/§4 P1-2 marked shipped when the slice lands.
