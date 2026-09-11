## 2026-09-11 · feat(invite): Velvet, the Classy invite theme, ships its skin

A couple with Event Hub Pro can now pick **Velvet** on Guests → Invite link and
their guests meet it on all three invite doors: the couple's reveal background
held under a graded velvet veil mixed from their own colour, a foil ring and
drop that sit the card on the velvet, the engraved double hairline inside the
card's padding, their mark as a paper seal above the title, and a foil rule
with one gem as the hinge. Ported from
`Design_Invite_Themes_2026-09-10/designs/velvet.html`, not redrawn.

The delta is a skin and nothing else — the column, the picker, the Pro gate, the
ground and the reveal on door 01 all already shipped (#5409, #5410):

* `apps/web/app/[slug]/invite/_components/themes/velvet.tsx` + `velvet.module.css`
* one case in `invite-skin.tsx`; `velvet.ready` → `true` in `lib/invite-themes.ts`
* `apps/web/app/_fonts/jost/` (Jost 400/500, SIL OFL 1.1 from
  `github.com/google/fonts` `ofl/jost`, licence committed beside it) and
  `apps/web/app/_fonts/bodoni-moda/` (the repo's own SemiBold face, subset to
  latin and converted to woff2) — declared in the theme's own module with
  `next/font/local`, so they ship on the invite doors and on no other page.

Two ports, not redraws, worth naming: the veil's deep band runs to 210px rather
than the design's 78px because `DoorShell` centres its column, which puts the
wordmark — the only lettering that ever sits on the velvet — where the design's
veil had already thinned (measured over a white photo: 9.4:1 at the deep band
with the default accent, 2.7:1 at the mid band); and the wordmark is repainted
paper by scoping `--m-ink` inside the theme, because `<Wordmark>` carries its
colour inline.

`themes-stay-skins.test.ts` gains the guard the theme registry needed: every
theme marked `ready` must have a case in `inviteSkin` AND both of its files,
and every case must belong to a ready theme. Without it a theme flipped to
ready before its skin lands is offered, saved, gated — and silently rendered as
the bare door.

SPEC IMPACT: None. The five themes, their tiers and Velvet's four-flap opening
were already recorded (DECISION_LOG 2026-09-10 "the invite link is an arrival";
the seven answers 2026-09-11). This ships the skin the decision already named.
