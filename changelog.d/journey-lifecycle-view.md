## 2026-07-11 · feat(schedule): Journey mode — the full event-lifecycle arc on /schedule

Adds a third mode to the couple's `/schedule` page — **Journey** — alongside the existing Preparation and Event Day modes. Where Preparation answers "what dated steps are still ahead of me?", Journey answers the wider question the owner asked for: "what is the whole arc of this event, from the day we started planning, through the day itself, to the story we publish afterward?" — the couple's historical journey, conceptualizing → reality → documentation, on one continuous, phase-grouped timeline.

Pure aggregation, **no new table / no migration**. It reuses the already-built Preparation agenda (payments · paperwork · vendor meetings · statutory milestones · manual/vendor-added rows) for the middle of the arc and adds three lifecycle bookends read from columns that already exist:

- **The beginning** · `events.created_at` — "You started planning".
- **The day** · `events.event_date` — the event itself.
- **The story after** · `event_recaps.published_at` (only when `status='published'`) — the editorial/recap the couple publishes; a forward "coming soon" placeholder holds the end of the arc until it's live.

Entries group into four narrative phases (kickoff → road → day → story), each a vertical timeline; the milestones render as larger accented nodes and reuse the Preparation source icon/tone vocabulary so the two modes read as one surface. A header progress rail (Started → The day → Your story) shows where "today" sits on the arc.

- `lib/journey.ts` — new. `buildJourneyTimeline()` pure builder + types. Event-type-aware copy handed in by the page (no event-term machinery pulled into the pure module).
- `app/dashboard/[eventId]/schedule/_components/journey-view.tsx` — new. Read-only presentational server component (arc header + phase sections + empty state).
- `app/dashboard/[eventId]/schedule/_components/schedule-mode-toggle.tsx` — Journey segment added (first), with a count badge.
- `app/dashboard/[eventId]/schedule/page.tsx` — `?view=journey` wired; one extra small RLS-scoped `event_recaps` read folded into the existing parallel batch; `events.created_at` added to the select; timeline built and rendered. Journey is opt-in via its segment — the silent default landing (Preparation when there's prep, else Event Day) is unchanged.

Foundation for the follow-up **Appointments** PR (shortlisted/booked vendors proposing tastings/fittings/site-visits): those appointment rows will feed the same arc via the agenda's meeting source, so "upcoming schedules assigned by their shortlists" lands on this Journey timeline.

SPEC IMPACT: Realizes the "event lifecycle journey" concept from Relationship_Workspace_and_Appointments_2026-07-11.md (the schedule/journey surface the Appointments layer will feed). DECISION_LOG.md row appended.
