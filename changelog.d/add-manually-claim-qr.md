## 2026-07-01 · feat(vendors): Add-manually claim QR + "not Setnayan-verified" disclaimer

Owner (2026-07-01): on the Explore → Shortlist "Add manually" flow, adding a
vendor should "create a QR code for the vendor to log in from," and couples should
be told a self-added vendor isn't Setnayan-verified ("add at your own risk · we
add them free so you can manage your planning better").

The claim flow already existed — `createManualVendorInvite` mints a `vendor_invites`
row and returns the `/vendor/claim/[token]` URL, surfaced in the modal's post-save
step as a copy/share link. This adds:

- **Claim QR.** `createManualVendorInvite` now also returns a server-rendered
  `qrSvg` (via `lib/qr.ts renderUrlQrSvg` over the claim URL). The post-save
  "Invite them to Setnayan" step in `NewManualVendorModal` paints it above the
  link: *"Show this to {vendor} — they scan it to join Setnayan & log in."* The
  vendor scans → `/vendor/claim/[token]` → signs up/links → the couple's recorded
  prices/payments/chat auto-attach to the vendor's new (unverified) account.
- **Disclaimer.** The manual-add form (manual mode only — not when linking an
  existing marketplace vendor) shows: *"Heads up — vendors you add yourself
  aren't verified by Setnayan. We add them free so you can manage your whole plan
  in one place 💛 — just vet them yourself before booking."*

SPEC IMPACT: None (reuses the shipped vendor_invites/claim infra + the QR helper;
no schema or new endpoint). Related follow-up (separate PR): gate Explore /
marketplace / `/v/[slug]` visibility on `verification_state` so unverified vendors
stay private until verified. Optional follow-up: a persistent "Self-added · not
verified" tag on the vendor card itself (not just at add time).
