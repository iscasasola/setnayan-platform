## 2026-08-26 · fix(papic): Papic is ONE service — the retired "Papic Pool / Papic One" names leave what customers read

Owner, 2026-08-11 and again 2026-08-26 after finding them still on screen:

> *"we do not have papic one or papic pool. no 2 ways of papic service. just 1. papic pool will be our papic service. this was documented before already."*

He was right that it was documented. **The database had honoured it and the code had not** — every legacy tier row is deactivated and renamed in prod, while the app still said the old names in four places, including the public pricing page.

🔑 **GIVING ONE CAMERA ITS OWN SHOTS IS A FEATURE, NOT A SECOND PRODUCT.** Owner: *"they just alot some photos for a specific Papic. so for example they get 3000 photos. and then they can assign the 500 photos to 1 papic. we already did this before."* Correct — `setCameraShots` writes the allocation and `papic_reserve_capture_split` spends the camera's own shots first, then lets the pot pay the remainder, under one row lock. **Dedicated shots are a FLOOR, never a ceiling.** So a page may describe that freely; what it may not do is offer it as an *alternative* to Papic.

**⚠ AND THE FIRST DIAGNOSIS OVERSTATED IT — corrected by reading the live page instead of the source.** The pricing estimator's two-way switch **has not rendered for some time**: it draws only when both catalog rungs are active, and the dedicated-camera rung is `is_active = false` in production. What visitors actually saw was one credit ladder under a headline promising two products. So this is a **wording fix, not pricing surgery** — no price moves.

**What changed**

- **`/pricing` estimator** — headline *"Estimate your Papic — dedicated cameras **or** a shared pool"* → *"one pot of shots for the whole celebration"*. **The `or` was the bug.** The pool paragraph now says it in the owner's own terms, including that you can set some aside for a particular camera later and take back what they don't use.
- **The dead two-way switch and the whole flat-per-camera branch are DELETED**, with the `Mode` type, its state, the camera stepper and the three now-dead `EstimatorRates` fields (`one`, `freeCameras`, `freeCameraCapacity`). Not because it rendered — because it was one catalog flip away from offering a fork the owner has ruled does not exist.
- **The couple's shared gallery card**: *"Shared pool gallery"* → *"Shared gallery"*, *"your Papic pool"* → *"your Papic library"*.
- **The couple's photo review page**: *"once Papic Pool is on for this wedding"* → *"once Papic is on for this celebration"*. Its comment cited the **superseded** 2026-07-30 lock naming two products; that citation is what kept the string alive.
- **`lib/papic-tier-copy.ts`** — the display title said `'Papic One'` under a comment claiming it *"mirrors the live `papic_tier_config.display_title`"*. **It did not**: the live row reads `'Dedicated camera (legacy)'`, inactive. 🔑 **A claim to mirror something is not a mirror.** Retitled **'A camera with its own shots'** — feature framing, and deliberately NOT the DB string, because this title can reach a public card and *"legacy"* is an operator's word, not a selling one.
- **The Ugat architecture map** carried a `NAMING LOCK: the two product types are Papic Pool and Papic One` plus two schema notes repeating it. Corrected. ⚠ Prose only — **no `claims` entry was touched**, so the schema-claim db-test is unaffected.

**🛡 Guard: `lib/papic-is-one-service.test.ts` — a CENSUS, not an allow-list.** It walks every non-test `.ts`/`.tsx` under `app/` and `lib/` (asserting the walk found >500 files, or a guard over nothing always passes) and fails on any `Papic Pool` / `Papic One` in code after comments are stripped. Log lines are exempt — an operator reading a server log is not a customer. A hand-written file list would have missed exactly the sentences that survived here. **It immediately found three more hits nobody had named**, in the architecture map.

🪤 **The guard was wrong twice before it was right, and both failures are recorded in it:**
- Its stripper **blanked newlines inside block comments**, so every line number it reported was wrong — it accused lines 1354/1376 for hits that really sat at 1658/1680. **A guard that reports the wrong location sends the next reader to innocent code.**
- Its stripper self-test used `'Papic Pool'` as the canary — a phrase that legitimately lives in this file's own ban list, so the test could never pass. The canary is now built by concatenation so the whole literal exists only in prose.

**Mutation results**, counts printed before → after: retired name back in rendered copy (0→1) 🔴 · the two-product switch returns 🔴 · the census sweeps zero files 🔴. Green on both clean sides.

**SPEC IMPACT:** None — this restores an existing owner lock (2026-08-11) that the code had drifted from.

---

🚨 **AND THE TEST GUARDING THAT TITLE MADE THE SAME FALSE CLAIM, ONE LEVEL UP.**

`papic-copy-guardrails.test.ts` pins the fallback tier table to the migration seed byte-for-byte, then hand-applies one post-seed rename for the `mini` row — setting `'Papic One'` under a comment reading *"the fallback mirrors the **LIVE** display title"*.

**It has never read the database.** Measured 2026-08-26, there are **three different values for that one row**:

| where | value |
|---|---|
| migration seed | `Papic Mini` |
| code fallback | `Papic One` |
| **live production** | **`Dedicated camera (legacy)`**, `is_active = false` |

…and a comment asserting they agreed. 🔑 **A claim to mirror something is not a mirror** — that is the second instance of this exact shape in this one change, and it is what let a retired name survive two owner rulings.

The override is now `'A camera with its own shots'` and its comment says plainly that it is **hand-typed product copy, not a mirror**, records all three real values, and states why it is deliberately not the live DB string (that title can reach a public card; *"legacy"* is an operator's word). ⛔ **Every other field still pins byte-for-byte to the seed** — points, rate SKU, seats, cap and sort order are economics and must never drift.
