## 2026-07-02 · feat(vendor-profile): service-coverage filter on the public services gallery

The public vendor profile's "Services & pricing" section now has coverage filter
chips (All + one per coverage group the vendor spans) so a couple can narrow a
long service list to just the coverage they care about. Extracted the static
grouped list into a dumb client component (`v/[slug]/_components/services-gallery.tsx`);
all label/price/meta formatting stays server-side in `ServicesPricingSection`
(new `toServiceCard` helper, replacing the old `ServiceRow`). Chips only render
when a vendor spans more than one coverage group. Group order + which groups
render are unchanged from the old loop.

First slice of the vendor-website redesign (owner design session 2026-07-02):
dense single-screen profile + compose-first Inquire funnel + Trusted-by
(vendor↔vendor handshake) + Awards. See DECISION_LOG.md 2026-07-02 rows.

SPEC IMPACT: None — additive UI on an existing section; no schema, no pricing,
no catalog change. Corpus decision rows already logged in DECISION_LOG.md.
