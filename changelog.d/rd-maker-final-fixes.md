## 2026-10-07 · fix(maker): the Stages | Studio final fixes — English badges, the Home header's background, shipped part names, What to bring after the Entourage, the drafted march on the canvas, logo motion dropdowns

Owner, 2026-10-07: *"our goal is just to build the step 1-6 completely and all its fixes"* · *"approve recommendations"* · *"This should be English: Wedding"* · *"i thought this will use the main background image of the event hub maker?"*.

- **Event-type badges are English** (`lib/event-vocabulary.ts` `EVENT_TYPE_BADGE`): WEDDING · CHRISTENING · BAPTISM · BIRTHDAY · ANNIVERSARY · DEBUT · TOURNAMENT. The samahan events tab's third copy of the map is gone — it imports the shared `eventTypeBadge`. Search still finds both languages (`EVENT_TYPE_TERMS`).
- **The Home header wears the Event Hub's main background** (`lib/home-cover.ts`, `lib/home-cover.server.ts`): the Main background → the hub cover → their colour/ombré → today's mulberry, through Discover's own dressing (`dressEventCover`, lifted out of `dressCards` unchanged), the words in the hub's measured ink over its AA veil. Published values only.
- **Part labels use shipped names** (`lib/maker-parts.ts`): "Watch Live", "Supplier Stories".
- **What to bring sits after the Entourage** on Invitation › Details — one list, `STAGE_SCENES_AFTER_ENTOURAGE` / `splitAroundEntourage` (`lib/stage-scenes.ts`), read by the Maker's scene list and both guest-page trees (`site-body.tsx`).
- **The Maker canvas shows the drafted Wedding March** — `loadEntourage` takes the host's drafted steps, lays them on with the march editor's own `replayMarch`, writes them back onto the printed rows (`lib/march-draft-print.ts`) and prints through `buildEntourage`. Guests (no `hostDraft`) read the live march until Apply.
- **Logo Motion In · During · Out are PickMenu dropdowns** (`maker-logo.tsx`), same saves.

Not in this PR: "Remove for good" drafted + a new own scene at the picked place (needs a draft field, an Apply delete and slot accounting — its own PR), and "the cover loses its frame" (a guest-page change gated by a flag the guest page may not read — owner call).

SPEC IMPACT: None — every change implements a DECISION_LOG row already dated 2026-10-07 ("EVENT-TYPE BADGES ARE ENGLISH", "SIX BUILD QUESTIONS SETTLED" (1) and (3)).
