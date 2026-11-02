## 2026-07-02 · fix(vendor): Locked QR — contract optional when the vendor has none

Resolves the flagged dead-end where a brand-new vendor (zero saved contracts)
couldn't issue a Locked QR because the contract pick was unconditionally required.

Now the contract is **required only when the vendor has saved (non-cancelled)
contracts** to choose from; a vendor with none can generate without one. Enforced
in both places:

- **Generator** — the gate requires a contract only when `contracts.length > 0`;
  the label drops its `*` and the empty state reads "you can generate without one."
- **`issueLockedQr`** — when no contract is submitted, it counts the vendor's
  non-cancelled contracts and only fails when some exist (server-authoritative,
  independent of the client). A submitted contract is still ownership-checked.

SPEC IMPACT: Locked QR contract selection is conditionally required (required iff
the vendor has ≥1 non-cancelled saved contract). No schema change.
