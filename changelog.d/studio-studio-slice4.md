## 2026-07-04 · feat(admin): Studio Studio slice 4 (final) — Social queue tab; the Studio menu is fully consolidated

- Wires the Social queue (~1,693 LOC) as the 13th and final tab in /admin/studio (byte-identical re-home into _surfaces/social-queue-surface.tsx; actions + count badge preserved; audit side-effects moved with the body). Legacy /admin/social-queue redirects in forwarding all params. Sidebar item repointed to ?tab=social-queue. The entire Studio menu (8 Content + 5 Marketing) now lives behind one vertical-rail /admin/studio. Stacks on slices 1–3.

SPEC IMPACT: None.
