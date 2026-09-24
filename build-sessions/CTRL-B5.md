# CTRL-B5 — THE EVENT HUB MOVES (the pass's look is built first, elsewhere)

**Model · effort: Opus · high.** Owner priority, 2026-09-21: *"add them to the next plan of overall
controller. and prioritize it there."*

```
cd ~/Documents/Claude/Projects/setnayan-platform && claude --model claude-opus-5
```

**Read first:** `build-sessions/BUNDLE-COMMON.md`, `build-sessions/ARRIVAL-COMMON.md`, then
`build-sessions/ARRIVAL-S7-motion.md` (commit 2's full brief). The approved design is the canvas
https://claude.ai/artifact/WhaPx4CKwbDTUqN1QCBedh — boards "4 · The pass" and
"Prototype · tap through it".

**⛔ CANCELLED — DO NOT OPEN.** Owner, 2026-09-21: *"can you build all 3 in 1 merge?"* The Event Hub session builds the pass, the motion AND the tab bar in one PR. This file is kept only as the brief. ~~**⏸ DO NOT OPEN YET.** Owner, 2026-09-21: *"let us finish 1 first here."* Commit 1 below (the pass's
look) is being built in the Event Hub session right now. **Start B5 only after that PR has MERGED**,
branch from the `origin/main` that contains it, and build **commit 2 only**. Commit 1 stays in this
file as the record of what the pass should look like.

**One branch, one PR, one commit (motion).** Branch from `origin/main`.

⚠ **COORDINATE BEFORE YOU START.** Run `gh pr list --state open --limit 40 --json number,title,headRefName`
and `git worktree list`. Anything touching `app/[slug]/_components/site-body.tsx`,
`guest-hub-bar.tsx`, `background-music.tsx` or `invitation-shell.tsx` is your overlap — say so and
stop rather than racing it.

---

## What already ships (2026-09-21) — extend it, do not rebuild it

- **The pass card** is `passCard` in `app/[slug]/_components/site-body.tsx`, anchored at
  `id={PASS_ANCHOR}` (`lib/arrival-action.ts`). Since PR #5796 it prints Guest · Table · Arrive ·
  Bringing from `lib/guest-pass.ts`, each omitted when the fact does not exist.
- **One QR** (PR #5802): the Me section's "My QR" shows only when the pass card is missing.
- **One seat link** (PR #5806): "Find my seat" → `/seat/claim`, gated on seating being enabled AND
  published.
- **No "Write to NFC"** on any guest surface (PR #5799). Keep it that way.
- **Face step** opens on the first camera tap, not on the page (PR #5800).
- **Share/Report** are a footer at the end of the page (PR #5808). **Music** is pinned top-right with
  a "Tap for their song" hint shown only at the top (PRs #5815 · #5823 · #5840).
- **The monogram has no ring** (PR #5817).

## Commit 1 — the pass looks like the design · 🔨 BUILT IN THE EVENT HUB SESSION, not by B5

The card still wears the old QR card's dress: a "YOUR INVITATION QR" eyebrow, a "For tagging &
pickup" heading and a two-line paragraph about photographers, the raw invitation URL in mono, on a
cream box. Owner, on this page: *"so many text. we want the event hub to be minimalist."*

The design (canvas "4 · The pass"): the couple's names and date at the top, the four facts in two
columns, **one large QR on a quiet ground**, one line under it ("Show this at the door. It finds your
table too."), then the existing keepers (save / copy) and "Find my seat". Dark ground or a dark header
band — follow the canvas; colours from the site palette (`buildSitePaletteVars`), never hard-coded.

- Delete the photographer paragraph and the printed URL from the card face. If the photographer
  explanation must survive, it goes behind the camera's first-tap sheet, which already exists.
- Keep `id={PASS_ANCHOR}` on the card, keep it in exactly one of its two slots, keep the QR's quiet
  zone (`every-qr-carries-the-strip.test.ts`), keep `GuestCodeKeepers`.
- Guards that pin this card and must stay green: `lib/the-pass-is-a-pass.test.ts`,
  `app/[slug]/_components/one-qr-on-the-invitation.test.ts`,
  `app/[slug]/_components/one-seat-link-on-the-pass.test.ts`,
  `lib/one-action-says-where-you-stand.test.ts`, `every-qr-surface-can-be-kept.test.ts`, the
  `the-invitation-is-not-a-receipt` eyebrow count, `lint-guest-legibility` (≥12px), `measures.test.ts`
  (mx-auto columns: max-w-5xl/3xl/prose/md only). Run test paths as `app/**/name.test.ts` — a
  bracketed path runs 0 tests and exits 0.

## Commit 2 — the hub moves, and every movement means something

Build exactly `build-sessions/ARRIVAL-S7-motion.md`. Two updates since it was written:
- Movement 4 (sheets) now also covers the camera's first-tap sheets (photo rules → optional face
  step), which live in `app/papic/guest/_components/papic-guest-capture.tsx`.
- The music button's playing bars (`.sn-eq-bar` in `globals.css`) are the one existing loop besides
  the "happening now" dot. Put both on the shared motion tokens; add no third loop.

## Not yours — the owner decides

**The bottom tab bar.** The canvas says *no tab bar before the day* (slim header with the mark and
names, jump chips); the live page has the five-tab `SiteMenuBar` (Home · Details · Camera · Story ·
Join) from the earlier site-menu decision. Do not remove or restyle it. If commit 1 or 2 would read
better without it, say so in the handback.

## Handback

The PR number · a phone-width screenshot of the pass on production after merge (`/cale-ice` as a
guest needs a guest link — say so if you could only see the logged-out page) · the six movements and
where each lives · proof reduced-motion turns them all off · what you could not verify on a real
phone.
