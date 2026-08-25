## 2026-08-25 · feat(ui): an empty screen reads as deliberate, not unfinished

W6 item 5 (AP-12), plus the measured answer to item 4c's last open question.

🔑 **RULE 0 CHANGED THE JOB TWICE.** The brief said "do not design a new empty
state — the pattern already exists on `(account)/samahan`, PORT IT." Measured:
(a) a shared `<EmptyState>` ALREADY SHIPS at `app/_components/states/`, and
(b) it is the **admin** register — a terracotta ring, a required
`readPermitted: true`, and a printed audit line *"Verified: read permitted · 0
rows"*, which is engineering language on a screen a couple reads. So the samahan
pattern is a **second, couple-facing** register, and it existed only as inline
markup on one page.

`<QuietStart>` extracts it — every mark lifted, nothing redrawn: the `sn-tile`
card, one `ink/35` glyph, a headline stating the fact, one teaching sentence, and
a single mulberry action **only where the person can actually start it**.

Adopted on **4** screens, all page-level, chosen because a person lands on them
and sees a bare sentence: the samahan index itself (so the pattern has one home
rather than a copy), the activity log, guest columns and the Live Studio cameras
list. Guest columns deliberately gets **no action** — only a guest can write a
column, and a button the host can never press is worse than none.

⛔ **NOT a whole-tree sweep, and that is a measurement.** 40 bare-sentence empty
branches exist across the couple tree; most are inside search sheets, filters and
drawers ("No one matches that name"), where a centred card is worse than the line
it replaces. The print sheet for guest QR cards is also left alone — its empty
line carries inline print styles and porting it risks the printed page.
⚖ Production is pre-launch, so most of these screens are empty **because that is
the plan**. This changes how emptiness READS. Nothing was removed, and none of it
is reported as a defect.

**Also here — item 4c's last open question, ANSWERED with a count.** "Can a
server action's failed read still surface as a false empty state downstream?"
Swept all four action trees — **243 files, 563 unbound `const { data: X } = await`
reads** — keeping only those returned to a caller with no guard on absence. Four
survived, and all four are false positives on reading (two 23505 "already done"
recoveries that otherwise return an explicit error, one admin check that THROWS,
one samahan name behind `?? 'your samahan'`). **No action returns an unmeasured
absence to a screen as content.** Recorded in `reads-are-honest.test.ts`, where
the exemption is claimed — a sentence is not a mechanism, so it is now a count.
🪤 The sweep's first pass reported NINE, and every extra was the DETECTOR: its
deny-pattern required `if (!row)` to close immediately, so `if (!row || …)` read
as no guard at all.

Guard `app/_components/states/an-empty-screen-is-deliberate.test.ts` — pins every
mark against the samahan original, pins the boundary with `<EmptyState>` in both
directions, and floors adoption at 4. 4 mutations, all measured, all red.
🪤 One reported 0 → 0 GREEN and **the sabotage was at fault, not the guard**: it
matched the first `<QuietStart` in the file, which is inside the comment
explaining the extraction, so it landed somewhere the guard correctly strips.
Re-measured outside comments: 0 → 1, red.

SPEC IMPACT: None.
