/**
 * WHICH SHOPS AN EVENT'S OWN SUPPLIER SEARCH MAY LIST — one rule for every search a couple types into inside an event.
 *
 * 🧪 THE RULE CHANGED 2026-11-06 (owner, DECISION_LOG "Demo catalogue — owner clicks"): real couples see demo shops on
 * Explore and the front page, marked "(DEMO ONLY)", *"but never inside their own event's supplier search"*; and
 * (*"DEMO CATALOGUE — scope"*) *"the demo events can only see demo suppliers"*. So inside an event the scope is the
 * event's own: `events.is_sample` must equal `vendor_profiles.is_demo` (`lib/demo-scope.ts`, `demoScopeFor`).
 *
 * This SUPERSEDES the 2026-10-21 rule this file used to hold (`demoShopsShownTo` / `demoVendorIdsHiddenFrom`: an admin
 * with the demo cookie saw demo shops inside ANY event). The cookie no longer reaches inside an event — a real event is
 * real for everybody, the owner included; a demo event is where demo shops are tried.
 *
 * Why it is still one helper (owner 2026-10-21 — *"and typing saysay did not show?"*): the category search
 * (`_actions/category-search.ts`, through `fetchWizardVendorRecommendations`) and the bench's whole-marketplace search
 * (`_actions/bench-marketplace-search.ts`) once disagreed about demo shops. Both now ask THIS module.
 *
 * 🔒 FAIL CLOSED. The demo ids are read with `readDemoVendorIds` (`lib/demo-vendors.ts`); a refused read is `null`, and
 * {@link shopInEventScope} then keeps NOTHING — the caller says it could not load, never lists a demo shop to a real
 * couple because a read failed. Guard: `lib/a-real-event-never-finds-a-demo-shop.test.ts`.
 */
import type { DemoScope } from '@/lib/demo-scope';

/** An event's search scope plus the demo shop ids it is measured against (`null` = the ids could not be read). */
export type EventSearchScope = DemoScope & { demoVendorIds: ReadonlySet<string> | null };

/** PURE. May this shop appear in this event's search? A refused id read keeps nothing. */
export function shopInEventScope(scope: EventSearchScope, vendorProfileId: string): boolean {
  if (scope.demoVendorIds === null) return false;
  return scope.demoVendorIds.has(vendorProfileId) === scope.is_demo;
}

/** PURE. True when the scope could not be measured — the caller reports "could not load", not "no shops". */
export function eventScopeUnreadable(scope: EventSearchScope): boolean {
  return scope.demoVendorIds === null;
}

/** PURE. Build a scope from parts (also what the tests use). */
export function eventSearchScopeOf(scope: DemoScope, demoVendorIds: ReadonlyArray<string> | null): EventSearchScope {
  return { is_demo: scope.is_demo, demoVendorIds: demoVendorIds === null ? null : new Set(demoVendorIds) };
}
