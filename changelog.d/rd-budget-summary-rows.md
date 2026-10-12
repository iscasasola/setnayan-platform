## 2026-10-08 · feat(budget): the summary is rows — Target in place, one meter, one Next line (Budget B1)

Plan row **B1** of `BUDGET_PAGE_2026-10-08_fable.md`, built from `prototypes/budget_page_2026-10-08_fable.html` (owner-approved: "budget looks good!"). Stacked on B0 (`rd/budget-read-is-honest`).

**What a couple sees.** The top of the Budget page is now four figures two by two — **Target · Agreed · Paid · Owed** — with no box and no tile, one 6 px meter (green paid · gold agreed · track target · a red tail when agreed runs past the target), a legend with "₱X left of target" / "₱X over target", and ONE line: **Next ₱528,000 · Seda Vertis North · Oct 5 · Pay ›**. Tap the Target number, type, and it saves (debounced `setEventBudget`, the same action as before); "saved" flashes, and a refused save says "not saved".

**Removed** (the plan row's list): the "What's your total wedding budget?" form and its "Update my budget" button (`budget-setter.tsx`), the boxed four-stat tile with its eyebrow and sub-lines, the live card (`budget-live-summary.tsx`: progress %, "Next payments" list, Live/Syncing chip) and its pinned bar (`budget-summary-ids.ts`), every `font-mono` under `budget/`, and the word "wedding" in the page's copy.

**How**

- `budget/_components/budget-summary.tsx` (client) + `budget-page.module.css` — class names follow the prototype's; tokens are the shipped ones. Help sits behind the shipped `InfoTip` (the contract's "new InfoHint" was not needed — `InfoTip` is on main). Figures count to their value through the shipped `Count`; the meter grows through `Fill` (button rule 2 and 3). A figure with centavos is printed exact and still.
- `lib/budget-page-view.ts` — `pickNextPayment(lines)` (earliest dated AGREED line with money still owed — never an un-booked supplier's quote), `budgetMeter()`, `shortDate()`. Pure; 11 tests.
- **One writer.** A Realtime payment / line-item change now re-runs the page's own render (`router.refresh()`), so `getBudgetLiveSummary` — the second writer of the old card — is deleted. Exported server actions **1199 → 1198**.
- **A refused read reaches the pixels.** When the resolver ran and a source failed (`EventMoney.reads`, B0), Agreed · Paid · Owed draw "—" and the meter draws no bar. Never a legacy figure, never ₱0. (The designed "₱994,400+" / "part of this couldn't load" wording is plan row B3.)
- `/dev/budget-lab` — the real summary over the prototype's figures computed by the real resolver core; 404s in production.

**Guards**

- `budget/money-wears-the-ledger-face.test.ts` REWRITTEN, not deleted (it pinned the opposite — Space Mono — since 2026-08-25): no monospace anywhere under `budget/`; every scanned money figure is tabular (`tabular-nums` / `styles.num` / `<Peso>`), prose billed in both directions; nothing a person reads says "wedding"; the setter form, the boxed tile and the pinned bar do not come back.
- `budget/the-skeleton-matches-the-page.test.ts` — its stale `<SummaryStat>` count now counts `data-budget-cell` out of the summary component; `loading.tsx` docblock rewritten (still `stats={4}`).
- `lib/budget-one-core.test.ts` / `lib/flag-chokepoint-scan.test.ts` — `budget/actions.ts` left both registries because the action it listed is deleted; a new test holds that no server action recomputes the summary.
- `lib/budget-read-is-honest.test.ts` +2 — the page hands the summary unknown figures on a refused read, and an unknown figure prints "—".
- Regenerated on this tree: `port-control-baseline.json`, `ugat/screens.generated.json`, `ugat/baselines/no-door.baseline.txt` (+`/dev/budget-lab`, a lab has no door by design), `one-comment-stripper.baseline.txt` (−2: both rewritten guards now use `lib/strip-comments`).

**Not in this PR, stated:** the page still opens with the "Budget" masthead and its three export links (they move in plan row B4, with the "‹ Budget · event kind" title row); the per-supplier cards below still use the shared `vendor-itemization-card.tsx` (also the supplier workspace's — it leaves this page in B2); "Pay ›" jumps to the per-supplier section until B2 gives it the payments sheet.

SPEC IMPACT: None — implements `BUDGET_PAGE_2026-10-08_fable.md` §5 row B1 as written.
