## 2026-09-28 · feat(hosts): a host is a host the moment they are added — whatever their role

Owner, about his own bride: *"creating someone a host needs no approval from their side. they will be
auto accepted"* · *"regardless of their role"* · *"she can also be a bride but not a host"* · *"she is
not a coordinator"* · *"they do not need to resign in. it should auto refresh"*.

**What was live, measured on his event:** the bride's June host invite existed only as a link the
inviter had to copy and send by hand (no email, no notification, nothing on her account), so it expired
unseen. When she signed up via her guest invitation she was linked as a GUEST; made a host by hand, she
stayed a guest to every table, because `sync_delegate_membership` inserted with `ON CONFLICT DO NOTHING`.

- **No accept step.** Trigger `a_host_added_is_accepted` accepts a host seat at insert when an account
  already holds that email; `claim_host_seats_for_user` (on `public.users` insert / email change) claims
  a waiting seat the moment the person signs up. A sign-up can never fail because of it.
- **A host's membership is `couple`, whatever the role.** `wedding_planner_external` (the hired
  coordinator, RA 10173 consent door) keeps the 2026-08-24 `coordinator` ruling and its accept step.
- **A guest made a host is upgraded, not skipped**, keeping `guest_id`; removing them returns them to
  the guest list instead of deleting them from it. The event's creator is never touched.
- **They are told, and their open page updates.** New `host_added` notification (in-app + email); its
  arrival makes `UnreadBellBadge` call `router.refresh()`, so the event appears without a sign-in or
  reload. The Hosts page says "Added — they're a host now" instead of handing over a link.
- **Only a host adds hosts — and every host can.** Owner: *"being a host gives the same power to add
  new hosts as well."* `inviteHost` / `revokeHostInvite` now use the host (`couple`) gate. The old gate
  admitted ANY accepted seat, planner included — and since an added host is now `couple` at once, a
  planner could have handed out more access than they hold. The add-a-host form and Revoke button are
  hidden from a planner; the form's copy no longer describes a link to send.
- Backfill measured first: 0 pending seats; of 12 accepted hosts only the bride's row changes
  (`joined_via` → `invited`).

SPEC IMPACT: `DECISION_LOG.md` — new 2026-09-28 row: host seats auto-accept; host membership is `couple`
regardless of role (reverses 2026-08-24 for every non-planner host role); planner unchanged.
