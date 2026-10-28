## 2026-10-29 · feat(supplier): ready a supplier to run an event and finish her shop (owner, 29 Oct)

Owner, verbatim (29 Oct ~04:25 PHT): *"I am planning to invite the stylist in tomorrow … fully access the event hub.
Create schedules. Check guestlist, fix seat plan and fix her shop and service card"* · *"This is similar to adding
them as a cohost which is already in effect. They only need a way to access it and have that menu for them on their
account."*

**S1 · "Events you run" for a live CO-HOST seat too.** `seatRunsTheEvent` (`lib/events-you-run.ts`) now also draws the
door for a joined, not-removed full co-host seat (`seatIsFullCohost`, the SQL `seat_is_full_cohost` mirror), listed
until the same seven days after the event a coordinator's window gives. The read
(`lib/events-you-run.server.ts`) asks `.in('role_subtype', RUN_SEAT_ROLES)`. Each row carries `seatWord`
(Coordinator · Co-host) for Today's line and the customer card's pill; after the event a co-host row says "Wrapping
up", never "access until" (a co-host's access does not end). A limited helper (`viewer`) gets no door. No new
permission path, no migration. Guards: `lib/events-you-run.test.ts`, `app/vendor-dashboard/coordinator-door.test.ts`.

**S2 · A shop Setnayan set up changes its name and address BY REQUEST.** One rule, `identityLockOf`
(`lib/vendor-corrections.ts`): a shop an admin pre-created for someone else (`created_by_admin_user_id` set and not
the shop's own owner) may FILL a blank name/address but not overwrite a filled one; verified shops unchanged (every
identity field); self-opened shops unchanged. The inline save refuses through `identityLockRefusal` (read off
`vendor_profiles_self`); the request is the shipped `requestProfileCorrection` → `vendor_correction_requests` →
/admin/corrections door. Your details and Today's setup draw a filled request-only row as "Ask to change" (→
`/vendor-dashboard/profile#fix`) or "Change asked · waiting"; the ask card offers exactly the rule's fields and starts
on the shop name. Lab: `/dev/supplier-lab?s=details&invited=1[&asked=1]`. Guard:
`lib/a-shop-setnayan-set-up-asks-to-rename.test.ts`; `correction-queue-has-an-intake` and `the-badge-has-a-deadline`
updated with reasons.

SPEC IMPACT: DECISION_LOG row "SUPPLIERS READY TO RUN AN EVENT AND FINISH THEIR SHOP" (corpus).
