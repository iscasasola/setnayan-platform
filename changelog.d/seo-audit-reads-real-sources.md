## 2026-07-31 · fix(seo): the audit was checking two sources nothing else consumed

Found while writing owner instructions for the two remaining SEO warns. Both
warns were pointed at inputs no other code read, so they described a reality that
did not exist — and one of them manufactured work.

**`Organization.sameAs` — the nag was false.** The audit read env
`SETNAYAN_ORG_SAMEAS`, which **nothing else in the codebase consumed**, while the
JSON-LD in `app/layout.tsx` shipped a hardcoded
`sameAs: ['https://www.facebook.com/setnayan']` — a Page the owner confirmed live
2026-07-10. So the audit said *"empty — create FB Page + LinkedIn"* every day for
a Page that already existed and already shipped. Acting on it meant creating a
duplicate.

**Verification tokens — the fix was unreachable.** `app/layout.tsx` renders the
meta tags from `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` /
`NEXT_PUBLIC_BING_SITE_VERIFICATION`, but the audit checked the **unprefixed**
`GOOGLE_SITE_VERIFICATION` / `BING_SITE_VERIFICATION`. Setting the vars that
actually verify the domain would have left the audit warning forever; setting the
ones that silenced it would have emitted no meta tag at all.

`lib/seo/org-same-as.ts` is now the single source both readers share.
`SETNAYAN_ORG_SAMEAS` stays as an **additive** override (shipped list is the
floor, not the fallback) so a new profile goes live without a deploy, and
`siteVerification()` reads the prefixed names while still accepting the
unprefixed so an existing deployment cannot regress.

Also documented all seven SEO env vars in `.env.example` — none were — including
the distinction that cost the most confusion: the verification **meta tag** and
the Search Console **data pull** are different credentials, and verifying
ownership does not grant API access.

SPEC IMPACT: None.
