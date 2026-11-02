## 2026-08-24 · feat(event-types): the words follow the occasion — the funeral, the first solemn type

W4-WORDS. The owner approved the funeral as a new event type on 2026-08-17
("yes to all four") and ruled it a TONE build across the whole guest tree. A
family arranging a wake now gets an event that never says "celebrate", never
says "party", never counts down to a happy day, and never offers a
save-the-date — and may accept abuloy, with gentler wording than the wedding's
"digital money dance" (his own ruling, same day).

- **The threading half of this session's brief was already shipped** — S13
  ("the guest tree speaks the event's own words") landed earlier with its
  exact-bill guard, re-verified by a comment-stripping measurement before any
  work began. Nothing was rebuilt; this change rides that seam.
- **The tone register** is one new pair of keys inside the existing
  `event_type_profiles.terminology` JSONB (`register: 'solemn'`,
  `occasion_noun: 'gathering'`) — **data, not schema**. `EventWords` gains
  `occasion` + `solemn`; every pre-existing type resolves celebratory,
  byte-identically, and a hardcoded `FUNERAL_PROFILE` fallback keeps a wake
  solemn even on a DB read error.
- **Where the register bites**: the countdown never renders (client guard +
  both server mounts); the lifecycle never enters `save_the_date` or the
  joyful auto-composed `editorial` phase (preview overrides included); the
  RSVP options read "Will be there / Undecided, for now / Unable to come";
  the two marketing upsells (start-free pitch, vendor-save block) are
  withheld; the pabuya surfaces read "A gift of sympathy"; the hub's phase
  lines, day-of banner, photo empties, live-wall, watch-live aria and empty
  plates all carry drafted quiet arms. Celebratory arms are pinned frozen.
- **The type itself**: vocab row (`funeral`, 🕊️, enabled) · solemn profile ·
  onboarding intro in the quiet voice (the generic flow's default greeting was
  "Let's plan your funeral" over a sentence about celebrating) · seven
  marketplace tiles scoped (catering · florist · photo-video · printing ·
  choir · guest-shuttle · coordinator; livestream is already universal) ·
  checklist chrome ("Funeral checklist" / "your service date") · a
  short-runway funeral task list · a service-day run-of-show (the GENERIC
  fallback would have seeded a "Socials"/dancing beat) · anchor + cadence
  (happens once) · AI tier C, which is the default made explicit, not a price
  decision — flagged to the owner.
- **A trap fixed in passing**: the admin profile editor rebuilt the
  terminology blob from its six form fields, so any admin save would have
  silently stripped the solemn register. It now merges over the stored blob.
- Guards: `the-wake-never-celebrates.test.ts` (14-site tone bill, both arms
  frozen, exact count) + `funeral-event-type.db.test.ts` (the migration
  asserted by the object in the replay, seven tiles exact, community-owned
  funeral refused). 10 mutations, every one measured by occurrence count
  before → after, every one red.

SPEC IMPACT: DECISION_LOG.md row 2026-08-24 (funeral type built; open owner
decisions listed there: the AI tier, Papic for wakes, the funeral-home
taxonomy leaf).
