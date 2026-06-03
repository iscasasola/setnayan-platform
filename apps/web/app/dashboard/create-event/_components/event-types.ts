// Shared event-type roster — single source of truth for the full-page
// create-event picker (event-type-picker.tsx) AND the in-chrome add-event
// bottom sheet inside EventSwitcher. Data only (no React, no server-action
// imports) so a client picker and the client switcher can both import it
// without dragging extra deps into the chrome.
//
// V1 tile list (locked 2026-05-16, debut enabled 2026-05-20). The V1.1
// multi-event roster (iteration 0041) grows one event_type at a time; the
// rest render as "Coming soon" placeholders so couples can see what is on
// the roadmap without being able to pick it yet.
//
// gender_reveal was briefly enabled on 2026-05-20 (PR #177) then reverted
// to "Coming soon" the same day per owner decision. The enum value stays
// in the DB (migration 20260521050000) — it's idempotent and harmless when
// unused; re-enabling later is a one-line flip of `enabled` here +
// ALLOWED_TYPES in create-event/actions.ts.
// All event types unlocked (owner-directed 2026-06-03 "unlock all events").
// Previously wedding + debut only; the other seven were "Coming soon"
// placeholders. The DB `public.event_type` enum already carries all nine keys,
// and the create-event action's isWedding branch writes NULL wedding fields for
// non-wedding events — so this is the documented one-line flip (+ ALLOWED_TYPES
// in create-event/actions.ts). Non-wedding events land on the standard dashboard
// (wedding-tailored planning surfaces fill in per-type in V1.2+).
export const EVENT_TYPES = [
  { key: 'wedding', label: 'Wedding', emoji: '💍', enabled: true },
  { key: 'debut', label: 'Debut', emoji: '👑', enabled: true },
  { key: 'gender_reveal', label: 'Gender Reveal', emoji: '🎈', enabled: true },
  { key: 'birthday', label: 'Birthday', emoji: '🎂', enabled: true },
  { key: 'celebration', label: 'Celebration', emoji: '🥂', enabled: true },
  { key: 'travel', label: 'Travel', emoji: '✈️', enabled: true },
  { key: 'corporate', label: 'Corporate', emoji: '🏢', enabled: true },
  { key: 'tournament', label: 'Tournament', emoji: '🏆', enabled: true },
  { key: 'christening', label: 'Christening', emoji: '🕯️', enabled: true },
] as const;

export type EventTypeKey = (typeof EVENT_TYPES)[number]['key'];
export type EventTypeRow = (typeof EVENT_TYPES)[number];
