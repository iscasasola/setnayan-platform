## 2026-07-30 · feat(privacy): the same-date demand signal is now a DPO control you can actually approve — not a paragraph

**Owner, looking at `/admin/data-privacy`: *"do not see the new dpo?"*** Correct, and it was a real
gap. `WHATS_NEXT_Explore_Marketplace_2026-07-29.md` §6 decision 3 logged the "In demand right now"
lens as having *"no opt-out and no DPO sign-off"*, and the session that closed that item closed it by
**documenting** the gate. All 19 controls on the board were approved and this signal was not one of
them, so there was nothing to sign. **A privacy gate that exists only in prose is not a gate.**

- **New control `same_date_demand`** — migration `20271021022827`, seeded **`inactive`**
  (fail-closed, no explicit status so the column default applies) with
  `ON CONFLICT DO NOTHING` so re-running can never clobber an approval.
- **Catalog entry** in `lib/data-privacy-controls.ts` (group `automated_ai` — it is a computed
  ranking sub-score, and the board has no cross-couple section; inventing one would re-order every
  existing row). Its `riskNote` is written as the DPO's actual decision input: why the min-3 floor
  exists (n=1 on a solo vendor for an exact date in a small municipality is functionally
  re-identifying), why the inquiry-only rule exists (the 2026-06-02 manufactured-scarcity ruling),
  and the one thing that is genuinely unmitigated — **there is no per-couple opt-out**.
- **Coverage declared honestly.** `lib/privacy-coverage.ts` is a `Record<PrivacyControlKey, …>`, so
  **typecheck refused the new control until its coverage was declared** — the type system doing its
  job. Declared `declaredIn: []`, i.e. it surfaces as drift on the Coverage tab, because `/privacy`
  and the ROPA genuinely do not cover cross-couple aggregation yet.

### ⚠⚠ The trap this gate had to avoid, and the test that pins it

The obvious implementation is `honestDemand = isExploreReplanEnabled() && approved`. **That is
backwards.** `vendors/page.tsx` uses `honestDemand` to pick between two counting rules, and its
`false` branch is the **raw save-count** — the manufactured-scarcity path the owner banned. Folding
the privacy control into it would have made **withholding DPO approval switch the dark pattern ON.**

So the control gates the **entire block**: not approved ⇒ both output maps stay empty ⇒ no chip, no
lens, no count. The cross-couple read is the same disclosure whichever counting rule is applied, and
it is *worse* under the save-count rule, so one gate covers both.
`lib/same-date-demand-dpo-gate.test.ts` asserts exactly that — including a `doesNotMatch` that fails
if anyone ever folds `demandApproved` into `honestDemand`.

**No visible change in prod today:** the lens already cannot render (it needs ≥3 other couples
inquiring on the same exact date; prod has **0** `chat_threads`). Approving is safe to do now and
safe to defer; the real deadline is before couples start messaging vendors.

Full unit suite green (5434), `tsc --noEmit` clean, migration-timestamp guard passes (989 migrations,
unique prefixes, allocator-sourced).

SPEC IMPACT: `WHATS_NEXT_Explore_Marketplace_2026-07-29.md` §6 decision 3 changes from "documented,
owner-gated" to "**a control on the board**" — the sign-off is now an in-app action with an
`approved_by/at` audit trail rather than a note. Logged in `DECISION_LOG.md`.
