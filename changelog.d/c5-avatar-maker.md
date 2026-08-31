## 2026-08-31 · feat(avatar): the guest avatar maker — a guest is themselves in the 3D room

The 3D room was finished and good, and every figure in it was a generic
stranger. This lands the maker, the first writer `guests.avatar_config` has ever
had, and the read that puts the result in the room.

**RULE 0 — almost none of this was new.** `lib/chibi-config.ts` already shipped
the whole catalog + sanitizer (`validateChibiConfig` / `resolveChibiConfig` /
`defaultChibiConfig`), `lib/chibi-geometry.ts` the part buffers,
`kit/chibi-figure.tsx` the renderer, and migration
`20270918210897_chibi_avatar_foundation.sql` the `guests.avatar_config` JSONB
column with its 2 KiB CHECK — all behind the EXISTING `NEXT_PUBLIC_FIGURE_CHIBI`.
That column had **zero readers and zero writers**: `git grep avatar_config
origin/main` returned only its own docblocks. chibi-config's header names three
future consumers — the maker client, the server sanitizer, the venue reader —
and this change is those three. No new catalog, no new sanitizer, no new hash,
no second flag.

- **`app/[slug]/avatar/` + `avatar-actions.ts`** — the maker and the write path.
  Every control is generated from an exported catalog; the preview is the
  shipped `<ChibiFigure>`, so what a guest builds is what the room draws. Trust
  model is the shipped one (`readGuestSession` must match both event and guest).
  `resetMyAvatarAction` writes NULL — the revocation, in the same screen the
  choice was made.
- **`20271186016459`** — `avatarConfig` on `public_venue_scene`'s existing `you`
  block: the viewer's own config, populated only when a personal token matched a
  live seated guest. Deliberately NOT gated on `venue_photo_visibility` — that
  setting governs showing guests to each other, never whether you may see
  yourself.
- **`lib/venue-avatars.ts` + the fallback pin** — the read rule, and the most
  important test here. A guest with no avatar must render byte-identically,
  because the failure mode is silently changing the room for everyone who never
  opted in. Mutation-tested; a run also caught the earlier draft of this suite
  passing a "seat drawn twice" sabotage, which is now covered.
- **`lib/erasure/purge.ts`** — RA 10173 erasure nulls `avatar_config`. Not
  biometric, but an erasure that left a chosen face and outfit standing in a 3D
  room would plainly not be an erasure.
- **`tests/db/an-avatar-reaches-only-its-owner.db.test.ts`** — the real RPC,
  replayed: it arrives, it reaches nobody else, it is never invented for a guest
  who has none, and it survives all three photo-visibility values.

- **`app/[slug]/venue/page.tsx`** — the maker's only door, flag-gated to match
  the route (which 404s when the flag is unset), so it never links to a dead
  end. A route nobody can reach is the same as not shipping it.

⚠ **DO NOT FLIP `NEXT_PUBLIC_FIGURE_CHIBI` YET.** Two gaps are real and are NOT
faked in code:
  1. **No gait.** The chibi rig is jointless below the neck (chibi-geometry
     merges legs, shoes and outfit into single buffers), so an avatar figure
     GLIDES where the blob runs. `pose`/`phase` have nothing to drive.
  2. **No seated avatars.** For the same reason, "seated" is new geometry, not a
     pose. Seated guests therefore still render as the anonymous mannequin, and
     the RPC does not ship their configs — shipping a payload ahead of its reader
     is the inert-column problem this change exists to fix.
Both are the rig spec's § 11 / PR-2 pose work and belong in `lib/chibi-geometry.ts`
behind its `chibiJunctionAudit` merge gate.

SPEC IMPACT: None — the catalog, the column and the flag are already specced
(`Chibi_Rig_Production_Spec_2026-07-19.md` §§ 3/4/10/11,
`OnTheDay_App_Build_Studies_2026-07-23.md` § 2); this is those documents'
declared maker/reader PRs.
