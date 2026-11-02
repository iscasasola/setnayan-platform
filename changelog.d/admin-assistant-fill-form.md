## 2026-08-26 · feat(admin-search): the assistant fills in a form, it never presses submit

The admin search box can now recognise a JOB, not only a page — "create canonical leaf" or "add
leaf attribute option" opens a short in-box form asking for that job's fields (its required ones
marked), and pressing **Prepare the form** navigates to the real admin page with those answers
already filled in on the real create-form. The admin still reviews and presses the real button
themselves — nothing here calls a create/update action directly, matching the one-person admin
plan (2026-07-11): the machine may prepare and hold back, never let money, a price, an approval or
a publish through by itself.

- New `lib/admin-map/match-job.ts` ranks a typed sentence against the generated job checklist
  (`admin-jobs.generated.ts`), gated on shared-word COVERAGE (≥2 real words, ≥60% of the query) so
  a bare filler word like "add" — shared by 40+ jobs — never crowns one by accident.
- New `lib/admin-map/humanize-field.ts` turns a job's raw argument name (`display_name_en`,
  `is_rental`) into a question a person can answer, without a second hand-authored schema.
- `admin-command-palette.tsx`: form-driven job matches are offered alongside page hits; the
  AI escape-hatch (`ask-the-admin.ts`) is now also handed every form-driven job as a candidate
  answer, so a phrasing the deterministic matcher cannot bridge ("add a new category on the
  taxonomy service" → `createCanonicalLeaf`) can still resolve once, and is remembered for free
  after. The whole ask-form writes only to local state and a URL query string
  (`?admin_ask=<job>&aa_<field>=<value>`) — no server call.
- **One concrete consumer wired end to end**, the owner's own example: `/admin/taxonomy` reads
  that query, resolves the free-text "which tile" answer against the real tile list (an unresolved
  tile is an honest miss — nothing pre-opens), opens the right tile's Add-a-service form pre-filled,
  and shows "Prepared from your question — review, then press Add service." The other 184
  form-driven jobs are matched and can be asked about today; only this one page has been wired to
  READ the answers back. The param contract (`humanize-field.ts`) is meant to be adopted by other
  admin forms incrementally — this is not a claim that all 185 are wired.
- **Two live findings from the 2026-08-26 adversarial audit, verified already fixed on `origin/main`
  before this branch started** (PR `claude/what-the-audit-found`, merged as the top commit this
  branch is based on) — not re-fixed here, only re-verified: the phone "All surfaces" filter's
  `keepByTokens` now matches ANY shared word (was `tokens.every`, which blanked both of the owner's
  own example sentences on the device he reports from); the "No page has the word X" notice is now
  computed against the same known-word set that produced the ranked hits, closing the apostrophe
  false-positive ("no page has the word 'vendor's'" printed above the correct answer).
- **One finding re-checked and found to be a deliberate, correct ruling, not a bug**: the admin
  top-bar has no search field below the `lg` breakpoint on purpose (owner ruling, 2026-08-26 — the
  phone admin answers, it does not open editing doors). The phone reaches the same words through
  "All surfaces", whose filter now runs the identical rule as the laptop. Left as-is.
- **`admin_search_phrases.learned_from` had `'admin'` in its CHECK constraint and no writer.**
  New screen `/admin/search-memory` lists every learned phrase (what it resolves to, when, how
  many times used, learned from AI vs an admin), with a **Delete** per row and a
  **"Teach it this instead"** action that re-validates the chosen destination against the scanned
  route map and stamps `learned_from = 'admin'` — the writer that value was missing. New db test
  pins the CHECK admits exactly `ai`/`admin` and nothing else.
- Regenerated `admin-routes.generated.ts` (96 → 97 destinations, +`/admin/search-memory`) and
  `admin-jobs.generated.ts` (284 → 286 jobs, +`deleteSearchPhraseAction`,
  +`teachSearchPhraseAction`) via their own scripts — neither generated file was hand-edited.
- New tests: `lib/admin-map/match-job.test.ts`, `lib/admin-map/humanize-field.test.ts`,
  `app/admin/_components/admin-job-ask-form.test.ts` (source-inspection guard: the ask-form only
  ever builds a URL and calls `router.push` — never an admin action — mirroring the existing
  "nothing in the chain can perform an admin job" guard on `ask-the-admin.ts`),
  `app/admin/search-memory/actions.test.ts`, and a new case in
  `tests/db/admin-search-phrases.db.test.ts` for the `learned_from` CHECK.

SPEC IMPACT: None — this extends an already-approved 2026-08-26 owner request (the admin assistant
that gathers answers and prepares a form, never presses submit) recorded in `DECISION_LOG.md`; no
new product surface, price, or SKU. `ANTHROPIC_API_KEY` in Vercel remains the only non-engineering
step before the AI escape-hatch (and therefore the semantic-gap bridging half of this feature)
responds; the deterministic half (job-word matching, the ask-form, the taxonomy prefill, and the
search-memory screen) works without it.
