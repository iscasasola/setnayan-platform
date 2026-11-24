## 2026-11-24 · feat(doors): supplier.setnayan.com and coordinator.setnayan.com, the business doors

The owner approved the business door drawing v7 (claude.ai artifact VFyriJ267Pw6Z3EN8i5PtJ, light only). It is built on the shipped pages: `/for-suppliers`, `/for-coordinators`, the one shell (`AppRailShell` → `FrontDoorShell`) and the one sign-in card. No second page.

- **One map:** `lib/doors.ts` `DOOR_HOSTS`.
  - `supplier` opens `/for-suppliers`.
  - `coordinator` opens `/for-coordinators`.
  - `business` is a 308 alias of `supplier`.
  - Every label is reserved: middleware answers it before the paid event-subdomain rewrite, and `RESERVED_SLUGS` refuses it as an event or shop address.
- **Host routing:** handled by `doorRoute` in middleware.
  - `/` on a door host is an internal rewrite to its front page, so the address bar keeps the door's name.
  - The five legal pages open inside the door.
  - Every other path is a 308 to the same path on setnayan.com. Sign-in never runs on a door host, so there is one auth origin.
- **Sign-in:** every door control goes to `<site>/login?door=X`.
  - The card swaps its heading words only.
  - The ✕ goes back to the door.
  - "Create one, free" is the shop set-up on the same account, with `?as=coordinator` on the coordinator door.
  - A sign-in that names nowhere lands through `/auth/door`, which asks `landingForAccount` with the door. It goes to the supplier dashboard if the account has a shop, and to `/open-shop` (or `?as=coordinator`) if it has none.
  - The door rides `next`, so password, Google, Apple and the magic link all carry it.
  - Someone already signed in goes straight on.
- **Chrome:** one flag (the `x-sn-door` header, always overwritten by middleware).
  - The shared shell reads it and drops the rail, the Menu button, search, the couple links, Discover and the wordmark's link.
  - One legal line takes their place.
  - `/for-suppliers` drops its couple-pricing aside.
  - `/for-coordinators` drops its couple footer and points "For suppliers →" at the supplier door.
  - The same flag can be turned on by a future "Setnayan Business" app shell (a `SetnayanBusiness` user-agent marker or a `setnayan-door` cookie, DECISION_LOG 866cebc5). The signed-in dashboard then loses its own rail rows, the way back and the company links. The app shell itself is not built.
- **/for-coordinators:** "Your preferred suppliers" is now "Trusted partners" (`TRUSTED_PARTNERS`).

SPEC IMPACT: None. This builds the approved door drawing and DECISION_LOG 866cebc5's flag. The owner added the three door hosts to Vercel and their DNS on 24 Nov.
