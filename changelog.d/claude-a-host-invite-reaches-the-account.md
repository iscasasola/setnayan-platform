## 2026-09-28 · feat(cohosts): co-hosts come from the guest list

Owner, about his own bride and then the whole model (DECISION_LOG 2026-09-28, "CO-HOSTS COME FROM THE
GUEST LIST — FINAL MODEL" and the rows after it): *"accepted guests can be assigned as host … host meaning
access to the event creation"* · *"they must accept attending the event first"* · *"the assigning is
automatic"* · *"use Co-host"* · *"Limited Helper can keep. may view but may not edit"* · *"only celebrant
themselves can reassign … celebrant role"* · *"all accepted guests … automatically follow the hosts"* ·
*"connected people follow each other"*.

**What was live, measured on his event:** the bride's June host invite was a link nobody sent; it expired
unseen. She later joined through her guest invitation and was linked as a GUEST; made a host by hand, she
stayed a guest to every table (`sync_delegate_membership` inserted with `ON CONFLICT DO NOTHING`).

- **Guest card → Access** (one PickMenu: Guest only · Co-host · Limited helper). Writes a seat tied to the
  guest row (`event_moderators.guest_id`); it goes live automatically once that guest has joined (YES +
  account linked) — `activate_guest_seats`, fired by the pick, the YES, or the account link.
- **Co-host = `couple`** (equal to the creator). **Limited helper = `coordinator`, read-only at the
  database**: RESTRICTIVE write refusals on the 20 coordinator-writable tables without an area check,
  plus 22 app edit gates that now exclude the `viewer` seat (they write with the admin client).
- **Celebrants:** a celebrant co-host cannot be removed or narrowed; only a celebrant changes a
  celebrant's role. `removeHost` now reads the database's answer (a refusal used to show "Host removed").
- **"+Co-host" is true** — derived from live seats; the bulk "Part of the host" picker and `lib/host-hat`
  are retired; the one guest wearing that label (the bride) holds a real seat.
- **"You are now a co-host for …'s … event. You have access to the following: …" · CONFIRM** — written by
  the database when the seat goes live (in-app; not on the email allowlist, since SQL rows never pass
  `emitNotification`); `CohostWelcome` shows it on the event until acknowledged; the bell refreshes an
  open page when it lands.
- **Followers:** co-hosts follow each other; a joined guest follows every co-host; a confirmed
  connection follows both ways. Backfilled.
- The Hosts page's email form is gone (co-hosts come from the guest list); `inviteHost` is the hired
  planner's door only, with its consent step.
- ⚠ `event_moderators.accepted_at` is DEFAULT now() — a waiting seat is `user_id IS NULL`. The first prod
  dry run of this flow skipped every seat on exactly that.

SPEC IMPACT: `DECISION_LOG.md` — 2026-09-28 rows: co-hosts come from the guest list (final model), three
holes closed (celebrant role lock, read-only limited helper, mute invites), followers vs connected people,
connected people follow each other. Reverses 2026-08-24 ("accepted delegate = coordinator") for co-hosts.
