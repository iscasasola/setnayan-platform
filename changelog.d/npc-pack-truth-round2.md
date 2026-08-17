## 2026-08-17 · fix(compliance): the pack stops promising deletions nothing performs

An adversarial audit of the freshly-regenerated NPC pack (7 claim-classes, 2 skeptics per
candidate, 62 candidates → 30 survivors) found more. Four were re-verified by hand against the
live production database before any edit.

**Two were ALREADY ANSWERED by the owner and were applied, not re-asked:**

- **Device fingerprinting stays ON.** The pack called it "built but switched OFF… cannot collect
  anything". Measured: **9 device rows across 4 accounts, first 2026-07-12, most recent
  2026-08-17.** The 2026-07-23 instruction to hold it off was **superseded the next day** by the
  owner-locked Interim Payments & Privacy Deferral Policy, which deliberately activated it and
  put it on the live `/privacy` page. The feature is correct; the pack was stale.
  ⚠ A session briefly set the control inactive by applying the **older** of two decisions, then
  restored it minutes later. `approved_at` was overwritten and is reconstructed from the three
  sibling controls approved in the same batch; the row's note records that.
  🔑 **The decision log is append-only — the first hit is the OLDEST. Grep for a LATER ruling
  before applying an earlier one.**
- **Backups stay on the free plan.** Owner 2026-08-10 (*"let's stay free for the moment"*), a row
  that already records "no automated backups" as knowingly accepted. So no spend is proposed: the
  pack's "Daily encrypted backups retained 30 days" claim is **deleted** and — the part that
  mattered — the breach-recovery step no longer instructs restoring from backups that do not
  exist.

**Three retention rules newly decided by the owner and written in:** face data deleted **3 months
after the event ENDS**; a supplier's ID image + liveness video deleted **90 days after the
approve/reject decision**, keeping only the decision record; and the **5-year auto-purge of event
data is WITHDRAWN** in favour of life-of-account.

🚨 **That last one was withdrawn because implementing it literally would have deleted the
photos.** In the live schema the photo rows, guest list, tags, schedule and supplier list all
cascade from the event, so "delete the wedding at 5 years" means "delete the album" — against the
owner's twice-locked rule that no photo is ever deleted, only compressed.

🔒 **Deleting face data does NOT remove photo tags** — verified in the live schema: a tag carries
the guest link itself and has no reference to face data, so nothing cascades. Guests keep every
photo already delivered; only future automatic matching is lost. That is what makes the 3-month
mark safe, and it is the question the owner asked before approving.

**New activity DPS-20 — the couple→supplier payment log.** The register claimed platform-wide
that Setnayan *"never holds, moves, or **records** the transfer of any money"*, and used it as the
reason the coordinator's money scopes needed no financial declaration. The "records" half was
false: **3 payment records totalling ₱111,500** exist, with amounts, dates, methods and reference
numbers. Now declared. The 0%-commission position is untouched — we still never hold or move the
money.

**Guard extended to 9 assertions.** The important new one: **an adopted-but-unbuilt retention
period must always say it is not yet enforced.** Production has ZERO scheduled jobs, so writing
"deleted after 3 months" alone would swap an old false promise for a newer one. The guard also
caught an inconsistency in this very change — a correction sentence phrased outside the standard
marker read as a surviving promise; the wording was fixed rather than the guard loosened.

SPEC IMPACT: Applied directly in the corpus — ROPA (DPS-01/02/04/14/19 + new DPS-20), Privacy
Manual (ADOPTED + DRAFT), Breach Management Policy (ADOPTED + DRAFT), face-vector DPIA, executive
dossier, device-fingerprint DPO review. `DECISION_LOG.md` 2026-08-17.

⚠ Filing is still January 2027; all 15 filing tasks remain `not_started`. Neither new deletion
rule is BUILT — that is named, not hidden.
