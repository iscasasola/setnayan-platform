## 2026-08-24 · change(vendor): one way to say "nothing yet"

W4-B, PR 5. The supplier tree said "nothing here" in 8 competing dashed
spellings. Fifteen true empty states now render through the kit's
`ShopEmpty`: eleven standalone panels (messages, bookings, payday, recaps,
disputes, recommendations, locked QRs, customers, both "No event today"
explainers, the customer card's files tab) and four inline/list empties —
the three identical `<li>` list empties (shot list, issues log, requests
inbox) keep their element and compose the exported `shopEmptyInlineClass`.

Two real fixes ride along: the three list empties wore `text-ink/45`, which
measures 2.62:1 on white — a hard AA fail — and now wear the kit's ink/60;
and both local `StatusBadge` components (locked QRs, editorial media) are
retired onto `ShopPill`, replacing per-file rgba()/`--m-*` inline styles and
one raw `red-100/red-900` (not a brand token) with the kit's tone map.

Drop zones, seat-plan geometry, document placeholders and the warn-toned
notice keep their dashed borders — a dashed border is not always an empty
state, and converting those would change what they mean.

Typecheck ✅ · kit-convergence + reads-are-honest ✅ ·
lint-port-no-lost-controls ✅ 404 routes · label-on-fill contrast ✅ ·
guest legibility ✅.

SPEC IMPACT: None.
