# Changelog fragment — claude/monogram-choreography

## 2026-07-17 · feat(monogram): the house choreography module — holds, 48-point spring, shared specular pass (benchmark P1 · PR-1)

`Monogram_Studio_Benchmark_Council_Verdict_2026-07-17.md` §4's "highest premium-per-line-of-code item": one shared choreography module applied to every reveal.

- **New `lib/monogram-studio/choreography.ts`:** `springLinear()` samples a real damped spring (stiffness 170 · damping 20 · mass 1) into a 48-point CSS `linear()` easing with a gentle overshoot-and-settle (feature-detected; overshooting `cubic-bezier(0.22,1,0.36,1)` fallback); `holdsFor()` maps tempo to the 250/300/400ms entry-hold band + ≥600ms settle; `runSpecularSweep()` runs the shared light pass **clipped to the letterforms** (runtime SVG mask of the mark's own paths, `mix-blend: screen`, warm `rgba(255,246,220)` band) — runtime-only DOM, self-cleaning, never touches the saved mark.
- **Wired into `studio-reveal-player.tsx` for all kinds:** every reveal now opens on an entry hold; Bloom and Petal Fall land on the spring; the specular pass crosses the finished mark — Handwriting after the last stroke, Bloom at full open, Petal Fall 300ms after the final piece, the 3D turn immediately after its landing (its full Medallion rebuild is PR-2).
- Unit-tested: spring emits 48 finite points ending at exactly 1 with a gentle >1 overshoot and a settled tail; hold bands assert 250/300/400.

SPEC IMPACT: verdict §8 P1-1 marked shipped (build-state updated when the slice lands).
