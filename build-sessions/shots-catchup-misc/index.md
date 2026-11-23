# #7988 · Home and Discover at 390 px, signed in (catch-up, 19 Nov 2026)

Branch `claude/home-discover-one-layout`, after merging origin/main `2d92d6f09`. The shots come from `next dev`
pointed at a **local stub backend** (`stub-backend.mjs`). It serves a signed-in user with an **empty** account
(no events, no follows, no shops), so every shelf shows its empty state, and Home's "Now happening" card is the
shipped EXAMPLE sample. **This is not production data.** The cloud session could not reach Supabase or the
Vercel preview. The browser is Playwright Chromium at 390×844, isMobile, DPR 2. Script: `shots.cjs`. The welcome
tour was skipped before each shot.

| Shot | What it shows |
|---|---|
| `home-390.png` | Home, signed in: the hub bar, the Events pinned row and the shared bottom bar. |
| `discover-390.png` | Discover, signed in: the **same** bar, the new Discover pinned row and the 16-px gutter. |
| `discover-after-tap-from-home-390.png` | Discover reached by tapping the bottom bar from Home. |
| `before-origin-main-*.png` | The same two pages on origin/main `2d92d6f09`, for comparison. |

**Does the bar survive the tap?** I marked the `<header>` on Home, tapped Discover, then looked for the mark.
- This branch: `barKept: true` (the same DOM node).
- origin/main: `barKept: false` (a new bar was mounted).

**Fixed in this catch-up.** Inside the hub `<main>`, Discover had lost the side gutter that `.fd-main` used to
give it, so every heading sat flush on the screen edge. It now has `px-4 lg:px-6` (the same 16 / 24 px), held by
test `3d` in `app/(hub)/home-and-discover-share-one-layout.test.ts`.

**For the controller to look at. These are this PR's own new parts; main has no Discover pinned row.**
- The Discover pinned row starts at the screen edge: its "Discover ▾" pill is at x = 0. Home's "Events ▾" row
  is inset.
- "Following" is drawn filled in terracotta while the filter is OFF. It is the row's action slot, styled like
  Home's "+".
