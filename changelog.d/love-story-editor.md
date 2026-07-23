## 2026-07-23 · feat(website): post-onboarding "Our story" editor — "Add it later" finally has a later

`/dashboard/[eventId]/website/our-story` (wedding + couple-only): edits the same
v2 `events.love_story` JSONB the onboarding love stage commits (spark / the
almost / the yes / anchors / milestones repeater), merge-don't-clobber, under
the host JWT (couple_can_update_event RLS). Also writes the dual-stored
`events.together_since` column (public readers prefer it over the blob — an
edit was previously a silent no-op on the editorial stat). 0-row updates now
surface as errors instead of a false "Saved". Milestones capped at 100,
auto-sorted chronologically. Hub QuickLink added (wedding events only), with a
nudge blurb when the story is empty.

SPEC IMPACT: corpus DECISION_LOG 2026-07-23 rows (love-story gap + this build;
DPO note: the editor writes ungated — explicit first-party authoring — while
onboarding's covert collection stays gated on home_activity_signals).
