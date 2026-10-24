## 2026-10-24 · fix(suppliers): the booked-by-payment embed names its foreign key

Production logged PGRST201 ("more than one relationship was found for 'event_vendors' and 'event_vendor_payments'") on
Home's Suppliers tile ("couldn't load"), the schedule's suppliers read and the dashboard decisions. `event_vendor_payments`
has two keys to `event_vendors`; `BOOKED_BY_PAYMENT_EMBED` now names the event-scoped one
(`event_vendor_payments_event_vendor_fk`). One-line fix plus a guard.

SPEC IMPACT: None.
