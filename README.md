# Shots — supplier website by plan (`/v/[slug]`), 2026-10-30

NOT FOR MERGING. Side-by-side proof for the slice PRs: left = the approved prototype
(`Setnayan-specs/prototypes/build-contracts-2026-10-30/supplier-website-by-plan/index.html`, `#plan=…&marks=0&vp=…`),
right = the built pieces on a local dev server through the repo's dev labs (no database).

| Slice | Files | Lab |
|---|---|---|
| 2 · since line, events by kind, Check a date | `s2-facts-*`, `s2-events-sheet-*` | `/dev/shop-page-lab` |
| 3 · reach by plan, own address, pinned review | `s3-{free,verified,solo,pro,ultra}-*` | `/dev/shop-plan-lab?plan=…` |
| 4 · card column beside the page, full width | `s4-layout-*` (Verified), `s4-layout-free-*` (Free) | `/dev/shop-layout-lab` |

Widths: 390 · 820 · 1280. The sandbox that took these blocks openstreetmap.org, so the maps show no streets
(the shipped pin map is an empty frame; `ReachMap` shows its ring and pin on a plain ground).
