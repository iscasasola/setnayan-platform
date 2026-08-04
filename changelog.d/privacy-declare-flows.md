## 2026-07-23 · docs(privacy): declare the 4 undeclared privacy-sensitive flows — Coverage & drift now green

Closes the "live but not declared to the NPC" drift the control-board overhaul surfaced.
The 4 flows that read `declaredIn: []` (coordinator consent/money, coordinator prep-release,
vendor AI auto-reply, vendor Deep Search) are now genuinely declared — the artifacts were
authored first, then `declaredIn` was wired to match.

- **ROPA (corpus source of truth)** — added two Data Processing System records to
  `NPC_Compliance/02_Records_of_Processing_Activities_DRAFT_2026-07-05.md`:
  **DPS-13 · Vendor AI Assistant** (auto-reply + Deep Search: §34 automated processing,
  "⚡ AI auto-reply" label, Anthropic web_search subprocessor, 180-day dossier TTL,
  SPI/face/guest-list carve-out) and **DPS-14 · Coordinator Delegated Access** (invite
  consent modal, scoped guest-PII access, opt-in finalize-vendors / handle-payments scopes
  kept consistent with the "Setnayan never holds/moves money" stance, prep-then-release).
  Regenerated `03_Records_of_Processing_Activities.pdf` + the merged packet
  (`Setnayan_NPC_Submission_Complete_2026-07-16.pdf`, 97→104 pp) via the corpus generator
  and refreshed both bundled assets under `apps/web/assets/npc-docs/`.
- **Public /privacy notice** — added a "Coordinators you invite (delegated access)" section
  (the only one of the 6 flows genuinely missing from the public notice; vendor AI §15,
  Deep Search §16, anti-fraud §17, and device-fingerprint §5 were already disclosed). Bumped
  the "last updated" date to 2026-07-23.
- **Coverage map** — `lib/privacy-coverage.ts` `declaredIn` for the 4 flows set to `['ropa']`
  (referencing DPS-13/DPS-14) with notes pointing at the ROPA + the public notice. The admin
  Coverage & drift tab now reports **13 of 13 privacy-sensitive controls declared · 0 drift**.

Verified: tsc 0 errors, next lint clean, coverage recomputed (undeclaredActive = []).

SPEC IMPACT: Corpus ROPA (`NPC_Compliance/02_...ROPA...md`) edited directly (DPS-13/DPS-14
added) and PDFs regenerated — logged in `DECISION_LOG.md`. These remain DPO-prepared drafts
pending external PH counsel review before NPC lodging (the whole filing is counsel-gated; the
board still renders its permanent "NOT FILED" banner). The two DPS controls stay fail-closed
on the board until DPO sign-off.
