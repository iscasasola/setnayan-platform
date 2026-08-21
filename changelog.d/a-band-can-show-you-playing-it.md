## 2026-08-18 · feat(vendor): a band can show you them playing it

Owner: *"we have a song bank of all music. bands/musicians can pick the song they
can do. and they can link videos of them performing that song via youtube link."*

The first half shipped. A band picks from the shared bank, and a typed song links
to the existing one rather than duplicating. **The second half had nowhere to
live** — a band could say *"I can play this"* and could not show it, so a couple
choosing between three bands who all claim *Forevermore* had nothing to compare.
That is the difference between a checklist and proof.

### 🔑 Nothing public read a band's repertoire at all

The set list existed only to match requests **on the day**. So the single most
useful thing a couple comparing bands can look at — *what can you actually
play?* — was invisible to them.

**Storing a video with no viewer would have been a gate with no handle, built on
the day three of them were removed.** So the public section ships in the same
change as the column, and an assertion holds them together.

### What ships

- **The band** adds, changes or clears a link per song on their repertoire, and
  can press *Watch* to check it. Empty clears — **taking a video down must be as
  easy as putting one up.**
- **A couple** sees *Songs they play* on the band's public page, with
  *Watch them play it* where a video exists.

### Decisions worth stating

**The video belongs to the PICK, not the song.** Two bands playing *Forevermore*
have two different recordings; putting it on the shared bank row would have let
one band's recording become every band's.

**Validated with the app's existing `parseVideoLink`** — already accepts YouTube,
Vimeo, Facebook, TikTok and Instagram. RULE 0: not a new URL parser, and the
guard asserts the action does not hand-roll its own host list.

**No database CHECK on the URL shape, deliberately.** A constraint encoding
today's platform list would refuse tomorrow's, loudly, to a band who did nothing
wrong. NOT NULL is not wanted either — most picks will never have a video, and
that is the normal state, not a missing one.

**An empty set list renders nothing at all**, not an empty section. "This band
plays nothing" is a claim we cannot make about a list the band has not filled in.

🪤 **A zero-row update is a silent refusal** — Supabase resolves rather than
throwing, so saving a link onto somebody else's song would otherwise report
success. Read back and reported.

### Guard

5 assertions. **3 mutations, each measured, all red:** removing the public
section (the gate-with-no-handle), dropping the column from the select (a phantom
column is rejected silently — the only symptom is that no video ever appears),
and dropping the zero-row check.

SPEC IMPACT: None.
