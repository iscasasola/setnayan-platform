# Changelog fragment — claude/monogram-defect-triage

## 2026-07-17 · fix(monogram): Vector Studio defect triage — PR-1 of the Monogram Maker council verdict

The ten-item unconditional fix list from `Monogram_Maker_Council_Verdict_2026-07-17.md` § 1 (no flag, no redesign dependency):

- **D1 — a Names keystroke no longer wipes the design + undo history.** The `input` listener now compares the computed initials before rebuilding (typing elsewhere in the names is a no-op); a real initials change pushes ONE undo entry and preserves each surviving letter's placement/scale (+ z-order and weave decisions when the letter count is unchanged). The guard lives in the listener, not `derive()` — `applyConfig` depends on `derive`'s full reset.
- **D4 — reveals can't lock the editor.** Any tap during an animation skips to the finished mark; the per-item stagger now shrinks to keep the whole run inside the chosen duration (a 160-path mirrored frame no longer stretches a 6s reveal to ~50s).
- **D3 — the gold/molten preview overlay has exits.** New ✕ button on the portal overlay + the Arrange/Draw mode switch clears it via `onPreviewKind(null,null)`.
- **D5 — the canvas stops trapping scroll.** Wheel zooms only with Ctrl/Cmd (trackpad pinch); canvas CSS is `touch-action:pan-y` with a non-passive `touchstart` that claims the gesture only on letter/symbol/handle/pinch hits — a background thumb-swipe scrolls the page again. ⚠ Needs the real-device pass the verdict prescribes.
- **D6 — staggered pinch-lift no longer teleports the selected letter**: drag only re-engages when the surviving finger is the one that started on the letter.
- **D7 — draw mode stops minting no-op undo entries** (symbol tap-select / handle-grab now push only if something moved).
- **D8 — symbol rotation wraps to (−180,180] at serialize** so the sanitizer's clamp can never rotate a reloaded symbol.
- **D11 — Cmd/Ctrl+Z inside the Names input keeps native text undo** (canvas keyHandler bails on form fields).
- **A11y pass:** `aria-live="polite"` on the status line, `aria-label` on all nine sliders + Names.
- **Blank-canvas hardening:** surrogate-safe first-character split (`Array.from`) + null-glyph guards in `fast()`/`full()` — an exotic character degrades to a missing letter, never a thrown-out canvas.

Also corrects the lying copy (D2): the editor promised letter rotation and pinch-resize that don't exist; the hint + header now describe the real gestures (gold dot resizes; pinch/Ctrl+scroll zooms the canvas).

SPEC IMPACT: None beyond the council verdict itself (`Monogram_Maker_Council_Verdict_2026-07-17.md` § 1 marks these shipped; P2 remainder D9/D10/D13/D14 + real letter rotation stays queued).
