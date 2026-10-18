# HANDOVER — rd/maker-first-load-headroom · started 2026-10-18 ~20:50 PHT by the controller

BLOCKER: the Maker's first-load JS is AT its budget (507.0 KB of 507.0 KB gz, measured by CI's "bundle size check" on
main 1e5178d). Any PR merged now fails the check by a few bytes even when it touches no Maker code (webpack runtime
holds every chunk hash) — #6643 (copy-only) is red for exactly this. Every future Maker PR (Desktop, overlay effects)
will hit the same wall.
FIX: make real headroom — target ≥ 6 KB gz under budget — WITHOUT raising the budget (raising it needs an owner ruling).
Measure first: the bundle check's own report (the per-chunk list for the Maker route) + `pnpm --filter @setnayan/web
analyze` or the repo's bundle script if one exists. Then move the biggest pieces that are NOT needed for the Maker's first
paint into lazy chunks (dynamic import on open: sheets, pickers, panels behind a tap, desktop-only code, dev-only code,
large constants/registries read only after a tap). No behaviour change; phone first paint must stay identical.
Prove: CI bundle check numbers before → after in the PR body; the Maker's touched tests green; a 375 px walk that the
Maker opens and the lazy pieces load on tap.
Commit + push after every step; HANDOVER current — the account may stop you any time; this is the top item for the next
controller if unfinished. Fragment changelog.d/rd-maker-first-load-headroom.md.

## STATE (builder, 2026-10-18 ~22:00 PHT)
BASELINE measured locally on 1e5178d (CI env, `pnpm build`): Maker first load 507.0KB gz / 507.0 budget (0.0 headroom),
52 chunks; shared bundle 201.8 / 202KB (0.2KB headroom — so every NEW async chunk name costs runtime bytes there; prefer
the existing named groups `maker-details` / `maker-mood-board`).
HOW MEASURED: a LOCAL-ONLY next.config.ts hook (never committed) writes per-chunk module lists + `hidden-source-map`, then
source-map byte attribution per source scaled to each chunk's gz (scripts kept in the builder's scratchpad: smap.mjs,
excl.mjs = exclusive cost per client boundary of the Maker's first-load entries).
TOP EXCLUSIVE CANDIDATES (gz KB, not needed for first paint): media-panels (Maker rows' panels, only drawn when a row
opens) 4.3 · NFC write button inside QrActions (editor-shell "Scan to view") 4.6 · LaunchStdButton (⋯ Go live row) 2.5 ·
dress-code attire fields 4.9 (SKIPPED: form fields inside a server-rendered form — a field not yet arrived would be
missing from a save) · moment-sheet 4.8 (SKIPPED: earlier measured trade-off, see details-lazy.tsx).
PLAN step 1: media panels + LaunchStdButton → stand-ins in details-lazy.tsx (chunk maker-details); NFC → QrActions renders
a lazy NfcWriteButton only when NFC is on (useNfcEnabled), chunk `nfc-write`.

## RESULT step 1 (2026-10-18 ~23:15 PHT) — commit 81bb8fdeee
Maker first load 507.0 → 493.2KB gz (13.8KB headroom; target was ≥6). Shared bundle 201.8 → 201.8 (unchanged).
Moved to `maker-details` (details-lazy.tsx): media panels (7) + LaunchStdButton (editor/page.tsx imports the stand-ins)
and MoreExtras (moved to website/editor/_components/more-extras.tsx; editor-shell mounts the stand-in).
⚠ A first try gated the NFC writer inside QrActions with its own chunk `nfc-write` — it put the shared bundle at
201.9/202 (+1 runtime entry). Reverted in favour of the MoreExtras move (same saving, no new chunk name).
Guards repointed: every-qr-carries-the-strip (STRIP_MOUNTS key → more-extras.tsx), the-maker-lower-third-holds-every-tool
(reads MoreExtras from more-extras.tsx + asserts editor-shell still mounts <MoreExtras>). Sabotage both: red → green.
NEXT: preflight, draft PR, 375px walk (Maker opens; ⋯ sheet shows Scan to view after its chunk; a row panel opens).
PR #6646 (draft, do-not-auto-merge, autoMergeRequest null).
WALK (375×812, /dev/maker-lab on `next dev`, no-database lab env + the 404 stub on 54321; Chromium + Playwright WebKit —
the Safari ENGINE, not a real iPhone): Maker opens; Invitation ▾ › Settings › "Who can view" shows Settings · Your Event
Hub with Scan to view drawn by the lazy MoreExtras (QR image blank = lab has no database). No page errors (console
errors are the expected no-database supabase ones). NOTE: MoreSheet is kept mounted hidden, so MoreExtras' chunk
(`maker-details`) is requested right after hydration — not before it; the same chunk the Maker's mounted stand-ins
(LowerThirdGrab/StageTools/MakerSheet) already pull at mount. The lab imports SiteChromePanel directly, so the media-panel
stand-ins were not walked (typecheck + guards only). Pictures + tools: controller-2026-10-12/walk-headroom/.
