# Changelog fragment — claude/monogram-styles

## 2026-07-17 · feat(monogram): 12 named Styles + 8 palette moods + can't-leave-ugly invariants (benchmark P1 · PR-4)

- **Twelve art-directed Styles, Filipino names** (verdict §1 — the named-style pattern with everything pre-solved: face, optical spacing, weave gaps, frame stack, palette): *Alon · Sampaguita · Habi (the weave showcase — pre-woven ring+diamond) · Balangay · Araw · Kapilya · Perlas · Hardin · Lazo · Tala · Payneta · Kandila*, plus Blank last. One tap applies the whole art direction — face swap included (async font load, chips follow). **No kerning sliders, ever** (§9).
- **Thumbnails in each style's own face:** cards group by typeface; each chunk loads its face once, then the synchronous transient apply→export→restore renders the couple's actual initials — chunks chain on idle, home-face cards fill first.
- **8 pre-balanced palette moods** in the Colours box (Ink & Gold, Wine & Cream, Mulberry & Gold, Forest & Brass, Navy & Champagne, Rose & Ink, Obsidian & Silver, All Gold): one tap sets ink + outline together (frames follow the metal); manual swatches stay as the fine layer and un-light the mood.
- **Can't-leave-ugly invariants (§2), deterministic:** weave cut-gap scales with the letters' visual weight at style build; overlap targeted by the interlock bisect (8–14% band, shipped P1-5); frame auto-fit on ink bounds + accent caps (shipped PR-4/#3357). No curation labor, no LLM.
- Legacy preset provenance keys stay valid; `PRESET_KEYS` extended in the sanitizer.

Verified live: 13 cards, 13/13 thumbnails across font chunks; Habi lands pre-woven (ring+diamond, weave ON); Alon swaps to the script face + obsidian ink with chips following; Navy & Champagne mood re-balances both colours and lights up. typecheck 0 · lint clean.

SPEC IMPACT: verdict §8 P1-4 marked shipped when the slice lands.
