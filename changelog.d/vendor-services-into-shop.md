## 2026-07-02 · refactor(vendor): retire "My Services", fold it into "My Shop"

The vendor **My Services** editor now lives inside **My Shop**, under the
"How you're doing" row, in a collapsible "Your services" section — and "My
Services" is **fully retired as a nav destination** (owner-confirmed: gone for
every role, not just owner/admin). The whole editor (tier & coverage, Explore
card preview, service cards with inline editors, specialist tools & category
requests) moved verbatim into four collapsible sub-sections.

**One shared component.** The ~1,760-line page body was extracted to
`app/vendor-dashboard/services/_components/services-manager.tsx`
(`VendorServicesManager({ search, basePath })`) and rendered inside a new
animated top-level disclosure on My Shop (`shop/_components/services-disclosure.tsx`,
reusing the shared `Collapsible` primitive so the motion matches the Manage tiles
+ QR card). Deep-link params (`?offpeak`/`?add`/`?saved`/…) open the section.

**Route retired to a redirect.** `/vendor-dashboard/services` now 307s to
`/vendor-dashboard/shop` (preserving query params), so bookmarks, the four inbound
"add a service" links (calendar/customers/earnings/repertoire), the off-season
nudge, and the guided-wizard return all still land on the editor. The guided
wizard child route `/services/new/[category]` is a separate segment and is
unaffected.

**Removed from every menu.** Dropped from the desktop sidebar
(`VENDOR_SIDEBAR_DESTINATIONS`), the mobile bottom nav (`VENDOR_BOTTOM_NAV_ITEMS`),
the `/more` overflow (the `offerings` group's `services` item; the group is
relabelled "Service tools" and keeps its 4 specialist tools), and the role-scoped
sets (`VENDOR_SCOPED_NAV_ITEM_KEYS` / `VENDOR_SCOPED_BOTTOM_NAV_KEYS` in
`lib/vendor-role.ts`). The Shop tab's `activeMatch` gained the retired services
routes so they still light a tab.

**⚠ Accepted trade-off (owner-confirmed):** agent/viewer staff reached services
ONLY via this menu, and My Shop is owner/admin-only — so staff now have no
services surface. Largely theoretical today (founder-only org); the clean future
fix is a role-guarded My Shop or a dedicated staff services view. Flagged inline
in `lib/vendor-role.ts` and in the corpus `DECISION_LOG.md`.

**Return-to-host on save.** New `lib/vendor-services-return.ts`
(`servicesReturnBase()`) reads the request Referer (allowlisted; defaults to My
Shop since the standalone route redirects there) so service/coverage/add-on edits
return to My Shop. Wired through `services/actions.ts`, `addon-actions.ts`,
`coverage-actions.ts`; each also revalidates `/vendor-dashboard/shop`.

SPEC IMPACT: Vendor-dashboard IA change — "My Services" retired as a top-level
destination for ALL roles (folded into My Shop; route redirects). Staff lose the
services surface (owner-accepted). Per the as-built ground-truth posture the code
is canonical; logged at the bottom of the corpus `DECISION_LOG.md` (2026-07-02).
No schema, pricing, SKU, or entitlement change.
