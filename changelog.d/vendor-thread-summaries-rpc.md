## 2026-06-29 · fix(chat): get_vendor_thread_summaries RPC for masked vendor inbox

A vendor is not an `event_members` row on the couple's event, and `events` has only
member/moderator SELECT policies — so the `event:events(...)` embedded join used by
`fetchVendorThreads` returns NULL under vendor RLS, and the masked event name (which
the vendor should see in place of the couple's private name, per 0019 identity
masking) never renders. New `SECURITY DEFINER` `get_vendor_thread_summaries(uuid)`
returns ONLY the safe masked fields (event display_name + date) + last-message
preview, scoped to threads the caller's vendor profile owns/staffs (ownership
re-validated against auth.uid()). Consumed by the native vendor inbox; the web vendor
inbox has the same latent degradation and can adopt it next.

SPEC IMPACT: None (backend RPC; no SKU/pricing/flow change).
