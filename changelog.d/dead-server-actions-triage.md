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
