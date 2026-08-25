## 2026-08-25 · fix(samahan): the day would have stopped at clip one on an iPhone, and taking your own clip down became a three-second race

Two defects an adversarial audit found in the story viewer I merged this morning, plus the guard
that should have caught the first of them. (The audit's finders ran; **every skeptic died on a
session limit**, so each finding was re-verified by hand before anything changed.)

🚨 **THE FILM COULD ONLY EVER PLAY ITS FIRST CLIP ON A PHONE.** Exactly one thing advances the
reel: a clip reaching its end. The first plays because a tap started it — every clip after it is
mounted from an `ended` handler with **no user gesture behind it**, and iOS Safari (which is how
this product is installed as a PWA) refuses to autoplay a clip carrying audio without one. These
clips always carry audio: the recorder asks for it and the web copy keeps it. So clip two would sit
on a still frame, nothing would explain why, and because nothing could then reach an `ended` event
the day **could never move again**. Now a refused play falls back to **muted and keeps going**,
says so on screen, and offers *Turn sound on* — a real tap, which is all the phone was waiting for.
A silent day is a far smaller loss than a day that stops at clip one.

Same stall, second cause: a clip whose file will not load fires no `ended` either. It is now
stepped over rather than sat on, as is a clip with no file at all.

**AND REGRET BECAME A RACE.** *Take it down* lived only inside the player, which used to **loop**
and wait. Once the film learned to advance, the button began dismissing itself after three seconds
— and if the clip was not your newest, the retry landed you on somebody else's video with no delete
control at all. There is now a take-down under your own thumbnail in the strip, where it sits still:
two taps (arm, then confirm), self-disarming after five seconds, and it never opens the film on a
stranger's clip.

🪤 **THE ORDERING GUARD DID NOT GUARD THE SCREEN.** Every other assertion in that file scans the
component; the ordering one exercised the library helper directly and never tied the two together.
Deleting the call from the component left the entire suite green while "Play the day" walked the
day backwards to breakfast. Now asserted against the component.

Five mutations, each measured before → after, all red.

SPEC IMPACT: None.
