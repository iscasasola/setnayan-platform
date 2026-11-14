## 2026-11-14 · feat(notices): one notice system — the foundation, the bell's waiting group, supplier Today and the admin work list

Owner, 14 Nov 2026, approving `prototypes/notices_system_2026-11-14_fable.html` (corpus DECISION_LOG 2026-11-14 "ONE NOTICE SYSTEM — APPROVED"), then: *"build it"*.

Every added notice is one of four kinds, and the kind decides its close word, where it sits and when it may come back (`lib/notices.ts`, executed by `lib/notices.test.ts`):

- **News** — *Got it*, never returns for that item.
- **To do** — *Not now*, returns after 7 days until done; an alerts ask stops after its second close and never takes the top while anything else waits; a to-do that blocks money or guests ranks above news.
- **Live** — *Hide*, returns when its fact changes (the fact is in the key); cannot be hidden when it affects other people.
- **Offer** — *Not now*, one per page at the end, returns after 30 days.

At most two at the top of a page; the rest wait behind "N more", which opens the bell's new **Waiting on this page** group (the badge keeps its number; waiting notices add only a dot). A page without a bell (guests) opens a "For you" sheet with Close. Nothing pops up by itself.

- **One memory**: `public.notice_closes` (migration `20271345334309`), own rows only, every verb, anon gets nothing. A close follows the person to a new phone; every close is also kept in the browser, and the older hand-written browser keys are still read so earlier dismissals hold.
- **Supplier Today**: the "You earned …" line is a news notice drawn by the one look, and the earned slot under the photo is Today's top. The alerts ask left its fixed bar over every supplier page and is now an ask notice (in the bell on pages without a top).
- **Admin work list**: the Apple secret reminder is a to-do (live and unhideable once expired); the email-delivery strip is a live notice that cannot be hidden.

**Not in this change, on purpose:** the couple's event Home (the approved drawing put three notices above the Next card, but the shipped Home has drawn none of them on its first screen since the 2026-10-02 "Home is the first screen only" rule — an owner call, not a port) and the guest pages (alerts ask, new on your invitation), which follow in the next wave on these same parts.

SPEC IMPACT: None — implements the approved design already recorded in corpus DECISION_LOG 2026-11-14.
