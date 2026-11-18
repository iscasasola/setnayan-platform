## 2026-11-15 · fix(live): four shop-website and supplier-dashboard faults against the 15 Nov rulings

W1 Walk A found each live; each follows a DECISION_LOG 2026-11-15 row.

1. **The "Their real calendar · Open Saturdays coming up" strip is gone** from the verified shop's calling card and the
   sample page (`OpenDatesPeek` deleted, its dates read with it). Row: "THE OWNER APPROVES THE SUPPLIER WEBSITE DESIGN…" —
   *the website's own day strip is gone*. Check a date stays the action row's door.
2. **The service card full screen's ✕ is 44px round, top left** (was 40px). Row: "ONE CLOSE BUTTON FOR EVERY FULL SCREEN:
   A 44px ROUND ✕, TOP LEFT". Guard: `app/v/[slug]/_components/the-card-close-is-44-round-top-left.test.ts`.
3. **The shop's back button says where it lands.** `src=explore` read "Suppliers" and went to `/explore`, which forwards
   to Discover; it now reads "Discover" and goes to `/`. The cold "See more suppliers" goes to `/` in one hop. An
   event's Suppliers is unchanged. Row: "ONE BACK BUTTON, NAMED FOR WHERE THE VISITOR CAME FROM". Guard: `lib/shop-back.test.ts`.
4. **The supplier dashboard no longer tells an unverified shop it is hidden** ("send your documents to go live",
   "Couples see your shop once you are live", "you go live", "Nothing before this is visible to a stranger"). Row: "AN
   UNVERIFIED SHOP HAS THE SAME WEBSITE AS A VERIFIED ONE". Guard: `lib/an-unverified-shop-is-not-told-it-is-hidden.test.ts`.

SPEC IMPACT: None
