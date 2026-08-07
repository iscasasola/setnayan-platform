## 2026-08-07 · docs: the verified register lands in the monorepo

**SPEC IMPACT:** None (documentation). Mirrors
`WHAT_IS_LEFT_2026-08-05.md` from the spec corpus.

Owner is compiling the remaining work and continuing on a **different account**.
`~/.claude/.../memory/` does not travel, and the spec corpus is a second repo a
fresh session may not have — so everything needed to continue is copied into the
monorepo, duplication accepted on purpose.

`WHAT_IS_LEFT.md` carries:

- **The register** — 87 claims verified against shipped code and the live prod
  database, never against the document that made the claim, then attacked by a
  refute pass. **58 survived**, in 9 groups, **15 needing the owner rather than
  engineering.**
- **Owner decisions already made**, so a fresh session does not re-ask them —
  photo retention (5 years), livestream delivery (a watch link, said plainly
  before purchase), the three 3D venue looks, restaurants as venues, venue room
  sizes, and the permanent-event-name lock. Plus one decision made FOR the owner
  and flagged in code (`destination` → the beach shell) that he has not been asked.
- **How to verify anything** — the five prod test accounts, and the two traps
  that make a test lie: the owner account passes every SKU gate (`is_internal`),
  and the marketplace is empty because both vendors are `hidden`, which is a
  setting rather than a bug.
- **The environment traps** that have each cost real time — CI running in UTC,
  `schema_migrations` lying, a migration below the applied head creating nothing,
  `npm run build` being impossible locally.
- 🔴 **An honest account of four times this session stated something untrue** and
  was corrected by a one-word question from the owner: an unverified list handed
  over as fact, a sweep with a false positive, "payments and tax were never
  looked at" (both shipped), and a feature declared complete that had a reader
  with no caller and then an action with no form.

`CLAUDE.md` (auto-loaded every session) and `HANDOFF.md` (which is from May and
predates most of the product) both point at it.
