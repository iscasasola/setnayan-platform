## 2026-10-22 · fix(qa): five small QA findings from the overnight-batch walk (#6776 F2 · F3 · F5 · F7 · F9)

- **F2 — /features and /tl/features show no internals.** The "who's who" cards printed a route path under
  every role (`/dashboard`, `/vendor-dashboard`, `/[slug]`, `/admin`) in a `<code>` span, and the team's
  card said "Gated behind is_internal" beside "force-majeure escalations". The paths are gone; the team
  card is "Setnayan's team" in plain words (checks suppliers, confirms payments, steps in when an event
  cannot go ahead); "slug" → "link"; the flow names the supplier marketplace instead of `/explore`.
  Guard `app/features/the-public-page-shows-no-internals.test.ts` PAINTS the hub's sections in both
  locales and reads the visible text (no route path, route placeholder, snake_case name, env name,
  backtick or `<code>`), plus every prose field of all feature pages.
- **F5 — the Suppliers search fits a phone.** "Search your shortlist or the whole marketplace…" was cut at
  375 px; it is now "Search suppliers" (the aria-label keeps the full description).
- **F9 — Your details no longer geocodes on every open.** `AddBranchForm` mounts with the page (folded
  shut) and looked up its opening centre in a mount effect. It now looks up the place only when the pin
  moves, through a page-wide cache (one call per spot; a blank or failed answer is asked again).
  Guard `app/vendor-dashboard/_components/branch-place-is-looked-up-on-a-move.test.ts`.
- **F7 — no change; the row was a misread.** /explore lists "Birthday" and "Celebration" as two
  separate chips (the QA text capture joined them with a line break). "Celebration" is the event type
  named Celebration (Salu-salo), which the house-word guard deliberately allows.

SPEC IMPACT: None.
