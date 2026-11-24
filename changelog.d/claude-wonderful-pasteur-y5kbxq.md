## 2026-11-23 · docs(design): DESIGN.md pointer + the Part I "no generic AI look" audit

- `DESIGN.md` (repo root): the five HOUSE_DESIGN_STANDARD Part I rules, one line each, pointing at the corpus standard, which wins on any conflict. `CLAUDE.md` §3 gains one line pointing to it.
- `audits/part-i-2026-11-23.md`: a read-only sweep of `apps/web` against Part I, by area (supplier → couple and guest → admin), each break with file:line, rule, what it is and a one-line fix; the shared tokens and components to change once (card radius 14 → 12, frame shadow → hairline, the header band and ambient gradients, the icon-tile pieces, `KpiStatCard`, `BADGE_CLASS`, `.input-field`, a body-level `tabular-nums`) with usage counts; and ten suggested builder rounds, smallest blast radius first.
- No UI code, no migrations, no baselines touched.

SPEC IMPACT: None. The audit lists four places in `HOUSE_DESIGN_STANDARD_2026-11-20.md` (B3 band, C4 soft-lift bullet, §12 "superseded", H1/H3/H4 radius 14) that still read the pre-Part I values, for the controller to correct in the corpus.
