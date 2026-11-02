# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-31 · feat(checkout): per-order payment QR — the amount is minted into the code, not typed by the couple

Checkout served the **static** merchant QR an admin had uploaded (`platform_settings.gcash_qr_url` / `bdo_qr_url`) as a plain `<img>`, so every couple typed the figure into their wallet by hand. Wrong amounts and typos were a reconciliation problem for the admin, not the payer. This mints a **per-order** QR Ph code carrying that order's exact VAT-inclusive gross, so the amount pre-fills in the wallet.

**Wallet behaviour was established empirically, not assumed.** The owner scanned every variant against live GCash, BDO and Maribank wallets on 2026-07-31 and completed a real ₱1.43 transfer:

- An amount (tag `54`) is accepted **only** when tag `01` = `12` (dynamic). GCash *parses* tag 54 and rejects the code outright when it sits on a static (`11`) payload — that rejection is precisely how we know the amount is read rather than ignored.
- **GCash rejects the entire tag `62` template** — every sub-tag tried (01 Bill Number, 05 Reference Label incl. numeric-only and 4-char, 07 Terminal Label, 08 Purpose). **No order reference can ride inside the QR.** Maribank accepts all of these, which is what proves the payloads are well-formed; GCash is simply the stricter reader, and it is the one that decides.
- Centavos survive end to end: a ₱1.43 code pre-filled as ₱1.43, transferred as ₱1.43, and landed on the recipient ledger as `+1.43`. The GCash reference number is identical on the payer's confirmation and the recipient's Transaction Details for same-rail GCash→GCash.

**Changes**

- **`lib/emv-qr.ts`** (new) — QR Ph / EMVCo TLV parse, build, CRC16-CCITT-FALSE, `isQrPhPayload`, `mintOrderQr`. Two correctness traps are handled and covered by tests: the CRC hashes **UTF-8 bytes** (not UTF-16 code units) and TLV lengths count **bytes not characters** — `JUAN PEÑA JR` is 12 characters but 13 bytes, and ñ is everywhere in Filipino names. `mintOrderQr` emits tag 01=`12` + tag 54 and **never** tag 62, refuses non-PHP (`53` ≠ `608`) codes, and returns `null` on anything it does not fully understand.
- **`lib/emv-qr.test.ts`** (new) — 10 tests over the **real** decoded GCash and BDO payloads, incl. fail-soft cases, the foreign-currency refusal, and the ñ byte-length case.
- **Migration `20271027100000`** — `platform_settings.gcash_qr_payload` / `bdo_qr_payload`. Backfills the two prod rows with the payloads decoded on 2026-07-31, **guarded on the current `*_qr_url` matching exactly**, so a QR replaced since simply stays `NULL` rather than minting an amount onto a stale account. Grants are table-level and inherited; the REVOKE is re-asserted defensively.
- **`app/admin/settings/actions.ts`** — `uploadMerchantQr` decodes the uploaded image once (sharp + jsQR, both already imported here) and writes the payload **in the same UPDATE as the URL**, so there is no window where the two disagree. `removeMerchantQr` clears both. A QR that will not decode stores `NULL`.
- **`inline-checkout-drawer.tsx`** — `PaymentDetailsBlock` mints the code for the order's gross (from the *same* `computeVatFromBase` call the header displays, so the scanned and displayed figures cannot drift), renders it as a data URL, and **falls back to the static image** whenever minting returns `null`. `qrcode` is imported dynamically to stay out of the initial bundle. Adds a copyable **Exact amount** row and a **Save image · scan from gallery** link — a couple browsing on their phone cannot point that phone's camera at its own screen, and both wallets can scan from the gallery.
- **Copy fix** — the reference block promised the note would match a payment "instantly". A scanned payment goes out via GCash Express Send, which does not reliably carry a note the recipient sees, and the reference cannot ride in the QR either. Reworded to "if your app offers one — it helps us match your payment faster".

**Not in this PR, deliberately:** unique-centavo amounts (changes what we bill — owner-gated) and auto-confirmation (needs an arrival feed that does not exist yet — GCash sends no SMS on wallet-to-wallet, and the account is personal so there is no merchant report).

SPEC IMPACT: `DECISION_LOG.md` — new row for the wallet-tested QR Ph rules (dynamic-flag requirement, tag 62 rejection, centavo fidelity, shared reference number) and the resulting per-order QR at checkout.
