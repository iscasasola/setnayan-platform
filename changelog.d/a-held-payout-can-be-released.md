## 2026-08-26 · fix(admin): a payout that was put on hold can now be released

An admin could freeze a vendor payout. The button was wired, the **"On hold"** filter
listed the result, and the confirmation promised, in these words:

> *"There's no automatic release in V1 — it stays held until you lift it manually."*

**Nothing could lift it.** `releasePayoutHoldAction` existed, validated its input, called
`releasePayoutHold`, wrote a `released_hold` audit entry and revalidated both the admin and
the vendor's earnings page — and **no page imported it**. The held branch of the row
rendered `null`.

🔑 **THE PROMISE IS WHAT MADE IT INVISIBLE.** The screen said the lever existed, so nobody
went looking for it. A **forward primitive with no inverse**, wearing the **gate with no
handle** costume: the mechanism written, correct, audit-logged, and unreachable by any
human. Its own docblock even states the reason it was written — *"the hold path could set
`on_hold=true` with no admin-facing way back — a held payout was stuck."* That fix was never
finished.

⚠ **Latent, not live**: prod holds **0** payout rows and this is the legacy pre-V2 path, so
nobody is stranded today. It would have bitten the first time anybody used the hold button.

🪤 **HOW IT HID FROM MY OWN SWEEP.** A first pass for "admin actions nothing calls" reported
**0 orphans across 281 actions** — because `lib/admin-map/admin-jobs.generated.ts` lists
every action **by name**, so every action looks called. Excluding generated inventories
revealed **9**, of which this one mattered. 🔑 **A generated inventory is not a caller** —
the same shape as counting a value passed to a mapping component as a raw render.

Guard `every-forward-control-has-its-inverse.test.ts` requires BOTH halves to be **bound to
a form on a screen**, not merely exported, and reads screens only — never the generated map.
Deliberately narrow: it pins the pairs that exist rather than inferring every forward/inverse
relationship, because a guard that cries wolf teaches you to skim past the one time it is right.

Verification: `tsc --noEmit` **exit 0**; unit suite **10,145 pass / 0 fail**; **eleven** lints
exit 0; mutation — unwiring the inverse goes **red** (1→0).

⏭ **The other 8 unreachable actions are reported, not deleted** — 5 stranded by the
2026-07-03 retirement of `/admin/event-types` into Taxonomy Studio (which reimplemented them
as `*EventTypeVocab` actions), and 3 taxonomy controls with no UI. Deleting an exported
action blind is how a live path disappears; they need a person to rule on each.

SPEC IMPACT: None — restores a control the product already promised.
