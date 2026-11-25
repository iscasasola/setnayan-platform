## 2026-11-24 · fix(copy): public lines match the rulings

The controller's 24 Nov "make it true" asked that every public line match the owner's rulings. A read-only audit of main 7247a56b9 and live setnayan.com found six kinds of line that no longer did. All six are fixed here, and one guard, `lib/public-lines-match-the-rulings.test.ts`, holds them.

- **a · Real Stories (retired 16 Nov, DECISION_LOG "THE BLOG AND REAL STORIES ARE RETIRED" · "RETIRED ADDRESSES FORWARD"):**
  - The /features row A46 is gone (now in `EXCLUDED`, with its reason).
  - The `real-stories` feature page has left the registry.
  - `/features/real-stories` and `/tl/features/real-stories` forward to Discover through `RETIRED_TREES`, the same door as `/realstories`, and keep their query.
- **b · Guest camera-roll uploads are live (14 Nov rulings, `lib/papic-phone-uploads.ts`):** the saved AI answer `guest-photos-free` now says guests can add event-day photos and clips from their camera roll if the couple allows it, matching the help topics. The "there is no camera-roll upload" evidence line is gone.
- **c · No typed counts:**
  - "all 192 categories" on the front door's marketplace row is now counted.
  - "200+ supplier sub-categories" in /llms.txt is now counted.
  - Both use the new `lib/category-count.ts`, which counts the live taxonomy (`getTaxonomy` / `readTaxonomyFrom`), browsable categories only. On the code fallback no number is said ("every category").
- **d · No unbacked promises:**
  - "keep 100%" is removed from the home For-suppliers overlay and the Free tier's tagline, because suppliers pay the booking fee. They now read "Free, for good".
  - The Creators page's "Free forever" becomes "Free to publish". No row backs "forever"; the 16 Jul creator verdict says "for free".
  - The Store's "Free forever" stays: it is ruled by 2026-11-23 "APP STORE FREE LIST — APPROVED", and now cites that row.
- **e · "Nothing renews by itself":**
  - There is one source, `lib/plan-renewal-words.ts` (`planRenewal`, `NOTHING_RENEWS`, `APPLE_PLANS_RENEW_SENTENCE`).
  - The plan screen reads `getIapGate()`, which carries `NEXT_PUBLIC_APPLE_IAP_ENABLED`, and passes `appleSells` to the plan rows, the plan sheet and `planPickLine`. In the app with Apple on, the lines say the plan renews through Apple and how to cancel it.
  - /features, the help article and /llms.txt keep the web words from the same source. /llms.txt adds the Apple sentence while the switch is on.
  - Gift lines ("a gift … nothing renews") are untouched: a gift never renews on any channel.
- **f · "Setnayan Journal" (the Journal moved into Articles, 17 Nov):**
  - `JOURNAL_BYLINE` is now "Setnayan".
  - The /articles meta description and the /llms.txt Articles intro no longer name the Journal.
  - `lib/articles-are-findable.test.ts` follows.
- **Kept, owner-ruled:** "No. 1 Supplier of the Year"; "Always free" for FaceBlock; "kept for life" for Memories; the Patiktok / Music Maker stubs; /blog → /articles; the sample peso figures in demo cards.

SPEC IMPACT: None. These are copy fixes to existing rulings (DECISION_LOG 2026-11-16, 2026-11-14, 2026-11-17, 2026-11-23). One divergence from a drawing: the 17 Nov Articles drawing shows "Setnayan Journal · 17 Nov" as the byline, and the controller's 24 Nov brief replaces it with "Setnayan".
