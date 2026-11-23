## 2026-11-22 · chore(batch): ship batch K — stalled fixes done in the batch, booth Pro floor, new-client window

Merges #8073, #8079, #8031, #8096 (follow-up), #8126 and #8086. Fixes made in the batch, on the owner's "fix all":
- **Papic pill:** the head pill reads "On — event day".
- **Guests:** the Seats count is hidden on a failed tables read.
- **#8031:** re-merged onto the shipped welcome doors. The invite page keeps `?next=` and no longer shows the line twice.
- **Maya:**
  - "Payment not finished. Nothing has been charged." appears on a settle outcome of 'none' only.
  - Sandbox approval needs both the payer and the order owner to be internal.

One migration, on the controller's GO: `20271356623783` (blob 69fbb364f7). Server actions stay at 1251 of 1251.

SPEC IMPACT: None
