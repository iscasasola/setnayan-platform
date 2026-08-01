## 2026-08-01 · refactor(setnayan-ai,papic): Setnayan AI is per event · Papic is offered everywhere

Two owner decisions, both taken 2026-08-01, applied end to end.

### 1 · Setnayan AI is PER EVENT — the per-USER path is retired

Owner, asked whether one purchase should ever unlock a person's other events:
**"it is per event"**.

The opposite model was fully built and inert behind a flag. It is now removed, so
per-event stops being a setting somebody could flip and becomes the only thing
the code can express.

Removed: `user_ai_subscription` (table) · `platform_settings
.setnayan_ai_per_user_enabled` (column + `resolveSetnayanAiPerUserEnabled`) ·
`getEventHostAiSubscription` (the host fan-out) · `userAiSubscriptionActive` +
`UserAiSubscription` · `lib/setnayan-ai-subscription.ts` (whole module:
`AI_SUB_SKU`, `parseCycles`, `cyclesFromAmount`, `extendUserAiSubscription`,
`reverseUserAiSubscriptionWindow`) · the `SETNAYAN_AI_SUB` activation handler and
its refund reversal in `sku-activation.ts` · `resolveAiSubTotal` · the
account-level `/dashboard/setnayan-ai` surface and both links to it.

`isSetnayanAiActiveForUser` / `shouldOfferSetnayanAiPurchaseForUser` are renamed
to `…ForEvent` and lost their `perUserEnabled` / `subscription` inputs — with the
flag off (its only ever state) the results are provably identical.

Verified in prod (`njrupjnvkjkitfctetvi`) immediately before dropping:
`user_ai_subscription` **0 rows** · flag **NULL** (never TRUE) · `SETNAYAN_AI_SUB`
orders **0** · orders overall **0** · no `SETNAYAN_AI_SUB` catalog row · no
dependent views. Nothing was stranded mid-refund: the SKU was never purchasable,
and the activation handler and its reversal are removed together.

Three security properties **tightened** as a side effect, none loosened:

- `SETNAYAN_AI_SUB` was the only **eventless** SKU; checkout's `event_members`
  membership check is now unconditional.
- It was the only SKU with a **cycle multiplier**; the charge path now performs
  no arithmetic at all between a catalog price and an order total. The SEC-7
  guard test moves from "exactly one multiply site" to **zero** — the 36×
  overcharge class is retired rather than defended.
- The key now falls through to the `no_price_source` refusal instead of its own
  branch, which would have started selling again had anyone seeded a catalog row.
- Dropping the table also removes a real exposure line: it carried
  `anon = SELECT/INSERT/UPDATE`.

Deliberately untouched: `events.setnayan_ai_active`, `…_active_until`,
`…_tier_at_purchase`, `resolveSetnayanAiDisplayPricePhp`,
`resolveSetnayanAiTypeChargeCentavos`, the tier ladder, and the
`setnayan_ai_paywall_enabled` / `setnayan_ai_per_event_pricing_enabled` flags
(both TRUE in prod). A new test pins tier · SKU · price for all 16 event types so
"no event's charge or display changed" is a test result, not a claim.

### 2 · Papic is offered on EVERY event type, including travel

Owner: **"Drop the travel exclusion — offer Papic everywhere."**

`PAPIC_ACCESS_DENIED_TYPES = ['travel']` and its enforcement branch are deleted
(the mechanism is gone, not emptied), and `travel` joins
`PAPIC_ACCESS_PHASE_1_TYPES` — **both** were required: deleting the deny list
alone would have dropped travel through the fail-closed default and left it
denied for a different reason. This also settles a contradiction with the older
standing lock "Papic on ALL 16 event types" (2026-07-27).

⚠ The audit that called this gate unreachable was **stale**. It is enforced today
via `addOnOfferedForEvent` from both the Suite grid and the `/studio/about` deep
link, so this is a real behaviour change, not a cleanup. Tests were inverted
rather than deleted.

⛔ **`date` and `hangout` are still denied** — they enable `rsvp` in prod but sit
in no phase set, so the pre-existing fail-closed default catches them. The
decision named the travel exclusion only and did not tier them, so they were left
alone rather than silently opted in. Locked in a test and flagged for the owner.

### Also

`diffSchema` (`tests/db/schema-snapshot.ts`) gained a `− declaredLedger` term.
The drift guard excused a pending migration that ADDS a column, and one that
drops a *phantom* column, but not one that drops a *real* one — so every PR
retiring a table went red. This is the first such PR.

SPEC IMPACT: Both are owner-directed product decisions and need corpus rows.
(1) `DECISION_LOG.md` — Setnayan AI is per EVENT; the per-user subscription
model (table, flag, `SETNAYAN_AI_SUB` term pass) is RETIRED, not dormant. This
supersedes the 2026-06-29 per-user reframing and affects
`project_setnayan_ai_per_type_pricing` memory + any doc describing Setnayan AI as
a per-user subscription. (2) `DECISION_LOG.md` — Papic event-type eligibility now
includes `travel`, reversing the `Papic_Access_Scope_Council_Verdict_2026-07-20.md`
§2 permanent V1 deny and aligning with the 2026-07-27 "all 16 event types" lock;
`date`/`hangout` remain untiered and OPEN.
