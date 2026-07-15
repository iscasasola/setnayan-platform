## 2026-07-15 · feat(samahan): community-event creation context (PR-3 of the minimal cut)

`events.community_id` gets its one and only writer (plan §7 — without it the
Events tab is an eternally-empty surface):

- **create-event `?samahan=<communityId>` context** — organizer-gated. The
  page verifies the viewer is an organizer of a live (non-archived) samahan;
  anyone else silently drops the param and gets the normal personal page.
  In context: a "Planning for <name> · SAMAHAN" banner, the type picker
  filtered to `resolveProfile(type).eventClass === 'community_eligible'`
  (the 7 community types — never wedding/debut/christening/gender_reveal/
  birthday/graduation), and a hidden `community_id` on the inline form.
- **Picker in samahan context always uses the inline form** — the tailored
  onboarding routes don't carry community context (context flows one way,
  from the community's Events tab).
- **`createWeddingEvent` re-verification (UI-bypass-proof)** — when
  `community_id` is posted: (a) `resolveProfile(event_type).eventClass`
  must be community_eligible (`?error=samahan_invalid_type`), (b) admin-client
  organizer + not-archived re-check (`?error=samahan_not_organizer`), then the
  insert stamps `community_id`. The DB CHECK
  `events_community_class_consistency` is the final backstop. Wedding +
  samahan can't combine by construction (wedding is 'personal' class).
- **"+ Plan an event" (organizer-only)** on the samahan Events tab — the
  empty-state CTA and a header button on the populated list. Ships now, not
  in PR-2, so no dead button ever rendered.

Ownership semantics (minimal): the creating organizer gets the normal
`event_members` 'couple' row and runs the event like any event; fellow
community members get READ visibility via `community_member_can_read_events`.
Auto-membership / invite-as-group stays deferred (`guest_groups` work, plan §1).

Still dark: reachable only through PR-2's unlinked pages until PR-4 flips the
home door.

SPEC IMPACT: `Samahan_Minimal_Build_Plan_2026-07-15.md` §7 shipped as specced.
