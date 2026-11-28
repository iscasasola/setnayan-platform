## 2026-11-27 · fix(words): L9 section P, public-site content finalized (commission, free promises, retired names, /monogram)

Owner ruling R4: finalize all content before any Facebook posting. This PR fixes the L9 list's section P rows that are not
waiting on the owner (`docs/content-finalization-2026-11-27.md`, PR #8416), including the rows in #8423's files after
it merged.

- **Commission (owner, 27 Nov).** A host reads only "Hosts pay 0% commission." (`HOSTS_PAY_ZERO`, built from `COMMISSION_PCT`):
  - /pricing meta, OG, Twitter, the Suppliers row and the supplier JSON-LD (P10, P11). /pricing names no booking fee and moved to `one-commission-promise`'s couple-facing list.
  - /about and /tl/about (P24), /our-story, llms.txt (P10).
  - /terms (P9): "Setnayan does not hold those funds. Hosts pay 0% commission. Suppliers pay Setnayan a booking fee under the supplier terms."
  - The AI commission answer. It left the /features FAQ and stays in llms.txt with the fee (P11).
  - A supplier reads no "0%" or "No commission" (P12):
    - `supplierCommissionShort` and `supplierCommissionPromise` now open "Couples pay you directly";
    - the /for-suppliers hero says "No fee on clients you bring.";
    - the supplier help answer names the fee plainly.
  - The Free supplier plan on /pricing reads "₱0 / month" through `formatPhp`, not "No fee" (P25).
- **Free promises (brand.md claim 3).**
  - /for-suppliers: "Free to start. No card needed." and "No hurry." (P4).
  - /for-coordinators: "Coordinator tools are included on every plan." (P5).
  - Home: "No guest limit." and "Free, not a trial." (P15).
  - llms.txt: "Starting is free, and planning is free."
  - Help: "Verified is part of Free."
- **Specialized tools (owner, 27 Nov, P3).**
  - One sentence, `SPECIALIZED_TOOLS_PLAN_LINE`: "Specialized tools come with Pro and Ultra."
  - It is said on /pricing, on the /for-suppliers plan cards, in the /features plan table and in the plan summary that /for-coordinators reads.
  - The gate itself still opens them on Plus. See SPEC IMPACT.
- **Retired and stale.**
  - /privacy's Patiktok section is one past-tense paragraph, and TikTok left the subprocessors (P7).
  - The Patiktok price row and quiz step are deleted (P27). The dead `freeGroups` is deleted (P28).
  - llms.txt makes no Apple or "iPhone app" claim until Apple approves the app; "Nothing renews by itself." stays (P8).
- **Over-promises.**
  - Home: "Suppliers, checked and reviewed." (P13).
  - /pricing: "Build your whole event in one place." (P14).
  - "What wedding planning app is built for Filipino weddings?" (P19).
  - /for-suppliers: "Try it. Leave anytime." (P26).
  - llms.txt: "Personal data is handled under RA 10173; see setnayan.com/privacy." (P32).
- **Facts.**
  - Home Event Plus: "The whole Event Hub and Papic credits for your event." (P1).
  - Memories ⓘ: six months with Event Pro (P20).
  - "your Event Hub link" (P21).
  - llms.txt: "The event's own page (your wedding website, as people search it)" (P31).
- **No free Papic credits (owner, 16 Nov; L9 P23).** The "Papic credits, first event · Included" row and every "first event's credits" promise left /pricing, its quiz, /about, home, the Papic demo, the help and llms.txt. Where a line is needed it is `GIFT_PHOTOS_LINE`: "Many bookings come with free Papic photos as a Setnayan gift." (`lib/papic-free-*.ts` and the claim code are left to their own build.)
- **/features.**
  - A row's ⓘ shows only "Coming" or "Live", never a build lane or ruling. The d06 editor's-note row left the page (P16).
  - No speed claims, five stages (P17). No named brands (P18).
- **Logo Maker and slugs.**
  - /monogram server-redirects to /palogo (308), and its page and public studio files are deleted.
  - The footer, sitemap, llms.txt and /palogo's second button ("Design yours · free with an account") moved with it (P29).
  - Four help slugs say "supplier", with redirects from the old ones (P30).
- **Guards.**
  - `front-door-words-hold.test.ts` holds every row above.
  - `stale-claims.ts` catches retired names, price promises and the iPhone-app line on llms.txt (P34). It does NOT ban "Setnayan AI … sold on its own" (see SPEC IMPACT).

NOT in this PR:
- P2 (Setnayan AI sold alone). The 4 Nov ruling it cites was superseded by DECISION_LOG 23 Nov ("so there is a separate price for setnayan AI 2790": SETNAYAN_AI back on sale as a single), and that page is another builder's task. So /pricing, the quiz, the help and llms.txt keep selling it as before.
- The owner's rows: P6, P22, P33.
- In-app (not public) lines that still name the first-event credits, for the build that removes `lib/papic-free-*.ts`: the /papic dial (`_papic-dial.tsx`), onboarding `services-step.tsx`, and `pay/[reference]` ("its free credits are live").

SPEC IMPACT: Medium.
- The public words say specialized tools come with Pro and Ultra (owner, 27 Nov). The gate still opens them on Plus: `SPECIALIZED_TOOLS_INCLUDED_TIERS`, `TIER_CAPS.solo.specialTools` and the SQL twins. That needs its own migration PR and the owner's GO.
- /monogram, the public no-sign-up logo preview, is gone. It redirects to /palogo.
- /privacy no longer describes TikTok data flows. No job in this repository erases stored `patiktok_oauth_grants` keys, so the page does not claim they were erased.
- L9 P2 conflicts with DECISION_LOG 23 Nov: the L9 list should be corrected.
- Corpus rows to record: DECISION_LOG (commission wording on host pages; specialized tools Pro/Ultra; /monogram redirect).

### 28 Nov · owner rulings applied on this PR's lines

- **No commission line for hosts.** Hosts own the event, so no host page says "0% commission" any more: /pricing (meta, OG, Twitter, the Suppliers row), /about, /tl/about, /our-story, /terms, the home JSON-LD, llms.txt and the AI answers. They say hosts pay suppliers directly. `HOSTS_PAY_ZERO` is gone. The booking fee stays on the supplier pages and in /terms.
- **Specialized tools are paid, each with a free 30-day trial.** No plan is said to include them, and no price is named. The /for-suppliers cards show the line with a lock. The /pricing and /features Pro and Ultra rows and the plan summary words no longer claim them. The gate still opens them on paid plans, and no trial is wired yet.
- **Setnayan AI is on Event Pro and Event Ultra.** The home JSON-LD no longer says it comes with Event Plus.
- The /features ⓘ says "Coming" once (the chip), so the Root map no longer counts it twice.
