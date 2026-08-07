## 2026-08-07 · fix(privacy): we told people we delete their Google and TikTok connections on a timer. We don't.

The public privacy notice promised, in writing, that a connected **TikTok** or
**Google Drive** account is thrown away *"30 days after the event ends"* and that
*"refresh tokens past their expiry are purged automatically."*

**Neither happens.** There is no scheduled deletion of integration grants
anywhere: the retention sweep is chat-text only, and the refresh job only
refreshes.

🔑 **The identical sentence was already removed once.** On 2026-07-27 the YouTube
section was rewritten, and its own engineering note says — in capitals —
**"NEVER PROMISE AN AUTOMATION THAT DOES NOT EXIST"**, naming this exact line.
**The two sections either side of that note kept it for another eleven days.**
A note telling the next author what not to do is not a guard.

**What the copy says now** is what actually happens: grants last until *you*
revoke them or delete your account, and **the moment you disconnect we erase the
stored keys** rather than merely marking the connection ended — true as of the
four-path credential fix shipped earlier today. And explicitly: *we do not delete
connections on a timer; if you want one gone, disconnect it.*

A promise about the user's own action, which we honour, replaces a promise about
a schedule, which we never had.

🛡 **Guard added to the existing retention-copy test** — the right home, and its
comment-stripping means the note explaining this removal cannot satisfy the
guard it exists to enforce. Sabotage-tested: restoring the sentence fails by
file and reason.

⚠ This is public, regulator-readable copy. Being caught contradicting our own
written record is the expensive part, not the engineering.

SPEC IMPACT: None — the corpus already describes disconnect-time erasure.
Closes an item in `WHAT_IS_LEFT.md` §2.
