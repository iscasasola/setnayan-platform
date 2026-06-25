## 2026-06-26 · design(download): premium hero — floating macOS app window + Dock launch-bounce

The `/download` page read like a draft: the hero centerpiece was a utilitarian
"File / Size / Released / Verified by" spec card (a GitHub-release widget), there
was no visual of the actual app, and the page was thin (hero → 4 steps → 2 notes).

Reworked to the Premium-UI Standard (`Premium_UI_Standard_2026-06-25.md`), staying
100% on the locked `--m-*` palette and the imagery-free editorial marketing voice:

- **New signature moment (one, orchestrated):** the hero's right side is now a
  floating macOS **app window** framing a **genuine live Setnayan page** — the
  public sample-couple landing (`/maria-and-jose`, `events.is_sample`), embedded
  same-origin (the site ships `frame-ancestors 'self'`) and rendered desktop-width
  then transform-scaled to fit (a `ResizeObserver` writes `--preview-scale`; pure
  CSS can't because `scale()` needs a unitless factor). The window rests on a
  champagne glow with the **Setnayan icon in a Dock beneath it**; on entry the
  window *opens* (scale/lift) and the dock icon does the classic macOS **launch
  bounce** — literally illustrating the page's promise: "its own window, with its
  own Dock icon." Replaces the spec card. GSAP via `useGSAP` (SSR-safe),
  transform/opacity-only, `prefers-reduced-motion` rests it final; the iframe is
  non-interactive (`pointer-events-none` / `tabIndex -1` / `loading="lazy"`) and
  the whole illustration is `aria-hidden`.
  - Cost noted: the embed pulls a real (heavier) page on the hero and fires one
    sample-event pageview per `/download` view — an accepted trade for the "live"
    feel (owner-chosen 2026-06-26). `overflow-hidden` clips the frame so a lagged
    `ResizeObserver` tick can never spill into the layout.
- **Substance:** added a "Why the Mac app" value trio (own window/Dock · opens
  straight to your plan · trusted & always signed in). Spec details demoted to a
  quiet meta line under the CTA; primary CTA keeps the desktop magnetic pull.
- Kept the 4-step install + system-requirements blocks (refined copy); folded the
  duplicated "signed & notarized" reassurance so it's stated once in the trio +
  once at first-launch.

No change to the download artifact, `lib/desktop-release.ts`, `/api/download/mac`,
the nav-registry CTA-label overlay, ISR, or page metadata. Page stays a Server
Component; all motion is isolated in the `_download-motion.tsx` client island.

SPEC IMPACT: None. Visual/copy redesign of an existing live marketing page (iter
0015 surface). No schema, pricing, SKU, or load-bearing public-claim change — the
notarization claim is unchanged and already true (see
`project_setnayan_desktop_notarization`).
