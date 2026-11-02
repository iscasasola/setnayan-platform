## 2026-08-24 · fix(vendor): gold is not body copy — 152 supplier text sites reach AA

W4-B, PR 4. The supplier tree carried 213 bare gold (`text-terracotta`,
#A9834B, 3.37:1 on white — an AA fail for text) sites. Measured and split:
68 colour ICONS, which legally clear the 3:1 non-text bar and are KEPT gold;
the other ~150 were words a supplier reads — links spelled
`text-terracotta underline`, status pills, labels, required markers. Fixed by
the doors-PR rule set, applied once per shape rather than re-argued per file:

- links and actions (underline / "Open →") → `text-mulberry` (4.61:1) — 49 sites
- gold-identity text on gold tints (pills, badges) → `text-terracotta-700`
  (the dark text-gold) — 33 sites
- plain gold labels/markers → `text-terracotta-700` — ~70 sites
- checkbox/radio accent colour and icon-sized elements reverted to decorative
  gold after review (a control's check mark is UI, not text) — 19 sites
- one hover state that went LIGHTER than its rest colour corrected to
  `text-terracotta-800`

Zero destinations or actions moved — lint-port-no-lost-controls ✅ 404
routes. Typecheck ✅ · reads-are-honest ✅ · label-on-fill contrast ✅ 1363
pairings · guest legibility ✅.

SPEC IMPACT: None.
