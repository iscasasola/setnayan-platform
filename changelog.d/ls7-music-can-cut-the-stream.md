## 2026-09-03 · feat(live-studio): the music can stop the broadcast, and now we say so (LS7)

YouTube runs Content ID against a LIVE stream in real time
(`support.google.com/youtube/answer/3367684`). On a match it replaces the broadcast
with a placeholder and warns the host to stop; if the content keeps playing the
stream is "temporarily interrupted or terminated". And it catches LICENSED music —
YouTube's own wording is that unless the rights holder allowlisted that channel,
"your live stream can be interrupted even if you've licensed the third-party
content". No couple is on a rights holder's allowlist.

**Why this is not a fourth copy of the three notices already on the buy sheet.**
Payment lead time, YouTube's 24-hour activation and the laptop all fail BEFORE the
day — late, but survivable. This one fails at the processional or the first dance,
in front of everyone watching from abroad, and the moment does not come back. A
Filipino wedding plays licensed music continuously: this is the default path, not an
edge case.

- `MUSIC_RIGHTS_NOTICE` (`lib/live-studio-readiness.ts`) — the fourth pre-purchase
  fact, beside the other three, passed in the `notice` array on the Live Studio buy
  sheet. Written as a PRECAUTION, not a disclaimer: it names the interruption, the
  licensed-music trap, what to play instead (live musicians / royalty-free), and the
  separate risk that a surviving stream still loses its archive to a claim.
- `/panood` gains a second FAQ, "What about the music?", directly after the laptop
  answer — same rule, the answer names the failure and the fix.
- 🚨 `POOL_CHANNEL_SHARED_STRIKE_NOTICE` (`lib/live-studio-pool-only.ts`) — **the
  pool channel's risk is not the buyer's, it is every other couple's.** A strike on a
  shared Setnayan channel lands on a channel that also holds other couples' archives,
  and YouTube terminates at three strikes taking every video with it. One couple's
  processional can delete another couple's wedding film.
  `live-studio-roam-provision.ts` has known this since Wave 9 — "isolates concurrency
  + copyright-strike blast radius" — **in a docblock nobody on either side of the
  decision ever read.** Now stated on the hosted-channel add-on copy AND on
  `/admin/live-studio-channels`, from one constant so the buyer and the admin who
  places the event cannot be told different stories.

**Guard:** `lib/the-music-can-stop-the-stream.test.ts` — pins the four claims in the
notice separately (a notice that only says "don't use copyrighted music" is the
version a couple who PAID for a licence correctly ignores), that it reaches the buy
sheet in the array, that `/panood` answers it, and that the shared-strike sentence
reaches both the add-on copy and the admin board from the shared constant.
`live-studio-lead-time.test.ts` and `the-laptop-requirement-is-disclosed.test.ts`
pin the array BY NAME and were updated to the four-entry shape — matched through the
shape, never loosened to a substring.

🔑 **OWNER QUESTION, RAISED AND DELIBERATELY NOT ANSWERED:** should a pool channel be
one-couple-per-channel-FOREVER (retired after the wedding, never checked back in)
rather than reused? Reuse is what creates the shared jeopardy. That is a
cost-and-operations ruling, not an engineering one.

SPEC IMPACT: a `DECISION_LOG.md` row on the pool-channel shared-strike risk and the
open one-couple-per-channel question.
