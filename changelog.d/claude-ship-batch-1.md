## 2026-11-25 · Ship batch 1: final-check fixes a7-b1 (#8307), a2-b1 (#8309), a6-b1 (#8311)

The GitHub Controller lands three final-check lane-A fixer batches together (no overlapping files), with the baselines regenerated once at landing (screens map, port-control). One Ship fix: the two new "couldn't read" states in a2-b1 (contract detail, sponsors) use the shared `BackButton` instead of a hand-drawn back link, so the design-rules ratchet does not go up.

SPEC IMPACT: None.
