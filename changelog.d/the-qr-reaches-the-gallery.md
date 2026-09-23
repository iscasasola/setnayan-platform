## 2026-09-23 · fix(payments): the payment QR can actually reach the gallery, and the handoff stops rendering where it does nothing

Owner: *"we want the image to save on the gallery."*

Two defects, both measured on real phones the same afternoon, and they fail in
opposite directions.

### 1 · On iPhone the QR saved NOWHERE — and the label named the gallery anyway

`payment-rails.tsx` offered the amount-carrying QR through a bare
`<a href={dataUrl} download>`. On the owner's iPhone, in Safari, from a page
whose control probe confirmed it COULD hand off to other apps (a "Call 0917…?"
sheet appeared): four taps, and the file landed in neither Photos nor Files.

🔑 **The label promised the place it never reached** — *"Save image · scan from
gallery"*. This control exists for exactly one situation: a couple paying on
their own phone, who cannot point that phone's camera at its own screen. The
amount-carrying QR is the one path that spares them typing the figure, and on
iOS it was a dead end that announced itself as a success.

**The mechanism already existed in this repo.** `lib/save-to-device.ts` was
built for Papic and documents this precisely: `navigator.share` with a file
opens the OS sheet offering "Save to Photos" (iOS) / "Save image" (Android). A
browser cannot write to the camera roll silently — that is a security boundary,
not a missing API. The pay page simply never used it. A wiring defect, not a
missing capability.

⚠ **`'shared'` does not mean saved.** `saveImageToDevice` deliberately returns
`'shared'` when the payer DISMISSES the sheet, so a cancel is not re-prompted.
Nothing in the UI may therefore claim the save happened — every message is an
instruction that stays true whether they tapped Save or cancelled, and a guard
fails on `Saved!`-shaped copy. The button's resting label no longer names a
destination either; where it went is only knowable after the fact.

Android note: one extra tap there (share sheet instead of a direct download),
in exchange for iOS going from impossible to possible.

### 2 · On Android the "Open GCash" button rendered and did nothing

Shipped in #5895 on an iPhone-only measurement. Measured 2026-09-23: Android
Chrome **refuses a bare `gcash://` from a web page** — it wants an `intent://`
URL naming the package. So the button had been rendering on Android, doing
nothing, which is the exact "dead button is worse than no button" rule its own
docblock states.

🔑 **And the fallback would have lied.** *"GCash didn't open — it may not be
installed"* is reasonable on a phone without the app and a false accusation on
a phone that has it. A wrong explanation is worse than no button, because the
payer acts on it.

The handoff is now gated by `walletHandoffIsMeasured`, which returns true for
iOS only. Turning Android on requires **measuring** the intent URL on a real
phone — its package name (`com.globe.gcash.android`) is an unverified guess and
always was, labelled as one in the probe. It must not be inferred from the iOS
result.

### Guards

`lib/the-payment-qr-reaches-the-gallery.test.ts` (4) and two additions to
`lib/the-handoff-cannot-pick-the-wrong-rail.test.ts`. Every one sabotage-checked:
reverting to `<a download>`, importing the helper without calling it, claiming
the save succeeded, putting the destination back on the button, and flipping
Android to measured — each breaks the suite, and the tree is clean after
restore.

SPEC IMPACT: None. Presentation and platform gating only; no schema, no price,
no locked decision. Off-platform payment posture unchanged.
