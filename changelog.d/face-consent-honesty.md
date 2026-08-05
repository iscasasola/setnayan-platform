## 2026-08-05 · fix(privacy): stop promising face matching on events where it is switched off

A guest RSVPing was asked to tick a box saying *"I consent to facial-recognition
photo matching for this event"*. On every event on the platform, no such
matching happens — the switch that turns it on was only built yesterday, and no
event has it on.

So every guest who has ever ticked that box agreed to something that did not
run, and walked away believing their photos would find them by themselves. They
wouldn't. Photos reach a guest when someone scans their QR or tags them.

The words now follow what actually happens. On an event with face matching
switched on, the wording is unchanged — it already spells out where the photos
come from and what the match is for. On an event without it, the box says the
true thing instead: the photo is added to the guest list so people can recognise
them, no facial recognition runs, and photos arrive by QR or tagging.

The adults-only requirement stays either way — a guest's photo on someone else's
event list is adults-only whether or not a face is measured. Only the reason
given changes.

SPEC IMPACT: DECISION_LOG row — consent copy is now mode-aware; a biometric
consent is no longer collected for processing that will not occur.
