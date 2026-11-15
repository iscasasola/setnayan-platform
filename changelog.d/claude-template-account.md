## 2026-11-14 · style(account): the account pages follow the design template (template wave, stacked on T14)

Template wave over `app/dashboard/(account)` (stacked on #7691). Style only — same words, data and actions; shared pieces
only (`ActionButton`, `InfoTip`, `PickMenu` + `PostedPick`, `Badge`, `EmptyState`).

- **create-event** — the planning-together / group notices are hairline rows, the two native selects are ▾ pickers
  (`anniversary_origin` posts the same field; `budget_band` still drives the live range), the long notes keep one line
  with the rest behind ⓘ, Cancel / Pick a different type are shared pills. Photo tiles stay photo tiles.
- **samahan** (group page, new group, identity header) — mono 9–10 px captions → 12 px labels, event rows are hairline
  rows, Save/Cancel are 44 px shared pills.
- **clusters** (list and one group) — sections over hairline rows, both event pickers are ▾ `PostedPick`s posting
  `event_id`, footnotes behind ⓘ, failed reads amber "not the same as none", money bold with even digits.
- **people/[dependentId]** — hairline timeline, dates in words.
- **profile/concierge · api-keys · billing · creator · life-flash** — cards become sections and rows, explaining lines
  behind ⓘ, captions are section labels, statuses are `Badge`s with words, created/last-used dates in words; API key
  strings, scopes and the curl block stay in the code face (they are code).
- Warn and danger lines use `text-[rgb(var(--color-warn|danger))]`: the bare `text-warn` / `text-danger` classes have no
  DEFAULT shade in `tailwind.config.ts` and emit no CSS (also fixed in #7691).
- **Kept on purpose:** creator's `event_id` select (`lib/chapter-event-link.test.ts` pins the native select); the dark
  photo scrim on event-type tiles (no dark-constant token); the samahan photo-upload spinner (no shimmer design yet);
  canvas colours drawn into the exported teaser PNG.

SPEC IMPACT: None — implements the approved design template (Setnayan-specs `prototypes/design_template_sheet_2026-11-14_fable.html`); no decision changed.
