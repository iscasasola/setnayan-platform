## 2026-09-21 · fix(invitation): no Write-to-NFC on the event hub

Owner: *"remove the write to NFC on the event hub."* The guest's own code keepers — the Save and
Copy pair under a guest's invitation QR, on the QR card, the My QR modal and the day-of hub's Me
panel — carried a "Write to NFC" button. It is gone from all three, because they share one
component.

Writing a tag is a job for whoever PRINTS and PLACES it — the couple, or a supplier dressing the
tables — not for a guest holding their own invitation. The strip stays on every host and supplier
surface that owns physical tags; this touches none of them.

The guard that REQUIRED the button (`every-qr-carries-the-strip.test.ts`, `NFC_ONLY_MOUNTS`) now
forbids it, and gains a sweep DERIVED FROM THE TREE: every file under `app/[slug]/` is read, so a
new guest surface that mounts either the button or the full strip is caught without anyone adding
it to a list. A floor proves the sweep read something. Putting the button back turns it red.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-21 row — narrows the 2026-09-20 NFC row's guest surface.
