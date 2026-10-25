## 2026-10-25 · chore(integration): the guest ticket page — RSVP seats + Wallet + get back in + use my email

Combines four draft PRs so the guest's thank-you page and Me ticket can be judged together: #6911
(`rd/rsvp-seats-first`), #6548 (`rd/apple-wallet-pass`), #6910 (`rd/guest-key-no-signout`), #6908
(`rd/pricing-table-and-small-calls`). The thank-you reads ticket → Save (all tickets) + Add to Apple Wallet
together → the +1 list → the rest (owner-approved layout; the move itself lives on #6911, pinned by its § 6b).

On top of the merges, here only:
- the wallet slot on `invite/enter` is #6548's FILLED one; #6911's placeholder assertion now asserts the button;
  #6548's "Wallet sits directly under Save" regex accepts #6911's "Save all tickets" label;
- `appleWalletDevice` reads the device through `lib/apple-device.ts` (#6548's CI shard failed
  `apple-device.test.ts` § 5 on a bare `/iPhone|iPad|iPod/`);
- labs: the maker-lab thank-you and the Me lab draw Add to Apple Wallet for an iPhone user agent; the thank-you's
  `&signedout=1` points Save at the real pass route (its 401 → "Get back in"); the Me lab's `?keep=1` draws
  "Keep this invitation" with "Use my email instead". The Wallet mount map names the lab.
- Me (`GuestTicket`): Add to Apple Wallet is sized to its words and centred under Save · Copy link — it drew
  full-width, wider and louder than the Save it accompanies (seen at 390 px);
- generated baselines regenerated (`ugat:screens`, `port:baseline`).

SPEC IMPACT: None (each member PR carries its own).
