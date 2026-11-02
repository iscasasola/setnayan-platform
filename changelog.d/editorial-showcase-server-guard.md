## 2026-06-29 · fix(editorial): server-side wedding guard on Real Stories opt-in

Defense-in-depth behind the wedding-only UI toggle (#2379). `setStoryShowcase` now rejects opt-IN when the event isn't a wedding. `public_summary_consent_at` is a per-USER flag and Real Stories aggregates weddings only (`loadPublishedShowcases` filters `event_type='wedding'`), so a direct action call from a non-wedding event could otherwise set consent that affects the user's other wedding events. Opt-OUT stays always-allowed (so anyone can turn it off regardless).

tsc + prod build green.

SPEC IMPACT: None. Hardens existing wedding-only Real Stories gating.
