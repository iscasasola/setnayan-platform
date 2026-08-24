## 2026-08-24 · change(vendor): a kit piece nothing uses is a gate with no handle

W4-B, PR 6 (last of the port wave). Two ends tied off:

- `ShopNotice` earned its keep: the 20 tinted notice bands (10 success
  confirmations, 10 gold info/alert bands across booking fees, verify,
  repertoire, disputes, recommendations, attributes, invite, the stylist
  library and team) render through it, with their `role="status"`/`"alert"`
  semantics carried as a typed prop.
- `ShopStat` is DELETED from the kit before anything shipped it. The tree's
  stat blocks differ in structure, not spelling — converging them is a
  redesign, not an extraction, and a kit export with zero consumers is a
  gate with no handle (this repo has shipped five). The kit now documents
  that rule where the component would have been: add a stat tile only
  together with its first two real consumers.

Typecheck ✅ · kit-convergence + reads-are-honest ✅ ·
lint-port-no-lost-controls ✅ 404 routes · label-on-fill contrast ✅.

SPEC IMPACT: None.
