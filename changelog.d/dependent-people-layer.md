## 2026-07-12 · feat(family-graph): dependent People layer — foundation (Phase 3 · COUNSEL-GATED · flag-off)

The first piece of the family graph (owner "open the whole family graph"). The guardian-held dependent records — a child (<18) or elder (>50) whose birthdate/sex/religion the owner stores to derive their milestones (1st · 7th · debut · 60th) and rites.

**⚠ COUNSEL-GATED, flag-off.** This is the most sensitive data the platform holds (a CHILD's birthdate + religion + sex — RA 10173 minors + §3(l)). The SCHEMA lands, but ALL writes are gated behind `dependentPeopleEnabled()` (`NEXT_PUBLIC_DEPENDENT_PEOPLE`, default OFF) — so the table stays EMPTY in production until the DPO/counsel batched review (G1) clears it and the owner flips the flag. Merging this stores no data.

- **Migration `20270801985629`** — `dependents` (owner_user_id · name · birth_date · sex · religion · relationship · per-field `*_consent_at` · `handed_over_at`/`claimed_user_id` for age-out). RLS Pattern A: readable/writable ONLY by the owning guardian (or admin) — never exposed to any other user. CHECK'd value sets.
- **`lib/dependent-people.ts`** — the pure age-fence + age-out logic (the load-bearing safety): `fenceBand`/`isFenceEligible` (`<18` child · `>50` elder · 18–50 **blocked** → invite, never register), `handOverAge` (18 F / 21 M), `shouldHandOver`, milestone derivation. 7 unit tests (incl. the exact 18/50/51 boundaries).
- **`lib/dependent-people-flag.ts`** — the counsel gate, default OFF (mirrors `personLifeStoriesEnabled`).

Age fence enforced in CODE (a DB CHECK can't reference now()); re-checked on every write. Next: the People capture UI + faith rites + godparents + e-gifts + household — all behind the same flag.

SPEC IMPACT: implements the master plan's Phase-3 PR-D foundation (dependent People layer + <18/>50 fence), flag-off pending G1.
