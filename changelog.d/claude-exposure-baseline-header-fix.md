## 2026-11-06 · fix(ci): the exposure baseline's header counts the line #7297 accepted

`#7297`'s merge added `guest_saved_vendors.vendor_service_id` to the body of `supabase/security/exposure-surface.baseline.txt` but left the header at `facts: 7164` (`col 5198`). `lint exposure baseline` then failed on main and on every PR (header 7164, body 7165). Regenerated with `gen-exposure-baseline.ts`: header only, 7165 / 5199. The body is unchanged, so nothing is newly exposed.

SPEC IMPACT: None
