## 2026-10-01 · fix(event-types): Tier 1a — sides, wording, wedding religion (P6a)

From `EVENT_TYPE_RELIGION_AUDIT_2026-09-30.md` §4 Tier 1 items 2, 6, 7 (copy), 8, 10.

- **Sides only where the role set has two principals** (`eventHasSides`): the new-group
  "Team side" pick, group chip titles, the groups rail, the possible-duplicate rows on both add
  forms, the check-in desk, the request "Accept" quick add and the roster search all drop the
  side on a birthday / wake / corporate event. The door refusals ("Only the couple…") name the
  event's own organizer (EventWords). Guard: `no-side-surface-on-a-sideless-event.test.ts`
  (per component, with counts).
- **Maker**: Page ▾ reads the profile's love_story part (`MakerNavigatorData.hasStory`) instead
  of a `hasStory: true` constant; the love-story scene is not part of a type with no two people
  (no "Empty — add your story."); stage blurbs lose "your monogram" / "wedding-day surface";
  the editorial fallback title is "Our Event" off a wedding.
- **Your Team copy** (5 strings), **prints + emails**: seat-plan pack fallback, supplier invite
  ("planning their birthday"), the full-res digest ("Your birthday gallery", was "Your your
  wedding …"), Real Story email. Guard: `the-wedding-words-stay-at-weddings.test.ts`.
- **Wedding religion**: `buildScheduleSeed` loads again as the first wedding template ("Your
  ceremony's day", through `loadScheduleTemplate`, +0 actions); INC · Muslim · LDS · SDA days
  (either rite column) get no cocktail hour, dancing or after-party from any template
  (db test `an-inc-wedding-has-no-cocktail-hour.db.test.ts`). Checklist sponsor and
  candle·veil·cord tasks follow the rite (INC one pair, civil two witnesses); a mixed wedding's
  checklist and dress note read both rites; Details and the date finder honour the launch gate;
  the faith picker no longer promises "pre-set halal" / "pre-set alcohol-free". Guard:
  `wedding-religion-reaches-the-day.test.ts`.

Not in this PR: `CEREMONY_TYPE_READABLE_LABEL` lives in `lib/wedding-plan-groups.ts`, held by P3
(#6234) tonight — follow-up once it merges. Gift words, debut/christening roles and the
simple_event hub surfaces are P6b; corporate / wake wording (addendum) is G5.

SPEC IMPACT: None.
