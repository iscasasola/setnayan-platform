## 2026-07-30 · fix(marketing): the two unbacked scarcity claims — one fabricated a number, the other SOLD vendors a dark pattern we deliberately don't build

`WHATS_NEXT_Explore_Marketplace_2026-07-29.md` §5.4 / §6 decision 4. Both live on
public marketing.

**Context that decides the fix.** The owner ruled on 2026-06-02 that demand
*"starts at the inquiry (Stage 2), NEVER at search (Stage 1) … counting it as
competition = manufactured scarcity (a fineable dark pattern)"*. The product
obeys that: `lib/same-date-demand.ts` discriminates on `chat_threads` existence
(a saved-but-never-contacted vendor contributes **zero**), floors at
`MIN_DEMAND_COUPLE_COUNT = 3` ("don't show a '1'"), and `lib/compat-score.ts`
fixes the **one** supported phrasing — *"N couples inquired for your date"*, with
no "only N left" / "booking fast" / "almost gone", because no capacity counter
exists behind any of those. **Verified: the couple-facing count is already
honest** — `honestDemand = isExploreReplanEnabled()`, and that flag is ON in prod,
so the inquiry-only floored path is what renders and the save-count path is dead.

The two marketing surfaces never caught up.

1. **`studio-card-demo.tsx`** showed a chip phrased around the *browsing* act with
   a number nothing produced. Now reads **"3 couples inquired for your date"** —
   the app's own sentence, and 3 is the smallest number the shipped signal can
   honestly display, so the mock is accurate rather than merely vaguer.
2. **`vendor-grow-sections.tsx`** — worse, because it was a **promise to
   vendors**. Step 2 of the Setnayan AI ladder read: *"When a new couple **eyes** a
   date you're already shortlisted for, we tell your client that schedule is in
   demand — **so they move**."* Two falsehoods in one sentence: "eyes" is the
   Stage-1 save the ruling forbids counting, and "so they move" sells engineered
   urgency. It advertised a feature we **deliberately do not build**. Rewritten to
   what ships: *"Real demand, stated plainly — When other couples actually inquire
   with you for the same date, your client sees that count — the measured fact,
   nothing dressed up. It takes at least three, so one enquiry never becomes
   pressure."*

**Guard:** the retired wording is now an entry in `.retired-strings.json`, so the
existing CI lint fails any PR that reintroduces it in `apps/web/app/**`.
`plan-budget-accordion.tsx` is the one `allow_paths` exception — it is the
pre-takeover accordion on the flag-OFF path, where the number genuinely *is* the
raw save-count, and the flag-OFF render must stay byte-identical.

`lint-retired-strings` passes (1,938 files), full unit suite green, `tsc` clean.

SPEC IMPACT: None on decisions — enforces the 2026-06-02 ruling on two surfaces
that had drifted from it. Closes §5.4 and §6 decision 4; logged in
`DECISION_LOG.md`.
