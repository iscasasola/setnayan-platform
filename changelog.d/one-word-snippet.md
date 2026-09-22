## 2026-09-22 · fix(papic): one word for a 10-second capture — "snippet", everywhere a person reads it

Owner, 2026-09-22: *"yes, use snippet everywhere."*

It was never a fresh rename — it was an **unfinished** one. `/papic` and `papicPointCurrencyTerms`
already said *Snippet* (36 files), while `papicCapacityPhrase`, the guest and crew cameras, the
gallery, the uploader and moderation still said *clip* or *video*. **One product, two words for the
same thing.**

- 🛑 **The guard was widened FIRST, and that order is the point.** `SPLIT_PROMISE` in
  `papic-copy-guardrails.test.ts` matched `videos?|clips?`. Renaming the copy without touching it
  would have left *"30 photos + 10 snippets"* unmatched — **the guard would have gone green while
  shipping the exact false promise it exists to forbid.** `snippets?` is now in the alternation and
  the old words stay, because copy written before the rename is still a lie. Proved by running the
  regex against both phrasings.
- `lib/papic-tier-copy.ts` — the single source 24 surfaces derive from — now says snippet. The
  number is still interpolated from `PAPIC_POINTS_PER_CLIP`; no figure was typed.
- 23 sentences across guest capture, crew capture, the uploader, the gallery, moderation and the
  controller.

⚠ **Deliberately NOT renamed, and each would have been a bug:** `kind: 'clip'` and friends are
stored values; `setnayan-clip-*.mp4` is a filename people already have; `lib/face-embed-clip` is
the **CLIP embedding model**, nothing to do with video. Internal identifiers were untouched here and
are renamed in the follow-up (`snippet-in-the-code`) after the owner asked for them too.

SPEC IMPACT: `DECISION_LOG.md` row added 2026-09-22 — the word, the half-migrated state it
replaces, and the guard trap.
