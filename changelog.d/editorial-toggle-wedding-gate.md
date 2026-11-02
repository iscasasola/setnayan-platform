## 2026-06-28 · fix(editorial): gate the Real Stories opt-in toggle to weddings

Follow-up to the editorial publish/share panel (#2371). The "Feature our story in Real Stories" toggle showed for any event type, but the public Real Stories gallery (`loadPublishedShowcases`) filters `event_type='wedding'` — so a non-wedding couple toggling it would set showcase consent that never surfaces. Now the toggle only renders for weddings (`isWedding` prop derived from `events.event_type`); everything else in the share panel (link, copy, Facebook/Pinterest share) is unchanged for all event types.

Verified in a live dev server with a throwaway mock-preview route (removed): the wedding instance renders the full panel incl. the toggle + the private-page caveat; a non-wedding instance renders the same panel WITHOUT the toggle (accessibility-snapshot confirmed exactly one toggle across both). tsc + prod build green.

SPEC IMPACT: None on locked scope. Matches the existing wedding-only Real Stories gating.
