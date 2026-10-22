## 2026-10-22 · feat(board, home): an event for your shop or a loved one says who — "For <name>"

Owner, 22 Oct, "yes to all" on `prototypes/for_tag_on_event_cards_2026-10-22.html`.

- **Events board (Planning posters):** when the event is FOR a subject the viewer holds —
  `events.honoree_dependent_id` re-read under `owner_user_id = viewer` (their shop's business
  alaga, or a loved one) — the stance chip's slot says **"FOR SETNAPROD"** instead of "You
  organise this": same shell, the shop's round logo (`vendor_profiles.logo_url`, signed) or the
  loved one's initials in the icon's place. Two chips, never three. Helpers and guests keep their
  own stance chip.
- **Event Home:** one quiet line under the name — the same mark + "For SetnaProd". The eyebrow is
  untouched.
- **A failed read draws nothing new** (the stance chip stays); a refused shop read keeps the
  record's name and draws initials. Read through `events_host` — `authenticated` has no SELECT on
  `events.honoree_dependent_id`.
- New: `lib/event-subjects.ts` (`readEventSubjects`), `lib/event-for-tag.server.ts`
  (`readForTags`), `lib/for-tag.ts`, `app/_components/for-tag-mark.tsx`; `StanceChip` moves,
  unchanged, to `app/dashboard/(launcher)/_components/stance-chip.tsx`. `/dev/home-lab` gains
  `?view=board[&for=1][&one=1]` and `?for=shop|person`.
- Guard: `apps/web/lib/an-event-for-someone-says-who.test.ts` (6 tests; 9 sabotages red → restored green).

SPEC IMPACT: `DECISION_LOG.md` row 2026-10-22 "FOR <NAME>" ON THE EVENT CARDS (corpus b78140db) — records the owner's ruling and where it lives in code.
