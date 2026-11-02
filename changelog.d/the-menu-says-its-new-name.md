## 2026-08-26 · fix(admin): the menu says its new name

The 2026-08-25 recut renamed the console's six menus in `ADMIN_NAV_GROUPS` —
Today · People & shops · Studio · Set up · Numbers · Money. It merged, deployed,
and the owner opened the console the next morning and said *"it still looks the
same."* He was right, and the rename was real: the name he READS was a different
copy.

The menu name lives in three places and only one was renamed:

1. `ADMIN_NAV_GROUPS[].label` — the full word in the wide rail. **Renamed.**
2. `STRIP_CAPTION` in `admin-rail-context.tsx` — the word under the icon between
   1024px and 1280px, where the stylesheet hides `.fd-label-text` and shows
   `.fd-icon-caption`. At that width **this is the menu**. Not renamed, so the
   desktop rail still read Overview · Accounts · Ugat · Stats.
3. `NAV_SLOT_DEFAULTS['admin.bottom-nav.*'].label` — which `admin-bottom-nav.tsx`
   overlays **on top of** its own hardcoded label, so the registry wins on every
   phone. Not renamed, so the bottom nav still read Overview · Accounts.

The tell was in the product all along: **Money was the one phone tab reading
correctly, and it is the one tab with no registry slot.**

Also removed `admin.bottom-nav.performance`, a slot for a tab that no longer
exists — never read by the renderer (it looks slots up by live tab key) but still
offered at `/admin/menus` as a renameable row for a tab nobody can see.

New guard `the-menu-name-has-one-source.test.ts` (5 rules, all mutation-checked
by occurrence count). It deliberately **asserts no word** — pinning "Today" would
just be a fourth copy that the next rename edits to go green. It asserts the
relationship: a strip caption must remain a contiguous word-run of its own menu's
label, and a bottom-nav registry default may not disagree with the tab it
overlays. Rename a menu to anything and the copies that did not follow go red.

SPEC IMPACT: None. No product decision changes — this makes the shipped rename
visible on the two screens that were still showing the old names.
