## 2026-07-10 · feat(create-event): event-type picker is now a responsive grid

Replaced the swipe carousel on the full-page create-event surface
(`/dashboard/create-event`) with a responsive grid of full-bleed event-type
photo tiles — 2-up on phones, 3-up on tablets, 4-up on desktop — so the whole
roster is visible at a glance and every tile is directly tappable (the old
carousel only let you begin from the centred card). Widened the page container
to `max-w-5xl` to give the grid room on desktop; constrained the inline
name-form fallback to `max-w-lg`. No routing, data, or selection-logic changes:
`EventTypePicker.handleSelect` and the DB-driven roster
(`getCreatableEventTypes()`) are unchanged, so Simple Event and any future
admin-created types appear automatically.

Owner directive 2026-07-10: "just show a grid of the different events — maximize
screen space for both mobile and desktop." Supersedes the 2026-06-04 "feel
photo" swipe carousel (`event-type-photo-picker.tsx` rewritten in place; the
in-chrome add-event sheet's `event-type-carousel.tsx` is untouched).

Also adds the missing `public/event-types/simple_event.webp` hero photo (a
warm golden-hour intimate-gathering shot, matching the other tiles). Simple
Event was enabled 2026-03-07 but had no asset, so its tile was falling back to
`wedding.webp`; it now shows its own photo.

SPEC IMPACT: None (presentation-only refactor of an existing surface; the
2026-06-04 carousel directive is superseded — logged here + in the component
doc-comments, no corpus spec file describes the picker's interaction model).
