## 2026-07-05 · feat(people): staged Phase-2 Life Stories participant UI (flag-off)

Added the participant-facing "Your Story" surface for the person-spine Phase-2
Life Stories feature. A person's life story is the photos / 5s clips / editorials
they appear in across events, multi-homed into their own archive as references
(source_table + source_id), never media copies — so the UI presents items grouped
by event with counts + kind + hide/unhide and per-event opt-out controls, and
renders NO thumbnails / R2 images.

- New client component `app/dashboard/(account)/_components/life-story-section.tsx`
  (`LifeStorySection` + exported `LifeStoryGroup` type). Uses the existing,
  flag-guarded server actions `hideMyStoryItem` / `unhideMyStoryItem` /
  `optOutOfEventStory` via `useTransition`; app-chrome palette + Lucide icons only.
- Mounted on the account home `app/dashboard/(account)/page.tsx` behind
  `personLifeStoriesEnabled()` — reads `getMyLifeStory({ includeHidden: true })`,
  resolves event display names in one `events` lookup, and groups by event.

⚠ COUNSEL-GATED / FLAG-OFF / PRODUCTION-INERT. The section only renders when
`NEXT_PUBLIC_PERSON_LIFE_STORIES=1`, which is OFF in production. When the flag is
off the fetch never runs and the section does not render at all — zero visible
change. This surface only READS + invokes the existing hide/unhide/opt-out
actions; it adds no new consent/hide semantics and no schema or migration.

SPEC IMPACT: None.
