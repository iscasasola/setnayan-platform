## 2026-08-02 · sec(db): drop the retired `token_burn_bands` — it was still granting `anon` full read/write

`token_burn_bands` was the per-region map deciding how many tokens a vendor burns to answer an inquiry. It was replaced on 2026-07-01 by a single source of truth, `regions.burn_band` ([20270331100000](supabase/migrations/20270331100000_burn_band_single_source.sql)), and retired **because it was wrong** — it keyed regions by long-form slug while the rest of the schema uses underscore/PSGC form, so six regions mis-resolved and eight were missing.

### It was not merely untidy — it was open

Regenerating the exposure baseline shows what the drop actually removes:

```
tpriv  public.token_burn_bands|anon             SIUD
tpriv  public.token_burn_bands|authenticated    SIUD
col    public.token_burn_bands.{band,label,min_wage_php,region_slug,tokens,updated_at}
                                                anon=SIU  authenticated=SIU
policy public.token_burn_bands|token_burn_bands_read   using=(auth.uid() IS NOT NULL)
```

A table nobody reads, retired for holding wrong data, with select/insert/update/delete reachable by the public anon key. **30 exposure facts removed, 0 added by this drop.**

### Verified unread, with the boundary stated

The `households` drop ([20271029415972](supabase/migrations/20271029415972_drop_households_and_guests_household_id.sql)) broke ten security assertions after a scan that excluded `*.test.*` called it dead. So this one states its search:

| check | result |
|---|---|
| `git grep -nE "from\(['\"]token_burn_bands['\"]\)" origin/main -- apps/web` | **0 hits** |
| all 27 files mentioning it | migrations, changelogs, 2 generated artifacts — and every app-code hit is a **comment explaining the retirement** |
| tests referencing it (`apps/web/tests`, `*.test.*`) | **none** — no canary depends on it, which is the households trap |
| foreign keys pointing at it | **none** |

The only burn lookup that runs is `resolveBurnBand()` ([auto-accept.ts:365](apps/web/lib/vendor-autoreply/auto-accept.ts:365)), which queries `regions.burn_band`. `/admin/token-bands` already writes `regions` too, so no screen is lost.

Per the owner's standing rule (2026-07-31): **retired means deleted, no tombstones** — a retired object left in prod is a lie the next reader has to disprove.

### ⚠ The regeneration surfaced three functions that are NOT mine

The refreshed baseline **adds** three lines:

```
func  public.ensure_papic_auto_missions(p_event_id uuid)                    secdef=yes exec=authenticated
func  public.respond_creator_offer(p_offer_id uuid, …)                      secdef=yes exec=authenticated
func  public.vendor_worked_with_ids(for_vendor uuid)                        secdef=yes exec=authenticated
```

Their migrations date to **20270403, 20270817 and 20270901**. Three SECURITY DEFINER functions have been live in prod for months without appearing in the committed exposure baseline — so the freeze guard, whose whole job is to fail on a widening, was comparing against a baseline that already understated the surface. **A guard that fails open reads exactly like a guard that passes.**

They are `exec=authenticated`, not `anon`, so this is an unreviewed-surface gap rather than an open door. Committing the regenerated baseline re-arms the guard; the three deserve the same read-the-body review the 211 anon-callable functions got.

`prod-schema.snapshot.txt` is refreshed in the same run. Its large diff is unrelated drift from today's merged work (the FK sweep's nullability changes), not from this drop — the snapshot's own docblock names staleness as a known limitation, and the drift test's replay is bounded by prod's ledger head, so both halves stay pre-drop and consistent.

Verified: full DB suite **729/729**, `tsc --noEmit` exit 0 with zero errors.

SPEC IMPACT: None — removes a retired object and the anon grant it carried.
