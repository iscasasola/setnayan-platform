## 2026-06-28 · fix(papic): photo-driven readers exclude guest clips (media_type filter) — sibling of #2335

Root-cause sweep of every `papic_guest_captures` reader in `apps/web`. A
photo-only consumer that omits `.eq('media_type','photo')` pulls guest CLIP rows
(`media_type='clip'`) whose `r2_object_key` is a video, which then break the
photo render (blank tile / `sharp()` decode reject). Fixed the two remaining
photo-only readers found (beyond #2335's `guest-stories.ts` and the
separately-owned `guest-live-gallery.ts`):

- `studio/papic/magazine/route.ts` — the Kwento Magazine PDF spine ("photos
  only", feeds `sharp()`): added `.eq('media_type','photo')` to the guest-capture
  query, mirroring the `papic_photos` `photo_type='photo'` gate already present.
- `studio/papic/_components/magazine-card.tsx` — the "{photos} photos" count that
  gates + labels the magazine card: filtered BOTH sides to photos only
  (`photo_type='photo'` seat / `media_type='photo'` guest) so the count matches
  the magazine it opens.

Added `lib/papic-media-filter.ts` (named constants + `isPapicPhotoRow` predicate)
as the single tested source of truth for the photo-only rule, with
`lib/papic-media-filter.test.ts` asserting clips are excluded and legacy
null/absent-discriminator rows stay photos (DB default = 'photo').

All other `papic_guest_captures` readers were verified INTENTIONAL (clip-aware
galleries, the full-archive ZIP, the Alaala clip orb, moderation/report/count
surfaces, write-path lookups) and left unchanged.

SPEC IMPACT: None
