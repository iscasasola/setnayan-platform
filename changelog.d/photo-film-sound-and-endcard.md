## 2026-08-13 · fix(film): the photo film had no sound, and half of it was the logo

Prerequisites for lengthening the make-a-film-from-my-photos route. Both are
defects in what ships **today** — neither is about the longer film.

### 1 · Every film in the product is silent, and the screen names a song

`pickMusic` takes the OLDEST active free catalogue track and never checks
whether that row has an audio file. Measured in prod:

- 24 active free tracks · **1** has an audio file
- the one that does (`velvet-court`, 158s) is the **newest**, so oldest-first
  can never reach it
- the picker therefore returns `br_quartet_sunset` — **no file** — and the UI
  prints *"Quartet Sunset · owned catalogue"* under a film with no sound

Its own sibling `listMusicOptions` has always dropped these (*"un-ingested
master → not offerable"*); this one never did. Now filtered at the query, and
`duration_sec` is selected so a caller can check the track covers the film.

**Blast radius: three films, all silent today** — the chapter film, Guest
Stories, and the Thank-You video all share this picker.

### 2 · The end card was eating the film

`buildBeatSchedule` gives its LAST source everything remaining, and every
montage appends the rigid "Made with Setnayan" card as that final photo — whose
default ceiling is `Infinity`. Measured against a real 175 BPM grid, 8 photos +
the card, at the **shipped** settings:

| film | end card before | after |
|---|---|---|
| **6s (ships today)** | **3.26s — 54% of the film** | 1.60s |
| 15s | 12.26s — 82% | 1.60s |
| 30s | 27.26s — 91% | 1.60s |

So more than half of the current teaser is a logo, and raising the length alone
— the one-constant change the plan of record proposed — would have produced 3
seconds of wedding and 27 seconds of branding, at exactly the right total
duration, with no error anywhere.

Fixed at the caller: a PHOTO carrying an explicit `durationSec` is now a fixed
slot, and the end card sets one. **Behaviour-preserving for every other film** —
verified that all existing photo callers pass `durationSec: null`, so nothing
else re-cuts. The shared `isLast` rule is deliberately untouched.

### Proof

🛡 **The first version of these guards was decorative and the mutation caught
it.** Three scheduler tests passed `slotMaxSec` explicitly, so sabotaging the
derivation (`clipSlotCeilingSec` → always `Infinity`) left all 31 green. The
function is now exported and asserted directly; the same sabotage (1 → 0
occurrences, marker present) turns test 29 red. 31/31 after restore.

Every number above was produced by running the real scheduler, not estimated —
and the first measurement used `beatsPerCut: 4` when the teaser passes none, so
it was re-measured at the shipped default before being written down.

SPEC IMPACT: None.
