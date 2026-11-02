## 2026-09-03 · feat(mood-board): couples can add their own palette roles

**The fixed 18-key palette taxonomy stays exactly as-is** (owner directive:
extend, don't reduce). Couples can now ALSO add arbitrary named roles beyond
it — the owner's example was "Ring bearer's dog," but any couple-typed name
works; a custom role isn't validated against a fixed vocabulary.

**New `RolePalette.custom_roles?: CustomPaletteRole[]`**
(`apps/web/lib/mood-board.ts`), additive alongside the existing
`Partial<Record<PaletteKey, string[]>>` and `room_dressing`. Each entry is
`{ key, label, colors }`; `key` is a slug RE-DERIVED from `label` on every
save (new local `slugifyCustomRoleKey`, mirroring the house `slugify`
pattern in `lib/slugs.ts` rather than importing it, so the client-bundled
`palette-editor.tsx` doesn't pull in `lib/slugs.ts`'s Supabase-typed
imports) — a renamed role re-saves idempotently under its new slug instead
of accumulating duplicates under a stale one.

**`sanitizeRolePalette` now reads, validates, and passes through
`custom_roles`** — this was the load-bearing half of the change: adding the
type alone without fixing the sanitizer would have silently dropped every
custom role on save, exactly the "measurement never reaches the render"
disease this repo has shipped seven fixes for already. Caps: max 10 custom
roles, max 6 colors per role (matching the highest cap any fixed role uses),
max 60-char label, invalid hexes dropped same as fixed keys, entries with no
label or no valid colors dropped, roles that slug to the same key
de-duplicated with a numeric suffix. 8 new unit tests in
`apps/web/lib/mood-board.test.ts` cover the round-trip, the label cap, the
hex-drop, the max-colors cap, the max-roles cap, and the slug collision case.

**UI**: `palette-editor.tsx` gains an "Add a custom role" section after the
fixed Roles family — a name input + the same swatch/add/remove color pattern
already used for fixed roles, with a remove-role control. No new UI
paradigm introduced.

**Downstream renderers updated to append (never replace) custom roles**:
the printable Mood Board PDF (`lib/moodboard-printable.ts`'s `paletteRows`),
the vendor-facing read-only Mood Board page
(`app/vendor-dashboard/clients/[eventId]/mood-board/page.tsx`), and the
Seating PDF's flat-hex export (`app/dashboard/[eventId]/seating/export/route.ts`).
`get_vendor_mood_board`'s RPC needed no change — it already returns the raw
`role_palette` jsonb blob, so custom roles flow through it unchanged once
saved correctly. The 3D Seating Lab
(`seating-lab-3d.tsx`) reads only specific known `PaletteKey`s and ignores
the extra `custom_roles` field without crashing — confirmed, not modified;
3D rendering of custom roles is explicitly out of scope. `applyMoodboardTemplate`
(`actions.ts`) was confirmed unchanged: `mergeRolePalette` spreads the
couple's current palette (preserving any `custom_roles`) and only iterates
the template's own keys, which never include `custom_roles` since templates
author only the fixed taxonomy.

**No migration.** `custom_roles` lives inside the existing `events.role_palette`
jsonb column — an additive field within an existing column, not a new
column or table.

SPEC IMPACT: None — additive to the already-locked Mood Board palette
taxonomy; no fixed-key decision changes.
