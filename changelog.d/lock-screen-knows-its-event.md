## 2026-08-18 · fix(event-hub): a private movie night stops being called a wedding

**What a person gets.** Open a private event that is not a wedding and the lock
screen names it correctly. Before: *"This wedding's page is private · Only the
couple's guests and moderators can view it · Open the personal link the couple
sent you"* — on an event called **Movie Night**.

**Why it matters more than its size.** This is the FIRST and often the ONLY
screen a stranger sees on a private event, and **4 of the 6 events in production
are private**. It was the single most visible instance of wedding wording in the
product.

🔑 **AND IT WAS FOUND BY LOOKING AT THE PAGE, NOT BY A TEST.** The owner opened
his own event and read it. Every guard, every scan and three separate word-counts
I ran had this file in the "remaining" pile and none of them ranked it. **What
made it invisible: every LAUNCHED event is a wedding, so the sentence was true
everywhere anyone had ever looked.**

A wedding reads byte-identically — asserted against the frozen literals, not
assumed. An unknown type degrades to *"This event's page is private"*, never to
a wedding.

🛡 `lock-screen-knows-its-event.test.ts` — 4 assertions. **Mutation-proved with
occurrence counts:** reverting the heading to the wedding literal (1→1)
**1 fail** · replacing the resolve with a hardcoded object (landed) **2 fail** ·
restored **4 pass**.

⚠ **A VOCABULARY WART, SURFACED NOT HIDDEN:** the `date` type's word is "date",
so that event now reads *"This date's page is private"* — true, but clumsy. The
words are admin-editable per event type, so this is a wording change the owner
can make, not a code change. I have deliberately NOT special-cased it: a
hardcoded exception here would be the fourth vocabulary in this tree.

SPEC IMPACT: None.
