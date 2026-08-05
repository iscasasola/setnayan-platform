## 2026-08-05 · fix: three things I shipped today that did not work

An adversarial re-check of today's work found six of eight claims wrong. Three
of them were defects in code I had already shipped and reported as working.

**The "change a partnership's type" button could never work.** The database
forbids changing an accepted partnership's terms — deliberately, so the terms
cannot change under the partner who agreed to them. A vendor pressing it got a
raw database error. It now does what the database allows and what the design
wanted anyway: withdraws the old partnership and sends the new wording over for
the partner to accept. The badge comes down at the withdrawal and returns when
they agree.

**The vendor's "what you've shot" strip showed nothing but broken images.** The
photo locations are stored in one format and I read them in another, which
produced a perfectly valid link to a file that does not exist — so nothing
errored and every tile silently failed. The couple's own gallery has always
translated between the two; this was the one screen that didn't.

**Half a screen still promised face matching after I fixed the other half.** The
consent checkbox was corrected this morning to say no facial recognition runs on
events where it's switched off. The card wrapping that checkbox went on saying
"the candid shots of you get gathered for you automatically. No scanning, no
searching." Two contradictory claims, two inches apart. A guest reads the
headline, not the small print. The whole card now follows the event.

Every test that covered these passed. They were all checking the shape of the
code rather than running it, which is exactly why none of the three was caught.

SPEC IMPACT: DECISION_LOG row.
