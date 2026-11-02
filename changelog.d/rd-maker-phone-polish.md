## 2026-09-26 · fix(event-hub): Maker phone polish — honest print previews, a faster Post Event canvas, one visibility control, one upload-limit line

Four phone-size (375×812 / 390×844) defects on `/dashboard/[eventId]/launch`,
found by the controller checking production on a phone:

- **Prints & Tickets previews no longer sit as silent grey boxes.** Each
  sample (`launch/_components/maker-prints.tsx`) now goes through the new
  shared `<PrintPreview>` (`launch/_components/print-preview.tsx`): a shimmer
  + "Drawing your `<piece>`…" while `/api/hub-print` renders, the real image
  faded in on `load`, and — never a silent grey box — an honest line + Retry
  on `error`. The state → copy mapping is a pure function,
  `lib/print-preview-view.ts`, because this repo's unit suite has no DOM to
  fire a real `error` event against. Server-side: `/api/hub-print`'s `screen`
  responses (SVG + sample JPEG) now carry `stale-while-revalidate=300`
  alongside the existing `max-age=60`, so flipping between the Maker's theme
  chips and Prints tab repaints instantly from the last render instead of
  re-earning the full server draw every time.
- **The Post Event canvas (`?phase=editorial&editor=1`) is instrumented and
  one real cause is fixed.** `app/[slug]/page.tsx` made FIVE separate
  `supabase.auth.getUser()` calls in a single render — its own Auth-server
  round trip each time — where `getCurrentUser()` (`lib/auth.ts`) already
  exists, `cache()`-wrapped, as the fix already proven for this exact shape on
  the dashboard. All five now resolve to one shared Promise. The route is also
  now instrumented with `lib/server-timing.ts` (same instrument as
  `vendor-dashboard/layout.tsx`) around `auth`, `media`, `widgets`,
  `doorway-facts` and `guest-context`, so the real phase-by-phase numbers are
  in the Vercel log drain (`[server-timing] {"route":"slug/invitation-body:editorial",…}`)
  going forward — this sandbox could not run a seeded live request to report
  numbers directly. At minimum, the loading skeleton
  (`app/[slug]/_components/invitation-skeleton.tsx`) now says "Loading your
  Post Event…" instead of "Loading your invitation…" whenever the Maker's own
  canvas/preview asks for a specific phase.
- **The Schedule scene sheet's two visibility controls are now one.**
  `SectionsPanel` (`website/editor/_components/sections-panel.tsx`) rendered
  the eye ("Visible"/"Hidden") AND the Auto·Shown·Hidden chips on every row —
  but `openBrowseSectionVisible` (`lib/invitation-widgets.ts`) only ever reads
  ONE of them per event, picked by `events.website_open_browse` (the couple's
  own "Open browsing" toggle): the mode chips when it's on, the eye when it's
  off — so one control was always silently dead. A new `openBrowse` prop now
  renders exactly one, per event, in both the full order list and the Maker's
  per-scene sheet. Held by
  `website/editor/_components/visibility-control-is-singular.test.ts`.
- **The Hero panel's upload limit is stated once.** `FileUpload` already
  prints its own "JPEG · JPG · PNG · WEBP · UP TO 10 MB" line from
  `acceptedTypes`/`maxSizeMB`; `maker-made-once.tsx`'s redundant
  `help="JPG, PNG or WebP up to 10 MB."` (a second, differently worded copy)
  is removed.

SPEC IMPACT: None — all four are bug fixes to shipped surfaces; no product
decision changed.
