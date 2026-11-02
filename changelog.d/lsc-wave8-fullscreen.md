## 2026-07-26 · feat(live-studio): chrome-less full-screen scroll-free controller (wave 8)

Owner (§ 4g, locked 2026-07-25): *"we will achieve the exact look on our design prototype. scroll free controller. nothing under and above it."* The controller is now a fixed, full-viewport surface with no masthead above it, no bottom nav below it, and no page scroll at any height. Flag-dark behind `NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED` — the page `notFound()`s with the flag off, exactly as before.

### The escape: the route left `/dashboard` (`/panood/control/[eventId]`)

An App Router page **cannot opt out of an ancestor layout**, and `app/dashboard/[eventId]/layout.tsx` *is* the chrome — SidebarShell top bar, `CustomerBottomNav`, `CustomerNavFab`, `CustomerSectionSubnav`. Covering it from inside is a documented dead end in this codebase: `app/panood/program/[eventId]/page.tsx` records that its own `fixed inset-0` attempt **rendered nothing**, because the shell's `<main>` carries `.sn-vt-page` (`view-transition-name`), which establishes containment and becomes the containing block for fixed descendants — `inset-0` resolved against a zero-height box.

So this follows **the same escape that pop-out already uses** rather than inventing a second one: a top-level route inheriting only the root layout. `panood` is already a reserved top-level slug and already the namespace for `/panood/cam/[token]` and `/panood/program/[eventId]`, so no new namespace and no chance of shadowing a vendor or event slug.

- Authorization is **unchanged and still stricter than the layout's** — `isLiveStudioSetupHost`, the same predicate the server actions use. Same posture as the program pop-out.
- The old URL `/dashboard/[eventId]/studio/live-studio-control/setup` stays as a **redirect stub**, itself flag-gated, so no bookmark or stale link 404s.
- Every reference now resolves through `liveStudioControlPath()` — `actions.ts`'s `SETUP_PATH`, the detail page's doorway, `panood/setup/actions.ts`'s two `revalidatePath` calls, and `lib/routes.ts`. Wave 6's `liveStudioControllerHref()` router is untouched, so the six doorways still flip atomically with the flag.

### No page scroll, ever

`fixed inset-0` at **`100dvh`, not `100vh`** (mobile browser chrome resizes the viewport mid-session; `vh` clips the transport row exactly when the operator reaches for Go live) with `env(safe-area-inset-*)` padding on all four sides — zero-valued on desktop, verified. Every row is `shrink-0`; the camera-channel grid is `flex-1 min-h-0 overflow-y-auto`, the one internal scroller. A `ViewportLock` client component locks `html`/`body` overflow and `overscroll-behavior` while mounted and restores them on unmount, so no global sibling the root layout renders can hand the operator a scrollbar.

### Three things had to move so the loop fits

- **Setup → a sheet.** Connect YouTube, encoder credentials, the channel manager and its join QRs, overlay text + corners, the moments list and the watch link were ~700px stacked under the loop — that stack *was* the page scroll. Same markup, same gating, now children of `<SetupSheet>` (the shared `<Sheet>` primitive: `role=dialog`, `aria-modal`, ESC, focus trap, focus restore, scroll lock). It is **hash-driven**, so the existing `#connect` and `#add-camera` anchors — which only worked because the page scrolled — now open the sheet and scroll its body instead of being dead links.
- **Status banners → a floating layer.** ~20 possible outcomes, each ~48px in flow; one server action was enough to push the transport row off a viewport nobody can scroll. Now `fixed` + `pointer-events-none` + a 6s timeout (they have no dismiss of their own and live as long as the query string does). Every message preserved verbatim.
- **The advisories → into the grid column.** The withheld-cut notice, the § 4d unlock line and the rehearsal-preview paragraph ride with the tiles they are about. `ProgramBridgeHost` moved there too but stayed **outside** the sheet on purpose: it installs the program bridge in an effect and disposes it on unmount, so closing a sheet would have killed a host's live output mid-ceremony.

### Measured, not estimated

Rendered at the real viewports with the app's own Tailwind build (temporary dev harness, not committed). Two defects the arithmetic missed and the browser caught:

- The **unlock bar was 193px at 360×640** — 30% of the viewport — because the CTA wrapped onto its own line and the paragraph ran three lines. The grid was left with **52px**, about a third of one tile. Now 74px: headline (which already carries the offer *and* the price) plus a non-wrapping CTA on phone, elaboration back at `sm+`.
- **Both Wave 7 warnings up at once dropped the grid to 27px.** The CH 1 monitor now yields for as long as a warning shows (`[data-lsc-left]:has([data-lsc-window]:not(:empty))` in `globals.css` — CSS has no previous-sibling combinator, and it degrades to the prior cap without `:has()`). Grid recovers to 115px.

| viewport | state | page scroll | grid visible | Go live in view |
|---|---|---|---|---|
| 360×640 | normal | none | 175px | yes |
| 360×640 | both warnings | none | 115px | yes |
| 390×780 | normal | none | 316px | yes |
| 390×780 | both warnings | none | 219px | yes |
| 320×568 | both warnings | none | 36px | yes |
| 1280×800 | both warnings | none | 629px, two-column `756px / 488px` | yes |

320×568 (below the brief's targets) in the double-warning state is the measured floor — cramped, but nothing overflows and nothing clips.

### Also

- **Transport is two-up at every width**, which is what the prototype's `.transport` row does (`.golive{flex:1}` beside the guest-pick switch). It used to stack below `sm:`, costing 112px for two 52px controls. Guest-pick's explanatory line is `sm+` only; the On/Off pill is the state, and the full sentence stays in `title` and for AT.
- **The way out.** Removing the chrome removed the sidebar, bottom nav and account plaque — every route back to the dashboard. The status strip's back control is now a labelled 44px "Exit" target with visible text at `sm+`.
- **Two additive props, both defaulted false** so existing callers render byte-identically: `<Sheet wide>` (22rem → 34rem for a settings body) and `<BroadcastWindowStrip compact>` (clamps the explanation *visually* — the sentence stays in the DOM and for screen readers; the headline and "Add another day" button are never clamped).

### Guards, and an honest correction

`lint-page-masthead.mjs` and `lint-bottom-nav.mjs` **do not fail a chrome-less page**, so no allowlist entry was needed and none was added. The masthead guard only flags an `.sn-eye` inside a `<header>` (its own docstring says it is "NOT a 'every page must have an h1' rule" and names deliberately headerless surfaces, including the Live Studio control room); its `ALLOWED` list scopes `app/dashboard`, `app/vendor-dashboard`, `app/admin` and would not have reached `app/panood` regardless. The bottom-nav guard checks that files *named* `*bottom-nav*.tsx` delegate to the canonical primitive, and that the primitive keeps its locked markers. Both pass, unmodified — as do the other six lint jobs.

Waves 1–7 verified intact: tally discipline, one-tap cut, un-dimmed tiles (no `grayscale`, no "Unlock to use"), the contextual "Unlock to broadcast" nudge, the window strip, the archive warning, guest-pick, ⚡ highlights, free single-cam.

29 new tests (`lib/live-studio-wave8-layout.test.ts`, plus three Wave 8 route tests in `live-studio-control.test.ts`); 3442/3442 unit tests green; typecheck, `next lint` (0 errors) and the production build pass.

SPEC IMPACT: `Live_Studio_Unified_Spec_2026-07-25.md` § 4g — marked SHIPPED, with the resolved route (`/panood/control/[eventId]`), the corrected lint-guard finding (no allowlist needed), the two measured layout fixes, and the setup-sheet split. `DECISION_LOG.md` row 2026-07-26.
