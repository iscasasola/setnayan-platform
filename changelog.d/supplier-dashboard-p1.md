## 2026-11-17 · feat(supplier): the supplier dashboard wears the owner's blue look (light) + the Prints row says what it is

- **The blue look, carried to every supplier page** (owner 16 Nov, DECISION_LOG "SUPPLIER DASHBOARD = THE OWNER'S BLUE LOOK … CARRIED TO EVERY SUPPLIER PAGE"; P1 drawings `prototypes/supplier_*_clean_2026-11-16/`). New `app/vendor-dashboard/_components/supplier-look.css`, switched on by `data-supplier-look` on the supplier template. It re-points the existing colour tokens on `<html>` while a supplier page is on screen. No component is recoloured by hand. The page is #EEF2F8 with the soft glow, cards are white with a soft shadow, titles are #101B30, body text is #566275, links are #175AB9, and the main button is solid #2272E6 with a white label (4.55:1) and the 16 Nov blue shadow. Ghost fills and washes are #E8F0FA, lines are cool, and the top bar is solid white from 1100. Admin › Colours and the couple side are untouched. Leaving the supplier area restores them.
- **Light only.** The ruling's dark mode is held as an owner question. The app is light-locked, the shell rule says dark follows the person's Appearance setting rather than the device, and the hand-typed white surfaces in the supplier area would break under it.
- **Shop › Promote › Prints row:** "Calling card + tarps" now reads "Marketing materials, printed out" (P1 drawing). The sheet, the 15 designs and the 7 pieces are unchanged.

SPEC IMPACT: None. The look and the words are the 16 Nov rulings already in DECISION_LOG. Nothing new is decided.
- The glow and the main button's shadow now read the tokens (`--color-mulberry`, the new `--sn-glow-soft`) instead of typed rgba values. Guard: `_components/the-blue-look-is-tokens-only.test.ts`.
- Audit fixes, 17 Nov:
  - **Prints follows the shop drawing.** The "Prints" heading stays. Under it sits "Marketing materials, printed out" and its counts (derived from `PRINT_DESIGNS` / `PRINT_PIECES`, never typed). Then come seven piece rows (name · size, then their line), each opening the shipped sheet on that piece. The icon is a calling card (`IdCard`).
  - **Shop's Prints tile.** The cover gains a Prints tile wearing the same `PRINTS_LINE`. It opens the shipped Promote sheet.
  - **Drawing colours.** Tiles, washes and pills are #DCE6F2, and warn is #8A5A00.
  - **Tokens only.** The glow and the button lift are tokens (`--sn-ambient`, `--sn-forward-lift`), read in globals.css at zero specificity. The lift never covers the keyboard focus ring.
  - **No Admin › Colours leak.** The supplier scope now holds every token a saved set writes. Guards: `the-blue-look-is-tokens-only.test.ts` and `shop/promote/prints-are-the-drawn-seven-rows.test.ts`.
- **Ready for #7888 (the clean warm look), which ships first.** The supplier scope re-points its new tokens to the drawing, so the supplier side never goes warm.
  - The secondary button (`--sn-btn-secondary-*`) is the blue ghost #E8F0FA with ink words (15.0:1). Hover is the #DCE6F2 wash. There is no outline.
  - The floating bar's `--sn-dock-lift` is the drawing's cool shadow.
  - The blue band keeps white words (`--sn-on-band`, 4.55:1). Ink on the blue would read about 3.2:1.
  - The guard holds each value. It also passes against #7888's `app-colours.ts`.
- **Template ratchet.** The cover's Prints tile is a wash tile (`--surface-soft`) with no bordered card, so Shop stays at its baseline.
