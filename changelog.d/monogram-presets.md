# Changelog fragment — claude/monogram-presets

## 2026-07-17 · feat(monogram): starting points — six preset compositions from the couple's real initials (council verdict PR-5)

The studio stops opening on a dead typeset (`Monogram_Maker_Council_Verdict_2026-07-17.md` §3): a **Start from** strip under the canvas offers preset compositions **rendered with the couple's actual initials**, three of them pre-woven so the interlock engine is visible before anyone has to understand it.

- **Six generators** (couples see five; single-name events see two): *Duo* (today's layout repaired — tuned ampersand + tighter spacing), *Interlocked* (the two initials overlapped with the weave already applied — a deterministic bisect nudges the offset until the overlap area lands in an 8–14% band of the union area, font-proof), *Stacked* (a merged column), *Framed duo* (compiles to a `frames[]` ring recipe — never baked strokes), *Solo ring* (single-name), *Blank* (start from scratch, last).
- **Thumbnails via the single mounted engine** (§8.15 — no headless mounts): transient apply → `buildExportSVG()` → restore, all synchronous so intermediate states never paint; generated lazily on idle and regenerated when the initials or the face change.
- **`preset?: StudioPresetKey` provenance field** on StudioConfig (sanitizer `oneOf(PRESET_KEYS)`) — analytics only, rendering never reads it; absorbed the separate `layout?` proposal (one field, not two).
- Applying a preset is one undoable step; every preset stays fully editable afterward (start from archetype → everything manual still works).
- **PR-4 gap fixed in passing:** the Reset button now clears applied frames (and preset provenance) along with strokes/symbols.

Verified live on the v2 public studio: the couple strip shows the right five cards; all five thumbnails generate in the real initials with zero visible canvas flicker; Interlocked applies pre-woven; Framed duo applies + marks the ring in the Frame shelf; undo returns exactly one step.

SPEC IMPACT: None beyond the council verdict (§3.1–3.3 marked shipped; §3.4–3.7 deferrals unchanged; flag `monogram_studio_v2` still gates).
