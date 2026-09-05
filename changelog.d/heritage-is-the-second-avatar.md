## 2026-09-06 · feat(3d-plan): Heritage is the second avatar style — guests now choose Chibi or Heritage

Owner 2026-09-06: *"can we finish chibi and heritage? just so there are now
options."* Chibi was finished (#5229 seated, #5231 walking). Heritage is the
2026-07-19 lineup's "revival of the dormant FigureSpec look system": the
articulated mannequin rig has carried `skinTone / hairStyle / hairColor` on its
spec and `SKIN_TONES / HAIR_COLORS / HAIR_STYLE_COUNT` in `figure-rig` since the
blob pivot — and `kit/figure.tsx` read none of them. It does now.

- **The rig honours its own look** (`kit/figure.tsx`): a spec that carries
  `skinTone` is *dressed* — garment cloth on the torso and arms, trouser cloth
  on the legs (the staff path, reused), skin on the head, and one of six hair
  caps (`kit/hair-cap.ts`, procedural sphere sections hugging `HEAD_GEO`). A
  look-less spec is the untouched one-piece mannequin: every guest without an
  avatar renders byte-for-byte as before.
- **`lib/heritage-config.ts`** mirrors `chibi-config`: catalogs are the rig's
  own (nothing invented; the outfit palette is shared with the chibi), strict
  `validate` (unknown key ⇒ rejected), never-throwing `resolve` (field-by-field
  repair to hash defaults), a small whitelist of ids — never a photo, never
  derived from a face. Guest outfits only: gown · suit · barong · filipiniana ·
  neutral (staff garments are refused).
- **`lib/guest-avatar.ts` is the ONE resolver.** No `style` key → chibi (v1
  shipped without one; every stored row today); `style: 'heritage'` → heritage.
  The chibi fallback rule is *called*, not re-implemented. Every reader — the
  walk's own figure, the seated crowd, remotes, the maker — and the one writer
  dispatch through it, so a heritage row can never be hash-rolled into a chibi.
- **Rendering by style:** the viewer's own heritage figure rides the existing
  blob path on a dressed spec (walk, run, sit, wave all work — it is the same
  rig); remotes likewise; seated heritage guests are individual dressed
  `<SeatedFigure>`s at their table, the way photo seats already are; chibi
  seats stay in the chibi crowd; the mannequin crowd skips both.
- **The maker** gains a Style row (Chibi / Heritage), keeps a draft of both so
  switching never loses work, previews the active one with the real rig, and
  saves the active one. The writer validates and whitelists by style.
- No migration: `guests.avatar_config` is JSONB, presence carries the raw
  config, and the RPC ships it raw — all three carry a heritage row unchanged.

Guards: `heritage-config.test.ts`, `guest-avatar.test.ts` (incl. the
heritage-row-never-becomes-a-chibi regression), `heritage-is-the-second-avatar.
test.ts` (the rig's look-gate, every reader through the one resolver, the
writer by style, the maker offering both). The chibi crowd and remote guards
updated to the resolver.

Not built, and said so: Blocky Kit, Soft One-Piece, Kokeshi.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-06 row.
