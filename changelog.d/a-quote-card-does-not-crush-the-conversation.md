## 2026-09-18 · fix(chat): the quote lives in the conversation, and the conversation keeps its height

The first quote ever sent on this platform was sent at 06:36 and accepted at
06:46. In between, the couple's thread rendered this:

```
<ol class="flex-1 … overflow-y-auto">   clientHeight  32px
                                        scrollHeight 498px
```

The whole conversation, in a 32-pixel sliver — the owner's *"the chatbox
shrunk"*. On desktop it clipped a card mid-sentence instead.

**Cause:** the thread column is a fixed height and the pinned **CURRENT QUOTE**
card sat above the message list, which is the column's only `flex-1` child. The
card's height came straight out of the conversation. The quote was also
duplicated — the same proposal already rendered as a card inside the stream.

🔑 **Unreachable until today.** That card only renders when a proposal exists,
and none ever had — so the layout was correct for every state anybody could get
to.

**The owner's design, which is better than the one I proposed:** everything
inside the chat box, with pills to jump. *"it will eat up screen space on
mobile… buttons to jump to the different latest proposals, so it can jump back
on the latest conversation."*

- The pinned card is **unmounted** (not deleted; still exported). Its removal is
  recorded in `port-control-baseline.json`, the guard that exists to stop a
  control vanishing silently.
- The in-stream card now carries the **line items** and a **Counter-offer**
  action.
- Two pills — *📄 Jump to the quote* · *↓ Latest messages* — positioned
  **absolutely over** the scroller, so finding the quote costs no layout height.
  Each appears only when its target is off-screen.
- The column gets `min-h` instead of `h`, and the list a `min-h-[14rem]` floor.

**🔴 And a quote is no longer take-it-or-leave-it.** Owner: *"so it should not
be just review and accept."* The amendment builder — `proposal_amendments`, its
db tests, the whole negotiation loop — has shipped for some time behind the
composer's **"Deal or meeting"** button, below the fold and named after neither
countering nor quoting. A couple reading ₱10,170 with one button assumes those
are the terms. Counter-offer links to `?compose=deal`, which opens that builder.
A **href, not a callback** — the thread pages are server components and cannot
pass a function across the boundary.

Six sabotages, one red each. **Two of them found bugs in my own guard first:** an
assertion that matched *something* with a min-height (the Files panel satisfied
it while the conversation had none), and a bare `/absolute/` over the pill
window that one in-flow pill still satisfied. Both now **count** rather than
match.

SPEC IMPACT: None.
