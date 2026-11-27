## 2026-11-27 · fix(words): L9 section P, public-site content finalized (commission, free promises, Setnayan AI, retired names)

Owner ruling R4: finalize all content before any Facebook posting. This PR fixes the L9 list's section P rows that are not
waiting on the owner and not in #8423's files (`docs/content-finalization-2026-11-27.md`, PR #8416).

- **Commission (owner, 27 Nov).** Hosts read only "Hosts pay 0% commission.":
  - /pricing meta, OG, Twitter, the Suppliers row and the supplier JSON-LD (P10, P11). /pricing names no booking fee and left `one-commission-promise`'s supplier list for its couple-facing list.
  - /about and /tl/about (P24), /our-story (P10).
  - /terms (P9): "Setnayan does not hold those funds. Hosts pay 0% commission. Suppliers pay Setnayan a booking fee under the supplier terms."
  - the AI answers (`lib/seo/ai-answers.ts`). The commission answer left the /features FAQ (it stays in llms.txt with the fee).
  - The supplier help answer says the fee without "No commission" (P12).
  - The Free supplier plan on /pricing reads "₱0 / month" through `formatPhp`, not "No fee" (P25).
- **Free promises (brand.md claim 3).**
  - Home: "No guest limit." and "Free, not a trial." (P15).
  - /for-coordinators: "Coordinator tools are included on every plan." (P5).
  - Help: "Planning is free.", and "Verified is part of Free."
- **Setnayan AI is not sold on its own (owner, 4 Nov).**
  - The stand-alone row left /pricing, its quiz and `_pricing-reads.ts` (P2).
  - Home's Event Plus line is "The whole Event Hub and Papic credits for your event." (P1).
  - The help says "Setnayan AI comes with Event Pro and Event Ultra."
- **Specialized tools (owner, 27 Nov, P3).**
  - One sentence, `SPECIALIZED_TOOLS_PLAN_LINE`: "Specialized tools come with Pro and Ultra."
  - It is said on /pricing, on the /for-suppliers plan cards and in the plan summary that /for-coordinators reads.
  - The gate itself still opens them on Plus. See SPEC IMPACT.
- **Retired and stale.**
  - /privacy's Patiktok section is one past-tense paragraph, and TikTok left the subprocessors (P7).
  - The Patiktok price row and quiz step are deleted (P27). The dead `freeGroups` is deleted (P28).
- **Over-promises.**
  - Home: "Suppliers, checked and reviewed." (P13).
  - /pricing: "Build your whole event in one place." (P14).
  - "What wedding planning app is built for Filipino weddings?" (P19).
  - "How is Setnayan different from spreadsheets and shared folders?" (P18).
- **Facts.**
  - The Memories ⓘ says six months with Event Pro (P20).
  - "your Event Hub link" (P21).
- **Logo Maker and slugs.**
  - /monogram server-redirects to /palogo (308), and its page and public studio files are deleted.
  - The footer, sitemap, health-check list and /palogo's second button moved with it (P29).
  - Four help slugs say "supplier", with redirects from the old ones (P30).
- **Guards.**
  - `front-door-words-hold.test.ts` holds every row above.
  - `stale-claims.ts` catches the retired names: Patiktok, Music Maker/Pakanta, Real Stories, Pailaw, Pabati, Camera Bridge, the Max/Solo plans (P34, part).

NOT in this PR:
- Rows in `llms-txt.ts`, `features-page.ts` and `supplier-front-page.tsx`: P2, P4, P8, P10, P12, P15, P16, P17, P18, P21, P26, P29, P31, P32 and the rest of P34. They wait for #8423.
- The owner's rows: P6, P22, P23, P33.

SPECIAL NOTE — /pricing/plan: the quiz no longer asks a Setnayan AI question (it priced the AI alone).

SPEC IMPACT: Medium.
- The public words say specialized tools come with Pro and Ultra (owner, 27 Nov). The gate still opens them on Plus: `SPECIALIZED_TOOLS_INCLUDED_TIERS`, `TIER_CAPS.solo.specialTools` and the SQL twins. That needs its own migration PR and the owner's GO.
- /monogram, the public no-sign-up logo preview, is gone. It redirects to /palogo.
- /privacy no longer describes TikTok data flows. The erasure of any stored `patiktok_oauth_grants` keys is not done by any job in this repository: it needs confirming before the page can say "keys erased".
- Corpus rows to record: DECISION_LOG (commission wording on host pages; specialized tools Pro/Ultra; /monogram redirect).
