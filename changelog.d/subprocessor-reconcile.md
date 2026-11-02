## 2026-08-06 · fix(privacy): the two lists of outside companies now agree, and something checks

Owner ruling 2026-08-06, as data protection officer.

**There were two lists and NOTHING compared them.** The public `/privacy` page
named three companies the internal compliance record did not; the record named
two that are not used at all. Neither was wrong on purpose — adding a processor
to one is a different commit from adding it to the other, and no test ever read
both. **The internal record had not been touched since 6 July.**

**The headline, and it saved the work:** `/privacy` needed **no change for any of
the five items**. It was already right. Every correction is on the internal side.

- **+ Sentry** — genuinely running (`@sentry/nextjs`), receiving crash reports.
  The clear-cut omission.
- **+ Google, + TikTok** — with roles **scoped** to "only when the user connects
  their own account". Over-disclosure is the safer side for a DPO.
- **~ Cloudflare** — role corrected: media storage **and** the relay carrying
  live call video in transit, which the public page already disclosed.
- **− Persona / Veriff / Onfido** — verified **not used**. Webhook stubs only,
  and `/privacy` already says "not currently active"; an admin reads vendor
  documents by hand. Listing a company that handles your data when it does not is
  its own inaccuracy.
- **− SendGrid** — not wired. One mention, in prose on an internal page.

## The durable half

A single source (`lib/subprocessors.ts`), a generated migration, and a
**cross-check that did not exist**: `subprocessor-drift.test.ts` fails if a
company we say handles data is missing from the public page, if a retired one is
presented as active, or if the migration and the source disagree.

🔑 **THE PUBLIC PAGE'S JSX IS DELIBERATELY NOT REFACTORED.** It is legal copy with
links and scoped explanations. Rewriting it to render from an array would put
that wording at risk to fix a bookkeeping problem. The checks cross-reference by
**name**, which is what actually drifted.

🔑 **THE MIGRATION IS GUARDED.** The record is also admin-editable, so the UPDATE
only fires while the row still holds the 9-entry array we read. If an admin has
edited it since, this is a no-op instead of silently clobbering their work.

⚠ **`dpa_on_file` stays FALSE on all eleven, because that is the live truth** —
there is no signed data-processing agreement with any of them. A test pins it, so
flipping one takes a deliberate edit rather than a dashboard tidy-up.

**Two of my own checks were lying, both caught by mutation:**
- `indexOf('Persona')` matched inside **"Personal Information Controller"** and
  "Patiktok **Personal** tier" — and checking only the FIRST hit would clear the
  file on an unrelated word. Word boundaries, every occurrence.
- The retired list could **shrink silently**: dropping a name just stopped the
  check looking for it. The four verified-unused names are now pinned.

**Verified:** 6 tests, mutation-checked · full suite 6,944 pass under
`Asia/Manila` · scoped `tsc` clean · 13/13 lint scripts clean · exposure baseline
**unchanged**, correct for a data-only migration.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-06. ⏭ Separately found and NOT folded in:
the public page appears to **under-disclose three services that genuinely run** —
raised on its own rather than changed quietly.
