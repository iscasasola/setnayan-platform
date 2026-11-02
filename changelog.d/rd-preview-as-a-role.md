## 2026-10-17 · feat(see-as): Role ▾ — preview the guest page as a wedding role

Owner, 17 Oct: *"i want to see how the palette changes depending on the guest?"* — *"for example i want to view it
as a father of the bride"*. The Maker's See as ▾ (PR-10) gains a **Role ▾** while it draws a guest (hold-▶ preview on
a phone, the dropdown above the preview on a desktop): this event's guest-list roles (its role set, in the couple's
own words), with a man / woman half where the role does not say it — Father / Mother of the Bride, Grand­father /
Grandmother, Ninong, Ninang, the secondary sponsors, Maid of Honor, Best Man, Bridesmaid, Groomsman, the bearers, the
Flower Girl, Guest · man / woman. A pick redraws the canvas at `?asrole=<role>-<f|m>`: the same fabricated
seat-holder (`lib/simulated-guest-preview.ts`) now carries that `role`, `attire` and `side`, so Dress Code, Me › What
to wear, the figure and the palette draw exactly what that role's guest reads.

- `lib/preview-role.ts` — the rows (`previewRoleOptions`) and the strict reader (`previewRoleOf`).
- `app/[slug]/page.tsx` — read only inside the See as branch (a verified host). ⚖ 2026-09-14 holds: a role preview
  is named for its role ("A father of the bride") and the preview person (`loadPreviewPerson`) is NOT read for it.
- `hideable-widget-render.tsx` (wrapper) — on the Maker canvas the Dress Code scene answers for the sample seat-holder (its id
  matches no row) instead of the host.
- Nothing is written: draw-time Maker state only; the sample's id, inert canvas and refused reply are unchanged.

Guard: `apps/web/lib/a-role-preview-is-that-roles-sample.test.ts` (sabotaged five ways, each caught).

SPEC IMPACT: None — extends See as ▾ (PR-10); the 2026-09-14 "a generic guest, never a real named one" ruling holds.

## 2026-10-17 · fix(dress-code): "You are Father of the Bride" — a parent named per person

The Dress code's "You are …" line said "Parents of the Bride" to one father. Its one label source,
`resolveGuestDressCode` (`lib/role-dress-code.ts`), now asks the entourage's own per-person resolver
(`kinWordOfReader`, `lib/entourage.ts`: title → attire → "Parent of the …"; a couple's rename wins), fed the
reader's own title, shown name and attire (`guestNameParts` from `site-body.tsx`). Real guests and the Role ▾
preview alike. Guard: `lib/a-role-preview-is-that-roles-sample.test.ts`.

SPEC IMPACT: None — follows the owner's per-person parent ruling (#6598).
