## 2026-09-14 · fix(privacy): a guest's takedown reaches the supplier's copy

Owner ruling (`DECISION_LOG.md`, "decision (DPO): a guest takedown reaches the
supplier's copy", 2026-09-14): asked whether a supplier who photographs a guest
keeps that photograph when the guest asks for it to come down, he overrode his
earlier *"that's their own copy, they get to keep it for portfolio"* with
**"no. we will honour the guest."**

`lib/hide-a-reported-photo.ts` searched TWO capture tables. Four exist. The two
it missed are the supplier-owned ones — `vendor_papic_captures` (a booked
supplier shooting on the Papic camera) and `vendor_papic_portfolio_photos` (the
supplier's own marketing album, i.e. the thing the overridden position named).
Both already carry `hidden_at`, both have readers that filter on it, and
**nothing had ever written it as a takedown**, so a moderator pressing "Hide"
against one of those ids matched no row, stamped the report *"Content hidden by
Setnayan moderator."*, and the photograph stayed where it was. No error
anywhere; the only symptom an absence.

🔑 **This is the SECOND instance of a defect whose first instance is described
in the file being edited.** That file was created in September to fix exactly
this, for the seat-camera table. It fixed the list and left the list a list. So
the guard is not "these four work" — a guard of that shape would have been green
through both instances. `tests/db/a-takedown-reaches-every-suppliers-copy.db.test.ts`
asks the REPLAYED SCHEMA which tables hold a captured file at a celebration with
a takedown switch (`event_id` + `r2_object_key` + `hidden_at`) and goes red
naming any that `REPORTED_PHOTO_TABLES` does not reach. A fifth capture table
turns it red by existing.

Also in this change:

- **The supplier is told.** New `guest_takedown_honored` notification type
  (enum migration `20271226261855`), emitted by
  `lib/tell-the-supplier-it-came-down.ts` from the moderator's resolve action,
  **and on `EMAIL_ENABLED_TYPES`** — the notification and the allowlist are two
  halves of one mechanism, and a supplier on a wedding floor is exactly the
  person an in-app badge never reaches. The guest is never named; the copy lives
  in a pure `supplierTakedownNotice()` a unit test reads.
- **The NSFW screen can no longer resurrect a takedown.** The background screen
  in `app/api/vendor/papic-capture/route.ts` wrote `hidden_at: null` on a clean
  verdict. The insert never sets `hidden_at`, so that write was a no-op in every
  case except the one that matters: a takedown landing before the screen
  finished was silently reversed. A clean verdict now records only that the
  screen ran.
- **Disclosed on `/privacy`**, one bullet in "Your rights (RA 10173)".
- **`data_privacy_controls.note` for `vendor_papic_capture`** now says what the
  control does (migration `20271227225871`, fills only an empty note so an
  admin's own audit note is never overwritten). ⚠ Correction carried: that row
  is NOT uniquely missing a note — **16 of 20 controls lack one**; the other 15
  are a separate owner question and deliberately untouched.

Explicitly OUT of scope: the consent wording shown to a guest before the first
photo. The owner ruled on timing, not on the words, and nobody is inventing
consent copy on his behalf.

SPEC IMPACT: None — the decision row already exists in `DECISION_LOG.md`
(2026-09-14, commit 083de72); this is the implementation of it.
