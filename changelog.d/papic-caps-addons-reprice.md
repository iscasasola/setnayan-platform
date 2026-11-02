# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-11 · feat(papic): split capture caps + free-tier bump + Photo Wall / Camera Bridge reprice

Owner-set 2026-07-11 pricing pass on Papic (WS1 of the Papic pricing/storage/face build plan). Pure reprices — no new tables, no behavioral change to the buy engine or gates.

- **Per-tier CAPTURE caps split** — `events.papic_ltd_cap_php` default 6000 → **5999** (₱5,999) and `papic_unli_cap_php` default 10000 → **11999** (₱11,999), replacing the spec-only flat ₱15,000 that never reached these columns. Migration `20270715898850` moves the column defaults and resets any row still on a known policy value (6000 / 10000 / 15000), preserving any genuinely custom per-event cap. Code fallbacks (`PAPIC_LTD_CAP_FALLBACK_PHP` / `PAPIC_UNLI_CAP_FALLBACK_PHP` in `lib/papic-cameras.ts`, plus the inline `|| 6000` / `|| 10000` in `studio/papic/page.tsx`) moved to 5999 / 11999 to match. The clamping engine + its unit test are unchanged (the test passes explicit caps, independent of policy defaults).
- **Free-tier allowance** — `PAPIC_TIER_QUOTA.free` 5 photos + 1 video → **10 photos + 3 videos** per free camera (owner: fatter free taste). First-5-cameras-free count unchanged. Home + pricing copy updated to match.
- **Live Photo Wall** (`LIVE_WALL`) `retail_price_php` 2499 → **2500**; **Camera Bridge** (`CAMERA_BRIDGE`) 499 → **500** — round-up (deviates from the -1 charm ladder for these two SKUs, owner-chosen). Cleans the PAPIC_UNLOCK all-in sums to ₱14,999→₱15,000 / ₱8,999→₱9,000.

SPEC IMPACT: Applied in corpus — `Pricing.md § 2.1` (caps banner + SKU rows + storage note), `DECISION_LOG.md` 2026-07-10/11 rows, and `0012_papic/Papic_Pricing_Storage_Face_Build_Plan_2026-07-11.md`. This PR is WS1 of that plan.
