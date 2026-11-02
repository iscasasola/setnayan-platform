## 2026-07-21 · fix(live-studio): the OBS pop-out rendered nothing — move it out of the dashboard shell

Owner: *"pop out for obs showed nothing."* Correct — it rendered the dashboard chrome with an
empty middle.

### Root cause

The pop-out lived at `/dashboard/[eventId]/studio/panood/broadcast/program` and drew a
`fixed inset-0 z-[9999]` layer to cover the shell. But the shell's content `<main>` carries
`.sn-vt-page` → **`view-transition-name: sn-page`**, and a named view-transition element
establishes containment — which makes it the **containing block for `position: fixed`
descendants**. The page returned *only* that fixed layer, so the `<main>` had no content height,
`inset-0` resolved against a zero-height box, and the surface collapsed to nothing.

### Fix — a real top-level route

Moved to **`/panood/program/[eventId]`**, which inherits only the root layout: no sidebar, no top
bar, no view transitions, nothing to escape from. `fixed inset-0` becomes `h-[100dvh]`, because
the page now owns the whole window instead of fighting a shell for cover.

Covering chrome with a z-index was the wrong instinct regardless: **OBS captures the WINDOW**, so
any chrome in the tree is one layout change away from leaking into the couple's broadcast. A route
with no chrome cannot leak chrome.

Gating unchanged — signed in → control-room member, and deliberately **no paid gate**: the free
tier needs the pop-out to confirm the OBS capture works before the day, and it renders *with* the
SETNAYAN overlay like every other surface, so it never becomes a softer door to a clean feed.

The control room's "Pop out for OBS" button now targets the new URL. The old route is removed
rather than redirected — it never worked, so there is nothing to preserve.

124 unit tests pass; typecheck + production build clean. New route: 2.36 kB.

SPEC IMPACT: `Live_Studio_Repackaging_2026-07-08.md` § 10 PR #4 describes the pop-out as a
"chrome-less Program output" — this is the first build where that is literally true.
