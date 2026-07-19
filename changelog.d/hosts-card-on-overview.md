## 2026-07-12 · feat(dashboard): move "Add a host" to the event Overview

Relocated the host/celebrant management entry from the account switcher to the
couple's event Overview, so the couple sees every account managing the event
right where they read their progress.

- New **Hosts** doorstep card in `EventDashboard`'s "Around your event" grid
  (`apps/web/app/dashboard/[eventId]/_components/event-dashboard.tsx`). Lists
  every managing account — the owning couple row(s), accepted
  `event_moderators` hosts (with their role label, e.g. Bride/Groom/Ninong),
  and pending invitations (`invited` chip) — with an **Add a host →** link to
  the full `/dashboard/[eventId]/hosts` invite + permission surface.
- Fetched in the dashboard's existing `Promise.all` via the admin client
  (co-hosts' names live in RLS-self-scoped `users`, mirroring the hosts page's
  admin-read pattern), fail-soft to `[]` like every other card feed. Accepted
  hosts that also hold an `event_members` row are de-duplicated (the richer
  moderator row wins so the role shows).
- Removed the **Hosts** footer link (and its `hostsHref` plumbing) from
  `account-switcher.tsx` in both the shared panel body and the standalone
  drawer. The switcher stays a slim home-hub jump; hosts now live on the
  Overview.

No schema, action, or route changes — reuses the existing `event_moderators`
model and `/hosts` page. Typecheck + lint clean.

SPEC IMPACT: None (UI placement only; the hosts/celebrant model, roles, and
invite flow are unchanged).
