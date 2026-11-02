## 2026-07-24 · chore(fraud): retire lead-token-hold, surface identity clusters on reg-number collision

**Context.** The fee model moved off per-inquiry (tokens retired 2026-07-21, inquiries free). The token HOLD-and-release path (`lib/lead-token-holds.ts` + `NEXT_PUBLIC_LEAD_TOKEN_HOLD_ENABLED`, default OFF) existed ONLY to protect per-inquiry TOKEN spend — reserve a token at accept, consume it on a genuine couple reply / proposal view, release it on a ghost, refund it on a vendor report or event delete. With no per-inquiry token spend left, the whole path was dead weight. The anti-spam velocity caps + trust badge (`lib/inquiry-gate.ts`) protect vendor TIME, not token spend — LEFT UNTOUCHED.

**Removed.**
- Deleted `lib/lead-token-holds.ts` (the flag + all seven seams: `acceptInquiryViaHold`, `consumeLeadHoldOnCoupleReply`, `markProposalViewedAndSettle`, `reconcileEventLeadHoldsOnDelete`, `runVendorLeadReportBackstop`, `sweepGhostedLeadHolds`, `maybeSweepGhostedLeadHolds`).
- `lib/chat-actions.ts` — accept path drops the `leadTokenHoldEnabled() ? acceptInquiryViaHold : …` branch (now just free-answer variant vs. live `unlock_vendor_event`); the now-dead `INSUFFICIENT_WALLET_BALANCES` copy branch (kept "only for the dormant HOLD path") is gone; the vendor-report token-refund `after()` hook is gone (the `user_reports` insert + admin review are unchanged).
- `lib/chat-send.ts` — the couple-reply consume-on-reply `after()` hook removed.
- `app/admin/events/actions.ts` — the pre-delete hold reconcile removed.
- `app/vendor-dashboard/layout.tsx` — the `maybeSweepGhostedLeadHolds()` login-driven sweep removed.
- `lib/creator-offers.ts` — stale comment that named the deleted sweep reworded.

**Preserved.** The proposal `sent→viewed` transition is a load-bearing status the vendor's clients/funnel surfaces read ("your quote was opened") and is independent of the token economy. Extracted its legit half into `markProposalViewed` in `lib/proposal-send.ts` (marks viewed, no token consume, no flag); `app/proposals/[publicId]/page.tsx` now calls it.

**Out of scope (deliberate).** `lib/vendor-autoreply/auto-accept.ts` also calls `unlock_vendor_event_hold` directly, but as a separate feature behind `NEXT_PUBLIC_VENDOR_AUTOREPLY_V1` (fail-closed, activation-blocked by design) — not via the deleted module. Left as-is. The underlying hold RPCs + `platform_settings.lead_hold_sweep_last_run_at` remain in the DB (no migration in this PR); nothing in app code routes to them anymore except that dormant auto-accept path.

**Added — identity-cluster signal on reg-number collision.** When a duplicate government reg number soft-flags a vendor for admin review (#3633), the admin verify queue now ALSO surfaces any existing `identity_clusters` linkage for that vendor's owner account — so a farmer using a fresh permit but the same device/account fingerprint is still catchable. New pure reducer `lib/identity-cluster-linkage.ts` (`countOtherClusterAccounts`, 6 unit tests); `app/admin/verify/page.tsx` reads the matview only for already-flagged vendors and renders a "+N linked accts" badge next to "Duplicate reg #".

⚠ **READ-ONLY, and DORMANT until DPO-gated capture is enabled.** This wires the READ of the existing `identity_clusters` matview only. It does NOT enable device-fingerprint CAPTURE — `NEXT_PUBLIC_DEVICE_FINGERPRINT_ENABLED` stays OFF (DPO-gated). The matview is populated solely by `refresh_identity_clusters`, which runs only when capture is on, so today every probe returns nothing and the badge never renders. The read activates automatically once capture is turned on.

SPEC IMPACT: None. No pricing/SKU/schema change. Retires an always-OFF flag (`NEXT_PUBLIC_LEAD_TOKEN_HOLD_ENABLED`) that never shipped live behavior; the corpus fake-inquiry-protection notes already record the hold model as "NOT built".
