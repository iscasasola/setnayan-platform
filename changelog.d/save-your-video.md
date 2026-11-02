## 2026-08-31 · fix(live-studio): the couple ends the day holding their wedding

**The gap.** `lib/live-studio-recordings.ts` already ships the recording handoff — every
broadcast is auto-archived by YouTube as an unlisted video at indefinite retention, free, and
the card resolves a permanent watch link on both couple-facing surfaces. But its own docblock is
honest that **"YouTube only offers a file download to the channel's OWNER"**, so on a
Setnayan-supplied pool channel a couple could watch their wedding forever and never possess it.

**The fix costs ₱0 and moves no bytes.** OBS writes a full-quality local file from the encoder
that is *already running* — one click beside Start Streaming. The only reason a couple would not
have that file is that nobody told them to press the button, so the sentence now ships on all
three surfaces where they meet the encoder: the setup card's OBS block, the controller's encoder
tile, and the recordings card they come back to afterwards.

⚠ This does **not** reopen the R2 archive. § 6 removed it from V1 "to avoid paying for storage
of content that's already free on YouTube", and a local recording makes it less necessary.

SPEC IMPACT: **Owner ruling 2026-08-31 — the archive is NEVER wiped.**
`Live_Studio_Cast_and_Roam_2026-07-23.md` § 4 and `Live_Studio_Unified_Spec_2026-07-25.md`
§ 4h both ended the handoff with "wiped + returned to the pool"; `09_Panood_Feature_Specification.md`
§ 6 promises indefinite retention. Wiping would delete a wedding, so `live-studio-recordings.ts`
deliberately refused to build it and logged the conflict as OPEN. **§ 6 wins, the wipe is
retired.** Applied to the corpus: a `DECISION_LOG.md` row plus corrections at
`Live_Studio_Cast_and_Roam_2026-07-23.md` (§ 4) and `Live_Studio_Unified_Spec_2026-07-25.md`
(§ 4h costs-accepted line, the ③ release note, and the § 4k open-decision block). The historical
quotation at Unified § 227 is left verbatim — it quotes the superseded wording as history.
