## 2026-10-28 · feat(guests): the guest card's ticket row — Share · NFC · New QR

Owner, 28 Oct: *"guest card still does not ahve that one share button"* (DECISION_LOG "GUEST CARD TICKET ROW = THREE ICON
BUTTONS: SHARE · NFC · NEW QR" + "APPROVED — ONE SEND BUTTON FOR EVERY INVITE"; prototype `send_run_simple_2026-10-27`
frames card · newqr). Beside the ticket the card now draws three neutral 44-px icon buttons:
- **Share** — the ONE send: the same `rowShare` → `shareInvite` path the guest row uses since #7002 (phone share sheet
  with their message + link, stamps Sent ✓ when an app takes it; a computer gets the shipped app rows + Copy);
- **NFC** — the shipped `NfcWriteButton` (new `iconOnly` form), same sheet and flag;
- **New QR** — confirms first ("Their old QR and link will stop working…"), then the shipped `releaseGuestClaim` › `new_qr`.
The ⋯ keeps the rest (Unlink account) and draws only while an account holds the invitation. The big "Invite ▾" left the
card; its pinned copy in the panel head is now the Share icon. "What they see on their phone." moved into the ⓘ beside
"Their ticket"; the status reads "Not sent yet · Not linked". How the card opens/loads is untouched (#7000).
Guard: `guests/_components/the-ticket-row-is-three-icons.test.ts` (rendered card; sabotaged red). Four existing guards
re-aimed at the new row. +0 server actions, no migration.

SPEC IMPACT: None (builds the 2026-10-27 rulings as recorded).
