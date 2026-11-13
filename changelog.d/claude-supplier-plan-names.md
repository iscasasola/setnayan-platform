## 2026-11-13 · fix(copy): supplier plans are Supplier Plus · Supplier Pro · Supplier Ultra

Owner 13 Nov: "for the supplier. we rename their plans. Supplier Plus (formerly solo) / Supplier Pro / Supplier Ultra". DISPLAY NAMES ONLY: prices, caps, storage, rules, internal keys (`solo`/`pro`/`enterprise`), SKU codes and enums are unchanged. Central labels `TIER_LABEL` and `planWord` carry the new words to every surface that reads them; a data migration updates only `vendor_billing_catalog.title`. The couple's Event Plus / Event Pro / Event Ultra are untouched.

SPEC IMPACT: DECISION_LOG row "SUPPLIER PLANS RENAMED" (owner 2026-11-13).
