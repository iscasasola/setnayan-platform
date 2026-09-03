## 2026-09-03 · chore(server-actions): delete eight superseded server actions, keep the deferred ones

Eight exported server actions with zero callers were confirmed **superseded** —
each has a live replacement that does the same job — and are deleted. Each
deletion leaves a short note naming the replacement, so the next dead-code sweep
does not re-find it and try to "finish" it.

| Deleted | Superseded by |
|---|---|
| `saveStdContent` (studio/save-the-date) | `saveAllStdContent` (2026-06-18), wired at `_components/StdBuilderClient.tsx`; writes a strict superset |
| `bulkAssignGuestRole` (guests) | `bulkApplyRoleAndGroup` — owner directive 2026-05-23 PM: *"apply and add button should be 1 only"* |
| `bulkAddGuestsToGroup` (guests) | same |
| `setGuestPlusOnes` (guests) | guest-detail toggle, `map-actions.ts`, CSV import / `addSingleGuest` — three live writers of `plus_one_allowed` |
| `joinDemoSession` (`_actions`) | the demo token pages resolve the scan during their own render via `lib/demo-sessions` |
| `seedDefaultScheduleBlocks` (schedule) | `loadScheduleTemplate`, additive-into-empty and host-submitted |
| `checkVendorDateConflict` (vendor invite) | `resolveVendorDateStatus` (owner 2026-07-02), which composes four reads, not one |
| `logBookingFeePayment` (booking fees) | `/pay/[reference]` → `submitPaymentProof`, which puts the exact figure in a QR — its whole file had no other export and nothing imported it, so the file is gone |

🔑 **`seedDefaultScheduleBlocks` was not merely unused — it was a loaded gun.** It
is the wedding twin of `seedNonWeddingRunOfShow`, which was moved out of that same
`'use server'` file on 2026-08-21 because its two trailing `revalidatePath` calls
are fatal when a page calls it during render: every first-ever visit to a
non-wedding Schedule returned a 500, and because the INSERT commits first, a
refresh hid it. This one carried the identical shape and the identical
"first-open" docblock. Wiring it as designed would have shipped that 500 a second
time. Both notes are now merged into one at that site.

**Left in place, deliberately — do not delete on the next sweep:**
`sendVendorInvite` · `connectExistingVendorProfile` · `revokeVendorInvite` carry a
dated 2026-08-06 docblock that says emailing an invite is *"a capability nothing
else provides … If email invites are ever wanted again, mount these; do not
rebuild them."* Its header said "these two" while preserving three; corrected to
name all three, since a sweep that trusts the count deletes the odd one out.

SPEC IMPACT: None. No behaviour change — every deleted export had zero callers,
verified by counting references across all files including each definition's own,
minus the definition line itself.

## 2026-09-03 · feat(server-actions): wire the four that were real, not dead

Four of the 31 were **correct, hardened and unreachable** — the UI that called
them was removed or never mounted, and nothing said so. Each is now wired to the
page that should have offered it all along.

| Wired | Where | What its absence cost |
|---|---|---|
| `revokeArea` | `/dashboard/[eventId]/access-requests` | `answerAccessRequest` can GRANT all 8 delegate areas; only 2 (budget, photos) could be taken back. Sharing the guest list, seat plan, schedule, suppliers, invitations or mood board was a **one-way door**. |
| `saveRsvpBackdrop` · `clearRsvpBackdrop` | `/dashboard/[eventId]/website/editor` | The public invitation kept **rendering** `events.rsvp_backdrop` while nothing could write it — the retired `/site-editor` port kept the actions and lost the control. |
| `updateSponsor` | `/dashboard/[eventId]/sponsors` | No way to fix a typo in a ninong's name. The only route hard-DELETEs the row, discarding the invitation, the answer, and the link to the auto-created guest. |
| `updateVendorEventSet` | vendor Song Desk | No way to rename a band's set. The only route was delete-and-recreate, and set songs are `ON DELETE CASCADE` — the setlist, on the night. |

The take-back section reads `event_moderators.permissions_json`, **not** the
`decisions` blob it sits under: the decision is what the host said and stays
"shared" forever after a revoke, so rendering from it would leave a couple
pressing Take back and seeing nothing change.

**New guard — `lib/a-mounted-action-keeps-its-control.test.ts`.** Every one of
these passed every test in the repo while unreachable: a server action with no
caller compiles, lints, and keeps its own unit tests green. The absence lives in
the join between an action and a component, and nothing was looking there.

🪤 **The guard needed two sabotage rounds to become real.** v1 asserted only "has
a caller" and passed through its own sabotage — unmounting `<GrantedNow>` left
`granted-now.tsx` on disk still calling `revokeArea`. v2 added a reachability
walk from Next entry points and *also* passed, because the unmount left
`import { type LiveGrant }` behind and a type import erases at runtime. Both
fixes are load-bearing; each was green before it.

**Two existing guards followed the booking-fee rule to its live lane.**
Deleting `booking-fees/actions.ts` turned `vendor-booking-fee-reference.test.ts`
and `payment-proof-ref-tenancy.test.ts` red — both pin lanes **by file path**.
Repointed, not relaxed: the owner's 2026-08-06 "a booking fee must carry a
reference" rule is enforced on `/pay/[reference]` (`payable.requiresReference`),
which the booking-fees page comment states outright. Both were sabotage-tested on
the new lane. The tenancy list went from two live lanes plus one dead one to
three live ones — coverage grew by losing an entry, since the vendor's real proof
upload had never been in it.

🪤 One tenancy assertion was pinned to a single variable name (`screenshotRefRaw`)
and could not see the same regression on a lane spelling it `refRaw` — sabotage
showed it green while its two neighbours went red. De-coupled from the spelling.

SPEC IMPACT: None. No product decision changes; four already-specified
capabilities become reachable, and no rule was removed or weakened.
