## 2026-06-28 · fix(onboarding): soften the songs step so couples actually pick music

The music step ("Your songs") had **0 of 56 weddings ever pick a single song**. The
wiring is correct (`prefs.music → musicPlaylistSeed → event_song_picks`) and the step
is already optional/skippable — the friction was the copy: *"pick at least 10 more"*
read as a mandatory quota nobody wanted to clear late in a long flow.

Fix (`song-bank-step.tsx`): reframe the footer to invite a few favourites and reward
ANY pick — `0` → "Tap a few you love — we'll build the playlist around them"; `1+` →
"N songs in · we'll build the rest of your playlist". No quota number, no gate change.
The goal is that couples actually seed a soundtrack, which feeds their wedding-video
renders instead of leaving the music empty.

SPEC IMPACT: None (onboarding copy only; no schema, pricing, or flow change).
