## 2026-08-28 · feat(vendor): Holding — a shop can see what it is holding, and on which dates

**Owner-approved 2026-08-28**, the fifth lane the drawing asked for: *"You said yes; they haven't
booked yet. A shop holding four couples for one date is exposed and nothing shows them that."*

**🔑 IT IS NOT THE LOCK HANDSHAKE, AND THAT WAS MEASURED BEFORE ANYTHING WAS BUILT.** The obvious
reading of "you said yes" is `lock_request_state = 'agreed'`. Read out of the live production
object, `vendor_agree_to_lock` writes `status = 'contracted'` **in the same statement** as
`lock_request_state = 'agreed'` — so a shop's yes IS the booking, and that state is `booked`, never
a fifth thing. The state the owner described lives in the **enquiry**, which is what the drawing's
own nudge copy says too: *"9 days since you REPLIED."*

⛔ **So `lockRequestStateOf` is untouched.** Building on `'agreed'` would have meant re-mapping the
shared core that six surfaces derive "who is booked" from — the risk raised when this was put to the
owner. Measuring it away beats managing it. Recorded separately in `DECISION_LOG.md`, because the
next person to design a "waiting on the couple" lane will re-derive it from the spec vocabulary and
be wrong the same way.

**What a shop sees:**

- **Holding** — an answered enquiry with no booking where nothing has happened for
  `HOLDING_QUIET_DAYS` (7), with the number on the row: *"quiet 9 days"*.
- **The exposure line**: *"One date has more than one customer holding it. 14 Feb · 3. You can only
  take one."* Named dates, soonest first, capped at four — a statistic is not actionable, a date is.

**The three judgement calls, each with a reason:**

- The quiet signal is the thread's **last activity**, not `vendor_first_reply_at` (the FIRST reply —
  a thread alive for weeks would read as quiet for weeks) and not `accepted_at` (when identity was
  revealed, not when anybody last spoke).
- An **unreadable clock fails toward `talking`**. Telling a shop a live conversation has gone cold
  is worse than not telling them a cold one has.
- Exposure counts **only `holding`**, and **never an undated customer**. A live conversation is work
  in progress; a couple with no date cannot be double-promised one, and bucketing them under "no
  date" would invent a clash out of the one thing they have in common.

🛡 The clash count is computed over **every** derived customer, never over the filtered rows — a
warning that disappears when you press a chip is not a warning. Guarded, and mutation-proved.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-28 (two rows: the lane, and the agree-is-the-booking finding)
+ `WHATS_NEXT_Shop_Redesign_SESSIONS_2026-08-28.md` — the S4 open question "a fifth lane, Holding"
is CLOSED by the owner and must not be re-asked.
