## 2026-09-29 · fix(dashboard): the event card wears the event's cover; coming back from Find your seat no longer replays the Save-the-Date film

**The card.** Owner report: a Pro event with a Save-the-Date background and a
Pro theme showed on the dashboard as plain white paper (names, monogram in an
oval, "24 need you", "81 days to go") — *"did not adjust to the event cover"*.
Cause: `resolveEventPoster` (`lib/event-poster.server.ts`) asked the Event Hub's
look resolver `resolveHubLook` WITHOUT `std_background`, so `look.photo` was
always null, and `posterFor` (`lib/event-poster.ts`) never looked at the theme's
own art — every event without a hero photo fell to the paper card. Neither
caller (`app/dashboard/(launcher)/page.tsx` `planningPosters`, the Maker's
poster preview in `maker-made-once.tsx`) read the column.

Now, through the same resolvers the Event Hub uses (no second resolver):
hero photo → the Save-the-Date background (`resolveHubLook().photo`, Pro-gated
exactly as the invite door paints it) → the theme's still
(`resolveThemeGround(theme).poster`, drawn as the invitation card in their
theme) → the paper card (Classic, unchanged). A wake keeps its quiet masthead.
The words on a photo or theme cover take their ink and veil from the Event
Hub's legibility rule (`hubLegibility` / `hubLegibilityVars`): over a photo
nobody has sampled, the ink that clears AA over both a black and a white pixel;
over a theme still, the theme's own ink over its measured scrim. This also
replaces the photo card's old fixed dark gradient, which was transparent by 60 %
of the height — below the names on a two-across phone card. `PosterEvent.std_background`
is REQUIRED so a future caller cannot forget it.

**The film.** On the Save the Date, "Back to the invitation" from Find your
seat lands on `/slug#site-details` — and the film started over from its first
beat. The hash already stood the opening down on every other stage
(`landedOnTheFirstPage`, `lib/reveal-stages.ts`); the same rule now decides the
film: `StdFilmHandoff` starts it lifted for a landing that is not the first page
(through the same `STD_FILM_EXIT_EVENT` "See our page" sends, so "Watch our
film again" is there), and `RevealOverlay`'s landing check runs on every stage
so no veil covers a page whose film was lifted. A bare address still plays the
film exactly as before; the Maker's canvas is untouched.

Guarded by `apps/web/lib/event-poster.test.ts` (new blocks: background, theme
still, Classic, wake, AA over any photo / over every theme still, both callers
read the column) and `apps/web/app/[slug]/find-seat/back-lands-on-the-invitation.test.ts`
block 5; `lib/the-couple-picks-where-the-reveal-plays.test.ts` re-anchored to
the widened overlay check. Each new block was seen to fail under sabotage.

SPEC IMPACT: None — implements the owner's 2026-09-24 rule that the poster
follows the hero ("hero photo wins; invitation card in their theme") and the
2026-09-28 "Back to the invitation" ruling; no decision changes.
