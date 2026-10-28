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

**S3 · Basic setup first.** `lib/basic-setup-gate.ts` decides once (`basicSetupHoldOf` in
`app/vendor-dashboard/layout.tsx`, from the shop row and the `verification_state` probe the layout already reads — no
new request): an UNVERIFIED shop's owner/admin whose shipped `businessProfileChecklist` is incomplete is held on the
setup. `BasicSetupHold` wraps the page body only and draws "Finish your basic setup first" (title + one line of what is
left, details in the ⓘ) with one button, "Back to setup" → Today's six steps. Open while held: Today, Your details,
documents, Events you run, Messages + Customers' People list, Notifications, Settings, Help, Helpers, Plan, Switch
shop, the avatar sheet (sign-out), the event itself (`/dashboard/<id>`), and the shop's Coverage while "Services
covered" is the missing step. A helper, a verified shop and an unread row are never held (`legacy_read` now marks the
fallback profile read). Guard: `lib/basic-setup-gate.test.ts`.

S2 follow-up: "Ask to change" files the request IN PLACE on the row (one line, Send → the shipped
`requestProfileCorrection`), so Today's setup stays "done in place" (`setup-is-done-in-place.test.ts` unchanged).

**S4 · "What you offer" counts each real service once.** `offerProgress` (`lib/supplier-setup.ts`) takes the coarse set
(`new Set(VENDOR_CATEGORIES)`, handed in by `lib/vendor-first-steps.server.ts` — the same set
`syncProfileFromCoverages` preserves beside the leaves): a coarse key beside a leaf is not a service of its own unless
a card is filed under it; an all-coarse shop keeps its services. An /open-shop stylist (`[makeup_artist, bridal_hmua]`)
is asked for three cards, not six. A refused card read stays "Couldn’t load" (unchanged). Lab:
`/dev/supplier-lab?easy=setup&coarse=1`. Guard: `lib/what-you-offer-counts-each-service-once.test.ts`;
`setup-is-done-in-place.test.ts` passes the set (reason noted).

SPEC IMPACT: DECISION_LOG row "SUPPLIERS READY TO RUN AN EVENT AND FINISH THEIR SHOP" (corpus).
