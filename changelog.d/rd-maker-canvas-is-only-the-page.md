## 2026-09-25 · fix(event-hub): the Maker's canvas is only the page — and never the Maker again

Owner, verbatim: *"the scene is now wrong. it used to be just the scene. now you
embeded the editor inside the editor"*, then *"editing should only be the page"*.

**Root cause.** The canvas is an iframe of `/<slug>?editor=1`, and that page drew
the host's own chrome inside it: the Host controls bar ("Your live site — as a
guest sees it · Edit this site · Preview Save the Date / Invitation / …"), the
bottom tab bar with the host's "Manage", the "Live hub" pill, the floating music
button. Every one of those is a LINK into the dashboard — "Edit this site" goes to
`/website/editor`, which forwards into the Maker (`/launch`). A tap inside the
canvas navigated the FRAME, and the frame then drew the whole Maker inside the
Maker. No server redirect was involved: `app/[slug]/page.tsx` has no redirect
into the dashboard (now held by a test).

**What changed.**
- **One flag, `isEditorCanvas`** (`app/[slug]/_lib/editor-canvas.ts`): the
  request asks with `?editor=1` (the canvas) or `?preview=draft` (the ▶ Play
  tab), and `page.tsx` honours it only for a verified host (`loadHostMembership`).
  It only ever HIDES. `SiteBody` threads it to every piece of chrome: the Host
  controls bar, both `SiteMenuBar` mounts, `PublicEventDayBar` (Live hub),
  `BackgroundMusic`, the supplier ribbon/doorway, the guest doorway strip, the
  everything-else sheet, "Stories about this day", the site header
  (`InvitationShell editorCanvas`), `GuestHubBar` and Share/Report. The root
  layout's cookie-consent and stale-tab notices carry `data-app-chrome` and are
  hidden in the canvas by one inline rule.
- **"Guest bars" switch** at the canvas's lower right (below the page, never over
  it; remembered per session): ON adds `&bars=1`, which brings back the GUEST
  header and the guest tab bar — drawn for a guest, so no "Manage". Host chrome
  never returns.
- **Two defences in the Maker** (`website/editor/_components/maker-canvas-guard.tsx`):
  the canvas checks its frame's path after every load and covers anything off
  the couple's page with "That link leads out of your … page" + "Back to your
  page"; and the Maker covers itself with "Preview unavailable" if it is ever
  loaded inside a frame.
- **▶ Play** now opens `/<slug>?phase=<stage>&preview=draft`: page-only, the
  host's draft, no click-to-edit bridge, tab titled
  "Preview · <Stage> · <names>".

**Verified** on the local harness (Next dev + sample-data stand-in, signed in as a
sample host): all four stages in Desktop and Phone mode render the page with no
Host controls bar, no tab bar, no header, no Live hub pill and no Maker inside
the frame; Guest bars ON shows the guest header and "Home · Details · Story ·
Camera · Join" with no "Manage"; forcing the frame to `/dashboard/…/launch`
shows the cover (and the inner Maker reports itself framed), and "Back to your
page" restores the canvas.

**Tests.** `app/[slug]/_lib/the-maker-canvas-is-only-the-page.test.ts` — renders
the shell with and without the flag, anchors every chrome mount per component
with its count (sabotaging one of the two `SiteMenuBar` gates goes red), holds
that the flag is a verified host, that the guest page never redirects into the
dashboard, and the Maker's frame guards.

SPEC IMPACT: None — no product decision changed; the canvas now matches the
owner's stated rule ("editing should only be the page").
