# Changelog fragment — claude/monogram-upsell-honesty

## 2026-07-17 · fix(monogram): honest Animated-Monogram upsell — PR-2 of the Monogram Maker council verdict

D12 (`Monogram_Maker_Council_Verdict_2026-07-17.md` §5.1–5.3): the ₱999 upsell advertised six motion signatures (Drawn, Foil, Bloom, Editorial, Halo, Stardust) and previewed `AnimatedMonogramHero` on a lettered lockup — while the live hero, for any event with a studio/uploaded mark, plays only the STUDIO reveal via `StudioRevealPlayer`. A studio-mark couple was sold animations their site never plays, demoed on a mark that isn't theirs.

- **One taxonomy per page:** when a custom mark exists (`monogram_uploaded_svg` ?? `monogram_custom_svg` — the hero's exact precedence), the header, before/after, owned preview, and what-you-get copy all speak the five studio reveals (Handwriting / Trace / Droplet / Gold Turn / Molten Gold). The six-signature pitch + lockup preview survive only for the fallback-lockup path, where they're true.
- **Real mark, real reveal:** both preview surfaces render `<StudioRevealPlayer svg={customSvg} anim={studioAnim}>` — the identical component the live hero uses — with the couple's saved `monogram_studio_config.anim` (defaulted via `DEFAULT_STUDIO_ANIM`). The static "before" side shows their actual `BespokeMonogramMark`, not the initials circle. `allowWebgl={false}` (one WebGL context budget; molten degrades to Gold Turn here exactly as on the hero). Gold/molten stage on the same dark ground the studio preview uses.
- **The free/paid line, said where the choice is made (§5.3):** a persistent status line under the studio card (a React sibling — never inside the inert editor subtree). Owned → "The reveal you pick in the studio plays live on your wedding website." Unowned → lock + "Previewing reveals in the studio is always free — guests see your pick live with Animated Monogram · ₱{catalog price}", anchored to the buy section (`#animated-monogram`). Price from the admin V2 catalog only, never hardcoded.

No engine change, no flag, no migration. The gate itself is untouched (free studio never gated; the SKU gates only the live reveal).

SPEC IMPACT: None beyond the council verdict (`Monogram_Maker_Council_Verdict_2026-07-17.md` §5.1–5.3 marks these shipped).
