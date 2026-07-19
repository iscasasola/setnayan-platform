## 2026-07-03 · feat(vendor): budget band — couple opt-in, range-only, on the Customer Card

Customer Card respine PR-5. The couple can opt in (default OFF) to share their
planned budget with vendors they talk to — shown as a rounded RANGE for that
vendor's category only, never an exact number. Framed to couples as "get more
accurate quotes, faster".

- Migration `20270508637171_customer_card_budget_band.sql`:
  - `events.share_budget_band BOOLEAN NOT NULL DEFAULT FALSE` (host opt-in).
  - `get_vendor_event_brief` (current prod def preserved verbatim) gains a
    `budget_band` key in BOTH stage payloads (booked + inquiry). NULL unless
    the host opted in AND the couple allocated to the vendor's category(ies).
    When present: `{ lo_centavos, hi_centavos }`. Band = couple's latest-snapshot
    allocation total for the mapped plan-group leaf(ies), quantized to ₱5,000
    steps so the exact figure is never recoverable (step = 20% of alloc rounded
    to nearest ₱5,000, min ₱5,000; lo=(ceil(a/s)−1)·s, hi=(floor(a/s)+1)·s).
    Vendor-category → budget plan-group mapping is exact-enum-only (no fuzzy
    matching), inlined from lib/wedding-plan-groups.ts.
- Couple: opt-in toggle on the Budget surface (under the suggested split).
- Vendor: "Budget" card on the Customer Card Overview tab (both stages).

SPEC IMPACT: None — design source 03_Strategy/Customer_Card_Prototype_2026-07-03.html
