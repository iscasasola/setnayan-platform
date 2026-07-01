## 2026-07-01 · fix(vendor-dashboard): remove page-title header blocks

Removed the eyebrow/title/subtitle page-header blocks (e.g. "VENDOR · MY
PERFORMANCE" / "My Performance", "My Customers" / "Your calendar, book of
business, and money in.") from 9 vendor-dashboard pages: performance, demand,
earnings, payday, customers, shop, on-the-day, services, verify. There was no
shared header component — each page hand-rolled its own block, so each was
edited individually. Functional content nested inside a header (the
per-service scope selector on `performance`, the descriptive/link paragraphs
on `earnings` and `verify`) was preserved outside the removed markup.

SPEC IMPACT: None — this is a visual/UI cleanup, not a spec-covered behavior
change. No iteration `.md` describes these headers as a locked requirement.
