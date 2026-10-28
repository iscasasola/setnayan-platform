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

**S6 · The shop's badges on Shop › How it is going.** Owner: *"Their badges will be on the supplier shop performance
page"*. `/vendor-dashboard/performance` now draws "Your badges" under the plain-words top (and on the tier upsell):
every badge worn today through THE one `ShopBadgePill`, and "Next to earn: 50 events · Silver · 4 to go"
(`badgeShelf` → `shopBadges` + `nextToEarnLine`, `lib/shop-badges.ts`). Read once (`readShopBadgeFacts`), awaited
inside the page's Batch A — no extra round trip. A refused read: "Couldn’t load your badges" · "—". Today's "You
earned …" line stays. Guard: `app/vendor-dashboard/performance/your-badges-are-on-the-page.test.ts`.

**S4b · The hosts pick their coordinator's access on Home — Limited or Full.** Owner: *"Once the coordinator accepts,
and connected to the event. The event should show to pick what kind of access do we want to give the coordinator. On
the home."* · *"only TWO levels"*. Home draws "<shop> is your coordinator — what can they do?" (owners only,
self-hiding, a refused read said) for every CONNECTED coordinator seat with no recorded answer — the answer is
`permissions_json.access_level`, a key no existing seat carries, so the live coordinator (old `{seat_plan: view}`
grant) is asked once. Limited = the coordinator's seat with view on every part; Full = the CO-HOST seat (`co_host` →
`couple` member). The seat-as-it-was is kept (`prior`) so Undo (the toast's pill) restores it exactly. Written
through the EXISTING `setDelegateArea` (area `access_level`) — no new server action. Changeable in Event details ›
Access (a Limited · Full access pick on the row). Events you run: a Full coordinator keeps the door (row word
Coordinator); a Limited one keeps it too (view). Guards: `lib/the-hosts-pick-their-coordinators-access.test.ts`;
`people-with-access.test.ts` allow-list + reason.

**S4c · Can a coordinator Apply the Event Hub? Measured.** `tests/db/a-full-access-coordinator-can-apply-the-hub.db.test.ts`
(PGlite): a coordinator member — narrow grant, "Same access as you" ON or Off — writes ZERO `events` rows (the only
UPDATE policy is `couple_can_update_event`); after the hosts pick FULL ACCESS (the co-host seat) her Apply lands;
Limited, a limited helper, Undo and self-promotion stay refused. No migration needed.

**S7 · No stub bounces.** Today's quote/contract rows (`overview-sections.tsx`), the customer card's proposals ·
contracts · "Open chat" with no thread (`clients/[eventId]/page.tsx`), the chat's proposal card, and the Hub's
no-shop redirect now go STRAIGHT to where the forwarding stubs sent them (`customerLandingHref`, the stubs' own
anchors table; `/vendor-dashboard/profile#docs`). The slow-reply email's door — `/vendor-dashboard/settings/notifications`,
a page that never existed — lands on Settings › Notifications (`settings#notifications`, the fold now carries the
anchor). Ugat screens, port baseline and root-map baselines regenerated (8 lines removed, none added). Guard:
`app/vendor-dashboard/no-stub-bounces.test.ts`.

**S8 · The event card saves in place — first pass.** Notes (add · done/reopen · delete) and the challenge save IN
PLACE: success revalidates the card where it stands, no navigation. A refused note write is now SAID (it was
swallowed): back to the notes with `?note=error` → "Couldn’t save that — try again". The 15 other actions still
navigate because each one's OUTCOME rides its redirect as a flag the page/Today prints (sent · error · hall taken ·
fee held …); converting them needs that word moved into a returned result with a client caller — listed, with
reasons, in the guard `app/vendor-dashboard/clients/[eventId]/the-event-card-saves-in-place.test.ts` (the list can
only shrink; a new navigating action fails it).

SPEC IMPACT: DECISION_LOG row "SUPPLIERS READY TO RUN AN EVENT AND FINISH THEIR SHOP" (corpus).
