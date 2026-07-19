## 2026-07-02 · feat(vendor-profile): "Trusted by" peer-endorsement block

The public vendor profile (`/v/[slug]`) now renders a **Trusted by** section
listing the vendors who endorsed this one through the existing vendor↔vendor
mutual-accept handshake (`vendor_partnerships` — the other vendor proposed, this
vendor accepted → `status='accepted'`). Peer consent is the public gate
(owner-locked 2026-07-02), not HQ verification; admin retains takedown via
`is_active`. Render-only — the handshake mechanism + all RLS already shipped
(migration `20270403305164`), so no schema change.

New `lib/vendor-trusted-by.ts` (`fetchTrustedByVendors`) reads accepted+active
partnerships pointing at the vendor and resolves each endorser's name through the
shared hybrid-anonymity resolver (`resolveVendorDisplayName` + `isTrueNameTier`):
a still-hidden endorser shows its taxonomy+city placeholder and is not linked
(its slug would leak the withheld name). The section hides entirely when empty —
founder-only marketplace means no peer endorsements yet, an honest empty state.

Slice 3 of the vendor-website redesign (2026-07-02).

SPEC IMPACT: None — render-only over existing schema; no migration, no pricing,
no catalog change. See DECISION_LOG.md 2026-07-02.
