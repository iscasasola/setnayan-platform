# Changelog fragment — claude/monogram-frames

## 2026-07-17 · feat(monogram): parametric frame patterns — the v2 Frame shelf (council verdict PR-4)

The owner's core ask (`Monogram_Maker_Council_Verdict_2026-07-17.md` §4): frames become a **pattern library**, not a drawing exercise — and the freehand pen survives, demoted to the personalization layer on top.

- **12 parametric patterns** (`frameBuilder` family in the engine): ring · double-ring · open-ring · diamond · cartouche · arch · scallop · laurel · wreath · **sampaguita** · corner-lines · corner-flourish (sampaguita + laurel are the Filipino-identity keeps). Every frame is generated from a compact recipe as **filled geometry** — the export walk's fill-only rule holds; no stroke data is ever stored.
- **Data model:** `StudioConfig.frames?: StudioFrame[]` (≤2) — `{kind, c, inset, scale, tx, ty, thick, count, gap, dbl}` recipes, clamped in `sanitizeStudioConfig`. Re-editable round-trip; `sanitizeStudioSvg` untouched; old configs unaffected (field optional).
- **Auto-fit + stack rule:** frames size themselves to the letter bounds + inset (one tap = a composed mark); ≤2 frames — one enclosure + one corner set, a new pattern replaces its class slot, tapping the applied pattern removes it. Frames render on a new `frameLayer` **below** the letters (letters win over rules — the point of open-ring); strokes/symbols stay above, exactly as shipped. Canonical export order: frames → letters → strokes → syms.
- **Shelf UI** in the v2 Frame tab (`#frameshelf`): 12 cards with procedurally generated thumbnails (canned two-bar silhouette, built lazily on idle from the same builders), applied-frame chips with ×, and Size/Thickness/Repeats/Opening sliders for the selected frame. Frame colour defaults to the mark's outline colour. Undo/redo cover every frame operation (snapshots carry `frames`).
- **Combination with the pen is free by construction** (§4): mirrored strokes and stamps land on top of pattern frames; "✎ Draw your own" is unchanged.
- **Normalized stagger (§5.5, the hard coupling):** `studio-reveal-player.tsx` caps the start-time span at one act duration — a wreath's dozens of paths land on the same clock as three letters. (The engine's canvas preview got the same cap in PR-1.) Reveals include frames, drawing the frame first.
- Boolean-heavy patterns (scallop/arch) rebuild only when a recipe or the (bucketed) letter bounds change — never per drag tick.

Verified live on the v2 public studio: all 12 thumbnails generate; ring applies (+painted pixels at the exact auto-fit radius), wreath replaces it, sampaguita swaps in, corner-flourish stacks to two, the Size slider reshapes, and four undos return the canvas to baseline with all cards cleared. typecheck 0 · lint clean · 1,922 unit tests pass.

SPEC IMPACT: None beyond the council verdict (§4 + §6 launch model marked shipped; flag `monogram_studio_v2` still gates the surface).
