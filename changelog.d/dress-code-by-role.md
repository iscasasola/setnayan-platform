## 2026-10-17 · feat(dress-code): each role presented by its figure and its colours

Owner, verbatim: *"dress code must present a better way using the image their role and the colors."* The Dress code
scene's roles (Colours and roles layout) become one block per role: its name, then each of its people led by the role's
own drawing (#6589) at 144 px, dressed in their colours, their Wear in their own word ("Long gown"), and every colour in
the scene's palette look, each said by what it colours. Men and women side by side; guests' colour options each drawn.
One role per row on a phone, two across from `sm`, three from `lg`; a hairline above each block, no frames (nothing in
it is pressed). Nothing picked → the role is not drawn (unchanged, #6602). Extends `DressCodeWidget` / `RoleFigure`.

Guard: `apps/web/lib/the-dress-code-shows-every-pick.test.ts` §8 (figure leads, ≥ 112 px; blocks, never framed boxes;
one per row on a phone) — sabotaged 4/4 red.

SPEC IMPACT: None beyond the owner's 2026-10-17 dress-code rulings already recorded upstream.
