## 2026-07-03 · feat(marketing): the Suri hero's price row IS the vs-team comparison

Owner 2026-07-03: "replace the row of the pricing. See how it compares against hiring a team to
do the same tasks." The Setnayan AI hero story's ₱799/₱499 price row becomes a two-bar
comparison, drawn to honest scale: "A team doing these tasks · ₱50,000+/month" (full gold bar)
vs "Setnayan AI · ₱799/28 days · ₱499 your first 28 days" (a ~1.6% sliver — the arithmetic is
the drama). Static text + bars only (no controls in the hero); Setnayan's number stays
catalog-driven (`pricing.aiRegularPhp`); the team figure is a labeled illustrative PH estimate,
and the "Typical PH rates, illustrative — bars drawn to scale" footnote stays visible at EVERY
viewport size (the disclaimer must always accompany the figure). Verified live in the preview:
compare block renders, old price row gone, bars at 100% / 1.6%, one screen.

Context: a parallel session removed "Setnayan AI" from the top nav (a63aee03) leaving the Suri
tile as the sole entry point — the interactive slider comparator in the pop-up is now DORMANT
(no entry point); this hero comparison carries the burden-vs-cost story instead.

SPEC IMPACT: None new — refines the Suri hero per owner direction; prices catalog-driven.
