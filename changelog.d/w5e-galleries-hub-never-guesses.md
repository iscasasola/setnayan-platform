## 2026-08-25 · fix(galleries): the hub stops answering a question it never asked, and its one button becomes readable

**A refused read told the couple they had no photos.** On
`/dashboard/[eventId]/galleries`, the couple's own photos were read without ever
binding the error. A refusal, an RLS silent-zero or a dropped connection all
resolve with `data: null`, the list read as empty, and the page said
**"Collecting… · Add your own photos to your Event Hub"** with an **Add photos**
button — on the surface whose entire job is to reach photographs they already
uploaded.

The Papic card one block up already carries a long comment explaining exactly
this: binding an error and discarding it is "the defect wearing careful
clothes". The card beside it never bound one. Both cards now say *"We couldn't
check just now — this does not mean there are none"* and send the couple to look
rather than to add.

**The one control on the hub was the least readable thing on it.** The primary
action painted white on `bg-terracotta` — in this repo the slot named
`terracotta` is the atelier **gold** `#A9834B`, and white on it measures
**3.48:1**, under the 4.5:1 AA floor. It now uses `mulberry` `#C24E25`, the CTA
the app already locked in `.button-primary`, at **4.76:1**. The quiet button's
label moved from `text-ink/60` (**3.99:1**) to `text-ink/70` (**5.40:1**).

⚠ The dormant dark block would put white on `#CBA766` at **2.27:1**, worse — but
that block is unreachable today (`darkMode: 'class'`, no `prefers-color-scheme`
rule, and a bootstrap that strips `.dark` before first paint), so it is recorded
rather than counted as live.

New guard `the-hub-never-guesses.test.ts` — three countable rules: one
`logQueryError` per read (floored), every branching action label must consult a
measured flag, and a measured contrast ban list.

⏭ **Reported, not fixed:** the Live Studio card is gated on `resolveAddOnState`,
whose `AddOnState` union has no "unknown" — a refused read there degrades to
"not owned" and the card simply does not render. That is a shared helper used
across the app; changing its contract is a bigger change than this page.

SPEC IMPACT: None.
