---
description: Audit build configs, page layer depth, and button/theme fragmentation — report only, no edits
---

Audit this repo against `docs/ARCHITECTURE.md`. **Do NOT edit any file.** Read from a fresh
`git worktree add --detach <scratch>/wt-audit origin/main`, never from `~` (a stale checkout).
`grep` here is a ugrep shim — use `git -C <wt> grep`. Ignore `apps/web/app/dev/**` and `*.lab.tsx`
except to count them.

1. **Split / duplicate build configs.** List every `next.config.*`, `tsconfig*.json`, `turbo.json`,
   `vercel.json`, `src-tauri/tauri*.conf.json`, every `"build*"` script in every `package.json`,
   and every workflow under `.github/workflows/` that runs a build. Flag two configs that set the
   same option differently, and two scripts/workflows that build the same target.
2. **Deep wrapper pages.** For each `page.tsx`: the layout chain above it, which layouts `await`
   data, and sequential independent top-level `await`s that could be one `Promise.all`. Flag the
   same auth/user read done in both a layout and its page.
3. **Fragmented buttons / themes / skins.** Every reusable button component with its importer
   count; every token source (`globals.css`, `lib/*tokens*`, tailwind config, any name→colour map);
   hex / `rgb(` / Tailwind arbitrary `[#…]` colours outside token files; numbered Tailwind palette
   classes (`bg-red-500`) that bypass tokens. Name the de-facto primary of each.

Output one Markdown table per area: `File | Finding | Evidence (command) | Proposed single home`.
Cite a greppable symbol or the command that re-measures each number — never a bare line number.
End with a ranked cleanup list and STOP for approval.
