## 2026-08-06 · feat(schedule): the couple's own coordinator can now message the host

The coordinator → emcee channel (`event_stage_notes`, migration
`20271111090000`) shipped with its send box **only inside the supplier floor
console** at `/vendor-dashboard/on-the-day/live/[eventId]`. At a Filipino
wedding the floor is very often run by the couple's aunt or by a planner the
couple invited — neither has a supplier account, and the vendor layout redirects
anyone without a vendor profile straight to `/dashboard`. The person the channel
was built for could not reach it.

"Tell the host" now renders on the couple-side schedule, in the Event Day view,
beside the host's own segments and the emcee script.

- New: `app/dashboard/[eventId]/schedule/_components/tell-the-host.tsx` (send box
  + an honest Sent/Seen list of what already went across),
  `stage-note-actions.ts` (the send), `_components/note-flash.ts` (result
  banner), mounted from `schedule/page.tsx`.
- **No permission was widened, and none needed to be.**
  `event_stage_notes_event_insert` was already written for these people — it
  admits `current_event_ids()` and `moderator_area_level(event_id,'schedule') =
  'edit'` alongside the booked coordinator. This PR adds **no migration, no
  policy, no grant, no column**; `supabase/security/exposure-surface.baseline.txt`
  is unchanged.
- The write reuses the shipped path's substance: same `cleanStageNote`, same
  caller's-own-client insert, same session-stamped `author_user_id`, same policy
  as the gate. Only the redirect differs — the supplier action lands on
  `/vendor-dashboard/…`, which would eject a non-vendor sender from her own page
  on every send.
- The box is gated on the value the page already computes for the run-of-show
  advance button, because that gate and the note policy admit the same people. A
  send box shown to someone the policy refuses is a button that fails on tap
  mid-reception.
- Renders nothing when the event has no host booked, and the "what you sent"
  list renders nothing when empty — `fetchStageNotes` returns `[]` for a failed
  read as well as for an empty channel, so "you have sent nothing" would be a
  claim we cannot stand behind.
- New tests: `apps/web/lib/stage-notes-event-side.test.ts` (12). Three were
  watched fail against deliberate mutations — an ungated send box, a swallowed
  insert error, and a forgeable `?note=sent` banner.

⚠ FOR THE OWNER — a real finding, **not fixed here** because it is a permission
question, not a build one: `current_event_ids()` returns **every** `event_members`
row including guests, so the insert policy as written lets any event member send
the host a note. Guests cannot reach this screen (the `/dashboard/[eventId]`
layout admits only the couple and accepted moderators), so nothing is exposed by
this PR — but the *policy* is broader than the *screen*. Narrowing it is an owner
call about who may message whom.

⚠ FOLLOW-UP: the insert now exists twice — here and in the supplier action. It
belongs in one helper in `lib/stage-notes.ts`, with each surface keeping only its
own redirect. That file was owned by another stream this cycle;
`stage-notes-event-side.test.ts` holds both copies to the same rules meanwhile.

SPEC IMPACT: None. No decision changes — the channel, its recipients and its
authorisation are exactly as locked on 2026-08-05; this only puts the existing
send box on the surface the coordinator actually works from.
