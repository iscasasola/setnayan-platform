## 2026-09-02 · feat(live-studio): ask once whether their YouTube is live-ready, before taking money

Live Studio's BYO path streams to the couple's **own** YouTube channel, and YouTube's
first-time live activation takes about 24 hours — a wait nothing on Setnayan's side can
shorten. Discovered on the wedding morning it is unrecoverable, and the date does not move.
Until now the buy surface never mentioned it.

- `YOUTUBE_READY_NOTICE` (`lib/live-studio-readiness.ts`) joins `LEAD_TIME_NOTICE` above the
  plans. Two clocks owned by two parties — ours is manual payment reconciliation, theirs is
  Google's activation queue — kept as two sentences because they run in PARALLEL. Merged into
  one they would read as a three-day wait and talk buyers out of a two-day purchase.
- The notice names **where to check** (`youtube.com/features` → "Live streaming: Enabled") and
  pre-empts the **50-subscriber myth**: that threshold is phone-app streaming only, and encoder
  streaming from a computer — the only path Live Studio uses — has no subscriber requirement.
  A couple who searches this finds "you need 50 subscribers" everywhere and concludes they are
  ineligible; the clause exists to stop a lost sale that was never actually blocked.
- A tick box gates checkout until accepted: *"I understand, and I already have a YouTube account
  that is ready for live streaming."* Starts **unticked**, no hidden field — the rule
  `app/signup/consent-is-affirmative.test.ts` enforces app-wide. It withholds the "Add to event"
  button, never the sheet, so the buyer can still read what the notice is asking them to act on.
- Asked **once, ever**: `users.youtube_live_ready_ack_at` (migration
  `20271191675816_youtube_live_ready_is_acknowledged_once`). On the PERSON, not the event or the
  order — a channel belongs to a human, so stamping either would re-ask them at their second
  celebration or their second purchase. Owner ruling 2026-09-02. Unticking clears it, so an
  accidental tick can be withdrawn in the same gesture. No new RLS: the pre-existing
  `user_owns_row` policy already covers a self-write.
- Four `/help` articles under a new **Live Studio** topic: how to check the channel is live-ready,
  how to create the watch link (stream key → software, watch link → Setnayan, never reversed),
  how to dry-run it, and who owns the recording.

⚠ **This records a CLAIM, not a verification.** Setnayan holds no OAuth grant on a couple's
channel — that is the sensitive scope whose 100-user cap the BYO path exists to avoid — so the
column must never be rendered as "YouTube verified". What actually proves readiness is the dry
run the help article describes.

Guards: `lib/live-studio-lead-time.test.ts` grows from 5 to 9 tests — the notice's three clauses,
that the box gates checkout, that it starts unticked, and that the stamp lives on `users`. Both
new gate guards were mutation-tested (pre-ticking the box and removing the gate each turn one red).

SPEC IMPACT: None yet. The BYO-versus-pool product ruling and the archive-download copy it would
change are still open with the owner and are deliberately NOT touched here.
