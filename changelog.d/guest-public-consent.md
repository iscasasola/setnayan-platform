## 2026-06-22 · feat(papic): guest opt-in to share clips publicly (feeds the Alaala orb)

Closes the last upstream gap in the Papic → Alaala flywheel. #2060 shipped the
orb feed + the couple-approval gate (`couple_approved_for_showcase`) and named
the GUEST gate as the remaining follow-up: there was no guest-facing way to set
`consent_to_public`, so an approved clip could never clear BOTH gates and the
orb stayed cold forever. This adds the capture-time opt-in.

OWNER-LOCKED RULE (memory `project_setnayan_alaala_orb_video_consent`): media
surfaces on the public showcase ONLY when BOTH gates are true —
`consent_to_public` (the guest opted in) AND `couple_approved_for_showcase` (the
couple approved). RA 10173: the opt-in is explicit, never pre-checked, default
OFF.

ARCHITECTURE NOTE: a guest who shoots through the Papic Guest camera writes to
`papic_guest_captures` (the per-guest ledger), NOT `papic_photos` (the
seat/paparazzi table the orb reads). #2060's `consent_to_public` landed only on
`papic_photos`, so the guest's own captures had nowhere to carry their consent.
This migration mirrors the column onto `papic_guest_captures` and threads the
flag through the capture path — the guest consents to THEIR OWN recordings.

- **Migration** `20270215631984_guest_capture_public_consent.sql` — adds
  `papic_guest_captures.consent_to_public` (`boolean NOT NULL DEFAULT false`) +
  COMMENT, and updates the quota-enforcing `papic_record_guest_capture` RPC with
  a trailing `p_consent_to_public BOOLEAN DEFAULT false` param that's written on
  the inserted ledger row. Additive + idempotent; the defaulted overload keeps
  the original 2-arg call working during deploy. No RLS change.
- **UI** `apps/web/app/papic/guest/_components/papic-guest-capture.tsx` — a plain
  "Let the couple feature my clips on their wedding page" checkbox near the
  shutter (`text-xs`/≥12px, explicit, default OFF, persistent per session).
  When ticked, each capture POSTs `share_publicly=1`.
- **Route** `apps/web/app/api/papic/guest-capture/route.ts` — reads the
  `share_publicly` flag and passes it to the RPC as `p_consent_to_public`.
  Graceful-degrade: if the 3-arg RPC isn't deployed yet, it retries the original
  2-arg signature so captures still record (consent just can't persist until the
  migration lands). Default OFF never silently shares a guest's media.
- **Retroactive toggle — SKIPPED.** There's no guest-facing view where a guest
  browses their own captured clips (the capture component only shows the live
  camera + the just-saved flash), so there's no surface to hang a per-guest
  retro toggle on. The capture-time opt-in is the core, as scoped.
- **Out of scope:** paparazzi-SEAT clips are captured by the photographer, not
  the guest who appears in them — `papic_photos.consent_to_public` there is the
  appearing-guest's consent and needs a different consent model. The couple-
  approval toggle / `lib/papic-gallery.ts` (#2060) are untouched.

SPEC IMPACT: 0012 Papic / Alaala — guests can now opt in to share their captured
clips publicly (sets `consent_to_public`); with the couple-approval gate this
lets the Alaala orb fill. RA 10173: explicit opt-in, default off.
