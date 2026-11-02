## 2026-09-24 · refactor(collection): extract the collection card from the Planning board — nothing changes on screen

Step 1 of `build-sessions/STANDARD-collection-card.md`. The Planning card lived
inline in `app/dashboard/(launcher)/page.tsx`; its layout is now
`app/_components/collection-card.tsx` — `CollectionCard` (seven slots:
cover · kicker · title · mark · meta · attention · progress), `CollectionGrid`
and `NewThingTile`. Planning is the only caller: `GlassEventCard` is reduced to
Planning's slot mapping, the five shelf grids render through `CollectionGrid`,
and `NewEventCard` renders `NewThingTile`. `CardShell`, `AttentionPill` and the
pressable-class helpers moved with the shell; `EventAttention` became the
`eventAttention` mapping.

**Proof nothing changed on screen:** the old inline card and the new one were
rendered (`renderToStaticMarkup`) for the same six fixture events — organiser
with a leading total, invited with no public page (inert), finished with a
story href, invited tomorrow, organiser today with no score, put-away — plus
the New-event tile. The two HTML outputs are byte-identical (sha1
`50aefd4f4344e4f2d4f9cac68b0a2ef9a7dd580a` both sides); a one-class sabotage
in the component made them differ.

`attention.count` and `progress.pct` are `number | null`: `null` renders
"couldn't load", never a number and never silence. Planning does not pass
`null` yet (its reads still degrade to "absent"), so nothing on screen moves;
making those reads honest is part of the poster-cover work.

Guard: `app/_components/collection-card-is-the-only-card.test.ts` — the card
shell, attention row, `+ New` tile and grid signatures exist only in the
component (a fork anywhere in `app/` fails), every adopter imports and mounts
it, and the unknown-vs-zero rules are rendered and asserted.

Five existing source guards pinned the card's markup inside `page.tsx`; each is
re-anchored to where the code now lives (the launcher's slot mapping AND the
component's rendering, both pinned), not relaxed. The port-control baseline's
`/dashboard/(launcher)` block list is updated by hand for ONLY this move
(`AttentionPill`/`CardShell`/`CountUp`/`EventAttention`/`ProgressRing` now
render from the shared component → `CollectionCard`/`CollectionGrid`/
`NewThingTile`); unrelated drift a full regeneration would have swept in was
left out.

SPEC IMPACT: None.
