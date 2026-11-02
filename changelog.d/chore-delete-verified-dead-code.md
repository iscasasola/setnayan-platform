## 2026-08-06 · chore(cleanup): delete 13 files proven unreachable, and fix the false premise one of them left behind

Batch 3 of the audit. **Nothing here changes behaviour** — the point is what was
NOT deleted.

### The audit's two biggest deletion claims were wrong

Before removing anything, eight deletion candidates each went to an independent
skeptic instructed to prove the code REACHABLE, with a checklist of the ten ways
code looks dead but is not (dynamic import, barrel re-export, App Router
convention files, server actions reached by symbol from a `<form action>`,
`public/` files served by URL, string-keyed registries, test/CI-only consumers,
cross-app imports, type-only imports, docs naming it load-bearing).

Two came back **DO NOT DELETE**:

- 🚨 **The retired Concierge wizard — ~4,100 lines, the audit's HIGHEST-severity
  deletion — is LIVE CODE.** Reachable through
  `studio/mood-board/page.tsx` → `InspirationBoard`. Deleting it would have
  broken a working screen for couples.
- **30 keynote JSX files** load in no deck — but `CLAUDE-CODE-BRIEF-v2.1_2026-05-28.md`
  §9 names 15 of them by exact path. Dead to the bundler, live as design source.

And the "**57 files, 8,590 lines, zero importers**" claim collapsed under audit:
13 must be kept (3 are read from disk by `readFileSync` in a test, or compiled by
`tsc` for their `@ts-expect-error` assertions — deleting them turns CI red with
no import anywhere), 5 were provably retired, and **39 are un-imported but NOT
proven dead** — parked scaffolding with dates and intent (`route-meta.ts` says in
its own header "additive (nothing imports it yet)"). Un-imported ≠ dead. Those 39
are untouched.

🔑 **The bigger the deletion claim, the less reliable it was.** Both bad ones
carried file counts, line counts and confident language, and would have passed a
casual review. Only trying to *disprove* them caught it.

### What was actually deleted — 13 files, 1,392 lines

Independently re-verified here by grepping every **exported symbol**, not just
the module path (a server action with no path-importer is still alive if its
function name appears in a `<form action>` elsewhere). All came back at zero.

- `lib/checklist-taxonomy.ts` — the 2026-07-26 phantom-column fix landed inside
  it, so that repair changed nothing anyone could see. The live checklist reads
  `lib/checklist-budget.ts`. Four corpus docs already recorded it dead, two weeks
  *before* the fix landed.
- `monogram/actions.ts` + `monogram-maker-shared.ts` — orphaned by `66f6cd2e3`
  (Monogram Maker reduced to Vector Studio + Upload); the live path is
  `upload-actions.ts` / `studio-actions.ts`.
- `app/_components/hero-backdrop.tsx` — sole reader of `NEXT_PUBLIC_HERO_IMAGE_URL`,
  so that variable controlled nothing.
- `lib/camera-bridge/index.ts` — a barrel with no bare directory importers.
- `waitlist/actions.ts` · `admin/wedding-types/actions.ts` ·
  `vendor-dashboard/tax-documents/actions.ts` · `lib/pro-website.ts` — each
  retired by its own shipped code, which says so in prose.
- Four orphaned vendor-token components. **`balance-card.tsx` and
  `buy-tokens-cta.tsx` were KEPT** — the first is rendered via
  `TokenWalletSection`; the second is held alive by two type-only `TokenPack`
  imports and is the sole caller of `startTokenPurchase`.

### The bug a deletion exposed

`subscription/page.tsx` suppressed its own "How to pay" tile for token top-ups,
on the written grounds that `<PendingPurchases>` inside `<TokenWalletSection>`
"already gets its full apply-then-pay panel." **False** —
`token-wallet-section.tsx` imports only `<BalanceCard>`, and `<PendingPurchases>`
had zero importers. **A vendor who ordered a top-up saw no payment instructions
at all**, on the one screen that exists to give them.

Latent rather than live: a top-up is not purchasable today, because the only
caller of `startTokenPurchase` is a component export nothing renders. But the
premise had to go with the component — leaving it would have made the false claim
permanent and unrecoverable by grep. One payment tile now serves every order.

### Verification

- **Baseline: 403 routes · 679 destinations · 514 actions — IDENTICAL before and
  after.** If any deleted file had contributed a reachable destination or a server
  action, those numbers would have dropped. They did not move.
- `tsc --noEmit` exit 0 · all 14 lint scripts pass · **6,629 lib tests pass**
- Zero dangling references: no deleted module name survives anywhere in
  `app/`, `lib/` or `components/` except in explanatory comments.

### Docs corrected in the same change

- `public/hero/README.md` claimed its image was "the live homepage hero" served
  by a component with zero importers, swappable "by overriding the env var" —
  three false claims. Images kept (finished art); the README now says nothing
  renders them and tells the reader to grep before trusting it.
- Two docblocks naming `lib/pro-website.ts`.
- **Spec corpus:** `Adaptive_Checklist_Build_Plan_2026-07-08.md` and
  `Adaptive_Checklist_Event_Type_Definitions_2026-07-08.md` both schedule a
  rewrite *of* `checklist-taxonomy.ts`. Both now say the stub was deleted and the
  PR CREATES the file — otherwise a future session greps the path, finds nothing,
  and rebuilds the concept from scratch.

SPEC IMPACT: Applied — the two Adaptive Checklist build-plan docs above.
