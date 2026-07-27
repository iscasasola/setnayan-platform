## 2026-07-27 · feat(vendors): floor command — the coordinator's day-of surface, and the access conversation it needs

The third and last specialization surface (after the song desk #3803 and the
stage script), plus the owner ruling that reshaped how a coordinator gets access
at all.

**🔐 THE RULING — a booking self-grants NOTHING.** Owner, verbatim: *"coordinator
will ask for access from the host. host must approve what features do they want
to share the vendor."* And, on how much may be asked: **specific features** — the
coordinator ticks what they need, the host approves or declines **each line**.

Half of that already shipped and was NOT rebuilt:
`event_moderators.permissions_json.areas` + `moderator_area_level()` is already
"the host approves which features to share" (seven areas, each edit/view/none,
per person, revocable). What existed in **neither** direction was the coordinator
*asking* — today only the host can initiate, via `/host/accept/[token]`. That gap
is the one new table.

**`public.event_access_requests`** (migration `20271014200000`) — who asked, for
which areas, with an optional note, and a per-area `decisions` map so a partial
yes is a first-class outcome. One open ask per person per event (partial unique
index) so a coordinator cannot drown the host. **It grants nothing:** every gated
feature reads `moderator_area_level`, never this table — so a bug in the asking
flow can never become a bug in the granting one. The asker may withdraw but not
answer: the withdraw policy's `WITH CHECK` admits only `status='withdrawn'`, and
the answer policy is host-scoped and deliberately NOT extended to delegates,
because a coordinator who could answer requests could answer their own.

**THE SURFACE** — `_components/floor-command/`, registered with the one line the
registry documents. Four panels, each AND-gated on a host grant:
*the running order* (advance + push by ±N minutes · needs `schedule='edit'`,
since both are writes and **view-only must not offer them**), *find a guest's
seat*, *the event QR kit* (both need `seat_plan`), and *the requests inbox*
(#3810). A coordinator with a booking and no grant gets the "ask the host" card
and no tools. Revoking an area closes the panel the same minute, no deploy.

**WHAT IT REFUSES TO REBUILD.** `FloorClock` and `RunOfShowHeader` already render
above the slot, so neither is repeated — a second clock that can disagree with
the first is worse than no second clock. The gap was never the *view*: `page.tsx`
mounts RunOfShowHeader **without `canAdvance`**, so the coordinator could watch
the running order and not touch it. Acting is the delta. The retime reuses
`computeRetimePatches` (PR #3412) so the floor and the couple's schedule page can
never disagree about what "+15 minutes" means.

**FIND-MY-SEAT — no new schema.** `coordinator_seat_by_guest_qr` (migration
`20271013200000`) adds no table, column or policy. A booked vendor still cannot
read `guests`, `event_seat_assignments` or `event_tables`; `get_vendor_seat_plan`
still hands them per-table COUNTS and never a person. Given a QR token the
coordinator is physically holding, it returns that ONE guest's table label and
nothing else — no name, no id, no neighbours. Five gates: vendor · booked ·
coordinator tile · **host-shared `seat_plan`** · **PUBLISHED** plan. Not
enumerable: `guests.qr_token` is 16 random bytes. Scanner reuses `makeQrDetector`
and the `tag-sheet` camera lifecycle (iOS one-camera contract) — no new machinery.

**Privileges.** `REVOKE ALL` then `GRANT SELECT, INSERT, UPDATE` to authenticated
only; no DELETE, nothing for anon. Both functions revoke from
`PUBLIC, anon, authenticated` explicitly. Baseline regenerated and reviewed: **19
added facts, every one `anon=-`**, the RPC `exec=authenticated` only.

**RA 10173.** Requests the subject made are purged on erasure and included in the
data export, author-scoped — both caught by the repo's own guardrails.

**Verification.** tsc 0 · lint 0 · unit **4522/4522** (31 new over the pure
helper) · db **475/475** (17 new, incl. the load-bearing pair: the same
coordinator refused with no grant and served after the host shares the seat plan,
where *the only thing that changed is a row the host wrote*) · production build 0.

SPEC IMPACT: Logged in `DECISION_LOG.md` 2026-07-27 — "coordinator access is asked for and granted per feature". Implements build-plan §10 #5 (find-my-seat) and completes the §10 specialization set. The access-request direction is NEW product behaviour and is recorded there, not merely in this repo.
