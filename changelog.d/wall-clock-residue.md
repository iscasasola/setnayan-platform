## 2026-08-04 · fix(time): eight more places that showed the wrong hour — including one I had wrongly cleared

A wide sweep for the same mistake found eight more, every one traced to a real
screen or a real message. Two of them correct my own earlier work.

**The call-time email was the worst of them.** When a coordinator presses "Email
call-times to vendors", the photographer tagged on a 2 PM ceremony received an
email whose subject line said **10:00 PM** — eight hours after the moment they
were being called to shoot. A 9:45 PM send-off emailed as **5:45 AM the next
morning**: wrong day as well as wrong hour. The couple's own screen still said
2 PM, so nobody inside the app could tell the email had gone out wrong, and an
email cannot be corrected after sending. Nothing has been sent yet — the whole
feature is still switched off — but nothing stood between that switch and a
wrong email. I had previously listed this file as checked and correct. It wasn't.

**Two screens that show the schedule were wrong for everyone at the wedding.**
The shared time formatter behind 27 screens rendered the venue's clock in the
*reader's* timezone — so a Manila phone showed 10:00 PM for a 2 PM ceremony. It
looked right only to a reader sitting in UTC, which is nobody except the test
runner. On the guest landing page this produced two clocks on one screen
disagreeing by eight hours, one directly above the other.

**A vendor's "be on site by" line** told an emcee to arrive at 9:00 PM for a
2:00 PM ceremony.

**The vendor console's "hours left in the program"** was still wrong because I
had only converted half of that function last time and left the other half
sixteen lines below.

**"What's next"** kept every moment of the wedding day listed as still-to-come
for eight hours after it had happened — with the correct time printed beside it.

**Promo codes kept working eight hours past their end**, and a gift card
scheduled to open at 9 AM stayed dead until 5 PM. **A gifted service** ran eight
hours past the end an admin typed. In both cases the code carried a comment
saying it converted Philippine time — it never did.

No data needed correcting: the only promo code in the system is an expired test
row, and no gifted services exist yet.

SPEC IMPACT: None.
