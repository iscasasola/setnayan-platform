## 2026-11-25 · fix(supplier): final check area 6, batch 4: an unread headcount, an unread Papic ledger, the Money bar's words

Lane A fixes from the 25 Nov final check (area 6). No amount, fee, plan or rule changed.

- **An unread guest count prices NOTHING (A6-03 · owner Add 35).** `liveHeadcount` (lib/pax.ts) returns `null` on a refused count, and `resolveLivePax` answers `PAX_UNREAD` on a refused count or event row (never the estimate, never 0). Every caller treats it as no price:
  - the package lock refuses with "Couldn't read the guest count. Try again.";
  - the catalogue's per-guest charge stops (`status: 'error'`, a hard stop on the charge path);
  - the guest-count surcharge computes and writes nothing;
  - the shop page's configurator hides its per-guest totals and says "Couldn't read the guest count. Try again." above them;
  - a host's price save (`updateVendorCosts`) refuses with the same words and writes nothing (never a price with its guest-count base blanked);
  - inquiry, unlock and search snapshots store nothing;
  - both chats say the words instead of a stored count.

  Finalizing a guest list refuses instead of freezing the estimate. A read that answers prices exactly as before.
- **An unread Papic ledger sells and refuses nothing on a guess (A6-24).** No pack is offered on an unread ledger; the album does not refuse an import as "out of credits"; the import route answers "Couldn't read your Papic credits just now. Nothing was spent — try again." (503), never "out of credits" on a guessed 0; the shop wallet does not print a granted count built from a guessed 0.
- **The Money bar's words (A6-B06).** "N% of ₱X received", not "booked": the bar measures what was received.
- **Not a finding (A6-B03).** The chat title ("Lolo's Birthday (Dec 15)") and the Clients row ("Lolo Ben at 80 · Birthday · Dec 15") differ by two owner rulings (28 and 30 Oct), held by `lib/one-event-one-chat-title.test.ts`; both read one date formatter.
- **Guards:** `lib/area-6-batch-4-holds.test.ts`; new `lib/an-unread-guest-count-prices-nothing.test.ts` (behaviour on a stub database: refused count → PAX_UNREAD, no price, and the real surcharge path computes no charge while a read count does; plus every caller pinned); `lib/every-guest-count-says-which-count.test.ts` allows the Add 35 form of the one `headerPax` line; `lib/vendor-papic-grants.test.ts` gains the unread-ledger `offerPack` assertion. Server actions: no new export. No migration.

SPEC IMPACT: None.
