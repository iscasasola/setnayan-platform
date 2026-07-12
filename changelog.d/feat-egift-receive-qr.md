## 2026-07-13 · feat(egift): personal receive-QR (Pabuya) — QR-display only, flag-off

Owner clarification (2026-07-13): "we do not offer transaction on e-gifts; they
just share their own QR codes." So e-gifts are an **asset-display** feature, not
a payments one — a user stores their OWN GCash/Maya/bank receive-QR and Setnayan
only DISPLAYS it. A giver scans it with their own app; the money goes straight to
the user's account. Setnayan never touches funds, reads no transaction, holds no
balance, keeps no ledger.

- New migration `20270803858253_…`: `users.egift_qr_ref` (r2:// image ref) +
  `users.egift_qr_label`. No new RLS (`users` is already owner-scoped).
- `updateEgiftQr` action + a "Your gift QR · Pabuya" section on the Profile page,
  reusing the existing `<FileUpload>` (presigned R2 PUT) + presigned display URL —
  same pipeline as the profile photo. Clear-by-omission nulls both columns.
- New flag `egiftEnabled()` (`NEXT_PUBLIC_EGIFT`, default OFF) — surface is dark
  until the owner confirms the giver-facing display placement.

This removes the earlier "BSP-transaction gate" framing: with no transaction,
there is no money-transmission to opine on — only a light data-display note.
Giver-facing auto-display (event/day-of Pabuya) is the surfaced next step.

SPEC IMPACT: reframes e-gifts to QR-display-only in the family-graph plan
(`Family_Graph_Owner_Actions_2026-07-12.md` §2c) + `DECISION_LOG.md`.
