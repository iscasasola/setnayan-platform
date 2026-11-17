## 2026-11-17 · fix(suppliers): Find never draws an already-added supplier with a fresh Add button

From the couple-dashboard audit: `vendors/_actions/category-search.ts` › `searchCategoryVendors` read the event's picks (`event_vendors.marketplace_vendor_id`) without its `error`. A refused read became an empty set, so every supplier the couple had **already added** came back as `alreadyAdded: false` — a fresh **Add** button instead of **✓ Added**, a failure drawn as a clean slate. It now logs and returns `{ ...EMPTY, unreadable: true }`, the answer this action already gives for its other refused reads, which `category-search-overlay.tsx` renders as "couldn't load".

SPEC IMPACT: None
