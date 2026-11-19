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
