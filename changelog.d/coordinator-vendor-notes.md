## 2026-07-20 · feat(coordinator): per-vendor working folder — private vs shared notes (flag-off)

Coordinator P4 (corpus `Coordinator_Role_Feature_Spec_2026-07-18.md` § 4 P4):
the per-vendor **working folder** note stream with the industry-standard
private-vs-client split — a coordinator preps notes privately, then shares
what's ready; the couple sees shared notes (and can add their own) but NEVER
the coordinator's private ones.

What landed:

- **Migration `20270825279091_event_vendor_working_notes.sql`** — append-only
  notes table per `event_vendors` booking: `author_user_id` · `author_role
  ∈ {coordinator, couple}` · `visibility ∈ {coordinator_private, shared}` ·
  `body` (≤4000 chars). No versioning machine (the spec's "proposal
  versioning" clause is about proposals, not notes) and **no UPDATE policy**
  — notes are added, never edited; the author may delete their own note (the
  safety valve for a private observation misfired into `shared`). A composite
  FK `(event_vendor_id, event_id) → event_vendors(vendor_id, event_id)` makes
  the RLS-load-bearing denormalized `event_id` unforgeable.
- **RLS** — canonical Pattern B (per-event collaborative data) via the shipped
  `coordinator_feature_recommendations` split idiom: coordinator side gates on
  `current_moderator_event_ids()`, couple side on
  `current_couple_event_ids()`. ⚠ Deliberately **unusual direction**: the
  couple's SELECT carries `AND visibility = 'shared'`, so the event owner
  canNOT read every row on their own event — that carve-out IS the feature.
  Couple INSERT is forced to `shared` (policy + CHECK). Admin read-only lens.
- **`lib/vendor-working-notes.ts`** — pure TS mirror of the RLS predicates
  (`canReadWorkingNote` / `canWriteWorkingNote` / `visibleWorkingNotes` /
  `workingNoteAuthorRole` / `canDeleteWorkingNote`) + the feature flag; unit
  suite `vendor-working-notes.test.ts` pins the full truth table, above all
  "couple can never read or author `coordinator_private`".
- **UI** — `WorkingFolderNotes` self-contained server component in the vendor
  workspace (`vendors/[vendorId]/workspace`), rendered in both the long-scroll
  page and the RelationshipTabShell Details tab. Write-time visibility toggle
  (coordinator only; default = private), private notes visually distinct
  (dashed border + Lock badge), couple composer locked to shared. Server
  actions `addWorkingNoteAction` / `deleteWorkingNoteAction` in the workspace
  `actions.ts` (vendors/actions.ts — incl. the #3405
  `coordinatorMoneyScopeAllowed` guards — untouched).
- **Flag `NEXT_PUBLIC_COORDINATOR_VENDOR_NOTES_ENABLED` (default OFF)** — the
  panel is couple-facing new UI, so it ships dark: flag off/absent ⇒ the
  component returns null with zero queries and the actions no-op — today's
  workspace page byte-for-byte. The table ships regardless and is inert until
  the owner flips the flag (Vercel env).

SPEC IMPACT: Coordinator_Whats_Next_2026-07-18.md § 5 P4 shipped (per-vendor
working folder — private coordinator notes vs couple-visible notes; contract
files already live in the workspace Documents section; proposal versioning
deliberately not built — append-only rows per the recon directive).
