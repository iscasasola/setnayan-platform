## 2026-10-25 · feat(tours): every page's spotlight names its main parts

Owner, 25 Oct: *"the spotlight tour is missing so many parts for each page as well"*. Each page's first-visit
spotlight now stops at each main part a first-time user has to find, in reading order (top → bottom, then the thumb
row). Each stop is a title and one short line.

- **New page tours.**
  - Host: Guests (`customer_guest_list_v2`), Suppliers (`customer_suppliers_v1`) and account Memories (`customer_library_v1`).
  - Supplier: Today (`vendor_today_v2`), Customers › People (`vendor_people_v1`) and Your collections (`vendor_collections_v1`).
  - Signed-out guests: the Papic camera (`guest_papic_camera_v2`) and the Papic page (`guest_papic_me_v2`).
- **Guest tours mount.** Guest tours go through a new `GuestSpotlight`, which keeps the seen mark in localStorage. They replace the guest carousels, which were switched off.
- **Grown, with a version bump.**
  - Event Memories (`customer_memories_v2`): adds ⚙ settings and ＋ Add photos, and the stops now follow reading order.
  - People (`customer_people_v3`): adds the view picker and ＋ Invite.
  - Events board + account bar (`customer_account_bar_v2`): adds the Planning and Worth planning shelves.
- **Grown, same key.**
  - Home: adds Switch on more.
  - Supplier Hub: reordered to reading order, and adds the event day's Launch the app and Set up stops.
- **Two never stack, even back to back.** The host's tour ends on Suppliers and the supplier's ends on Today. A page tour that waits for one of them now waits for the next visit, instead of starting the moment the "You're set" card closes (`spotlight-mount.tsx`).
- **Guard.** `spotlight-anchors-exist.test.ts` now names the home component of every stop. That component's comment-stripped source must draw the token, and a stop with no home fails. Seen red: removing `guests-counts` failed it. Each `tour` prop a component passes on must also end up as a real `data-tour`.
- **Still missing.** The Events board's Search events and ＋ Create event live in `shell-thumb-rows.tsx`, and Discover in `front-door.tsx`. Both files belong to another builder this round, so neither has a token yet.

SPEC IMPACT: None. No new mechanism or decision. This applies the standing rule (every feature gets a first-visit spotlight, DECISION_LOG 2026-10-02) to the parts each page already ships.
