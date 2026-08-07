## 2026-08-07 · chore(vendor): stop showing vendors a currency that buys nothing

Owner lock **2026-07-21**, decision block answer (7), verbatim: *"token can
retire, there should be nothing that needs token anymore."* Prod agrees — zero
token purchases, zero redemptions, zero token-able SKUs, nobody has ever bought
or spent one. The wording was still on screen.

A 6-area sweep with per-finding adversarial verification found **64 candidates,
42 confirmed** (22 refuted — QR-claim, session and design tokens use the same
word). This PR takes the **vendor-facing** ones.

| Removed | Where a vendor saw it |
|---|---|
| the gold coin price badge inside **Accept** | vendor home, on **every** new-customer inquiry card — a price on the one thing the booking fee made free |
| the coin balance pill | the pinned sidebar footer, on **every** vendor screen |
| "Includes N free tokens each period" | the Pro and Enterprise plan cards |
| "Pro and Enterprise also bundle free tokens each cycle" | the intro under "Choose your plan." |
| the whole token wallet section | unmounted from the Plan hub |

🚨 **The Accept badge is the one that actually cost something.** Vendors were
shown a 1–3 token price to accept an inquiry, when accepting is free and has been
since the booking fee replaced lead unlocks. We were advertising a charge on the
thing we made free.

🔑 **The sidebar pill's own docblock said "tokens are retired — the balance is
read-only, nothing spends them"** — and it was still printed in the chrome of
every vendor screen. A counter for a currency that buys nothing is not read-only;
it is a standing claim that the currency exists.

Dead imports removed with their uses (`Coins` in two files, the
`vendorTokenBalance` read in the vendor layout, the wallet import on the Plan
hub). `tsc --noEmit` clean · **19/19** lint scripts.

### Deliberately NOT in this PR

Not because they are fine — because they are bigger than copy:

- **`/admin/token-purchases`** and **`/admin/vendors/<id>/tokens`** — two whole
  admin pages for confirming token-pack payments and granting tokens.
- **"Token sales" + "Token bands" in the admin sidebar** on every admin page, and
  a "Token sales" row in the admin work list. ⚠ Admin nav shape is guarded
  (#4066, after a cleanup deleted two nav groups) — removing entries must
  regenerate that guard in the same PR, deliberately.
- **`/vendor-dashboard/creators`** — an entire feature whose currency is tokens
  ("spend one token to offer a storyteller your promo", refund-if-no-reply,
  a "Reach tokens spent" column). Retiring the currency leaves it with no meter;
  that is a product question, not a copy edit.
- **Money.** The Custom plan builder sells **₱100 per 25 tokens/cycle**, and
  `vendor_billing_catalog` still carries an **ACTIVE** "Custom — Included Token
  (per cycle)" row at ₱100 plus five retired token packs.
- **Public copy** — `/features` (EN + TL) and `llms.txt` both mention token-pack
  receipts and token spend.

SPEC IMPACT: None here. `Pricing.md § 0.C` still describes a live token economy
and is already flagged stale by [[project_setnayan_token_retirement]]; the
corpus correction belongs with the money change above, not with this copy pass.
