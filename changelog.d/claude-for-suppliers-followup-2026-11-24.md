## 2026-11-24 · fix(for-suppliers): Get verified carries its choice, every preview names every plan, no false lede, the window switch fits its card, the price meta sits under the title

A read-only re-walk of /for-suppliers and the supplier Shop and Toolkit on live (shots in `build-sessions/shots-supplier-walk/`) found five faults. Fixed at their causes:

- **"Get verified" was the Free door.** The Verified plan card opened a bare `/open-shop`, so the choice was dropped. It now opens `/open-shop?plan=verified`. `verified` is a plan word (`SUPPLIER_PLAN_QUERY_KEYS`) but not a paid tier row (`supplierPlanTier` stays null). A shop opened with it lands on its existing papers fold (`VERIFY_PAPERS_PATH`, the same place as `VERIFY_DOCS_HREF`). No price rides with it. Guard: `lib/get-verified-carries-the-choice.test.ts`.
- **og:description left Ultra out.** It was built from a hand-picked second list (`['solo', 'pro']`). Every description (meta, og, twitter) now reads the one `all` list. Guard: `lib/for-suppliers-previews-name-every-plan.test.ts`.
- **"Most of them free." sat over the only two tiles, both Paid.** The #tools section has no lede now (`Part`'s lede is optional). What is free is said where it is true: the Toolkit count and its sheet.
- **Desktop Shop › Analytics: "12 months" ran out of its card.** The side column draws the cards two across (~171 px). The card is now a size container: when it is narrower than the figure plus the full words, the figure steps aside (the line under the graph says the same number) and the switch fills the row as "Month · Year". The full words stay the buttons' names. A phone's 340-wide card is unchanged. Guard: `app/vendor-dashboard/performance/the-window-switch-fits-its-card.test.ts`.
- **Toolkit: "One-time · Plus, Pro or Ultra" wrapped to 4 lines beside Buy.** The price meta is now the tile's own line under the title, at most 2 lines, and the foot holds the button alone. Guard: `app/vendor-dashboard/shop/store/the-price-meta-sits-under-the-title.test.ts`.

Four older guards pinned the changed shapes (`verified` read as no plan; the Verified card's `href: OPEN_SHOP`; `options={WINDOW_OPTIONS}` twice). Each now pins the new shape.

SPEC IMPACT: None. These follow existing rules: the W1-B21 plan carry-through, one source per fact, honest copy, and the house switch. The badge count (5 on /for-suppliers vs 6 in the Toolkit) is NOT in this PR. It waits for #8255 and ships as its own small PR.
