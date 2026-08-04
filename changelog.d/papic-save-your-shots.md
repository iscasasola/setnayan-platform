## 2026-08-02 · fix(papic): the "save your photos" nudge now grows with what there is to lose

Owner set the rule for who gets which photos (2026-08-02): **a guest gets photos
they were TAGGED in — by face or by someone scanning their QR — otherwise only
what they took.** Unless the host opens the whole gallery.

That rule is already how the product behaves, so nothing needed building for it.
But it puts real weight on one sentence: *"what they took"* is the guest's only
guaranteed take-home, and for an anonymous guest it lives on their phone until
they attach an account. The nudge that says so read the **same calm line whether
they had taken 0 shots or 40**.

So at the one moment it mattered, it looked exactly like the moment it did not —
and a guest who closed the tab lost every photo they took. (The couple's copies
are safe either way; this is the guest's own.)

**Now it scales with the stake.** Nothing taken → the original quiet line.
Anything taken → the strip grows, gains a full border, and names the number:
*"7 shots — yours only on this phone. Save them to your account or they go when
you close this tab."* The Save control goes solid so it reads as the action
rather than as decoration.

Count comes from the same `photos + clips` the header already displays, so the
nudge and the on-screen count cannot disagree.

⚠ No behaviour change: signing up already attached an email to the SAME anonymous
uid, carrying the seat and every capture across. Only the prompt changed —
what was always possible is now visible at the point it matters.

SPEC IMPACT: `DECISION_LOG.md` — the owner's photo-entitlement rule (tagged →
photos of you · otherwise → only what you took · host may open the gallery)
recorded as the governing line for Papic delivery.
