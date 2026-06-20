## 2026-06-20 · fix(vendor): accept-inquiry token/tier errors no longer crash the page (flow wave D)

The user-flow audit's **critical** "vendor/messages" finding: when a vendor taps **Accept** on a couple's inquiry and the token/tier burn fails (FREE tier can't answer in-app, the verified weekly limit is hit, or the wallet is short), `acceptInquiry` (`lib/chat-actions.ts`) **threw** — crashing the whole thread page to the error boundary. These are *expected* conditions, not bugs; the vendor should see a clear message and stay put.

- **`apps/web/lib/chat-actions.ts`** — `acceptInquiry` now redirects back to the thread with `?error=1&msg=…` for each expected burn failure (`TIER_FREE_NO_INAPP`, `VERIFIED_WEEKLY_LIMIT`, `INSUFFICIENT_WALLET_BALANCES`, + a generic fallback) instead of throwing. The toast bridge (#1927) surfaces the message inline — no crash, no lost context. A `fail(msg)` helper builds the redirect off the form's `return_to` (falling back to the thread path). The truly-unexpected DB-write error stays a throw (rare genuine fault).

This is the feedback lever applied to a throwing action — the pattern for the rest of the 79-finding sweep (convert *expected* failures to `?error=` redirects; leave genuine faults to the boundary).

Verified: 4 `fail()` calls replace the 4 `acceptInquiry` burn throws; the remaining "verify to message couples" throw is a *different* action (`sendChatMessage`), correctly untouched; `redirect` already imported; `chat-actions.ts` pre-flighted clear of open PRs. tsc/lint/build via CI.

SPEC IMPACT: none (bug fix). Backlog: `02_Specifications/User_Flow_Audit_Backlog_2026-06-20.md`. Remaining criticals: Pakanta `/orders/new` loop (payment-adjacent, dedicated PR), onboarding "Sign in" path (blocked by #1180's onboarding-shell edits).
