## 2026-07-20 · feat(vendor-autoreply): Phase 4A auto-accept

Compatibility auto-accept with token hold (What's-Next doc §7 / recon VFD-7),
flag-dark behind `NEXT_PUBLIC_VENDOR_AUTOREPLY_V1` (OFF in prod). No migration —
the Phase-1 schema (20270822679405) already carries every column used.

- **Decision predicate** (`lib/vendor-autoreply/auto-accept-decision.ts`, pure +
  unit-tested): auto-accept fires IFF compat score ≥ the vendor's threshold AND
  a token is available for the hold AND the lead is not trust-flagged AND under
  the vendor's daily auto-accept cap (plus flag/opt-in/pending/tier gates). An
  errored trust check or token probe fails CLOSED — never treated as a pass.
- **Orchestrator** (`lib/vendor-autoreply/auto-accept.ts`) runs at the tail of
  the Phase-3b inbox hook: snapshots `compat_score_at_inquiry` +
  `compat_reasons` on the thread (once, at inquiry), places the hold via the
  token-settlement stream's `unlock_vendor_event_hold` RPC **consumed as-is**,
  flips the thread pending→accepted (guarded), posts an is_bot welcome citing
  `explainCompatScore()` reasons, and logs `vendor_bot_replies`
  action='auto_accept'. **No-token path:** the bot keeps answering, places NO
  hold (never silently burn or borrow), and flags the waiting high-compat lead
  via `compat_reasons.auto_accept_skipped='no_token'`.
- **Trust gate** = an OPEN `integrity_flags` row of kind
  `inquiry_concentration` against the vendor (output of
  `detect_inquiry_concentration`, fake-inquiry stream). `get_lead_trust_flags`
  is not used as a gate — its only signal (`active_planner`) is contractually
  "purely positive, never gates".
- **Config UI**: the My Shop autoreply card (PR #3410) gains the auto-accept
  toggle + threshold + daily cap for the *existing* `auto_accept_*` columns
  (card, actions, parse + tests). No schema changes.
- ⚠ **Activation blockers (deliberate):** (1) the OWNER has an OPEN ruling on
  bot actions vs token-settlement semantics (the `is_bot` exclusion from
  `stamp_vendor_first_reply` question) — auto-accept's token hold must not go
  live before it; (2) `unlock_vendor_event_hold` gates on `auth.uid()` being an
  answering member, so today's service-role call fails FORBIDDEN → fail-closed
  manual; the settlement stream needs to expose a bot-callable hold seam
  (precedent: `claim_unlock_vendor_event`) at activation time.

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/Vendor_Front_Desk_Chatbot_Whats_Next_2026-07-18.md` §0/§7 — §4A moves from "NOT built" to built (flag-dark, activation-gated on the owner's bot-vs-settlement ruling + a service-role hold seam).
