## 2026-07-30 · feat(papic): promote Papic where it was missing — a derived price anchor on /papic, and it stops promising face-matching it can't do

`Papic_Promotion_Surfaces_BUILD_SPEC_2026-07-29.md` **PR-F**, the last non-gated item in the wave.

### 🔴 Found while building it: `/papic` promised live auto face-matching in three places

Not in the spec, and the most consequential thing in this PR. Auto face-matching is **DORMANT** — enrollment ships, the matcher does not, and QR-scan tagging carries the load (the spec's own §3-5 makes this copy law). The top-of-funnel Papic page stated it as a live capability three times:

- FAQ *"How does each guest get their own photos?"* → *"Papic **recognises faces**, so every photo a guest appears in is gathered into their personal gallery **automatically**."*
- Step 02 → *"Papic recognises faces and sorts each one to the guests in it — **automatically, in real time**."*
- The comparison table → *"Each guest's own gallery, **sorted by face**."*

The first one was also inside the **`FAQPage` JSON-LD**, i.e. served to answer engines as a quotable fact about a capability that does not exist.

All three now lead with the mechanic that actually works and is genuinely instant: a QR scan. Hold a guest's place-card QR — or a table sign, which tags the whole table at once — in frame, and those photos sort into their galleries in real time. Face enrollment is mentioned once, framed as *"ready to be matched"*, never as a promise that a guest **will** be found.

### The derived price anchor

The page previously quoted **no price at all**, on the stated grounds that "prices are admin-managed + provisional". Right about hardcoding, wrong about silence: the highest-intent Papic page in the product never told a couple that **Papic starts free**, so the single fact most likely to convert was the one thing missing.

`resolvePapicAnchor()` reads the live rung tables (`papic_pass_tiers` / `papic_one_tiers`), the two admin-editable free allowances (`papic_event_pool_config`) and the active catalog, then renders through the `papic-tier-copy` helpers — `papicBucketPhrase`, `papicPoolRungPhrase`, `papicOneRungPhrase`, `papicPointCurrencyTerms`. **Zero literals.** An admin reprice moves this page with no edit.

**It fails quiet, by construction.** Each reader degrades independently; a rung whose price is missing is **dropped** rather than rendered at ₱0 (which on a price list reads as "free"); and if nothing resolves at all, the block returns `null` and the page is byte-identical to before. On a CI build with no service-role key the free-tier lines still render from the documented seed while the rungs simply don't — a shorter true page, never a fake one. The page stays `force-static` with `revalidate = 3600`, so prod picks up an admin change within the hour.

### The rest

- **`SoftwareApplication` JSON-LD `featureList`** — now names **Papic Pool** and **Papic One** as the first two entries, adds "free to start on every event" and "a QR scan tags who is in a photo", and drops *"Every photo automatically finds the people in it"* (same dormant-matcher claim as above).
- **Site-wide SEO** — `app/page.tsx` featureList said Papic was a *"(paid add-on)"* full stop; now "free on every event; paid top-ups for more shots". Its meta description said **"Papic guest photo-and-video capture"** — the retired display name PR-C flagged for this PR under the owner's naming lock — now "Papic candid photo-and-video capture", plus the free tier. `app/layout.tsx`'s `Organization` description got the same free-tier clause.
- **The guest pitch** (`[slug]/_components/tier-comparison-widget.tsx`) — the guest-facing "two ways to celebrate" card sold capture as **"Shutter"** and never once said "Papic": the couple's flagship capture product, pitched anonymously to the exact person who uses it. Now names it. No count, no price — what the event actually holds is resolved on the capture surface.

### Not done, and why

**The `/realstories` service-badge cross-link.** The spec asked to link Papic where the gallery lists services. Those badges live **inside** the story card's own `<Link>` (`gallery.tsx:192–316`) — nesting an anchor there is invalid HTML and would break the card's click target. Doing it properly means restructuring the card's interaction model, which is a gallery change, not a copy change. Left for whoever owns that component; the badges remain accurate, just inert.

**Verification:** `tsc --noEmit` clean · `next lint` clean · `lint:retired` OK · **`test:unit` 5,428/5,428 pass**. No local `npm run build` (7 GB heap → SIGTERM 143) — the production-build check exercises the new static prerender, which is the one thing in this PR that build could catch and tests can't.

SPEC IMPACT: Applied to the corpus — `Papic_Promotion_Surfaces_BUILD_SPEC_2026-07-29.md` §2-F closed (with the realstories carve-out and the auto-face finding recorded) + §2.1 build log, and `DECISION_LOG.md`. No price, SKU or schema change: every figure is read from tables the owner already controls.
