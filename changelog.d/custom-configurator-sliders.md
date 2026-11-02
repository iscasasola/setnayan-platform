## 2026-07-04 · docs(vendor-tiers): Custom Stage 2 = slider configurator on BOTH vendor and admin side (owner)

- `apps/web/VENDOR_TIERS_AND_BENEFITS.md` §11 Stage 2 rewritten per owner: the Custom composer is a **two-surface slider configurator** — vendor self-serve panel on `/vendor-dashboard/subscription` (one slider per rate-card line: branches / seats / event slots / photo packs; live charm-rounded price, floor at base, 28d/annual toggle; submit → apply-then-pay order + admin review handshake) AND an HQ admin surface with the same sliders per org plus unit-price control (admin-managed catalog). Provisioning: `tier_state='custom'`, effective caps = base + purchased units.
- §5 handoff entry appended. Build remains gated on the 4 remaining §11 sign-off numbers.

SPEC IMPACT: corpus `DECISION_LOG.md` — row appended (2026-07-04, Custom configurator = vendor+admin sliders).
