## 2026-07-12 · fix(admin): self-diagnosing error boundary + background-videos nav description

- **New /admin error boundary** — admin crashes used to bubble to the root
  guest-friendly "Something on our end didn't work" page with only a digest
  (the owner hit an undiagnosable error on /admin/money today). Admins are
  internal: the new boundary shows the actual error.message + digest + route
  so any future admin crash names itself. Couples/vendors/guests keep the calm
  branded page.
- **background-videos description** added to the admin nav descriptions map
  (the item was wired in the glass PR without one — card subtitle was empty on
  the More landing).

SPEC IMPACT: None.
