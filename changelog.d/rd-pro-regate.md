## 2026-10-18 · feat(pro): every Animate, effect, Style and Accent is Event Hub Pro ◆ — tried free, named at ✓ Apply; free events keep what they published

Owner 2026-10-16, verbatim: *"all animate, effects, styles, accents are pro"* (DECISION_LOG "ALL ANIMATE, EFFECTS,
STYLES AND ACCENTS ARE EVENT HUB PRO ◆"), with his answers the same night: everything in Style is Pro (colour, size,
font, style cards on a part; free events keep the theme's defaults) and free events keep what they already published.

Built with the shipped pattern only — the one gate (`planHubDraftApply`), the one named list (`hubDraftProEffects`),
the event's unlock (`ownsPro`) covering everyone on it. Newly held at ✓ Apply for an event without Pro:

- a part's own Style — colour · size · font · weight · B/I/U · alignment · width · spacing, and a letter's own font /
  colour / size (`HUB_ELEMENT_PRO_FIELDS`, `el:<part>:runs`) — named "Colour · Size · Schedule";
- every style card that is not the theme's own: scene looks (`PRO_SCENE_STYLES`, generated from the registry and held
  equal by `scene-style-pro.test.ts`), the fixed parts' cards, Post Event scene cards, the Dress code's palette and
  Do's & Don'ts looks, the camera's look (all but Classic) — named by the card;
- Animate that was still free: a fixed block's motion, a reply line's / card's / group's Build in, the Cover photo's
  Parallax; Drift and Ken Burns now wear ◆ and are named by their own names like Shimmer;
- a reply line's colour · font · size · picture look.

Grandfathered by the shipped rule (`refChange`): what is live compares as no change, going back to the theme's own is
free, and the guest page draws a part's look from the style alone (`free-events-keep-what-they-published.test.ts`).
Stays free: the page's own Look (font, colours, buttons), backgrounds' colours, a part's Show and words.

The Maker marks the newly-Pro controls the shipped way (" ◆" on the label / card name). The Maker lab takes `?pro=1`
for an event that owns Pro.

SPEC IMPACT: None — implements DECISION_LOG 2026-10-16 as recorded; product calls (Look stays free, Love Story's
Chapters/Essay/Years now Pro, a cross-stage default card counts as Pro once stored) are listed in the PR for the owner.
