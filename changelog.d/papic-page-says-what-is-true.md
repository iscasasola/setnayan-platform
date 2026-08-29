## 2026-08-29 · test(papic): the public Papic page can no longer promise what we cannot do

Three drafts of `/papic` have now been written. Two were made without access to the running product, both were beautifully made, and both promised things we cannot do — one printed an invented **"0.4 second"** face-match time, one turned our six-month *shooting* window into an **expiry date**, and one led on a **per-guest allowance that is still being built**. None of it was caught in review, because every sentence read like something we would obviously have.

A fourth draft is a matter of time. So the prohibitions stop living in a brief somebody has to remember to open (`PAPIC_PAGE_BRIEF_FOR_CHAT_2026-08-29.md` § 3) and become a test.

**RULE 0 first, and it paid: the page itself needed no change.** The build order recorded item 2 as *"drawn, waiting"*; measured against `origin/main`, the whole page half had already shipped hours earlier (`3fc9f54d9` → `b782d91e7`). The sixteen-row price wall is already a `+`/`−` dial showing one rung, the cost block already has a heading, *"Two ways to run it"* already sits above it, and all nine facts item 2 asks for are already on the page. **Nothing was rebuilt.** What was missing was the guard, which is the durable half.

`lib/papic-page-says-only-what-is-true.test.ts` — 13 assertions over the six files that render a word of that page.

**Nine prohibitions, from one list.** A ninth is one entry: a speed or latency figure · a per-guest shot limit · the year (one pot across several celebrations) · an expiry · a price in another currency · a `papic.setnayan.com` subdomain · a retired product name · unlimited uploads · a bigger share for the ninongs.

**Every prohibition carries its own proof, because a banned-list guard dies quietly.** A pattern that can no longer match anything passes forever and protects nothing, so each entry carries `sample` — the claim as somebody actually wrote it — and a test asserts the pattern still matches its own sample. Each also carries `stillSayable`: true sentences on the page today that must NOT match. **A guard that cries wolf gets skimmed past on the day it is right**, and these are the near-misses — *"the new credits land in seconds"* is not a latency figure, and cameras being *"free and unlimited"* is not *"unlimited uploads"*.

**One correction, worth more than the guard.** The brief bans **"chapters"** outright as unbuilt. Measured: `lib/papic-chapters.ts` **ships**, derives a chapter from `captured_at` with nothing stored, and is rendered by the guest's own gallery (`app/papic/me/[token]/page.tsx`) and the pool grid. What is unbuilt is **the year** — linking two celebrations, which nothing in the code does. So the prohibition is on the year, and `stillSayable` **pins the chapters line** so a later reader cannot tidy a true claim off the page.

**Three structural repairs pinned, each undoable by an edit that looks like an improvement:** the sixteen-row wall cannot come back (nothing may `.map()` the rung list into rows) · the cost block keeps a heading and stays *below* "Two ways to run it" · the headline is followed by the product, not by an eyebrow or an explaining paragraph (owner 2026-08-19: *"we do not need these. it just eats up space."*).

Comments are stripped with the repo's one string-aware stripper before any match — these files quote the banned claims verbatim in their own docblocks, including the one explaining the guard.

**16 mutations, every one printed before → after and every one RED**, including the guard's own floor: breaking a pattern so it cannot match its sample, and adding a `stillSayable` the pattern eats, both fail. ⚠ One count was uninformative on the first pass — replacing the cost `<h2>` with a `<p>` left the *text* count at 1 → 1, so it was re-measured on `<h2` (6 → 5) to prove the sabotage landed where it was aimed, not merely somewhere.

Sibling `papic-copy-guardrails.test.ts` does not overlap this: that one forbids a hand-typed **number** where a derived one belongs; this one forbids a **claim** we cannot keep, whatever the arithmetic.

SPEC IMPACT: `PAPIC_PAGE_BRIEF_FOR_CHAT_2026-08-29.md` § 3 and `WHATS_NEXT_Papic_Build_Order_2026-08-29.md` — item 2's page half was already shipped when both were written, and the blanket ban on "chapters" is too wide: chapters within one celebration ship and may be claimed; the year may not.
