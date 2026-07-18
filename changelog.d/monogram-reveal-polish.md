# Changelog fragment — claude/monogram-reveal-polish

## 2026-07-17 · fix(monogram): 3D Turn feels 3D + Play moves to the bottom of the reveal box (owner refinement)

- **3D Turn, physical (owner: "3D doesn't feel 3D enough"):** the LIVE player now spins on a **tilted axis** (`rotate3d(0.24, 1, 0)` — pure rotateY reads flat), with tighter perspective (650px, origin raised), a depth zoom (`translateZ` −120px → 0), a **drop-shadow that starts loose and lands tight**, a brightness kiss at the mid-turn, and a spring-ish −8° overshoot before settling. The 2D studio canvas can't do true perspective, so its fake now sells the illusion with the classic trio — cosine scaleX + a decaying shear lean + depth zoom — topped with a **specular light sweep** crossing the mark as it lands.
- **Play button** moves out of the reveal-chip row to a full-width "▶ Play the reveal" at the **bottom of the reveal settings box** (below tempo + fine-tune) — easier to find and to manage after adjusting settings.

Verified live: reveal box order = kinds → molten note → tempo → fine-tune → Play → caption; 3D Turn plays with the new physics; tap-to-skip cleans up (sweep removed). typecheck 0 · lint clean · unit tests pass.

SPEC IMPACT: None (a benchmark council on "best monogram maker on the internet" is running; its verdict lands as a corpus doc separately).
