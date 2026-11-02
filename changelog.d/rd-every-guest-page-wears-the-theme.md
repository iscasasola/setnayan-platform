## 2026-09-25 · feat(event-hub): every guest page wears the couple's theme

Owner: *"event hub has the different menus that are not editable. but they
should still adapt to their theme"* — then, on wearing the look once at the top
of every guest page, *"yes place it there."*

**What changed.** The couple's look — theme (`data-hub-theme`), theme fonts,
mood-board palette, Event Hub Pro colours and face, the candlelight art
direction, and `--accent` — is now worn ONCE by `app/[slug]/layout.tsx`
through a new `GuestLookScope` (`_components/guest-look-scope.tsx`), for every
page of the guest tree. Before, only the landing page, `/recap` and `/pabuya`
stamped it on their own `<main>`; `/find-seat`, `/seat`, `/find-my-table`,
`/hub`, `/everyone`, `/welcome`, `/venue`, `/avatar` and `/print` never wore it.
Content is unchanged.

- `loadGuestLook(slug)` (`_lib/loaders.ts`) is `cache()`d and reads through the
  already-cached `loadEventShell` row — no second events read. The Pro check is
  now one cached `websiteProActiveFor(eventId)` shared by the theme gate,
  `loadMedia`'s watermark and the layout.
- `InvitationShell`, `recap` and `pabuya` no longer stamp the look (a second
  stamp below the layout's inline palette would let the theme beat the
  couple's own colours); `siteColorVars` plumbing removed.
- Privacy: the layout uses `resolveHubTheme` (new; `resolveHubLook` minus the
  presigned reveal photo). Everything it paints was already painted by the
  private landing for anyone holding the link. Reserved slugs, missing events
  and types without the `website` surface (whose address renders a supplier's
  page) get no look.
- The invite door (`/invite/*`) keeps its own skin and is left alone.
- A themed page lays a plain paper ground (`bg-cream`, the theme's own) under
  the viewport: `<body>` paints the ROOT cream, so without it a page with no
  paper of its own put Velvet's cream ink on white.

**Readability.** A real-browser sweep (sample data, 12 guest pages × House +
4 Pro themes, WCAG AA) found 159 text runs a theme made worse than House. All
repaired with tokens in globals.css / theme-aware classes, none with one-off
colours: deeper theme inks on capiz/galeriya/abaca, the accent and CTA on their
deepest design-system steps (abaca in its own ink, velvet in its foil),
`--surface` = the page paper, `--m-ink` for the wordmark on velvet/candlelight,
`bg-white` → `bg-cream` on guest cards (identical on House, which is white),
and a new `text-ink-on-light` token for text on surfaces that stay light (set by velvet and candlelight).

Guard: `app/[slug]/every-guest-page-wears-the-theme.test.ts` (sabotaged both
ways). `the-site-wears-the-doors-theme.test.ts` reshaped for the single stamp.

SPEC IMPACT: None new — implements the 2026-09-25 DECISION_LOG row "THE EVENT
HUB'S FIXED PAGES AND MENUS ARE NOT EDITABLE — BUT THEY WEAR THE THEME". The
per-theme token repairs change how capiz / galeriya / abaca / velvet read on
the landing page too (darker inks, deeper accents, abaca's ink CTA, velvet's
foil CTA) — flagged for owner sign-off in the PR.
