## 2026-07-11 · fix(guards): clear two non-blocking guard failures on main

Two pre-existing guard violations were sitting red on main (both non-required, so
they never blocked a merge — that's why they accumulated):

- **radius:** a seating-editor booth used the arbitrary `rounded-[3px]` → `rounded-sm`.
- **admin chat-guard:** `purgeUserAuthoredChat` (the RA 10173 right-to-erasure that
  hard-deletes ONLY the leaving user's own authored messages on account deletion —
  service-role, audit-logged; shipped in the data-retention work) is a sanctioned
  path but lacked the `// chat-guard-allow` marker on the query line. Add it, and
  reword the docstring's literal table mention so the prose line no longer trips
  the scanner.

SPEC IMPACT: None (guard hygiene; no behavior change — the erasure path is unchanged).
