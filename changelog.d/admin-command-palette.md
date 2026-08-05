## 2026-08-04 · feat(admin): ⌘K — type three letters, go

The admin is **108 pages** behind a sidebar the owner locked to six flat doorways (2026-07-15, *"solid menu with no submenus"*). A short menu is only safe if the long tail is reachable **by name** — otherwise finding a page depends on remembering which drawer it lives in.

⌘K (Ctrl-K on Windows) opens a search over every menu destination. Arrow keys move, Enter goes, Escape closes. Results are grouped by menu, and matching prefers a label that *starts* with what you typed, then contains it, then has the letters in order — so `sec` finds **Secrets & Rotation** before anything merely containing those letters.

### A shortcut, never the only door

Everything it reaches is also browsable at `/admin/more` — "All surfaces" — which is why this can be keyboard-only and unlabelled without stranding anything. **If a destination is ever reachable only by typing, that is a bug in the menu, not a feature of this.**

### Two things the codebase decided for me

**The client boundary.** It imports `ADMIN_NAV_GROUPS` directly rather than taking it as a prop. That array carries `icon: LucideIcon` refs — function objects that cannot cross the Server→Client boundary as props, the exact crash `admin-sidebar.tsx` documents. Importing it into a `'use client'` module bundles the real array instead. Single source; never a second hand-typed roster.

**The focus contract.** My first draft only *restored* focus on close and was correctly rejected by `modal-a11y-adoption.test.ts`, which refuses anything claiming `aria-modal` without routing through the shared `useModalA11y`. **Restoring is not trapping** — a keyboard user must not be able to Tab out of an open dialog into the page behind it. Now uses the shared hook, so Escape and focus-restore come from the same place as every other overlay.

Mounted once at the admin shell rather than per page: one overlay in the tree, works on all 108 pages, and renders `null` until opened so the closed cost is a keydown listener.

Verified: unit suite **6,487 pass / 4 fail** — the same four pre-existing `@electric-sql/pglite` module failures on unmodified `origin/main` · lint clean · zero typecheck errors in the changed files · a11y adoption guard green.

SPEC IMPACT: None — navigation only.
