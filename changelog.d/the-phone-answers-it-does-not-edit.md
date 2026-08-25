## 2026-08-26 · feat(admin): on a phone the console answers, it does not edit

Owner, verbatim: *"for mobile version, we only provide quick answers. no editing of
settings or features. just responses for those that needs decision and response."*

**The phone strip carried tabs to Set up and Numbers.** Set up opens the taxonomy editor —
the exact editing this ruling moves off the phone — and Numbers is traffic charts, which is
looking, not answering. Both are replaced by **Money**, because confirming a payment IS a
response: the receipt is on the row and one press settles it.

**Today · People · Money · More.**

**The six editing tiles stand down below `lg`** — prices, categories, the website, test
data are all editing doors — and a line takes their place:

> **Prices, the website and settings are on the computer.** This screen is for answering
> what needs a decision — it does not change how Setnayan works.

⚖ **A gap is not an answer.** Hiding the tiles silently reads as a broken screen or a
missing feature; saying it reads as a decision. The line lives in the same file as the
tiles so the two cannot drift apart.

⚖ **TWO THINGS THIS DELIBERATELY DOES NOT DO.** It does not remove **More** — deleting the
only route from a phone to sixty pages is a capability deletion nobody asked for; the ruling
describes what mobile is FOR, not a lockout. And it does not delete the six; they are hidden,
not gone.

🔒 **Still inside the locked ≤5 primitive** (`admin-bottom-nav.tsx` — *"the ≤5-tab SUBSET
SHORTCUT … it is NOT the full menu; More is"*). This takes the strip from five to four.

Guard: `app/admin/the-phone-answers-it-does-not-edit.test.ts` — 3 assertions: no tab is an
editing or looking destination and all three answering tabs survive; the strip stays ≤5 and
keeps its way out; the tiles hide below `lg` and the signpost is mounted.

SPEC IMPACT: `DECISION_LOG.md` row 2026-08-26 — mobile admin is answer-only.
