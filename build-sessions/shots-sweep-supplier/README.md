# Supplier sweep — 390 px shots (16 Nov 2026)

Taken from the `/dev` labs on `next dev` (no sign-in, no database), 390 × 844 at 2×, by `shots.cjs` here.

⚠ **The 16 Nov values are injected for these shots**: `--sn-page-bg: 247 245 244` (#F7F5F4) and
`--sn-frame-shadow: var(--m-shadow-md)`. This branch is cut from the token map (#7733), where the page is
still white and the frame shadow is `none`; the sibling PR (`claude/clean-look-tokens`) sets those values.
The Next dev "Issues" badge (dummy-database fetch errors) is hidden.

| Shot | Lab URL | What moved |
|---|---|---|
| 01-shop-tab-makers | `/dev/supplier-lab?s=shop-tab` | Maker tiles read the frame token |
| 02-offers-rows | `/dev/offer-maker-lab` | offer rows read the frame token |
| 03-hub-post-an-update-sheet | `/dev/supplier-lab?s=hub&ev=ic` (Post an update) | Cancel · Post are `ActionButton` |
| 04-your-page-verify | `/dev/supplier-lab?s=page` | the verify card reads the frame token |
| 05-portfolio-tab | `/dev/supplier-lab?s=portfolio-tab` | the shop page on the new page colour |

Scan: `node build-sessions/shots-sweep-supplier/scan.mjs apps/web` (from the repo root).
