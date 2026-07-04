## 2026-07-04 · feat(admin): Accounts Studio slice 1 — tabbed /admin/accounts shell + Users & Events tabs

- First slice of the Accounts menu consolidation: new server-component shell at /admin/accounts with a ?tab= allowlist and a responsive server-rendered tab strip. Users + Events list bodies re-homed into _surfaces/ (byte-identical, actions imported from their existing locations; Users audit side-effects preserved). Legacy /admin/users + /admin/events redirect into the studio, forwarding their query params. Sidebar 'users'/'events' items repointed to ?tab= (matchPrefix kept at legacy routes); mobile cards follow automatically via ADMIN_NAV_GROUPS (PR #2792). Vendors/Venues/Demo vendors tabs still link to their standalone routes — wired in later slices.

SPEC IMPACT: None.
