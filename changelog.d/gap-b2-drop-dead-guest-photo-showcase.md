## 2026-07-24 · fix(recap): remove the never-fillable guest-PHOTO showcase reads

Gap audit 2026-07-23 · Batch B2 (owner 2026-07-24: "remove the empty photo
section"). The public wedding recap's "Papic GUEST captures join the day"
section ran two per-load reads filtering `media_type='photo' AND
couple_approved_for_showcase=true`. But the ONLY writer of
`couple_approved_for_showcase` (the studio approve action) is CLIPS-only — a
guest PHOTO can never be approved — so both reads always returned [] and the
section was permanently empty while still hitting the DB twice per recap render.

Removed the two dead queries (`app/[slug]/_components/editorial/data.ts`); the
`guestGalleryRows`/`guestTimelineRows` unions downstream are `.length > 0`-gated,
so behavior is byte-identical (they were always empty). Guest CLIPS still surface
via the Alaala-orb capture-anchor read (unchanged). Documented how to re-enable
guest photos (add a photo-approval action) if ever wanted.

Verified: editorial/public-media tests 19/19 · tsc/lint · next build.

SPEC IMPACT: None — dead-code removal; no behavior change (the section was empty).
