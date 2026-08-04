## 2026-07-12 · feat(design): Atelier + macOS glass reskin — Phase 1 token foundation

Owner-locked 2026-07-12: the "Atelier + macOS glass" kit (spec corpus
`Design_Reskin_Atelier_Glass_2026-07-12/handoff/`) is the FINAL design language.
Phase 1 lands the foundation:

- **Typography flip (chrome only):** Hanken Grotesk (400–800) + Space Mono load
  via next/font; `--font-app` (dashboards via `.app-surface`, which also flips
  `--font-mono` → Space Mono) and the four v2.1 marketing vars now alias to them.
  Retired from loading: Source Sans 3, Saira Condensed, Geist, Instrument Serif,
  JetBrains Mono (−5 families off the first-paint path).
- **Guest surfaces untouched:** root `--font-display`/`--font-sans`/`--font-mono`
  deliberately keep Cormorant/Manrope/DM Mono — the /[slug] invitation pages are
  owner-EXCLUDED from the reskin and inherit root vars. Browser-verified: root
  vars still resolve Cormorant/Manrope while login/dashboard/marketing-hero
  render Hanken.
- **SN token layer:** full `--sn-*` token set (paper/ink/gold/semantic/radius/
  warm elevation/glass/motion) + component classes (.sn-btn/.sn-input/.sn-card/
  .sn-chip/.sn-badge/.sn-glass/.sn-ambient) + the motion library, appended to
  globals.css. Zero class collisions with existing .sn-login/.sn-seg/.sn-bounce.
  One adaptation vs the kit: `--sn-font`/`--sn-mono` resolve through the
  next/font variables (literal family names don't resolve under next/font);
  reduced-motion guard scoped to .sn-* (a global `*` rule would kill the boot
  splash failsafe).
- `.sn-ambient` is defined but NOT yet applied — backdrop lands per-surface with
  the accent swap (Phases 4–5) so production never shows a half-skin.

SPEC IMPACT: corpus `DECISION_LOG.md` 2026-07-12 design-finalization row (supersedes
0015 Cormorant/Manrope chrome roles, the 2026-06-10 Source Sans lock, and the
2026-07-09 wine-token direction — gold supersedes wine, applied in Phases 4–5).
