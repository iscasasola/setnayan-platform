## 2026-07-27 · fix(db): guard phantom columns in FILTERS and WRITE payloads — 4 live dead queries found

Completes the sweep begun by the select-list guard (#3777). That guard reads `.select('…')` only; it does not, and structurally cannot, see the other two places a column name is typed:

```
FILTERS   .eq('col', v) · .in('col', […]) · .order('col') · .not('col', …)
WRITES    .insert({ col: v }) · .update({ col: v }) · .upsert({ col: v })
```

Both fail **identically** to a bad select — PostgREST rejects the whole statement with `42703`, supabase-js resolves `{ data: null, error }`, and a downstream `?? []` renders the failure as "no rows". `lib/ghosting.ts` was the proof this is not theoretical: it named its phantom column in **both** a select and an `.in()`, and only the select half was catchable.

**Four live defects found, all invisible to part 1, all confirmed absent from production `pg_catalog`:**

- **`vendor_profiles.is_active` ×2** — no such column. `/admin/vendor-partnerships` and `/vendor-dashboard/partnerships` both filtered on it, so **both partnership pickers returned zero vendors**: nobody could add a partnership from either side. The admin picker drops the filter (its comment says "all vendors", and the console legitimately needs to see unverified shops); the vendor-facing picker moves to the marketplace's real liveness pair (`public_visibility='verified' AND verification_state='verified'`).
- **`event_vendors.vendor_profile_id` ×2** in `lib/vendor-activity.ts` — the *same* phantom that killed `lib/ghosting.ts`, named only in a filter so the select guard could not see it. Finalized-booking and vendor-cancellation counts were **permanently 0 for every vendor**, feeding `vendor_activity_stats` and through it the quality score that ranks the marketplace. Re-pointed to `marketplace_vendor_id`.

**⚠ The scanner was rebuilt once, and that is the part worth reading.** The first implementation reused part 1's fixed 700-character window and produced a **67% false-positive rate** — four of six reports were filters belonging to a *different* statement. Three distinct leaks, each a real defect in the technique:

1. **Dynamic `.from(variable)`** — the literal-only regex does not match it, so the window never closed and the next statement's filters were blamed on the previous literal table.
2. **A helper taking the table as a string argument** — `headCount(admin, 'service_categories', q => q.eq('tier', 1))` contains no `.from()` at all.
3. **A filter quoted inside a `//` comment** while explaining the code below it, counted as if it were code.

Attribution is now a **chain walk**: from `.from('t')`, consume only `.method(…)` links with balanced parens; the first token that is not `.identifier(` ends the statement. A fourth leak surfaced during that rewrite — a prose apostrophe (`// the couple's row`) opened a string the paren matcher never closed, running one `.from('events')` chain into the next statement and crediting it with 16 columns belonging to `event_members`/`guests`. Both the chain walker and the object-key parser now skip comments before quote handling. **All four leaks are pinned as regression tests (T10, T10b)** — a guard that cries wolf gets its findings allow-listed, which is exactly how a ratchet rots into a rubber stamp.

New `lib/security/query-column-scan.ts` + `.test.ts` (11 cases). Deliberately conservative: interpolated literals, embedded/joined references (`other_table.col`), JSON paths, and object literals containing a spread or computed key are **dropped rather than guessed** — every rejection is a chosen false negative. `KNOWN_PHANTOMS` starts **empty, ceiling 0**, because unlike part 1 this scanner resolves nothing it is unsure about, so a report is a real bug until proven otherwise. Anti-vacuity is enforced (T4–T6: ≥2,500 filter sites, ≥700 write sites, >90% table resolution) and detection is proven against fixtures independent of repo state (T7–T9).

Current scan: **3,981 filter sites / 6,667 column refs · 1,153 write sites / 4,318 refs · 0 phantoms.**

Verified: new suite 11/11 · full unit suite **4,642** green · typecheck clean · lint clean. ⚠ Production build not run locally (SIGTERM-killed on this machine — 7 GB requested heap vs ~2.5 GB free; a control build of unmodified `main` fails identically), so that check rests on CI.

SPEC IMPACT: None.
