## 2026-07-16 · feat(stories): the Storytellers shelf on /realstories — one-click featuring, byline tiles, vendor backlink (PR-D)

The Storytellers hub (council verdict S1+S2+S3 collapsed into ONE deny-by-default,
self-gating PR): nothing public changes until the owner's first Feature click.

- **Migration `20270818771487`** — `creator_chapters.showcase_featured_at` +
  `showcase_feature_rank` (the events-curation 2-column pattern of
  `20261221000000`, pattern-copied never shared) + partial featured index +
  global published index. No new tables, no `events` changes, no consent-gate
  changes.
- **Admin curation** — a "Storytellers" tab in `/admin/studio` (14th sibling in
  `_surfaces/`): candidate list = ALL published chapters on public-profile
  accounts, newest first, with YouTube-thumb embed preview + owner + kind +
  views + open-report count inline. `app/admin/storytellers/actions.ts` copies
  the audit+notify+revalidate spine from the real-stories actions over its OWN
  gate (published + public profile + **YouTube-derivable thumbnail — non-YouTube
  chapters are REFUSED**, the owner-ratified V1 thumbnail rule). Feature /
  unfeature / re-rank; creator notified on first feature (`showcase_featured`
  mirror); `/realstories` revalidates live.
- **S0 seam wired** — a report-hide on a `'chapter'` report atomically clears
  `showcase_featured_at` in the same `/admin/user-reports` resolution (+ a
  "Remove from Real Stories" button on chapter reports); a hidden chapter can
  never ride out the ISR window.
- **The shelf** — "From Our Storytellers" (`#storytellers`) below the untouched
  editorial cascade: featured chapters only, rank order, in a NEW byline-forward
  tile ("A chapter by @slug" + Storyteller badge + kind chip + view count +
  YouTube-derived thumb), linking to the canonical noindex `/u/[slug]/c/[id]`.
  **Zero featured chapters ⇒ the shelf renders NOTHING** — verified live: the
  page is byte-identical to its pre-PR self today. Loader/tile/mapper live in
  route-agnostic modules (`lib/storytellers.ts`, `app/_components/
  storyteller-tile.tsx`) importing nothing from the page code.
- **Hub metadata** reworded once for both voices ("Real stories from real
  events — editorial features written by Setnayan, and chapters told by our
  storytellers") + CollectionPage JSON-LD description; the ItemList stays
  editorial-only (chapter pages are noindex).
- **`/storytellers`** → 307 redirect to `/realstories#storytellers` (temporary
  on purpose — Phase S4 keeps the standalone-page promotion open); slug
  reserved.
- **Cross-rail chips** via `creator_chapters.event_id`: editorial cards get
  "Watch the storyteller's cut"; shelf tiles get "Read the editorial".
- **`/v/[slug]` "Featured in these stories"** — the vendor microsite strip now
  carries BOTH voices (consented editorials + featured chapters crediting the
  vendor via substrate), each in its own tile grammar, hidden when empty — and
  is **FREE for every visible vendor**: the `premiumLayout` gate on the section
  and the `editorialTagged` Pro-gate on the credit chip are RETIRED (Simplicity
  Canon rule 2: "you never pay to be named in a story"; the cap is now `true`
  across the tier matrix, the editorial free-tier credit hide is removed, and
  /realstories credit chips now resolve names through the hybrid-anonymity
  mechanic so an unrevealed vendor is credited by screen name).
- **`CREATOR_BADGE_LABEL`** flipped 'Creator' → 'Storyteller' (owner-ratified
  badge word — names the badge, the shelf, the admin tab, the redirect).

Verified: typecheck + lint clean · migration:check green · live run: 307
redirect works, shelf absent with 0 featured, cascade unchanged, vendor page
renders with empty strip hidden, non-YouTube refusal enforced in action + UI.

SPEC IMPACT: Storytellers_Editorial_Architecture_Council_Verdict_2026-07-16.md
(§3 architecture · §4 curation flow · §5 schema — implemented as specified) +
Creator_Economy_Simplest_Approach_Council_Verdict_2026-07-16.md §5 PR-D line +
the owner ratification block in Creator_Economy_Discount_Collab_Build_Plan_
2026-07-16.md (badge word "Storyteller" · YouTube-derived thumbnails · rule 2
credit-is-free). DECISION_LOG.md row appended in the corpus.
