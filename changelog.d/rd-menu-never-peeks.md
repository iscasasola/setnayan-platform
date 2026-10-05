## 2026-10-06 · fix(maker): the shut lower-third menu never peeks out under the Menu button

On the guided flow's own screen the lower third shrinks to one Menu row; the shut menu sheet was only slid down 104% of its box, which on an iPhone lands inside the home-bar padding — its Look · Save the Date rows peeked out at the bottom (owner, live iPhone). Shut now also sets `visibility: hidden` after the slide (`transition-[transform,visibility]`), so nothing shows and the close still animates. Guard: `the-maker-lower-third-holds-every-tool.test.ts` (sabotage-verified).

SPEC IMPACT: None
