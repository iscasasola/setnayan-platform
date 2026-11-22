## 2026-11-22 · ship(batch-y): #8186 the final supplier ladder (plans A+B+C) — alone, ahead of the queue

#8186: the plans are storage sizes. Free 256 MB · Verified 2 GB · Plus 128 GB · Pro 500 GB · Ultra 1 TB (`storage_mb` replaces `storage_gb`), every tool on every paid size, and Pro and Ultra have no branch limit. Migration `20271360033501_supplier_final_ladder_2026_11_22.sql` (controller GO pinned to blob 7ff15b29b5). No price is written; the monthly-only prices are the next PR.

Ship controller: four plan names the ladder made wrong, in files #8186 did not touch. The branded 3D booth refusal now says it comes from Plus. Story pages come with every paid plan. The page-plan list puts the cover photo, pinned review and stories on Plus. The branch note says branches come with Pro and Ultra. The upsell guard's entry for the booth refusal says "below Plus". Generated files regenerated once (screens map, port baseline, admin jobs); the exposure surface is unchanged.

SPEC IMPACT: None (the ladder's spec edits shipped with #8186's own fragment)
