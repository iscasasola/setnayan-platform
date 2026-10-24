## 2026-10-25 · fix(nfc): the Write-to-NFC sheet follows the house design

Owner, on two phone screenshots of the guest card's NFC writer: "the NFC write does not follow our design
templates". Restyle only — behaviour, the read-back rule and the flow are unchanged.

- The shared `Sheet` without its `title` strip (that strip was the monospace eyebrow); the heading is the house
  19 px title with its details in an ⓘ (`InfoTip`).
- Every outcome is the house `StatusLine`: Tag written ✓ (info) · Not confirmed ⓘ (warn) · Write failed ⚠ (bad).
- The link is a read-only field (no monospace) with a Copy `ActionButton`.
- Every control is an `ActionButton`, icon + word, toned by meaning, in one fit row that never wraps: one main verb
  per state — "Write another" after success, "Check tag" when not confirmed, "Try again" on failure; the rest quiet.
- The body is `NfcSheetBody`, drawn from props, so a lab can draw every state without a radio.
- Guard: `app/_components/the-nfc-sheet-is-a-house-sheet.test.ts`.

SPEC IMPACT: None
