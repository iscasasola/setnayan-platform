## 2026-10-23 · fix(proposals): a printed quote says when it no longer stands; rows never split across pages

From the coordinator walk (owner, 23 Oct: "Keep what we have first and make them run smoothly"). The proposal page's
status badge sits in the bar that print hides, so a declined, expired or superseded quote — or a draft — printed on the
shop's letterhead exactly like a live offer. It now carries one print-only line ("Declined — this quote no longer
stands", "Draft — not sent yet"; `proposalPaperStatus`, `lib/vendor-proposals.ts`). A line item, an instalment or a
way to pay no longer splits across two pages (`print:break-inside-avoid`), and a long shop name, title or line label
wraps instead of squeezing the price or the logo.

Guard: `app/proposals/[publicId]/a-printed-quote-says-if-it-stands.test.ts`.

SPEC IMPACT: None.
