## 2026-11-25 · fix(schedule, profile, groups, sign-up): honest reads, ten final-check faults (area 2, batch 5)

- Schedule › Requests: a refused read says so, never "Nothing waiting" (A2-I1). Planning list: refused paperwork
  deadlines and meetings are named (`missing`), never silently dropped; Home's counts unchanged (A2-I3).
- Home › Shop: "Couldn’t read your shop", never "Yours shows here once you have one" over a failed read (A2-B2).
- Loved one: a refused read is "couldn't read", not a 404 (A2-C12; linked events are lane R and left).
- Profile: a refused read shows no forms Save could write blanks from, and a refused pending-deletion read does not
  re-offer "Delete my account" (A2-C7); account type in plain words, no internal section codes (A2-C8).
- Groups: roster, events and invite link each say when they could not be read — never "rotate" over a working
  link (`readCommunityEvents` / `readCommunityRoster` / `readInviteToken`; the old names keep their shape) (A2-C14).
- Host invitation: a refused read is "try again", not "not found" (A2-A10).
- Sign-up "You": a refused read never draws an empty card whose Done would clear saved values (A2-A7).
- Details field links: a couple lands in Event settings ON that row (A2-H11).

Guard: `app/dashboard/[eventId]/schedule-profile-groups-reads-hold-final-check.test.ts`.

SPEC IMPACT: None (honest states per CLAUDE.md §5 rule 4; house words).
