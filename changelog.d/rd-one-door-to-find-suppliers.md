## 2026-10-21 · fix(suppliers): one door to Find — the bottom search shows the categories when empty; a typed shop name is searched

Owner, on the couple's Suppliers page: *"Why do i have this find supplier button? When we have the search bar at the bottom?"* → *"Remove the big Find a supplier button now; the bottom search bar shows the categories when empty."* And, same screen: *"and typing saysay did not show?"*

- The big orange **Find a supplier** button is gone from the Find body (every width, web and app shell — one component, `services-takeover.tsx`).
- The bottom search (`find-thumb-row.tsx`), tapped with nothing typed, opens the **Find page's own category list** above it — same groups, same order, same "Booked ✓ / N suppliers / Joining soon", and a row goes where the Find page's row goes (`/vendors/categories?c=<tile>`). Typing closes it and narrows the page as before; a tap outside or Escape closes it.
- ONE list, ONE read: `FindCategoryList` (`vendors/_components/find-category-list.tsx`) draws both the Find page and the empty state, from `readFindList` (`lib/supplier-find-read.ts`, moved out of the Find page). The Find page keeps working for every other link.
- `/messages`'s empty "Find a supplier" link opened only that browse → now `findDoorHref` (`/vendors?tab=shortlist&find=1`), which opens the bottom search's empty state.
- **"saysay"**: the shop is `is_demo = true` by the owner's 2026-09-29 ruling (DECISION_LOG "LANE 2 §2C" (1)), so a real couple's search hides it — by design. But the bench's name search hid demo shops from **admins in demo mode too**, while the category search did not; both now call one rule (`lib/demo-vendor-exclusion.ts`). The Find page's own box ("Search suppliers or a service") matched only category words; it now also lists shops by name, with the same name search.
- Guard `app/dashboard/[eventId]/vendors/one-door-to-find.test.ts` (executed render + wiring + demo rule), six sabotages red.

SPEC IMPACT: None — implements the owner's 2026-10-21 ruling on the shipped one-screen Suppliers page (DECISION_LOG "SUPPLIERS ONE-SCREEN"; the Find list is the 2026-10-01 "SUPPLIER INBOX + FIND-A-SUPPLIER DESIGN" list, unchanged).
