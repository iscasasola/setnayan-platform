## 2026-08-17 · fix(compliance): the shipped NPC pack stops misstating the product

The compliance pack served from `/admin/data-privacy/documents` — the set a lawyer or the
National Privacy Commission would be handed — was measured against shipped code and the live
production database and was wrong three ways. Every one had **already been corrected in the
corpus markdown**; only the artifact was stale.

**Root cause, and why regenerating alone would NOT have fixed it.** The generator's source list
(`NPC_Submission_PDF_2026-07-16/_generate_pdfs.py`) pointed at the superseded `_DRAFT_`
documents while the DPO's `_ADOPTED_` twins (2026-07-24) carried the corrections. Re-running it
would have re-published the same false claims from the same wrong sources. The pointer was the
bug.

**What was wrong, measured by reading the shipped PDFs — not their dates:**

| | shipped pack | truth |
|---|---|---|
| Processing activities | 14 (`DPS-01…14`) | 19 — absent: guest columns · shared photo pool · same-date demand signal · in-app video calls · coordinator day-of desk |
| Wedding photos | "90 days hot R2 + 5 years IA cold · **5-year hard limit**" | original replaced by a compressed copy at the later of 6 months from first capture / 3 months after the event ENDS; **no photo is ever deleted — only its resolution changes** |
| Media residency | "APAC / **PH** region" in 4 ROPA cross-border rows incl. the wedding-photos row | database **Singapore** (`ap-southeast-1`, read from the project), object storage **Cloudflare R2 Asia-Pacific**. There is no PH region and we have never had PH residency |

The retention row contradicted our own live `/privacy` page and committed us, in a filing, to
destroying photos we in fact keep — the more dangerous direction of drift.

**Fixed:** 9 residency misstatements across 4 documents (2 further matches are the *corrections*
quoting the old wording and were deliberately left); the `DPS-16` retention row, drafted
2026-08-02, which back-referenced a rule `DPS-05` had already retired on 2026-08-07; and both
photo rows saying "3 months after the event **date**" where the owner moved the floor to the day
the event **ENDS** on 2026-08-10 (verified against `papic-fullres-drop-core.ts`). The three
superseded drafts now carry DO-NOT-RENDER banners. Pack regenerated: 13 documents, 121 pages,
merged packet renamed to its real date and the manifest repointed so the download does not 404.

**Two silent-failure modes closed in the generator itself:** a missing source printed `SKIP` and
exited 0 — a pack quietly missing its ROPA looked exactly like a successful build; and the page
footer now stamps the regeneration date, so currency is readable from the artifact rather than
from a folder name.

**New guard — `apps/web/lib/npc-pack-is-true.test.ts`.** Asserts on the ARTIFACT (the bytes an
admin downloads), never on a date or a filename, because the markdown lives in a different
repository. Dependency-free PDF text extraction (`pdftotext` is not guaranteed in CI, and a
guard that cannot run is no guard). It refuses to pass on an unreadable file: the first attempt
at the extractor returned **0 characters** and would have gone green while reading nothing, so
`assertReadable` makes that fatal. Corrections that quote the retired wording are exempt by
design — a guard that condemned the sentences that fix the problem would teach the next reader
to skip it.

**Also corrected: `lib/privacy-coverage.ts` notes.** Five said a control was "held fail-closed"
or "ships OFF"; production shows **all 20 controls `active`**, and the catalog states every
feature gate reads that value. The env-flag half is not readable from a session and is now
explicitly asserted **neither** way. `declaredIn` is deliberately **unchanged** — the drift alarm
stays lit; marking activities "declared" is the DPO's call at adoption, not a side effect of
regenerating a PDF.

SPEC IMPACT: Applied directly in the corpus (2026-06-04 standing authorization) —
`NPC_Compliance/02_Records_of_Processing_Activities_DRAFT_2026-07-05.md`,
`01_Privacy_Manual_ADOPTED_2026-07-24.md`, `05_DPIA_Register_DRAFT_2026-07-05.md`,
`06_DPIA_Face_Vectors_DRAFT_2026-07-05.md`, `NPC_Privacy_Compliance_Dossier_2026-07-12.md`,
`NPC_Submission_PDF_2026-07-16/_generate_pdfs.py`, and DO-NOT-RENDER banners on the three
superseded drafts.

⚠ Filing is unchanged and still January 2027 per the owner's standing rule ("let this run
truthfully until then"). All 15 `npc_filing_tasks` remain `not_started`; nothing here files
anything. Three items only the DPO can close are raised separately.
