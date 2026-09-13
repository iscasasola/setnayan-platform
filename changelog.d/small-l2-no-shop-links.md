## 2026-09-11 · fix(shop-page): a shop's own website and social links never show on its public page (Q3)

Owner ruling 2026-09-11 (DECISION_LOG "SEVEN SUPPLIER-SIDE QUESTIONS" Q3): *"Never show links"* — no tappable website or social link on a shop's public page, before or after booking (the recommendation was "only after booking"; the owner chose stricter).

RULE 0: `app/v/[slug]/page.tsx` (also served at the bare `/{slug}`) rendered `vendor.website` as a plain `<a href>`, and its Featured-videos gallery classified Instagram/Facebook/TikTok/other pasted links as click-through "Watch on X" cards (`lib/video-embed.ts`'s `kind: 'link'` — distinct from YouTube/Vimeo's `kind: 'iframe'`, an actually-embedded player). The synced-Instagram-posts section also linked a video post out to its IG permalink. Three doors, one page.

Fixed all three, saved values untouched (still selected/stored, only the render changed):
- The website `<a>` block is gone.
- `featuredVideos` is pre-filtered to `kind === 'iframe'` before it reaches the grid — an embedded YouTube/Vimeo player stays (it is a video, not a link, and Q3 never asked to drop the videos); a link-out card for IG/FB/TikTok/other is never built.
- A synced Instagram video post renders its same re-hosted thumbnail + play badge as a plain (non-clickable) tile instead of an `<a href={permalink}>`.

Also fixed the couple's own dashboard supplier card (`app/dashboard/[eventId]/_components/vendor-marketplace-info.tsx`), found by the extended guard below: it rendered `contact.website` as a link too, under a 2026-09-10 note that explicitly kept "website + city" — a decision Q3 (one day later, stricter) supersedes. Removed the website `<li>`; the city line stays.

Extended `lib/no-door-out-of-the-app.test.ts` (the shipped "no door out of the app" guard, previously scoped to contact schemes/fields and deliberately silent on website/social per its own header) with two new zero-tolerance rules over the same couple/public reachable file set:
- **Rule 5** — no `href` bound to a `.website` field.
- **Rule 6** — no `href` bound to a video-link-out's `originalUrl` or an Instagram post's `permalink`; an `<iframe src=…>` embed is exempt by construction (a different attribute entirely).

Tests: the guard's 4 new cases (2 enforcement + 2 shape-proof), all green alongside its original 11. Mutation-checked (reintroduced `href={vendor.website}` on the shop page — Rule 5 failed as expected; restored from an explicit backup, diff confirmed clean). Existing `app/v/[slug]/*.test.ts` suites (one-inquire-button, identity-chips, the-shop-page-tells-the-truth ×2, service-card-shows-its-title) unaffected. Typecheck clean. Lint clean.

SPEC IMPACT: None — Q3 is already the corpus's decision (DECISION_LOG, this row); this PR is the code catching up.
