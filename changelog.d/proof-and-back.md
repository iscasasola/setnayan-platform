## 2026-09-20 · fix(money): the way back out of a quote, and a receipt you can actually read

Three things the owner hit in one live payment run as the couple `testnayan4` on the
booked Saysay thread, all in the same lane: **the money surfaces tell you nothing you
can see.**

### 1 · "when i press back, it doesn't go back"

Nothing breaks the browser's history stack on this hop — every door into
`/proposals/[publicId]` is a plain `<Link>`, no `target`, no new context, no
`redirect()` on load. What did not go back is the page's **own** control, the one
labelled "Back" in the corner, which is what a person presses. It was hard-coded to
`/dashboard/<event>/vendors` (the Vendors bench) for the couple and
`/vendor-dashboard/proposals` for the supplier. Both parties arrive from **the
conversation**, so pressing Back moved them somewhere else entirely.

The page now resolves the quote's own thread — `chat_threads` on
(`event_id`, `vendor_profile_id`), the same pair the workspace uses for its chat
deep-link — and the control reads **"Back to the conversation"**. Resolved, not carried
in a `?from=`: that makes it right for an arrival nobody linked (an email, a bookmark,
a refresh) and leaves nothing for a caller to forge. A missing thread or a refused read
keeps exactly the destinations the page already had, so the control can never vanish
and never points at nothing.

### 2 · "when i upload a photo, i cannot see it. it is too small"

The couple's "Amount to pay" form asked for a proof of payment through a bare
`<input type="file">` — a filename in 12px grey — and the later-installment field
rendered the finished upload as a **48px thumbnail in a filename row**. Every screen
where somebody then *decides about that money* offered the words "View proof" and
nothing else.

🔑 **The pattern already existed and had one customer.** `app/admin/payments` has
rendered a `max-h-64 object-contain` picture with "Open full size" under it since the
checkout queue was built, and `/pay/[reference]` grew its own on 2026-08-21 after the
owner said the same sentence about the same class of file. It is now
`app/_components/proof-image.tsx`, mounted on **all** of them:

| Where | Who is deciding |
|---|---|
| `app/admin/payments/page.tsx` | admin reconciling a Setnayan-checkout payment *(refactored onto the shared one)* |
| `app/admin/disputes/_components/deposit-disputes-section.tsx` | admin ruling on a refused deposit |
| `app/admin/force-majeure/[flagId]/page.tsx` | admin handling a force-majeure flag |
| `app/vendor-dashboard/clients/[eventId]/page.tsx` ×3 | the supplier, **beside "Confirm deposit received"** |
| `…/workspace/_components/deposit-reservation.tsx` | the couple, checking what they sent |
| `app/_components/chat-message-stream.tsx` | the supplier confirming from the chat |

Plus `app/_components/chosen-proof-field.tsx` for the file you have just *picked* —
same 256px ceiling, name, size, Remove that clears the input, tap to open full size —
and an opt-in `bigPreview` on `<FileUpload>` for the two receipt uploads on its `wide`
evidence lane (an opt-in, not a new default: ~20 other `wide` fields are genuine
evidence lists).

Two gaps found on the way and closed: the couple's chat card passed
`depositProofUrl: null`, so a couple could record a payment from the chat and the chat
would then show them nothing of what they attached; and the supplier's
"Confirm it reached you" in the chat had **no receipt at all** to look at.

🔒 Privacy is unchanged and now harder to get wrong. `readBookedMoney` signs the
receipt at the single read (`depositProofDisplayUrl`, scoped to that event's own
deposit folder) rather than handing the stored `r2://` ref to two callers to sign for
themselves — `lib/deposit-proofs-are-private.test.ts` refused the first draft that did,
correctly, and now pins the new reader too.

### 3 · "clicked confirmed and it just bounced to the chat page"

From `/vendor-dashboard/clients/<eventId>?tab=details`, confirming a deposit **worked** —
`deposit_acknowledged_at` written, booking fee opened — and the supplier was dropped on
the chat. `vendorAcknowledgeDeposit` redirected to
`/vendor-dashboard/clients/<eventId>?deposit_ack=ok`: the right page, the right notice,
and **no `?tab=`** — and since #5614 a tab-less landing there *is* a landing on the
conversation, which the page forwards to the thread by design.

The repo already had this rule written down — *every door off a thread page carries
`?tab=`*. This is the same rule pointing the other way. `lib/vendor-client-return.ts`
always names a tab, and honours the form's `return_to` for exactly two shapes: this
supplier's own thread, or this event's own client page on a tab that exists. Same
allow-list construction as `lockAnswerReturnTo` (#5722). The refusal arm
(`vendorRejectDeposit`) had the identical bounce and is fixed with it.

### Guards (each sabotage-proven)

- `lib/proposal-back.test.ts` — the back rule: the thread, the fallbacks, no
  `/dashboard/null/…`, in-app paths only.
- `app/proposals/[publicId]/the-quote-is-not-a-dead-end.test.ts` — **counts** the 7
  doors into a quote across 6 files and fails on a `target=` on any of them (a
  `target="_blank"` is the one change that would silently kill browser Back), and pins
  the page's resolved back control.
- `app/_components/the-proof-is-legible.test.ts` — parses the max-height out of the
  shared class and floors it at 200px, **counts** all 8 `<ProofImage>` mounts per file,
  pins the receipt above the Confirm button, and refuses a return to a link-only proof.
- `lib/the-confirm-lands-where-you-pressed-it.test.ts` — executes the return rule over
  8 inputs and 10 hostile ones, and pins both call sites and all three forms.

⚠ **Trap for the next session:** `tsx --test "app/proposals/[publicId]/x.test.ts"`
matches **nothing** and exits 0 — the brackets are a glob character class. Two
sabotages "passed" against a file that never ran. Use `app/proposals/*/x.test.ts`, or
the repo's own `test:unit` globs.

SPEC IMPACT: None — no locked decision, price, SKU or schema changes. Behaviour only:
where two controls land, and how large a private file is drawn.
