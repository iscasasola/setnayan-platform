## 2026-08-18 · design(app): 78 page descriptions deleted, 55 kept behind the (i)

**SPEC IMPACT:** None — copy removal on existing screens.

Owner, correcting the scope of #4557: *"the goal of this session is just to delete
those other text that are not needed."*

#4557 moved **every** page description behind an (i). That preserved all of them,
which was the wrong reading — the (i) is the escape hatch for a description that
is genuinely needed, not a filing cabinet for every sentence that used to sit
under a title.

**The rule applied here:** keep it only when the sentence tells you something you
must know to USE the page — an action, a limit, money, privacy, or a consequence.
Delete it when it only says *what the page is*, because the title already did.

- **78 deleted** across 70 files. 132 pages carried an (i); **55 still do.**
- Gone: *"Vendor profiles in the database"* under **Vendors**, *"New messages,
  order quotes, and payment confirmations land here"* under **Notifications**,
  *"Everything you can add to your day"* under **Your Studio**, and 75 more of the
  same shape — plus internal notes naming cron jobs, cache TTLs and query
  ordering that no admin needed at the top of a queue.
- Kept: the booking-fee schedule, *"Setnayan never touches the money"*, *"you can
  take any of it back later"* on coordinator access, *"the wipe is irreversible
  and needs a second admin"*, *"featuring is a spotlight on top of their consent,
  never a way around it"*.

⚠ **THE FIRST CUT REACHED SEVEN LIVE MARKETING PAGES AND WAS REVERTED.** `lede` is
not a name `<PageMasthead>` owns — the public product doorways under
`app/(shell)/` pass a **required** `lede` to `<Doorway>`, where a sub-line under a
headline is a value proposition, not a page description, and was never in scope.
Caught by `tsc` (TS2741 ×7), not by the sweep. The sweep now requires the file to
actually render `<PageMasthead>`.
🔑 **A PROP NAME IS NOT A COMPONENT.** Sweeping by prop name crosses every
component that happens to share the word.

Verified: `tsc` clean · full unit suite green (no test pinned deleted copy) ·
`lint-port-no-lost-controls` ✅ 402 routes / 1429 controls · `page-masthead.test.ts`
5/5 · masthead ratchet unchanged at 15.
