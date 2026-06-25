## 2026-06-26 · design(download): premium hero — floating macOS app window + Dock launch-bounce

The `/download` page read like a draft: the hero centerpiece was a utilitarian
"File / Size / Released / Verified by" spec card (a GitHub-release widget), there
was no visual of the actual app, and the page was thin (hero → 4 steps → 2 notes).

Reworked to the Premium-UI Standard (`Premium_UI_Standard_2026-06-25.md`), staying
100% on the locked `--m-*` palette and the imagery-free editorial marketing voice:

- **New signature moment (one, orchestrated):** the hero's right side is now a
  floating macOS **app window** framing a **high-fidelity mock of the couple
  dashboard** — the real sidebar nav (Home · Guests · Explore · Studio · Budget,
  with the actual Lucide icons), the countdown chip, a "Today's focus" card, the
  overview stats (Guests · RSVP'd · Budget) and an upcoming-schedule list, styled
  to match the real surface on the `--m-*` palette. The window rests on a champagne
  glow with the **Setnayan icon in a Dock beneath it**; on entry the window *opens*
  (scale/lift) and the dock icon does the classic macOS **launch bounce** —
  illustrating the page's promise: "opens straight to your account." Replaces the
  spec card. GSAP via `useGSAP` (SSR-safe), transform/opacity-only,
  `prefers-reduced-motion` rests it final, the whole illustration `aria-hidden`.
  - A mock, not a live embed, by design: the dashboard is auth-gated, so it can't
    be shown live to a logged-out visitor (an iframe would render a login screen).
    Owner-chosen "polished mock" over a static screenshot or a public-surface embed
    (2026-06-26) — it never goes stale and is fully responsive.
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
