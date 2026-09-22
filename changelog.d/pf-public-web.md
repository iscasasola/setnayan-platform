## 2026-09-22 · fix(seo): the sitemap stops advertising a page crawlers cannot read

W4 / register LAU-45.

`/open-shop` — the supplier onboarding funnel — was in `sitemap-static.xml` with
the note *"was orphaned (indexable but in no sitemap); added 2026-07-10."*

**It is not indexable.** `app/open-shop/page.tsx` does
`if (!user) redirect('/login?next=…&as=vendor')`, and **every crawler is signed
out.** Measured on production: `/open-shop` → **307** →
`/login?next=%2Fopen-shop&as=vendor`. For two and a half months the sitemap
pointed Google at a login page, and the supplier funnel was advertised to nobody.

🔑 **The note that added it was the mistake.** "Indexable but in no sitemap" was
half-measured — whoever checked confirmed the route EXISTED and never fetched it
signed out. A page you can see while logged in says nothing about what a crawler
gets.

Nothing is lost by removing it. The PUBLIC face of that funnel is `/vendors` —
the supplier pricing and pitch page, still indexed — which links onward to
`/open-shop` for anyone signed in. A sitemap lists what a stranger can READ, not
every door an authenticated person can walk through.

`sitemap-lists-only-public-pages.test.ts` derives the rule from the page sources
rather than hardcoding an exclusion list, so a route that GAINS an auth gate
later fails here instead of silently rotting in the sitemap — which is the
direction this defect actually travels. It prints what it resolved (36 of 36
advertised paths found a page file) and floors both counts, so a resolver that
stops finding pages cannot pass by seeing nothing. A second test keeps the
pattern aimed at the real `open-shop` page, so the matcher cannot drift into
matching nothing.

Also verified while measuring, and NOT a defect: the sitemap index is healthy —
37 static + 80 help + 51 blog + 2 vendors + 22 weddings = 192 URLs — and
`/alaala` IS indexed, which was the other half of LAU-45. Every other advertised
URL returns 200 signed out; `/open-shop` was the only one that did not.

Proved by sabotage: putting `/open-shop` back turned both tests red
(`37 advertised, 1 auth-gated`). Restored, 2/2.

SPEC IMPACT: None.
