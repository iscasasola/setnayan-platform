## 2026-10-23 · feat(privacy): DPO rulings of 2026-10-23 — face tagging is opt-in, LanguageTool is dropped, couples may leave the same-date count

Corpus DECISION_LOG row "OWNER ANSWERS ON THE BUILD TRACKER" (commit aedbf233).

- **Face tagging is now off by default and the couple opts in.** Migration `20271284831032` flips `events.face_tagging_declined_by_couple` to DEFAULT true. It also sets every existing event with no face enrolment to off; events where a guest has already enrolled keep their current answer.
  - The resolver itself is unchanged: the couple's "Turn it on for my event" is the opt-in.
  - The Papic card and the birthday limit line now say opt-in, and /privacy says "Face tagging is off unless the hosts turn it on."
  - Guard: `lib/face-tagging-is-opt-in.test.ts`.
- **LanguageTool is dropped.** The grammar layer in `lib/editorial-scan.ts` is removed and OpenAI moderation stays. LanguageTool is removed from /privacy's processor list and from the admin editorial-review copy.
  - Guard: `lib/languagetool-is-gone.test.ts`.
- **Couples may leave the same-date count.** Migration `20271285020592` adds `events.same_date_count_opt_out` (with its own SELECT grant and no UPDATE grant).
  - The couple's event privacy settings get a "Count us for other couples" tile. It uses the same pill-and-button control as "Who can watch on the day", through `setSameDateCountOptOut`, which runs after the host check.
  - `groupHoldsByVendor` drops opted-out events before the min-3 floor.
  - /privacy's "You cannot switch this one off" becomes "You can switch this off".
  - The `same_date_demand` risk note and its test now name the opt-out.
  - Guard: `lib/couples-may-leave-the-same-date-count.test.ts`.

- **Exposure baseline:** `col public.events.same_date_count_opt_out anon=- authenticated=S` recorded with the
  generator (`pnpm --filter @setnayan/web exposure:baseline`) — the one deliberate widening. SELECT to
  `authenticated` only, so the couple's own privacy page can read their answer; no UPDATE grant (written through
  the host-checked service-role action); no anon grant. `lint-events-column-grants` passes.

SPEC IMPACT: Applies the DPO rulings recorded in corpus `DECISION_LOG.md` (aedbf233). These follow-ups belong in the NPC pack at its next regeneration:
- ROPA DPS-17 (opt-out now exists)
- DPS-25 (LanguageTool removed)
- DPIA 06 (face tagging default OFF, resolving the "default-ON ruling vs code default" open item)
The Breach Policy § 6.2 ruling is recorded in corpus commit 6c8be9ab, and its /privacy wording ships in PR #6819.
