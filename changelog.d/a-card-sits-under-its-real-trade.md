## 2026-09-15 · fix(shop): a card shows its cover photo and sits under its real trade

SUP-12 + SUP-14, both measured on the one published shop before either was sized.

### SUP-14 — cards filed under "OTHER"

The live page listed "Services offered: **Live Band · Host / MC**" and then, two
sections lower, put both priced cards under a heading reading **OTHER**. Both
rows carry real trades in the database (`live_band`, `host_mc`).

🔑 THE PAGE WAS NOT MIS-FILING THEM — IT WAS FAILING SAFE. Two vocabularies:
`vendor_services.category` is TEXT holding a coverage LEAF (`live_band`) or a
tier-2 TILE id (`host_mc`); `serviceGroupOf` speaks coarse `VENDOR_CATEGORIES`
(`band_dj`, `host_emcee`). Measured: `isCanonicalService('live_band')` is false
and `serviceGroupOf('live_band')` returns **undefined**, which matches no
SERVICE_GROUPS key. The old ternary's `: 'other'` was the only thing stopping
both cards DISAPPEARING — which is exactly what this row's wording warns about.

The translator already existed: `eventVendorCategoryForCardKind`, built
2026-09-09 for this mismatch, pure, and asserted against the live enum by a db
test. Nothing new is mapped. Measured through to the heading — live_band →
band_dj → "Media & entertainment", host_mc → host_emcee → the same, photographer
unchanged, and anything unknown → misc → "Other", so every card still lands.

### SUP-12 — the cover photo that was already uploaded

The "Live Band" card has a real `primary_photo_r2_key`; the public page drew no
picture. Its sibling has none, which makes the pair the honest test.

🔑 A ONE-ARGUMENT OMISSION. The fallback shipped 2026-09-11 inside
`toServiceCard` — "no showcase photos → fall back to the card's own cover" — and
takes the cover as an ALREADY-RESOLVED URL because that function is pure. Its own
docblock names the callers that do not pass it and lists this page among them.
So the card was wired, the fallback was tested, and this page stopped one
argument short. Added the presign (fail-soft, per service, parallel — the
showcase resolver's own shape) and passed it.

⚠ HALF THIS ROW WAS ALREADY DONE. It asks for the cover on the shop page AND in
the supplier's own card list; `services-manager.tsx` has been resolving and
rendering it all along. Only the public page was missing it — so there is no
overlap with the lane that owns the supplier dashboard.

SPEC IMPACT: None. Both are joins between parts that already shipped.
