## 2026-11-24 · feat(for-suppliers): "390+ tools and templates, ready to use."

Owner, 23 Nov: "put 390+ tools and templates on /for-suppliers". The line opens the page's "Your tools" section, under its head and above the lede. The words come from one spelling, `TOOLKIT_CLAIM` in the new `lib/supplier-toolkit-count.ts`. They never say "free", because Cake Maker, Song bank, Papic challenge and 3D plan are on a plan.

The figure is held by the new `app/for-suppliers/the-toolkit-claim-is-true.test.ts`. It recounts what the code ships and fails when the total drops under `TOOLKIT_CLAIM_FLOOR`. Today the code ships 391:

| Item | Count |
|---|---|
| Starting card templates (`service_included_templates` seed) | 321 |
| Payment splits | 5 |
| `SPECIALIZED_TOOLS` | 11 |
| `CARD_ORDER` graphs | 17 |
| Badge families | 5 |
| QR modes | 6 |
| Print designs | 15 |
| Print pieces | 7 |
| Pickable availability styles | 4 |

This matches the census in specs `prototypes/toolkit_templates_2026-11-23/`. Scanner modes, quick replies, status presets and table shapes are left out.

SPEC IMPACT: The /for-suppliers copy gains one line, "390+ tools and templates, ready to use." (owner ruling 23 Nov). Controller to log the DECISION_LOG row.
