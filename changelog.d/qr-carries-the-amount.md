## 2026-09-20 · feat(payments): the code a payer scans carries the amount, and provably pays the same account

Owner ruling, 2026-09-20: *"each QR should show a specific amount."*

**RULE 0 — most of this already existed and was not rebuilt.** `lib/emv-qr.ts` has minted
QR Ph codes since 2026-07-31: tag `01` flipped to `12` (dynamic), tag `54` set to the exact
amount, CRC-16/CCITT-FALSE recomputed over the payload including `6304`, and no tag `62`
(real GCash rejects that template outright). Every one of those claims is the owner's own
wallet testing, recorded in that file's header — not inferred from a spec.

**What was actually missing was that the minted code was drawn in the BROWSER.** `minted`
started null on every render, so `/pay` fell back to the static merchant image — a real,
scannable code that opens the wallet at ₱0 — until the `qrcode` chunk arrived, then swapped.

- New `lib/qr-image.server.ts`. `/pay` now mints and draws **both rails on the server**,
  before the page is sent; `ChannelInfo.payload` became `ChannelInfo.mintedUrl` and the
  panel's `useEffect` + `import('qrcode')` are gone. Switching tabs swaps two images that
  are already there.
- The step-1 sentence now follows the **image actually painted**, not the stored payload: a
  payload that mints but fails to render falls back to the static code, and the words go
  with it.
- **The supplier's own QR can carry the figure too.** `vendor-direct-pay` mints from
  `vendor_payment_methods.decoded_destination` — what the uploaded image *actually* encodes,
  decoded server-side at upload time, not what the supplier typed — when the screen knows
  the ask. The deposit step passes the accepted quote's first payment (`minimumPhp`), the
  same number the form below defaults to. Screens that do not know a figure pass null and
  say the amount must be typed. Nothing is guessed.

**🚨 The failure that matters is a code that pays the wrong account** — it scans perfectly,
pre-fills the right figure, and nothing downstream notices. New
`verifyMintedAgainstSource` compares the OUTPUT against the source: every merchant account
template (26–51) and every identity tag (52, 53, 58, 59, 60, 61) **byte for byte**, plus
tag 01 = `12` and tag 54 to the centavo. `mintOrderQr` now calls it and returns null on any
doubt — the old self-CRC check passed happily on a drifted identifier.

**Guard** — `lib/a-minted-code-pays-the-same-account.test.ts` (9). It renders a real PNG
with the product's own renderer and settings, decodes it back with the repo's own detector
(`lib/qr-decode.ts`, sharp + jsQR), and asserts on what came out of the image. It proves the
harness first on a trivial payload, and proves the **refusals** as well as the successes.
Sabotage-proven four ways: the verifier dropping its identity comparison → 1 fail; the mint
dropping tag 01 → 5; the mint dropping the verifier → 1; the panel re-importing `qrcode`
→ 1.

🪤 **One of these assertions was vacuous and was measured to be so.** "mintOrderQr refuses
what the verifier refuses" first used a payload with no currency tag — which `isQrPhPayload`
already refuses at the door, so deleting the verifier call left the suite green. It now uses
a duplicated merchant-name tag: through the old door, stopped only by the verifier.

`app/pay/the-figure-and-the-qr-agree.test.ts`: pay-panel's `payAmount` floor 4 → 3, with the
reason written in — the caption's two hand-written branches became one `qrWords` call, so the
figure is displayed in the same three places from one fewer call site. The count is no longer
asked to carry that weight alone: a new assertion pins the ARGUMENT reaching `qrWords` to
`payAmount`, since `qrWords(exact, '₱838')` would keep every call site and still print a
figure the QR does not carry.

⚠ **NOT PROVEN BY ANY OF THIS: that a real wallet accepts the code.** That was established
by the owner scanning real money on 2026-07-31 and must be re-established. See the PR body
for exactly what to scan.

SPEC IMPACT: None. No pricing, rail or lane changes.
