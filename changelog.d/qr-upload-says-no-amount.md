## 2026-08-29 · fix(admin): the merchant-QR upload says which QR to upload

The payment-methods screen asked for "your merchant QR code" and said nothing
about which one. A wallet app's own *generate a QR with an amount* flow imposes
its own floor — GCash asks for ₱100 — and an amount-baked QR would freeze every
Setnayan order at that one figure. The smallest live catalogue item is
`PAPIC_GUEST_100` at ₱70, so an amount-baked upload breaks it outright.

Setnayan does not need an amount on the source QR: `mintOrderQr()` rewrites the
uploaded QR Ph payload per order (tag 01 → '12', tag 54 → the exact amount) and
the owner's own 2026-07-31 wallet testing proved centavos survive — a ₱1.43 code
pre-filled, transferred and landed as ₱1.43. **There is no minimum in our
code**: `mintOrderQr` accepts any amount above zero.

The upload block now states, where the admin is standing, that the plain
receiving QR with NO amount is the one to upload, and why.

Copy-only; no schema, no logic, no price moved.

SPEC IMPACT: None.
