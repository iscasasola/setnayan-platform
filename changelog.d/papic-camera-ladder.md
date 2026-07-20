## 2026-07-21 · feat(papic): camera ladder repriced — Mini ₱100, Max ₱200, Ltd retired

Owner ladder from the 2026-07-20 pricing session, and the fix for a live duplicate-title defect.

| Rung | Was | Now |
|---|---|---|
| Papic Mini | ₱30 · 20 pts/camera·day | **₱100 · 200 pts** |
| Papic Max *(was "Papic Unli")* | ₱100 · unlimited | **₱200 · 500 pts** |
| Papic Ltd | ₱50 · 70 pts | **deactivated** |

**"Unli" is retired as a name.** The rung is capped at 500 points, and a tier capped at 500 is not
unlimited — shipping that word is the same class of defect the 2026-07-20 website audit found across
the live site. The **tier code stays `unlimited`** (schema CHECK value + existing seat rows ·
never-rename lock); only the display title changes.

**Capping `unlimited` is a real behaviour change:** `points_per_day` goes `NULL → 500`, so the
fail-closed gate now **binds** on this rung where it previously returned TRUE without touching the
ledger. Verified no code path special-cases the tier to skip metering — the `rung === 'unlimited'`
checks in `upload/route.ts:357` and `papic/actions.ts:337` are the **paid** gate, and
`papic-cameras.ts:662` is a tier-code validator. Blast radius is nil regardless: **`PAPIC_CAMERA_*`
has zero orders in the platform's lifetime**, so no seat exists to be re-metered and **no
grandfathering clause is needed.**

**Duplicate title fixed.** `PAPIC_CAMERA_ROLL_DAY` (₱30) and `PAPIC_CAMERA_LTD_DAY` (₱50) both read
_"Papic Ltd (per camera, per day)"_ in prod — and `app/pricing/page.tsx` maps every active SKU into a
schema.org `Product`/`Offer` using `sku.title` verbatim, so answer engines ingested two "Papic Ltd"
offers at different prices. ROLL is retitled to its real rung. Confirmed against prod that this is
the **only** duplicate among active SKUs, so the migration's post-condition (no two active SKUs may
share a title) is safe to assert.

Stale fallback constants updated with it — `PAPIC_CAMERA_{ROLL,MINI}_FALLBACK_PHP` 30 → 100,
`_UNLIMITED_` 100 → 200 — so a DB-read failure can no longer quote a retired price. The Ltd constant
survives for lineage. The ladder doc-comment at the top of `papic-cameras.ts` is corrected too, so
the file no longer contradicts itself.

⏳ **Merging this file does not apply it** — still needs `supabase db push --db-url "$SUPABASE_DB_URL"`.

SPEC IMPACT: Corpus already updated — `0012_papic/Papic_Pricing_Lock_2026-07-20.md` § 2.2.
