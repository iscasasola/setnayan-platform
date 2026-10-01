## 2026-10-02 · fix(money): receiving accounts are shown by NAME, QR Ph says "any bank or e-wallet", and Record-a-payment is reachable on a phone

A payment's channel prints as the receiving account's name (couple order page, supplier booking-fee page, admin payments card, admin alert email) instead of an id like "maribank-7k2q". The hard-coded "BDO or GCash" customer/supplier copy now reads the accounts list (or says "bank or e-wallet"); a branch order accepts any open account id; the dead `hasBdo`/`hasGcash` in checkout are removed. Next to a payment QR that is QR Ph: "Scan with any bank or e-wallet app (QR Ph)". The ledger's Reference link shows at every width, admin order search opens the payments desk (Record card), supplier list cards link to `/admin/vendors/<id>`, and admin search finds payments by record/received/arrived and payment methods by bank/e-wallet/receiving account.

SPEC IMPACT: None
