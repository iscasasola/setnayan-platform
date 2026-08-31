## 2026-08-31 · feat(avatar): the guest avatar maker — people in the 3D room look like themselves

The 3D room was finished and good, and every figure in it was a generic
stranger. This lands the missing piece: a guest can build their own chibi and
be recognisable at their own seat.

**RULE 0 — almost none of this was new.** `lib/chibi-config.ts` already shipped
the whole catalog + sanitizer (`validateChibiConfig` / `resolveChibiConfig` /
`defaultChibiConfig`), `lib/chibi-geometry.ts` the part buffers,
`kit/chibi-figure.tsx` the renderer, and migration
`20270918210897_chibi_avatar_foundation.sql` the `guests.avatar_config` JSONB
column with its 2 KiB CHECK — all of it flag-dark behind the EXISTING
`NEXT_PUBLIC_FIGURE_CHIBI`. That column had **zero readers and zero writers**
(`git grep avatar_config origin/main` → only its own docblocks). What was
actually missing was the maker, the write path, and the read path. Nothing here
re-invents the catalog, the sanitizer, the hash defaults or a second flag.

- **`lib/venue-avatars.ts` (new, pure)** — the ONE seat-routing rule, consumed
  by BOTH of the guest walk's seat loops so they cannot disagree about a seat.
  `seatRenderKind` reduces term-for-term to the rule that shipped when no
  avatar is present; `avatarsBySeat` returns an EMPTY index when the flag is
  off, whatever the payload carries.
- **THE FALLBACK PIN (`lib/venue-avatars.test.ts`)** — the most important test
  in this change. It asserts the new routing against a **verbatim transcription
  of the pre-change rule** over the entire seat matrix: a guest without an
  avatar must render byte-identically, because the failure mode is silently
  changing the room for everyone who never opted in. A mutation run found the
  suite initially let a "seat drawn twice" sabotage through — the partition
  assertion now covers seats WITH avatars too.

SPEC IMPACT: None yet — the catalog, the column and the flag are all already
specced (`Chibi_Rig_Production_Spec_2026-07-19.md` §§ 3/4/10/11,
`OnTheDay_App_Build_Studies_2026-07-23.md` § 2); this build is those documents'
declared maker/reader PRs. Ships behind `NEXT_PUBLIC_FIGURE_CHIBI`, default OFF.

NEXT CONCRETE STEP (if this session runs out of room): the write path
(`app/[slug]/avatar-actions.ts` on `readGuestSession`), the maker route
(`app/[slug]/avatar/`), the `public_venue_scene` `avatars` block gated exactly
like `photos`, and nulling `avatar_config` in `lib/erasure/purge.ts`.
