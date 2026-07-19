# Changelog fragment — claude/monogram-studio-v2-markup

## 2026-07-17 · feat(monogram): Studio markup v2 — Letters · Frame · Reveal tabs + atelier reskin, behind `monogram_studio_v2` (council verdict PR-3)

The §2 restructure of the Vector Monogram Studio, flag-gated and byte-identical when OFF (default):

- **New `lib/monogram-studio/markup-v2.ts` + `flag.ts`.** `NEXT_PUBLIC_MONOGRAM_STUDIO_V2` picks which editor DOM both hosts (dashboard studio + public /monogram) inject; the shipped v1 `markup.ts` is untouched.
- **Tabs replace modes:** the `Arrange | Draw frame` toggle and the six-instruction edithint wall are gone in v2 — a sticky **Letters · Frame · Reveal** segmented control tops the panel. Letters holds the setup (Names → Font → Colours) + the selection-driven letter/crossing boxes; tap-selecting a letter from any tab jumps to Letters with the selection kept. Frame opens on the pattern-shelf slot (`#frameshelf` — PR-4 fills it) with **"✎ Draw your own"** revealing the full v1 pen + symbol boxes unchanged (the pen survives, demoted — §4). Reveal holds the always-open animate panel (the collapsible accordion is gone). One static canvas hint replaces the instruction wall.
- **Engine feature-detects the DOM** (`#vtabs` present → v2 wiring; absent → v1 wiring untouched). `drawMode` is true only while Draw-your-own is open inside the Frame tab; tab switches clear the gold/molten overlay (D3 path reused).
- **Sticky Save on phones** (dashboard host): the save form rides a bottom-sticky bar under 640px; desktop static. Fit/Reset demote into a `⋯` overflow; Undo/Redo stay top-level.
- **Atelier reskin (§2.4):** v2 CSS speaks Hanken Grotesk (`--font-hanken`) for UI and Space Mono (`--font-space-mono`) for data, gold supersedes mulberry as the accent — both faces already load app-wide from `app/layout.tsx`. Font-preview chips keep their own display faces. `#presetstrip` (PR-5) also stubbed.

Verified live with the flag ON (public studio): tabs round-trip, pen hidden until Draw-your-own, reveal chips auto-play + tap-to-skip survive, mark renders; with the flag OFF: exact v1 DOM (Arrange/Draw toggle · edithint · collapsible animate · Manrope) boots cleanly. typecheck 0 · lint clean.

SPEC IMPACT: None beyond the council verdict (`Monogram_Maker_Council_Verdict_2026-07-17.md` §2 marks PR-3 shipped; launch = the owner flipping `NEXT_PUBLIC_MONOGRAM_STUDIO_V2`).
