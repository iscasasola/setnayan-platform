## 2026-09-11 · feat(services): a card goes live only with a cover photo and what's included (H2)

The owner's 2026-09-09 ruling — *"the cover-photo · title · inclusions
requirements stay"* — finished. The title was B1's; this adds the other two, in
all three places that decide a publish, together (as #5373 proved they must):

- **The shared gate** (`lib/service-publish-gate.ts`): `PUBLISH_REQUIREMENTS` is
  now `cover · price · inclusions` (the order the maker's first pass asks). New
  `coverIsSet` / `inclusionsAreSet`, the refusal + coach sentences, and the
  live-card split: `unmetForALiveCard` (price only) and `liveCardFlags`.
- **The trigger** (`enforce_service_publish_gate`): a card inserted live or
  flipped draft → live needs a cover (asked first). "What's included" is a
  DEFERRED constraint trigger (checked at commit), because inclusions are child
  rows written after the card — `save_vendor_service`'s write order and a
  one-statement CTE both pass; a card that ends the transaction live with nothing
  included does not.
- **`save_vendor_service`**: when a save takes a card live, it refuses a payload
  with no cover, no price or nothing included — same order, same sentences.
  Every other line of the body is byte-identical (absent-perk rule, "Service not
  found.").
- **A card already live is FLAGGED, never refused or unpublished**: the legacy
  editor's Save stays enabled for it and lists what a couple is not seeing
  (`liveCardHealthFlags`); the toggle, the maker and the RPC judge only a card
  going live. Production's two live cards (both with nothing included, one with
  no cover) stay live and still save — proved in the db test.
- **The maker's first pass** asks "What's included?" between the price and the
  optional gift; the wizard's cover rule moved into the shared gate.
- **`host_mc`** — a blank host card is named **"Host / MC by …"**, not "Host Mc
  by …": `fill_blank_service_card_title` now reads the taxonomy tree's own label
  (`service_categories.label_en`) before humanising the key.
- DB-test fixtures that inserted LIVE cards now carry a cover and one included
  line (the rule applies to every writer, fixtures included).

Guards: `lib/a-card-needs-a-cover-and-whats-included.test.ts` (10),
`tests/db/a-card-needs-a-cover-and-whats-included.db.test.ts` (12).

SPEC IMPACT: DECISION_LOG.md row appended 2026-09-11 (H2 built; the "judged when
a card goes live, flagged when already live" reading recorded for owner sight).
