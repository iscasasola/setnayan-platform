## 2026-11-14 · fix(admin): main builds green again — Work's queue drawer back under the template ratchet (32 → 22)

`origin/main` went red on `lib/template-score-ratchet.test.ts` (`admin/queues: 28 → 32`) once the request cards (#7697)
and the tightened ratchet (#7704) met. Every Work peek item now carries its request card, so the drawer's old raw row —
a `<select>` and eight hex colour fallbacks — was never drawn; it is removed, and an item without a card falls back to a
plain line to its page. `admin/queues` scores 22; the baseline is LOWERED 28 → 22 and the field-template baseline locks
`queue-drawer.tsx` 1 → 0. No baseline is raised.

SPEC IMPACT: None.
