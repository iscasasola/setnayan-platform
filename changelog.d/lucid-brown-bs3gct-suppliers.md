## 2026-11-17 · fix(suppliers): Find never draws an already-added supplier with a fresh Add button

From the couple-dashboard audit: `vendors/_actions/category-search.ts` › `searchCategoryVendors` read the event's picks (`event_vendors.marketplace_vendor_id`) without its `error`. A refused read became an empty set, so every supplier the couple had **already added** came back as `alreadyAdded: false` — a fresh **Add** button instead of **✓ Added**, a failure drawn as a clean slate. It now logs and returns `{ ...EMPTY, unreadable: true }`, the answer this action already gives for its other refused reads, which `category-search-overlay.tsx` renders as "couldn't load".

SPEC IMPACT: None

### And Book: a booking's contracts are measured

`vendors/[vendorId]/workspace/page.tsx` read the booking's contracts with `?? []` and never looked at the error: a refused read printed the "no contract" chip and *"No contracts uploaded yet. Ask {supplier} for a contract"* — over a read that never answered. It is now measured: the chip is withheld and the panel says it couldn't load. The panel's **Manage** link (a ~16-px press) and **Ask … for a contract** (~28 px) gain `min-h-11`.
