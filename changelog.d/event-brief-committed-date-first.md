## 2026-08-01 · fix(vendor): the Event Brief's primary date now honours the committed date, not a stale candidate

**Owner signed off on this behaviour change** after being shown the evidence below ("fix it").

### The defect

`apps/web/lib/event-brief.ts` computed the Brief's anchor date as:

```ts
const primaryDate = candidates[0] ?? windowStart ?? eventDate;
```

Two things are wrong in one line. **The committed `event_date` ranks LAST**, behind both the shortlist and a rough window. And **`candidates[0]` is stored order, not chronological order** — the date-picker appends as the host taps, so the first element is simply the first one they touched.

**Locking a date does not clear the shortlist.** `app/dashboard/[eventId]/date-selection/actions.ts` writes exactly four fields on lock — `event_date`, `event_date_precision`, `date_status: 'locked'`, `auspicious_reasons`. Grepping that file for `date_candidates` returns **zero hits**. So a locked event keeps its stale candidates forever, and the Brief kept answering with a day the host had already moved off.

### Why this is vendor-facing, and what changes for them

`date.primary` is not an internal convenience. `lib/vendor-autoreply/adapter.ts` passes it straight into the vendor-facing lite contract, and `lib/vendor-autoreply/types.ts` states the contract explicitly: *availability MUST be keyed to `event.primaryDate`*. `lib/vendor-autoreply/inbox-hook.ts` builds that Brief from `select('*')`, so it receives every date column and was fully exposed to the bug.

**Concretely: for an event with a locked date AND leftover candidates, the Brief's primary date changes from the candidate to the committed date.** Before this fix a vendor could be auto-replied to — or matched — about a day the couple had already abandoned. `app/dashboard/[eventId]/vendors/_actions/category-search.ts` was unaffected in practice because its narrow column list selects `event_date` but not `date_candidates`, and it already reads `ev.event_date` directly for the availability RPC — which is itself a second signal that the committed date is the authoritative one.

### How many prod rows actually change: ZERO today

Queried against prod (`njrupjnvkjkitfctetvi`, SELECT only):

| | rows |
|---|---|
| events total | 5 |
| `event_date` set | 4 |
| candidates set | 2 |
| **both set** | **1** |
| both set, and they coincide | 1 |
| **both set, and they diverge** | **0** |
| rows where `primary` actually changes | **0** |

The one row that carries both ("Cale & Ice", `event_date 2026-12-18`, `date_candidates ['2026-12-18']`) is harmless precisely because they coincide. **This fix is preventative, not corrective** — prod is still pre-launch-empty, and nothing a user can currently see moves. The divergence is reachable the moment any host locks a date that was not on their shortlist, which the lock flow permits without restriction.

### The fix — reuse, not a fourth copy

`primaryDate` now calls **`earliestKnownEventDate()` from `lib/event-dates.ts`** (added by PR #4021), which is exactly this ladder:

```
committed event_date  →  EARLIEST date_candidate  →  date_window_start
```

That module is pure and import-free by contract, so `event-brief.ts` acquiring its single import does not compromise "free to run anywhere". The values handed over are already normalised by the Brief's own `str`/`strArr` (trimmed, empties dropped, non-array guarded), so the helper's `.filter(Boolean).sort()` operates on clean input. This was the third hand-rolled reading of these same three columns; there is now one.

**`mode` is untouched.** The `'specific' | 'window' | 'unset'` derivation is separate logic answering a different question ("how precisely is this dated?", not "which day?"). Reviewed and left exactly as-is.

### Why this does NOT gate on `date_status`

The lock writes `date_status: 'locked'`, so gating on it was the obvious alternative. It was checked against prod and **rejected on the data**:

- **All 5 prod rows read `'undecided'`** — including all 3 that carry a real `event_date`. The value `'locked'` has never been written to any prod row.
- Gating on it would therefore **ignore `event_date` on 100% of prod rows**, silently reintroducing this exact bug in a harder-to-see form.
- The column IS `SELECT`-granted to `authenticated` and `anon`, so the blocker is the data, not the grant — both were checked, per the standing trap that a revoked or empty column changes behaviour silently.
- It is also absent from `category-search.ts`'s narrow column list, so a gate would arrive `undefined` there and resolve *differently per consumer* — the same "two surfaces answering one question differently" shape this whole thread exists to stop.

**`event_date` being non-null IS the commitment.** `date_status` remains a UI/workflow flag, not the source of truth for which day the event is on.

### Tests

`lib/event-brief.test.ts` — 7 new cases, 20/20 pass. The gap was the point: the existing fixtures set candidates-only (`:57`) and `event_date`-only (`:84`), so **no test had ever exercised a row with BOTH set** — which is precisely the row a lock produces.

- **`locked event_date beats stale candidates that no longer contain it`** — the regression case. `event_date: '2027-02-14'` with `date_candidates: ['2026-08-01','2026-09-01']`; asserts `primary === '2027-02-14'`, that the shortlist is still reported verbatim, and that `mode` stays `'specific'`.
- **`candidates resolve to the EARLIEST, not the stored first`** — `['2027-11-20','2027-03-05','2027-07-14']` → `'2027-03-05'`, with stored order preserved in the reported list.
- Committed date outranks a window start; empty candidates array; all-falsy candidates (`''`, whitespace, null) cannot shadow the window start; no date signal anywhere stays `null` + `'unset'`.
- A source pin asserting `event-brief.ts` imports **and calls** the shared ladder.

**Both pre-existing assertions still pass unedited** — `:57` (candidates-only → `'2027-02-14'`, still the earliest of its pair) and `:84` (`event_date`-only → `'2027-03-01'`), as do the window-start-only and null-source cases at `:134` / `:97`.

`lib/event-dates.test.ts` — `event-brief.ts` added as the **third enforced caller** of the shared ladder, so a future edit that re-inlines the columns fails CI. It is deliberately excluded from the companion *"neither surface re-inlines"* heuristic, and the exclusion is narrow and commented: the Brief legitimately reads `date_window_start` / `date_window_end` because it **exposes** them as fields of its read-model, so that check would only false-positive. The import+call guard is what binds it.

SPEC IMPACT: **Not None.** This changes what vendors are told. The Event Brief's `date.primary` — the date the vendor auto-reply keys its availability answer to, and the date category search matches against — now resolves to the couple's committed `event_date` ahead of any leftover shortlist entry, and sorts candidates chronologically rather than trusting stored order. No schema, pricing, or SKU change. Zero prod rows change today (prod is pre-launch-empty); the behaviour becomes reachable as soon as a host locks a date that was not on their shortlist. Log at the bottom of `DECISION_LOG.md` in the corpus.
