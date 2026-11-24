# /for-suppliers follow-up: Now and Proposed (live 179fc0e, read-only)

**Now** is live as served. **Proposed** is this PR's exact CSS and markup applied to the live page inside my own browser tab, then shot. It is a preview of the change on real data, NOT a local build. Nothing was saved to setnayan.com. Each Proposed shot also has a measurement taken in the same tab.

| Fix | Now | Proposed | Measured |
|---|---|---|---|
| 4 · Analytics window switch, desktop Shop | `4-analytics-switch-1280-now.jpg`: "12 months" runs past each card and the next card cuts it off | `4-analytics-switch-1280-proposed.jpg`: "Month · Year" fills the row | Switch overflow past the card's inner edge: 0 px on all 6 cards measured (Now: the "12 months" text ran past its card, and the carousel edge clipped it). At 390 the card is 340 wide and keeps "30 days · 12 months" plus the figure (`.ag-wl` shown, `.ag-ws` hidden). |
| 6 · Paid widget price line, Toolkit | `6-price-meta-390-now.jpg`, `6-price-meta-1280-now.jpg`: 4 short lines beside Buy | `6-price-meta-390-proposed.jpg`, `6-price-meta-1280-proposed.jpg`: under the title | 4 lines → 2 lines on every paid tile, at 390 and 1280; never clamped. |
| 3 · "Most of them free." over two Paid tiles | `3-tools-lede-390-now.jpg` | `3-tools-lede-390-proposed.jpg`: no lede; the Toolkit count line stays | n/a |

Fixes 1 and 2 are not visual. The proof is text from live (prices left out of this file on purpose):
- **1 · Get verified:** live serves `<a … href="/open-shop">Get verified`. This PR makes it `/open-shop?plan=verified`; after the shop opens it lands on `/vendor-dashboard/profile#docs` (`VERIFY_PAPERS_PATH`, the same place as `VERIFY_DOCS_HREF`). Guard: `lib/get-verified-carries-the-choice.test.ts`.
- **2 · og:description:** live serves "… Plus ₱… / month · Pro ₱… / month." while twitter names Plus, Pro AND Ultra. This PR builds og from the same `all` list. Guard: `lib/for-suppliers-previews-name-every-plan.test.ts`.

Seen while shooting, not in scope:
- `/for-suppliers` now says "53 in the Toolkit: 19 tools · 29 graphs · 5 badges". The supplier Toolkit says "12 widgets · 4 QR designs · 29 graphs · 6 badges". That is fix 5 (one list), held for #8255.
- Desktop Shop › Your bundles and services: a service card's title wraps a few letters a line ("Mob ile bar by Setna prod"), squeezed by its photo.
- 390 Shop: the "View shop" button truncates to "View sh…" beside Toolkit · Share · Promote.
