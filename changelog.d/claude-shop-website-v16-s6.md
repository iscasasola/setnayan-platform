## 2026-11-17 · feat(shop): v16 S6 — an unverified shop has the same website, limited, with its markings

- **One website for every shop.** The owner's 15 Nov ruling ("AN UNVERIFIED SHOP HAS THE SAME WEBSITE AS A VERIFIED ONE", which supersedes the 13 Nov "two looks" for the look) means an unverified shop now wears the same hero, calling card, two columns, side card and motion. The calm one-column sibling is gone.
- **Only the content differs** (`isVerifiedShop`). An unverified shop has no blue check, no Check a date (so no month on the side card), and no rating chip.
  - Its Reviews section reads "Shown once Setnayan verifies this shop", because reviews are collected and shown with a rating after verification.
  - It has no map, no directions, no street and no web address. Its Where is the city alone (`shopWhere`, unchanged).
  - It stays `noindex`.
- **The markings,** each one shared `NotYetVerifiedTag` (the drawing's `NV_TAG`), each opening one explain sheet (the shipped house `Sheet`, with the drawing's `nvExplain` words):
  - the hero (beside the name);
  - the band under the name (the shipped `NotYetVerifiedNotice`, moved under the hero);
  - the Awards "Not yet" slot;
  - every service card ("Not verified"), and the services note;
  - every portfolio photo ("Not verified"), and the photos note;
  - "What Verified adds" in About;
  - the side card's tag, with its three lines;
  - the quote tray's dock line;
  - the footer.
- **Tabs:** an unverified shop's are Services · Portfolio · About · Reviews · Where, as drawn.
- **Guards:** a new `lib/the-unverified-shop-follows-v16-s6.test.ts` (5 tests, each sabotage-checked red). Eight existing guards that pinned the 13 Nov two looks or the S3/S4 shapes are re-aimed to the one-look shape, equally strict.
- No new server action, migration or route.

SPEC IMPACT: None. This builds the 15 Nov ruling and its approved drawing (`prototypes/shop_website_two_looks_2026-11-15/site.src.html` § NOT VERIFIED).
