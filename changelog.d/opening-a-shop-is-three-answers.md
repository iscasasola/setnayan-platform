## 2026-11-25 · copy(features): opening a shop is "three answers", not "two steps"

/features, the front door's supplier strip and the AI answer for "How do suppliers join Setnayan?" still told suppliers a shop opens "in two steps". The sign-up (`/open-shop`, `OPEN_YOUR_SHOP_HEAD`) says "Three answers. Free." and /for-suppliers says "Open your shop: three answers". Every page now says three answers, matching the Facebook posts moved on 25 Nov.

Changed: `lib/features-page.ts` (C01 row and the Open chapter title) · `app/features/_story-sample-moments.tsx` · `app/_components/frontdoor/front-door-landing-data.ts` (`SUPPLIER_STAGES`) · `lib/seo/ai-answers.ts` (`supplier-join`). New guard `lib/opening-a-shop-is-three-answers.test.ts` holds it. No TL or CEB copy said "two steps".

SPEC IMPACT: None (copy only).
