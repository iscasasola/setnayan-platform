## 2026-07-30 · fix(ugat): the health registry was crying wolf — 6 of 9 findings were already fixed, and 3 cited columns that never existed

`/admin/ugat/map` exists to tell the truth about the platform. On 2026-07-30 it was the least truthful surface we have.

**What was actually wrong.** The nine health findings were a verbatim freeze of the 2026-07-04/05 audit, and the console's own comment defended that as correct — "static schema documentation: correct until the schema changes." The schema changed. Twenty-five days later the panel was still painting **six closed findings as live**, two of them labelled `red` / "Confirmed broken", and **two of those two were security findings**. An admin opening the map saw nine alarms and had no way to tell which were real.

**Re-audited every finding against `origin/main`, with evidence per verdict:**

| | Verdict | Proof |
|---|---|---|
| F1 payment screenshots → public bucket | **FIXED** | `lib/bucket-routing.ts:33-42` routes `payment-screenshots/` to the private bucket; all three writers use it; display is presigned. Guard: `lib/bucket-routing.test.ts` |
| F2 verification fee drift | **FIXED** | `lib/vendor-verification.ts:116-146` resolves from `service_catalog` and **fails closed to free** |
| F3 bundle triple-hardcode | **FIXED** | migration `20270511379088` created `bundle_components` with real FKs. Guard: `lint-entitlement-gates.mjs` |
| F4 faith modal 18 vs server 10 | **FIXED** | closed the *generous* way — the DB was widened to 18, not the modal cut to 10 |
| F5 pre-reveal logo leak | **FIXED** | `messages/page.tsx:138-153` gates the list-row logo behind `isVendorNameRevealed()` |
| F6 join QR can't be revoked | **FIXED** | `regenerateInviteQr()` rotates the token; all four readers honour `revoked_at` |
| F7 `tier_state` no sync | **MITIGATED** | expiry stamping + a login-driven sweep guard it, but column-pairing is a *convention*, not an invariant |
| F8 order ledger | **OPEN, re-scoped** | it IS read — by machines. No **human**-facing view exists. Title was wrong. |
| F9 service cards no FK | **OPEN** | still TEXT, but severity is honestly lower: the writer validates app-side and a rename keeps the key stable |

**Three findings pointed at columns that do not exist.** This is the part worth internalising — the prose rotted independently of the verdict:

- F6 cited `events.qr_revoked_at`. That column has **zero hits across all 1,002 migrations**. Revocation always lived on `event_join_tokens`. The node card printed "qr_revoked_at — always NULL ⚠" as evidence of a bug, when the column's absence was the whole reason it read NULL.
- F1 cited `payment_inbox_messages.proof_r2_key`. That table appears in **zero** migrations — the 0034 spec table never landed under that name.
- F8 cited `order_ledger_entries`. The real table is `order_ledger`.

A finding can be *right about the problem* and *wrong about every identifier in its trace*. Both halves now carry evidence.

**Two new findings.**

- **F10 · red · routed to the security handoff.** The F1 re-audit found a *different* public-bucket path, live and deliberate: `vendor-itemization-card.tsx:670-679` uploads couples' off-platform payment receipts with `bucket="media"` — and `setnayan-media` is THE publicly-served bucket (`booth-studio.ts:267`, served unsigned). These are bank-transfer screenshots carrying reference numbers and partial account numbers; the only protection is an unguessable key. The code comment frames them as "the host's own record", which reads as considered, but it is the same PII class F1 was raised for. **This is an owner decision (move to private + presigned, or accept a documented posture) and existing objects are already public** — not something this PR should quietly change on a live payment surface.
- **F11 · amber · fixed here.** The console *itself* committed the F2 failure class: it hardcoded `'₱100 / token'`, a price that survived both the reprice to flat ₱200 and the outright retirement of the token-pack sale. A panel that flags price drift was drifting. The row is deleted rather than corrected — **never print a static price**.

**How findings stop going stale.** Each now carries `status` (open/mitigated/**fixed**), `verifiedAt`, `verifiedEvidence` (ref + `file:line` or migration), an optional `guard` naming its CI tripwire, and an optional `signalKey` for live telemetry. Fixed findings are **kept as history, never deleted** — a visible closed finding proves the audit loop works and stops the same issue being re-discovered from scratch. The map overlay reads `openUgatFindings()`, so a closed finding can never paint a red edge again. Anything open past 30 days shows a "STALE — re-verify" chip instead of continuing to look authoritative.

Staleness is computed from a **server-injected `nowMs`**, not `Date.now()` inside the client console — a locally-read clock renders a different age on each side and React reports it as a hydration mismatch.

**Tests** gained the contract, not just updated counts: ISO-shaped `verifiedAt` not in the future, non-stub evidence, valid status, `openUgatFindings()` excluding exactly the fixed rows, the staleness boundary turning over at day 30, and — the regression that mattered — **no fixed finding may surface on an edge**. The old "exactly 9 findings" assertion is gone: it made *the audit doing its job* look like a test failure. The trace-length check widened from `=== 5` to a 5–7 range because pinning 5 would have forced deleting the phantom-column corrections, which are the most useful rows in the file.

SPEC IMPACT: `DECISION_LOG.md` row — Ugat findings re-audit 2026-07-30 (6 of 9 fixed, F7/F8 re-scoped, F9 open, F10 NEW routed to security, F11 fixed in place). No SKU, price, schema, RLS, or flag change; no exposure-baseline regeneration required.
