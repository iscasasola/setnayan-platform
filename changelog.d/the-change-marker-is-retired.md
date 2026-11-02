## 2026-09-09 · docs(chat): the fourth chat marker is RETIRED, not broken — the change card is not built, and a guard says why

**S1 was to build the missing `change_order_id` card. It should not be built, and this is the measurement that says so.**

The 2026-09-09 ruling ⓸ records: *"MEASURED GAP: the `change_order_id` marker has NO card renderer at all, so Decisions would silently omit changes today."* The first half is true. The second is a wrong consequence drawn from a correct fact, and it would have cost a session — plus a second money card in the thread.

**The card is not missing. It was built, then deleted on purpose.** Commit `d3350b8e2` (2026-07-24), *"refactor(chat): collapse negotiation money cards to ONE 'Deal' (council verdict)"*, deleted `chat-change-order-card.tsx` (129 lines) and its stream branch/fetch on the owner's *"as simple as possible"*. Its own message states the reasoning: **the bundled amendment is a superset, so couples see ONE money card.** The producing chip (`change-request-suggest-chip.tsx`) went in the same sweep. The commit deliberately left the actions and table in place: *"Dormant change_order actions/table left in place (removable later; flag-dark, no data)."*

**Superset verified against the live objects, not the commit message.** `proposal_amendment_items.item_kind` CHECK admits `discount · addon · freebie · request` — the change order's discount (−delta) and inclusion (+delta) both land inside it, and a Deal carries many priced lines where a change order carries one signed number. Both tables share an identical `proposed → accepted/declined/withdrawn` machine and the same `raised_by IN ('couple','vendor')`.

**Decisions cannot omit a change, because nothing can produce one in chat.** The only writers of `chat_messages.change_order_id` are `createChangeRequestFromChat` and `counterChangeRequestFromChat`; **neither has a single importer** anywhere in `apps/web`. By contrast `createAmendmentFromChat` and `createScheduleRequestFromChat` each have two (a suggest chip + the composer menu). So Decisions is a **three-marker** filter — `proposal_id · appointment_id · amendment_id` — plus the payment and guest-count cards, and that is complete, not lossy.

⚠ **Production could not have answered this and must not be cited as if it had.** Prod holds **3 chat messages total and zero rows on all four markers**, including the two that demonstrably work — so emptiness there cannot tell *unreachable* from *merely unused*. The import count can, and did.

⚠ **A change order is a LIVE feature — only its chat bridge is retired.** `vendor_change_orders` is raised today from the couple's supplier workspace (`raiseChangeOrder`) and the shop's client page (`vendorRaiseChangeOrder`), renders in `ChangeOrderTrail`, and settles a signed delta into `event_vendor_line_items` on accept. Whoever reads "no producer" and concludes "dead table, drop it" would be wrong; the guard's fourth assertion exists to say so in the same breath.

🔎 **`NEXT_PUBLIC_CHAT_NEGOTIATION_V1` is `true` in production** (read from `vercel env pull`, which returns `NEXT_PUBLIC_*` in plaintext) — so Deal and Meeting are live for real users, and the retirement is a shipped state rather than a dark one. The same pull answers gate **G6**: `NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED` is also `true`, which the sessions register listed as unreadable from a session.

**New guard — `apps/web/lib/the-change-marker-is-retired.test.ts`** (4 tests). Every assertion is a COUNT on comment-stripped source, so prose about the construct cannot satisfy it:

1. Both writers have zero callers — and the anchor is guarded first (each `export async function` must still exist, so a rename cannot pass vacuously as "no importers").
2. `chat-message-stream.tsx` mentions `change_order_id` exactly as many times as it negates it (`!m.change_order_id`), with the negated count required `> 0` — a positive read is a renderer and goes red.
3. The successor still works: `ChatAmendmentCard` mounted, `createAmendmentFromChat` still imported. The retirement is only defensible while Deal exists.
4. `ChangeOrderTrail` is still mounted in the supplier workspace — the feature is alive outside chat.

🪤 **The guard caught its own loose anchor before any mutation did.** `change_order_id: changeOrderId` matched **3**, not 1: `p_change_order_id: changeOrderId` (the accept/decline RPC parameter) *contains* the column assignment as a substring, so two reads read as writes. Fixed with a `(?<!p_)` lookbehind, verified back to 1.

🛡 **5 mutations, each measured before → after, all RED, all restored.** Occurrence counts printed in the PR body.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-09 row ⓸ — the "measured gap ⇒ Decisions would silently omit changes" clause is corrected in the corpus: the renderer's absence is a 2026-07-24 council verdict, the marker has no producer, and Decisions is a three-marker filter. Whether to reverse that verdict and put changes back in chat is flagged as an owner call, not resolved here.
