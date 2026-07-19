# Changelog fragment — claude/monogram-reveal-presets

## 2026-07-17 · feat(monogram): reveal tempo presets + Reveal-as-Finish (council verdict PR-6)

§5.4–5.7 of `Monogram_Maker_Council_Verdict_2026-07-17.md` — the last of the four replot slices behind `monogram_studio_v2`:

- **Three tempo chips replace the slider wall as the primary control:** Quick (3s) · Classic (6s · default) · Ceremonial (10s), each writing `dur/smooth/delay` internally — the wire format is untouched, so the live player needs no change. A **Fine-tune** disclosure keeps the raw sliders; touching one flips the tempo to `custom` (no chip lit). `anim.preset?: 'quick'|'classic'|'ceremonial'|'custom'` marker added to StudioConfig (sanitized `oneOf`), inferred from the numbers for pre-existing configs.
- **`droplet` displays as "Bloom"** — wire key unchanged (§5.6).
- **Molten honesty:** picking Molten Gold surfaces "needs a newer phone — older ones see Gold Turn instead", disclosing the player's silent degrade (§5.6).
- **The Reveal tab is the Finish step (§5.7):** entering it auto-plays the current reveal once (safe because PR-1's tap-to-skip shipped first), with a thumb-reachable ↻ Replay pill on the canvas, visible only on that tab.
- **Stale copy fixed:** the status line's "open Preview to animate" (a control that no longer exists) now says "pick a reveal to animate" — v1 and v2 both.

Verified live on the v2 public studio: Bloom label; sliders collapsed behind Fine-tune; Replay pill only on the Reveal tab; tab entry auto-plays (and tap-to-skip ends it); Classic lit by default; Ceremonial writes 10.0s/0.6s and plays; a slider touch un-lights all chips (custom); the molten note appears only for Molten Gold. typecheck 0 · lint clean · 1,922 unit tests pass.

SPEC IMPACT: None beyond the council verdict (§5.4–5.7 marked shipped). With this, all four `monogram_studio_v2` slices (PR-3…PR-6) are in — launch = the owner flipping `NEXT_PUBLIC_MONOGRAM_STUDIO_V2`.
