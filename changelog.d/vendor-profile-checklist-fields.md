## 2026-07-02 · feat(vendors): relabel Business Profile checklist + require Logo

Owner-driven relabel of the vendor "Manage your shop" → Business Profile
completion checklist (the card that gates publication), plus **Logo is now a
required field** (was collected but not gated).

**New required set (9 items, was 8):**

| Was | Now |
|---|---|
| — | **Logo** (➕ now required; the upload field already existed) |
| Business name | **Shop name** |
| Business owner | Business owner *(kept, per owner)* |
| Maps pin | **Company address** |
| Contact number | Contact number |
| Business email | **Company email** |
| Services covered | Services covered *(kept, per owner)* |
| Year started | **EST** |
| Updated business documents | **Documents needed** |

- **Single source of truth for the labels** — extracted `BUSINESS_PROFILE_LABELS`
  in `lib/vendor-profile.ts` and imported it into the save-time publish gate in
  `app/vendor-dashboard/actions.ts`. The two surfaces previously hard-coded the
  same strings independently and drifted on every rename; they now can't.
- **`Company address` completion relaxed to address-text-only** — it required a
  resolved lat/lng before, which the publish gate never did (the Nominatim
  geocode runs asynchronously *after* save and can be null on a fresh address).
  The card and the gate now agree; the distance chip still renders once the
  geocode resolves.
- Edit-form field labels renamed to match, and the four newly-gated fields
  (Logo, Company address, Company email, Contact number) show the required `*`.
- Purely additive to the publish gate (Logo now blocks publish until uploaded).
  No schema change, no migration — all nine items map to existing columns /
  the existing verification-docs flow.

SPEC IMPACT: Vendor Business Profile required-field set (iterations 0022 vendor
dashboard / 0025 profile settings) grows 8 → 9 with Logo now gating publication,
five items relabelled, and the address item's completion loosened to text-only.
Business owner + Services covered kept required (owner confirmed in-session).
DECISION_LOG row appended in the spec corpus.
