## 2026-10-02 · fix(root-map): wave 1 — "Filled in but not saved" 17 → 0, "Sanitisers that drop keys" 3 → 0

Every one of the 20 lines was opened and decided against the code; the Root map
baselines shrink by exactly those 20 lines and nothing else moves.

- **Dead fields removed from the form** (the action never needed them):
  `concierge_choice` (create event — retired 2026-05-28, always 'diy'),
  `guest_id` (invitation "Mark sent" — the guest is bound into the action),
  `business_name` + `category` (supplier workspace invite — re-read from the row),
  `amount_php` (pay panel — the ORDER's amount is stamped, never the form's).
- **Already saved — the scanner could not see it** (fixed in `lib/ugat/scan-fields.ts`,
  each with a fixture test proven by sabotage): a keyed reader that hands its key
  to another keyed reader (`readHttpUrl(fd, 'media_url')`, social queue × 4); a
  child component posts only ITS OWN inputs, not its file-mates' (songs merge
  `dup_id`/`canonical_id` were pinned on the delete form); a field whose `if`
  branch calls something non-pure decided something (`redirectBack`, `syncCardGroups`,
  `updateVendorStatus`, a gated `revalidatePath`) — `if (x) console.log()` still
  does not count.
- **Sanitisers no longer drop silently on a save:** `sanitizeGroupAttire` and
  `sanitizeReceptionDesign` take an optional `dropped` list naming every unknown
  key / style / option; the dress-code save and `saveReceptionDesign` REFUSE when it
  is non-empty instead of storing less than was sent. `scrubWizardState` already
  returned `strippedPaths` (erasure — dropping is the point, and it is reported).
  `scanSanitizers` now treats a cleaner that pushes its drops onto a returned list
  as not silent (fixture test, both sides).
- Round-trip cases added for Pay › Send the proof and Supplier workspace › invite link.

SPEC IMPACT: None
