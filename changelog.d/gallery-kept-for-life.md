## 2026-08-18 · fix(retention): the compressed gallery is kept for life

Owner ruling 2026-08-18, verbatim: **"we keep it for life."** This supersedes the 2026-08-07
"free for 5 years, then a paid option" ruling, which had itself superseded a 2026-07-10
"free forever" lock. There is now **no end date and no paid tier** on the compressed gallery.

**What a person experiences:** the online gallery no longer carries a five-year clock, and the
promise that storing it would one day become something they pay for is gone. Nine screens, the
warning email and the public privacy notice all said five years; they now say for life.

⚠ **This retires a PROMISE, not a product.** The paid-after-five-years option was never built and
never priced — the privacy notice literally said *"we will tell you the price well before then"*.
Nothing was deactivated and nobody was charged.

🔒 **The two things that did NOT change.** The full-resolution ORIGINAL still becomes a compressed
copy at six months from first capture, floored at three months after the event ends — untouched.
And the separate paid option that keeps originals at full resolution is untouched; it sells
**resolution, not time**, so the free tier lasting forever does not overlap it.

🔑 **THE GUARD HAD TO FLIP, NOT LIFT.** `retention-copy-is-true.test.ts` carried three patterns
FORBIDDING any copy that called the gallery "forever" or "indefinitely" — which is now the truth.
Deleting them and adding nothing would have left the withdrawn wording free to drift back, so each
was replaced by its opposite: what is now false is the five-year window and the paid option after
it. ⚠ Scoped to the gallery on purpose — five years is still correct for couple↔vendor messages
and for BIR tax documents, and both were read before writing the patterns.

🔑 **A VERBATIM QUOTE IS DATED, NEVER EDITED.** Three files quote the owner saying *"we still keep
their photos for 5 years. but compressed."* Rewriting a quote to match a later ruling destroys the
record of when the decision changed. Each is now marked superseded with both dates, and the rest of
the sentence — pay nothing, still keep, compressed — still holds.

📄 **The compliance pack is corrected AND REGENERATED.** Four source documents carried the
withdrawn promise (Privacy Manual, ROPA ×2 rows, Data Retention Schedule ×3, Executive Dossier).
🔑 **The stale half is the ARTIFACT, not the source** — correcting the markdown and stopping there
leaves 13 PDFs still declaring five years, and those PDFs are what the guard reads and what the DPO
would file. Source corrected first, then regenerated: 13/13 documents, 128 pages.
✅ **No misstatement was ever made to the Commission** — the pack is unsigned and unfiled.

🛡 **Mutations, each measured by occurrence count, all RED:**
the withdrawn five-year promise creeping back into the privacy notice (1 → 0) · the paid-option
sentence creeping back into the couple's gallery page (0 → 1) · the ROPA's lifetime row reverting,
verified end-to-end by editing the source, regenerating the PDF and re-running the guard (1 → 0).

⚠ **The compliance guard caught one of my own mistakes, correctly.** Removing the phrase
`Nothing is deleted at 5 years` made its assertion fail — because that test exists to check the
replacement is stated, not merely that the lie is gone. Its assertion now pins **both** halves of
the new rule (no scheduled deletion AND the lifetime), which is strictly stronger than what it
replaced. It was not weakened to go green.

SPEC IMPACT: `DECISION_LOG.md` row 2026-08-18 · `NPC_Compliance/01_Privacy_Manual_ADOPTED_2026-07-24.md`
· `NPC_Compliance/02_Records_of_Processing_Activities_DRAFT_2026-07-05.md` ·
`Data_Retention_Schedule_2026-07-11.md` · `NPC_Privacy_Compliance_Dossier_2026-07-12.md` — all
applied directly in the corpus per the 2026-06-04 standing authorization, and the PDF pack
regenerated from them.
