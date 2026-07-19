## 2026-06-22 · feat(alaala): feed the memory orb from consented Papic clips

The Alaala "living memory" orb on the brand `/our-story` manifesto was a
permanent cold-start: `AlaalaOrb` took a `clips` prop, but its `DEFAULT_CLIPS`
was `[]`, its only caller passed nothing, and `papic_photos` had no consent
flags — so the orb showed its CSS-gradient skin FOREVER, with no producer and
no feed. This closes the Papic → Alaala flywheel gap: a clip can now actually
reach the orb, gated by the owner-locked double-consent rule.

OWNER-LOCKED RULE (memory `project_setnayan_alaala_orb_video_consent`): a clip
surfaces on the public showcase orb ONLY when BOTH gates are true —
`consent_to_public` (the guest consented) AND `couple_approved_for_showcase`
(the couple approved). Cold-start is preserved: the orb stays empty until the
first clip clears both gates.

- **Migration** `20270215602618_alaala_clip_consent.sql` — adds
  `papic_photos.consent_to_public` + `couple_approved_for_showcase` (both
  `boolean NOT NULL DEFAULT false`) + column COMMENTs + a partial index
  `papic_photos_alaala_showcase_idx` for the orb feed. Additive + idempotent,
  no RLS change (the columns ride papic_photos' existing policies). Applied to
  prod statement-by-statement via `db query` (ledger drift made `db push`
  over-reach) + a `schema_migrations` ledger row inserted; both columns + the
  index verified present.
- **Consumer (feed)** `apps/web/lib/alaala-orb.ts` — new server-only
  `fetchAlaalaOrbClips()` reads `papic_photos` clips where BOTH gates are true,
  non-hidden, NSFW-`clean`, presigns each `r2_object_key` via
  `displayUrlForStoredAsset`, caps to 12. Scoped to the curated showcase events
  (`events.is_sample`) when no event ids are passed (the brand `/our-story` has
  no event in context); the two consent gates are the real guarantee.
  Best-effort throughout → `[]` (cold-start) on any error. `OurStoryManifesto`
  now takes a `clips` prop and threads it into `AlaalaOrb`; `app/our-story/page.tsx`
  switched from `force-static` to ISR (`revalidate=3600`) so it can fetch the
  feed; empty feed → the orb keeps its CSS-gradient cold-start.
- **Producer (couple gate)** new `setClipShowcaseApproval` server action in
  `studio/papic/actions.ts` flips `couple_approved_for_showcase` on one of the
  couple's clips under their own RLS session; revalidates the gallery + the
  public orb. The couple's Papic gallery grid
  (`papic-gallery-grid.tsx`) gains a sparkle toggle on each clip (live =
  terracotta, approved-but-waiting-on-guest-consent = amber) + an inline
  explainer; `lib/papic-gallery.ts` now selects + surfaces both gate flags on
  clip rows.
- **Producer (guest gate) — FOLLOW-UP.** No public-share consent signal exists
  at Papic capture / guest-portal time today (`guests.photo_consent` is RA-10173
  biometric consent, a different thing). `consent_to_public` defaults `false`
  and the column hook is in place so it CAN be set; the full guest-consent
  capture UI is the remaining follow-up. Until it ships, an approved clip stays
  off the orb (waiting on guest consent) — the locked cold-start, preserved.

SPEC IMPACT: 0012 Papic / Alaala — the memory orb now feeds from consented +
approved Papic clips (migration + feed query + couple-approval toggle); closes
the Papic → Alaala flywheel gap; cold-start preserved until first consent.
