## 2026-07-04 · feat(admin): Accounts Studio slice 2 — Venues tab

- Wires the Venues LIST as a tab in /admin/accounts (byte-identical body re-homed to _surfaces/venues-surface.tsx; actions imported from the existing location). Legacy /admin/venues redirects into the studio forwarding q/type/city. venues/[id] detail + venues/new create stay standalone (linked out). Sidebar 'venues' item repointed to ?tab=venues (matchPrefix '/admin/venues'); mobile card follows via ADMIN_NAV_GROUPS. Stacks on slice 1 (#2793).

SPEC IMPACT: None.
