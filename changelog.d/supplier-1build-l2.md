## 2026-11-08 · feat(supplier): Clients — the picked client's nine pages, list and Details (THE ONE BUILD · L2)

- The picked client becomes ONE route with nine pages (Details · Chat · Schedule · Quotation · Payment · Forms ·
  Files · Hub · Report), each body in `clients/[eventId]/_pages/<page>.tsx`, switched by `?tab=` with no request.
- `customerCardHref(eventId, page)` names any of the nine pages.

SPEC IMPACT: None from this lane directly — the build follows `plans/supplier_one_build_2026-11-08/` (controller
records the DECISION_LOG rows for Chat-in-client and the Script fold at integration).
