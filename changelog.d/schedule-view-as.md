## 2026-11-02 · feat(schedule): View as — a guest, a role, a supplier or crew, Suppliers by time (Step 3c, Pro)

The Schedule's shipped View as ▾ on the Event Day rail is extended (corpus SCHEDULE_CHAPTERS_BUILD_PLAN §3 "Suppliers by
time", §3b, §4, §12 Step 3; the approved prototype `prototypes/schedule_chapters_2026-11-01/`). On the Schedule page
(where chapters are drawn) it lists **Everyone** (the rail, the default) · **A guest** · **Suppliers by time** · **By
role** · **Suppliers** with their crews, searchable once the list is long. Picking one lays that day over the rail;
"back to Everyone" returns. A VIEW only — nothing in it writes.

- **A guest:** only chapters on the invitation, and in them only moments on the guests' schedule
  (`isOnTheGuestsSchedule`: shown, for Everyone, not a coordinator's staged prep). Never a task.
- **A role:** the moments for that audience (Entourage · Sponsors · Family) and the tasks naming that role or group.
- **A supplier or crew:** their tasks across chapters with place (`taskPlace`) and time, their call time (first line,
  supplier lead 0), moments they are tagged on with no task yet, and a clash flag (`findTaskClashes`).
- **Suppliers by time:** overlapping supplier work grouped into stretches, "N suppliers at once" (suppliers, not crews);
  tap a line for that supplier's day.
- **Time TBA** chapters read "Time TBA", give no call time and are left out of Suppliers by time.
- **Pro (§3b):** a Free event's View as wears the ◆ PRO mark (`PaidMark` try) and opens the upgrade; absent in a store
  shell that sells no Pro. Asked as the whole of Event Hub Pro (`eventCoupleWebsiteProActive`, as viewed) — listed in
  `every-pro-gate-names-its-part.test.ts` because View as is not an Event Hub part.
- Reads: `lib/schedule-view-as.server.ts` (tasks · moment rooms · guest groups · Pro) in one parallel round; a refused
  task read is said on the view, never drawn as an empty day. The Maker's lens is unchanged.
- Lab: `/dev/chapters-lab` (fake tasks), `?free=1` for a Free event.
- Guard: `app/dashboard/[eventId]/schedule/view-as-shows-only-whats-theirs.test.ts`.

SPEC IMPACT: None — built to plan §3/§3b/§4. Two readings are flagged for the owner in the PR: (1) Pro = the whole of
Event Hub Pro (no part of its own); (2) "a guest" = every guest until invitation-by-chapter (Step 5) narrows
`guestInvitedTo`.
