## 2026-09-02 · fix(live-studio): the laptop requirement is disclosed before the money moves

Live Studio needs a Windows or Mac laptop at the celebration running an encoder — a browser
cannot push a livestream, and the phones only feed the controller. `ENCODER_NOTICE` has
always said so and is returned on EVERY readiness branch including the green one.

But readiness is a **post-purchase** surface. The buy sheet carried the payment lead time and
YouTube's activation wait and never mentioned needing a computer at all; the public product
page mentioned OBS only inside a FAQ answer about *YouTube channels* — not where somebody
deciding whether this product fits them would look.

🔑 **AND THIS IS THE ONE WITH NO RECOVERY.** A couple who meets YouTube's 24-hour wait too
late can still wait. A couple who meets the payment SLA too late can be approved early next
time. A couple with **no laptop on the wedding morning has no broadcast**, and nothing fixes
it — not money, not support, not a later date.

- `ENCODER_BUY_NOTICE` joins `LEAD_TIME_NOTICE` and `YOUTUBE_READY_NOTICE` above the price.
  It names the machine ("Windows or Mac laptop"), rules out the obvious wrong guess ("a phone
  or tablet on its own cannot"), and says the browser cannot either.
- The public page gains **"What do I need on the day?" as the FIRST FAQ**, ahead of "How do my
  guests watch?" — the requirement leads rather than trails.
- Deliberately a SECOND string rather than reusing `ENCODER_NOTICE`: they answer different
  questions ("what must I own?" before paying, "what do I do with it?" after). A guard pins
  that they may word it differently but may not disagree on the fact.

Guard: `lib/the-laptop-requirement-is-disclosed.test.ts` (4). Mutation-tested — dropping it
from the buy sheet, burying the FAQ entry below the guests question, and vaguing "Windows or
Mac laptop" down to "a computer" each turn exactly one red; restored by SHA-256.

`live-studio-lead-time.test.ts` updated: it pinned the notice array exactly, so it went red
on the third entry, as designed. Matched through the new shape rather than loosened.

SPEC IMPACT: None — this discloses an existing requirement, it does not change one.
