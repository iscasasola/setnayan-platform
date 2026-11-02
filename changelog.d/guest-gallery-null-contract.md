## 2026-08-13 · fix(guest-gallery): a guest who had not been tagged yet was told the page failed to load her photos

`getGuestLiveGallery()` returned `null` for **three different things**: a failed read, a thrown error, and — 118 lines earlier — the perfectly ordinary *"nobody has tagged this guest yet"*. Its own docblock declared the opposite: *"An empty result is now a REAL result. `null` means, and only means, that the read failed."*

**That comment was false, and the false version survived a guard written to catch exactly it.**

### What a person experienced

`app/[slug]/_components/site-body.tsx` already renders three distinct states, correctly:

| value | what she reads |
|---|---|
| `null` | *"We couldn't load your photos just now. Nothing is lost — pull down to refresh in a moment."* |
| `{ photos: [] }` | *"No one has tagged you yet — your photos appear here as they're taken."* |
| photos | the grid |

Because zero tags returned `null`, **every guest who had not been tagged yet — the state of literally everyone before the photographers work through the album — was shown the failure message.** The reassurance branch written for her was unreachable by the dominant path. A wedding page accusing itself of an error that never happened, at the moment a guest most needs reassurance.

### Why the guard did not catch it

`three-states.test.ts` exists for this exact defect. Its assertion was:

```js
assert.ok(!/if \(photos\.length === 0\) return null;/.test(GALLERY), …)
```

A 2026-07 fix deleted that late return and wrote the docblock. **`if (!tags || tags.length === 0) return null` sat 118 lines above it, untouched, doing the identical harm to the far more common case** — and the guard, matching one deleted spelling, passed over its surviving twin.

🔑 **A GUARD THAT MATCHES A STRING DOES NOT WATCH THE ACT.** The assertion now matches *any* early return of the failure value on an empty set, however spelled, and additionally requires the zero-tags path to return a real empty result rather than merely avoid `null`.

### The contract, now true

- `{ photos, total }` — the read **succeeded**. `photos` may be empty; that is a real answer.
- `null` — the read **failed**. Only that.

Three reads had to start checking `.error` for that to be a mechanism rather than a sentence: the `photo_tags` read and **both** media reads discarded it, so a refused query (`{ data: null, error }`, never a throw) rendered as *"you have no photos"* over rows that exist. The `catch` stays — gallery trouble must never take the wedding page down — and is now the only *other* thing that means failure.

### The caller that was waiting on this

`lib/alaala-wall-data.ts` (the Alaala memory wall, #4395/#4397) deliberately did **not** map this `null` onto its `unreadable` flag, and said so in a comment: while `null` was ambiguous, doing so would have raised *"Some of your memories could not be loaded"* at the entire guest population. That deferral is now closed — a failed attended read reports `unreadable: true`, and refusing to map it would be the opposite error.

### 🪤 The bracket-glob trap bit again, and it is worth writing down twice

`npx tsx --test "app/[slug]/_lib/three-states.test.ts"` printed **`# tests 0 … # fail 0`** and exited **green**. Brackets are a glob character class, so an explicit bracket path matches nothing and reads exactly like success. Every run here goes through `app/*/_lib/…`, and the mutation harness **refuses to proceed on a zero-test baseline** rather than reporting eight confident passes over a suite that never ran.

**8 sabotages, each occurrence-counted before → after, all 8 caught** — including restoring the exact shipped bug, dropping either `.error` check, removing the catch, un-mapping the wall's `unreadable`, and deleting either of the invitation's two sentences.

Full suite: **7,805 unit tests green**, typecheck clean, all 21 `lint-*.mjs` guards + `lint:dup-rule` green.

SPEC IMPACT: None — no SKU, price, schema or migration. No read is widened: the same rows, correctly distinguished from a failure to read them.
