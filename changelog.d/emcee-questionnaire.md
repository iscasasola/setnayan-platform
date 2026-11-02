## 2026-09-18 · feat(emcee): the host's questions — the couple tells him how to say the names (DAY-7)

A host/MC's hardest job is reading ~30 sponsor names aloud, and a booked supplier
cannot read the guest list. Spec § 8 of `Emcee_Script_System_BUILD_SPEC_2026-07-29.md`
("the questionnaire — specified so it is not designed twice") is now built:

- **His questions travel, the answers do not.** New `vendor_questions` (vendor-owned,
  no `event_id`) and `event_question_answers` (per event), the third instance of the
  `vendor_songs ↔ event_song_picks` / `vendor_activities ↔ event_activity_picks` split.
  Migration `20271233982952_emcee_questionnaire.sql`.
- **He writes them** at the bottom of his existing segments page
  (`/vendor-dashboard/activities#questions`), with six one-tap starters from the
  spec's "only ask what the app cannot know" list — pronunciation first. Retire,
  never delete (no DELETE grant), so a past couple's answer never cascades away.
- **The couple answers** on their schedule page, directly under his segments
  (`HostQuestions`). Renders nothing without a booked host who asks something. A
  refused read never draws the form — an empty box would save as a clear.
- **He reads them** on the couple's Script tab, above the script ("What they told
  you"), with unanswered ones listed as still open.
- **Audience:** the couple (`current_couple_event_ids()`, never guests) and the host
  who asked, only while booked. **No coordinator lane** — spec § 11 Q4 allows it
  only with an approval that is not built.
- `lib/booked-host.ts` holds the one `HOST_TILE`; `EmceePicks` imports it.

Guarded by `lib/emcee-questions.test.ts` (7, sabotage-proved) and
`tests/db/emcee-questionnaire-audience.db.test.ts`. Exposure baseline and FK-behaviour
map regenerated for the two new tables (authenticated only, nothing to anon).

SPEC IMPACT: `Emcee_Script_System_BUILD_SPEC_2026-07-29.md` § 8 said the couple would
answer in the coordinator working folder (`event_vendor_working_notes`), which would
have needed a role rename on a coordinator-only table. Built instead as a per-question
answers table mirroring `event_activity_picks`, which is what the same section says to
mirror. Recorded in `DECISION_LOG.md` and § 8.
