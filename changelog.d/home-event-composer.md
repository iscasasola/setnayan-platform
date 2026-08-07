## 2026-08-07 · feat(home): "What's your event?" composer row on the user home

Owner, 2026-08-07, comparing the home to Facebook: *"instead of what's on your
mind? what's your event? something like this."*

Adds one full-width row under the greeting on `/dashboard` — avatar initial ·
"What's your event?" · a terracotta ➕ — linking to `/dashboard/create-event`.

**Nothing was re-conceived.** The four-surface home (PR #3240, owner-approved,
and marked `preserve: RE-SKIN, never re-conceive` in `design#5`) is untouched:
same sections, same order, same data. Creating an event was ALREADY reachable
three ways — the trailing dashed "New event" ghost card, the raised ➕ in the
phone pill nav, and the ⌘K bar — and all three remain. The gap this closes is
that none of them *asks*; the composer is that same single destination given
the width and the invitation wording.

Deliberately **not** a text input: the create screen needs a type, a subject
and a date before it can make anything, so a sentence typed here would be
discarded on the next screen. It looks like a composer and behaves like the
door it already was.

Palette-locked tokens only (`--sn-gold-100/700`, `terracotta`, `text-ink`);
existing `sn-press` / `sn-reveal` motion; no new dependency, no new route, no
migration, no flag.

SPEC IMPACT: None — the create-event destination, its guards and the home's
four surfaces are all unchanged. The wider question the owner raised (a
follow-feed of Storyteller Chapters) is NOT in this change and remains an open
owner decision.
