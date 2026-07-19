## 2026-07-12 · feat(vendor): promote Bookings + Payday to always-on on My Customers

Owner asked which one-page sections should stay always-visible vs expand/collapse.
Rule applied: always-on = glanced almost every visit AND light to render;
collapse = heavy / configure-once / already summarised elsewhere.

- **My Customers** — Bookings (new inquiries · the daily heartbeat) and Payday
  (cash-flow timeline · 1 query · shown nowhere else) now render EAGERLY below
  the pipeline, always visible. Clients, Messages, and Availability & capacity
  stay in the collapse/expand accordion (roster covered by the pipeline list,
  unread count on the summary card, config respectively).
- **My Shop** and **My Performance** — unchanged: their home bodies are already
  the always-on dashboard, so nothing was promoted from their accordions.

Legacy `?tab=bookings` / `?tab=payday` deep-links still land on the page (those
sections are now always visible; `#bookings` / `#payday` anchors added).

Verified: tsc + lint clean.

SPEC IMPACT: corpus DECISION_LOG.md 2026-07-12 (always-on picks).
