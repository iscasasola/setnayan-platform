## 2026-07-21 · fix(papic): wave 0 — stop selling a shelved product and crediting ₱107,000 of fake savings

Four corrections from `Papic_Website_Strategy_Council_Verdict_2026-07-20.md` § 2. None needs an owner
decision, a DPO ruling, or engineering judgement — each is a deletion, a rename, or an
`is_active = false`.

**1 · `CAMERA_BRIDGE` was purchasable at ₱500 — for a feature shelved 2026-07-17.**

Titled *"unlocks DSLR for ALL Papic cameras"*, and the premise does not hold: the connectivity
research found Fujifilm's SDK **does not exist**, Canon's *"EOS Camera Connect SDK"* is **fictional**
(the real thing is CCAPI, ~25 bodies, 5D IV / 6D II permanently absent), Nikon and Sony unverified,
Panasonic and DJI impossible. What actually works is GoPro, Insta360 and Ricoh THETA — **action cams,
not the DSLRs a wedding photographer brings.**

**A purchasable false promise is the most expensive kind of fake door**, which is why this is a
deactivation rather than a copy edit. The row is kept for lineage — one historical paid order (June
2026) references it. No refund is implied; that is an owner decision.

**2 · The onboarding credited ₱107,000 of savings on two products nobody can buy.**

`onboarding-pricing.ts` fell back to `set: 0` for a missing or inactive SKU **while keeping its
`OUT_ANCHORS` compare-at price.** With `PAPIC_SEATS` (₱75,000 anchor) and `PAPIC_GUEST` (₱32,000) both
inactive, the couple saw two products rendered **free**, crediting **₱107,000 of savings**, for things
that cannot be purchased at any price.

`out` is now zeroed alongside `set`. **A ₱0 price beside a ₱75,000 anchor is the worst possible
pairing — silence is honest, a fake bargain is not.**

**3 · "Photo Challenges" was advertised with zero machinery.**

`app/[slug]/page.tsx:3152` and `:4178` promised it on a live guest surface. A repo-wide search returns
**no game tables and no components**. Claim removed from both. *(The feature is specced in
`Papic_Games_and_Vendor_Missions_Spec_2026-07-21.md` — re-add the copy when it ships, not before.)*

**4 · `/papic` sold two SKUs that no longer exist under those names.**

The purchase FAQ — which backs the **FAQPage schema**, so it is indexed — and the "Two ways to run it"
cards named *"Papic 5 Seats"* (`is_active = false`) and *"Papic Guest"* (renamed to **Papic One** by
migration `20270828140000`). Both now name shipped products: **Papic Mini / Papic Max** for dedicated
cameras, **Papic One** for every-guest capture.

### ⚠ Deliberately NOT fixed: the permanence copy

The council flagged *"kept forever"* / *"Saved Forever"* / *"for life"* across `app/page.tsx:40,41`,
`layout.tsx`, `HomeReskin.tsx:602`, `[slug]/page.tsx:4226` and others as banned.

**That flag is superseded.** It was raised when retention was to be 5 years; the owner has since
decided (2026-07-21) that the **compressed gallery is kept forever** — originals to `event + 60d`,
gallery indefinitely — which honours the 2026-06-23 *"pay to create, free to keep… KEPT FREE FOR
LIFE"* lock, and matches the code (no gallery expiry exists).

**So the copy is now true for the gallery and must not be deleted.** What remains is a genuine
conflict between that decision and `Data_Retention_Schedule_2026-07-11.md`, which sets media at 5
years and states indefinite retention *"is itself a violation."* **That is a DPO/owner reconciliation,
not a copy sweep** — deleting the copy here would have contradicted a decision made hours earlier.

⏳ Migration needs `supabase db push`.

SPEC IMPACT: `Papic_Website_Strategy_Council_Verdict_2026-07-20.md` § 2 — four wave-0 items closed;
the permanence item is re-classified as a DPO conflict rather than a copy defect.
