## 2026-11-14 · feat(template): T08 — the last supplier batch onto the design template

The supplier's client pages first, then the rest of T08 (design template, owner-approved 2026-11-14):

- **Challenge photos** and the **editorial media studio** (inside a client): sections and hairlines instead of cards,
  the explaining paragraphs behind an ⓘ, every hand-made button an `ActionButton` (one main), the status pills the
  shared `Badge`, pale ink → the template's dark grey.
- **Packages**, **Your requests**, **Tell us what you do** (three steps), **a request**, **albums by event**,
  **settings**, **help**, **new service** + the **add-a-service picker**, **upload a contract**, the **track-record
  panel**, the **supplier invite** landing a couple opens, and the supplier **chats** / **notifications** screens:
  visible titles that restate the pinned row → screen-reader only (with their own title-less `loading.tsx` where the
  shared boundary would shimmer one), cards → sections and rows, failed reads → `TemplateFail`, empties → one line,
  the contract's event `<select>` → the house dropdown, money in the body font.
- Nothing removed: every link, control and action stays; no query, action or server file changed.

SPEC IMPACT: None
