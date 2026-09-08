## 2026-09-09 · fix(chat): four "message this supplier" controls open the conversation

Four controls that name a specific supplier all landed on the **whole conversation list**
instead of that supplier's thread:

- **"Waiting for quotes"** on the shortlist — the rows most likely to have something to
  read — with the thread id resolved **eleven lines above** and the component's own
  docblock reading *"tap a row to jump to the thread."*
- A button labelled **"Open thread"** on a locked package, which opened the list.
- The workspace's *"Open Messages to send the first note"*, which sent the couple where
  starting one means typing an email address they have never been shown.
- **"Message"** on a booked supplier's budget card, whose prefill keys on a column most
  marketplace paths never write.

All four now resolve or create the thread through the shipped
`ContactShortlistVendorButton` → `contactShortlistVendor` → `startServiceInquiry`, which
dedupes on the `chat_threads` UNIQUE(event_id, vendor_profile_id) index — no second
resolver. An off-platform supplier, and a package with no primary supplier, keep the plain
link, because there is genuinely no thread to open.

⚠ The budget card's change is scoped to the **card** variant: the same component embeds in
the workspace, which already ships a thread deep-link and the conversation itself.

⚠ Three pins in `a-supplier-on-the-budget-page-can-be-reached.test.ts` held the old href
and are **re-aimed, not deleted** — they still cover the fallback, and three new cases
cover the opener, the off-platform row and the embed.

⚠ `lint-port-no-lost-controls` reported two routes losing the inbox as a destination — a
substitution reads as a removal. Baseline regenerated **after reading the diff**: exactly
two destinations removed (907 → 905), both intended, no other removal absorbed.

SPEC IMPACT: None.
