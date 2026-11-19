## 2026-11-20 · docs(seo): search and AI text from one source — Plan it · Live it · Keep it

Owner, verbatim: *"Yes, send it"*. The words come from specs `SETNAYAN_FOR_SEARCH_AND_AI_2026-11-20.md` (b0253b24).
Stacked on #8016.

- `lib/llms-txt.ts`: top of `/llms.txt` is the source's one line, entity card (§1) and long version (§2), with
  "let's get that set" as the meaning; Is / Is not table; who it's for (§3); the offer regrouped **Plan it · Live it ·
  Keep it** (§4) with each pillar's feature-page links under it; an "Against the market" block by kind of tool (§7 —
  no rival named, no rival price, the internal "where rivals are ahead" list not shipped); a "Words" block (§9). The
  retired Real Stories page is no longer linked (`RETIRED_FROM_LLMS`). The supplier fee says the 19 Nov free-booking
  sentence instead of "first booking … is on us" and "own clients are always free"; the For Suppliers line drops "no
  booking commission"; Setnayan AI is said to come with Event Pro and Event Ultra everywhere. Prices stay catalogue-read.
- `lib/seo/ai-answers.ts`: the §8 Q&A leads the list (eleven new ids, six existing ones reworded; ids kept), Lane K's
  six corrections follow. No peso typed; each answer's `evidence` names code on this base. `SUPPLIER_FREE_BOOKING_LINE`
  is the one copy of the 19 Nov sentence.
- `app/layout.tsx`: Organization JSON-LD description rewritten from §1 + §2 (the retired Logo & QR part and "that's
  all set" are gone). It says "event", not "celebration": the house-words guard refuses the noun in this file.
  `SITE_TITLE` / `SITE_DESCRIPTION` unchanged — pinned by existing guards; owner questions on the PR.
- New guard `lib/seo/the-retired-words-stay-gone.test.ts`: none of the source's "Remove now" lines reach llms.txt, the
  saved answers or the comment-stripped layout (sabotage-tested). "50 credits free on your first event" is HELD on
  llms.txt (owner question), and the guard fails the day the hold is no longer needed.

SPEC IMPACT: None beyond the source document, which is already in the corpus.

### 2026-11-20 · update — brand lines say "celebration" (owner: "Yes, brand lines")

- `lib/the-app-says-event-in-plain-words.test.ts`: "celebration" is allowed only in a NAMED list of brand-line
  declarations (`SITE_TITLE`, `SITE_DESCRIPTION`, `organizationJsonLd.description`, the share card's
  `baseMetadata.openGraph.images.alt`, `WHAT_IS_SETNAYAN_ANSWER`, `EMAIL_TAGLINE`) — matched by the declaration that
  owns the string, never a pattern. Every other string in those files still fails; each named declaration must exist.
  Sabotage-tested both ways.
- `app/layout.tsx`: `SITE_TITLE` = "Setnayan · The home of every Filipino celebration"; `SITE_DESCRIPTION` = the
  ruled line ending "Hosts pay 0% commission."; the Organization description says "celebration".
  `lib/public-copy-is-not-wedding-only.test.ts` pins both exactly — the description's old "names suppliers and six
  services" requirement became the exact pin.
- `lib/seo/ai-answers.ts`: "What is Setnayan?" is `WHAT_IS_SETNAYAN_ANSWER`, saying "celebration".
- `lib/help/topics-existing.ts`: /help's "What is Setnayan?" gives the meaning as "let's get that set"; the
  retired-words guard now reads /help for it.

### 2026-11-20 · update — /help, the own-clients claim and rival claims (owner: yes; review FIX-FIRST)

- The own-clients claim is gone in every wording (DECISION_LOG 2026-11-19 "PROMOTION PAGES", item 4):
  `lib/llms-txt.ts` drops "A couple the supplier brings through their own invite, their own booking QR or their own link
  never carries the fee." and the "Clients a supplier brings are free:" lead-in; `lib/seo/ai-answers.ts` and /help drop
  the lead-in too. The free booking is said only as `SUPPLIER_FREE_BOOKING_LINE`. What the code bills
  (`SUPPLIER_BROUGHT_SOURCES`) is unchanged.
- `lib/llms-txt.test.ts`: the test that REQUIRED the "never carries the fee" clause is INVERTED — it now requires the
  clause absent and the 19 Nov line present (sabotage: clause back → RED).
- /help (`lib/help/topics-existing.ts`, `lib/help/supplier-1.ts`, `lib/help/user-2.ts`):
  - privacy article: no Real Stories promise; Story Maker: no "Sharing it on Real Stories";
  - "What does Setnayan charge suppliers?" (web + in-app): `FIRST_BOOKING_ON_US` and "own clients are always free" →
    `SUPPLIER_FREE_BOOKING_LINE`;
  - "Suppliers: is my first booking free?" (slug kept): body is `SUPPLIER_FREE_BOOKING_LINE`, not `FIRST_BOOKING_ON_US`;
  - "Suppliers: does a couple who comes from my own QR count as Setnayan's?": keeps the attribution answer, drops
    "your own clients never carry a booking fee";
  - "Is Setnayan free for couples?": Setnayan AI comes inside Event Pro and Event Ultra (was "all three include").
- `lib/seo/the-retired-words-stay-gone.test.ts`: every served /help article (all help topics, supplier ones included)
  is checked for EVERY retired line, article by article, with a population floor and "found the article" preconditions;
  new rows `/never carr(?:y|ies) (?:a |the |any )?(?:booking )?fee/i` and a broadened own-clients pattern (paraphrases);
  a new test: no rival named or described in llms.txt or the saved answers. Sabotage-tested.
- No claim about rivals: "Against the market" now says only what Setnayan does for each job (no rival kind's features,
  no "no one else"); "structurally different" drops the foreign/international/family-album claims; the AI questions no
  longer name PhotoShare, The Knot or Zola.
- `lib/the-app-says-event-in-plain-words.test.ts`: the `lib/llms-txt.ts` exemption's stale reason is replaced (the file
  renders /llms.txt and opens with the brand line; one template, so no named declaration to narrow to).
- `FIRST_BOOKING_ON_US` stays: `lib/personal-invite-offer.ts` and two guards still import it.

### 2026-11-20 · update — re-review at 5e763f1005 (FIX-FIRST)

- `lib/help/topics-existing.ts` `best-free-filipino-wedding-planner-app`: "Event Plus, Event Pro and Event Ultra, all
  with the Setnayan AI planner" → "(Setnayan AI comes inside Event Pro and Event Ultra)" — `AI_PLAN_SKUS` is Pro and
  Ultra only. A sweep of every served /help sentence and every AI answer pairing Event Plus with AI found no other.
- `the-retired-words-stay-gone.test.ts`: the Setnayan-AI-in-Plus row also catches "all with (the) Setnayan AI"; the
  own-clients row also catches "own clients always stay free", "Clients you bring yourself are always free" and
  "… keep them free" — each with a sample line, and the replacement lines are checked NOT to trip. Scope unchanged:
  llms.txt, the AI answers, layout and /help only (for-suppliers and the commission promise are a later build).
  Sabotage: the old AI line back in /help → RED naming the article; restore → green.
- `the-app-says-event-in-plain-words.test.ts`: the `lib/llms-txt.ts` exemption reason now says what is true —
  "celebration" appears about a dozen times there, brand line and prose, not only the brand line.
