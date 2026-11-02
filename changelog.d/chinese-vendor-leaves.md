## 2026-06-28 · feat(taxonomy): Chinese specialist vendor leaves

Added 5 net-new Chinese (Tsinoy) specialist vendor leaves so couples with
`ceremony_type='chinese'` (or `secondary_ceremony_type='chinese'` under the 0043
overlay model) discover the right specialists, and so the date-selection
"Consult a date specialist" CTA has a real deep-link target. 2 of the 7 spec
leaves already shipped (`double_happiness_decor`, `qipao_cheongsam_attire`) and
were left untouched.

New leaves (canonical key → tile → faith tag):

- `chinese_lauriat_caterer` → `feast / catering` → **faith NULL** (see below)
- `date_fengshui_consultant` → `planning / date_specialist` (NEW tile) → `Chinese`
- `tea_set_styling` → `design / stylist_decorator` → `Chinese`
- `angpao_betrothal_supplier` → `prints / souvenir_giveaways` → `Chinese`
- `lion_dance_troupe` → `program / performers` → `Chinese`

**Food de-faith lock (owner visibility).** `chinese_lauriat_caterer` is a
FOOD/catering service, so under the locked 2026-06-11 de-faith rule it is seeded
**`faith = NULL`** (NOT `Chinese`) and marked `is_tradition = TRUE`. A faith tag
would HIDE a Chinese-banquet caterer from every non-Chinese couple who might want
one, and the seed migration's fail-loud DO block aborts if any dietary row is
faith-tagged. Result: the lauriat caterer stays universally discoverable via the
INCLUDE-only faith filter while still reading as a Chinese tradition service.
`dietary` is left NULL on all 5 leaves. The other 4 leaves are genuine
Chinese-specialist services and carry `faith = 'Chinese'` (Title-case, matching
`faith_vocab`), so the INCLUDE-only filter surfaces them only to Chinese couples.

A new tier-2 tile `date_specialist` was minted under the `planning` parent for
`date_fengshui_consultant` — a BaZi/feng-shui date advisor is NOT a coordinator,
and the date-specialist CTA needs a clean, semantically correct target. The tile
is INSERTed before the canonical row (tile_id FK ordering) and added to the
`WeddingTile` type + its 4 exhaustive maps in `lib/taxonomy.ts`.

Files:
- `supabase/migrations/20270309020000_chinese_specialist_leaves.sql` (NEW) —
  mirrors `20261120000100_faith_journey_content_seeds.sql`: tile insert + 5
  `canonical_service_schemas` stubs + 5 `canonical_service_taxonomy` placements +
  fail-loud DO block; idempotent (`ON CONFLICT DO NOTHING`).
- `apps/web/lib/taxonomy.ts` — parity `TAXONOMY_MAP` rows (runtime fallback +
  re-seed source) + `date_specialist` tile wired into `WeddingTile`,
  `TILE_PARENT`, `WEDDING_TILE_ORDER`, `WEDDING_TILE_LABEL`, `WEDDING_TILE_SLUG`.

SPEC IMPACT: None directly in this PR. The 5 leaves are owner-pre-approved
(Appendix B of `Chinese_Wedding_Traditions_Reference_2026-06-28.md`). Surface for
owner sign-off: (1) the lauriat-caterer faith-NULL + tradition-discoverable
posture, which deliberately diverges from the 3 existing faith-tagged Chinese
leaves to honor the food de-faith lock; (2) the new `date_specialist` tile under
Planning as the canonical "Consult a date specialist" deep-link target. New
Chinese tiles will render as "Recruiting" (zero vendors) until vendor
acquisition; coordinate a vendor pass so Chinese couples don't hit empty
categories.
