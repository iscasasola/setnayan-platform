## 2026-08-09 · fix(public): the Google-access page shares as itself, with the brand card

Follow-up on the same branch, from adversarial review of PR #4271.

The new `/privacy/google-access` page reproduced the exact defect the same PR had
just fixed on `/`. Next **replaces** `openGraph` and `twitter` wholesale rather
than deep-merging them (`next/dist/lib/metadata/resolve-metadata.js`,
`case 'openGraph':`), and the page shipped:

- **an `openGraph` object with no `images`** — so the root layout's 1200×630
  brand card was deleted on that URL and the page shared as a bare link; and
- **no `twitter` object at all** — so the layout's twitter card survived intact
  and this legal summary would have been shared under Setnayan's *marketing*
  headline and description ("Plan your whole Filipino wedding free…").

Both objects are now stated in full. The rule the PR wrote into `app/page.tsx` —
*an override object must be COMPLETE, not a patch* — now also applies to the page
the PR added.

**Guard** (`app/privacy/google-access/google-access.test.ts`, +4 tests, 7 total):
asserts against the page's **real exported `metadata` object**, not its source
text, and **derives** the required key set by parsing `baseMetadata` in
`app/layout.tsx` — so adding a key to the root layout raises the bar here
automatically instead of leaving a hand-typed list to go stale. Mutation-tested
2026-08-09, baseline green (7/7) before and after; each of these turned it red:
dropping `images`, emptying `images`, deleting the whole `twitter` object,
**leaving that object present only as a comment** (the shape that defeated a
previous guard), downgrading the card to `summary`, pointing the twitter words
back at the marketing copy, shrinking the image below 1200×630, and adding a new
key to the layout's `openGraph`.

Not changed, deliberately: `/privacy` has the same partial shape (og without
`images`, twitter without `images`). That is the house pattern rather than a
regression introduced here, and it is out of this brief's scope — flagged for a
separate sweep across the legal routes. `og:image` plays no part in Google's
OAuth review either way; this is a sharing/brand-consistency fix.

SPEC IMPACT: None.
