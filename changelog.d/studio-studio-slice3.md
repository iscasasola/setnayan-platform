## 2026-07-04 · feat(admin): Studio Studio slice 3 — Marketing tabs (Spotlight Awards, Journal Spotlights, Discount codes, Referrals)

- Wires 4 of the 5 Marketing surfaces into /admin/studio (byte-identical list re-home into _surfaces/; actions imported from existing locations; audit side-effects preserved). Discount codes' detail/new sub-routes stay standalone (linked out); only its list is absorbed. Legacy list routes redirect in. Sidebar items repointed to ?tab=. Only Social queue (1,693 LOC) remains — slice 4. Stacks on slices 1–2.

SPEC IMPACT: None.
