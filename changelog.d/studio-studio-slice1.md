## 2026-07-04 · feat(admin): Studio Studio slice 1 — /admin/studio vertical-rail shell + Website/Hero video/Reveal Studio/Recaps tabs

- First slice of the Studio menu consolidation (13 surfaces): new /admin/studio server shell with a VERTICAL NAV RAIL grouped into Content + Marketing (horizontal pills can't hold 13 / would break the ≤5-pill rule). ?tab= allowlist; query-aware sidebar lit-state via the shared matcher (#2796). Website/Hero video/Reveal Studio/Recaps re-homed byte-identical into _surfaces/; legacy routes redirect in; sidebar items repointed to ?tab=. The other 9 surfaces stay standalone (rail links out) until later slices.

SPEC IMPACT: None.
