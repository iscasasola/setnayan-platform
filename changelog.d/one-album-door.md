## 2026-08-27 · fix(event-hub): one place decides whether the album door is offered — the hub and the public event-day bar were asking the calendar

**Three surfaces on the public event website offered a way into the couple's recap album, and only ONE of them asked whether the album exists.** Counted on `origin/main` at `1c88a65e4`, not estimated — three files under `app/[slug]/` constructed the album-door href; after this change, one does.

| surface | what it asked | |
|---|---|---|
| the rooms footer — `resolveRoomLinks` | `recapPublished` | ✅ |
| the live hub's photos panel — `app/[slug]/hub/page.tsx:436` | `dayOfPhase === 'post'` | ❌ |
| the PUBLIC event-day bar — `_lib/loaders.ts` `publicAlbumHref` | `dayOfPhase === 'post'` | ❌ |

**The third one was not in the brief that commissioned this fix — it was found by deriving the file list instead of hand-listing it**, and it is the worst of the three: `publicAlbumHref` feeds the "Photos" button on the anonymous/public arm of `/{slug}` itself, the address printed on the invitation, reached by a guest holding no session.

🔑 **THE PHASE WAS A PROXY FOR "THE ALBUM IS OUT", AND IT IS WRONG IN BOTH DIRECTIONS.** `post` is only T+36h → T+60h (`lib/day-of-mode.ts`), a 24-hour slice. So the two phase-gated doors (a) appeared during exactly the window when the couple has almost certainly not published yet — the guest tapped "See the recap gallery" and landed on `/{slug}/recap`'s "The recap isn't ready yet" stand-in — and (b) went dark **forever** at T+60h, hiding a genuinely published album that the rooms footer on the same event was still offering. This affects every event type, weddings included.

🔑 **`loadRoomLinks`' own docblock predicted this and named the mechanism:** gathering the facts once avoids "six copies of the same reads and six chances for one of them to drift into asking a slightly different question. That drift is exactly how the money-gift door and the money-gift PAGE ended up applying two different visibility rules." These were the seventh and eighth copies.

**The fix — one decision, three callers.** `albumRoomLink(slug, recapPublished)` in `app/[slug]/_lib/room-links.ts` is the RULE; `albumDoorPublished` / `resolveAlbumDoor` in the new `app/[slug]/_lib/album-door.server.ts` is the FACT plus its **fail-closed** read, lifted verbatim out of `loadRoomLinks` so the other two surfaces inherit the failure direction rather than re-deciding it ("a failed read here must not invent an album that is not there: a link to a 404 is worse than no link, and a guest turned away once stops tapping"). `resolveRoomLinks`, `hub/page.tsx` and `loaders.ts` all now route through it.

⚠ **The decision lives in its own module, and that is not tidiness.** The obvious home was `room-links.server.ts` — it cannot be: that file imports `./loaders`, and `loaders.ts` is one of the three callers, so `loaders.ts → room-links.server.ts → loaders.ts` would be a cycle. `album-door.server.ts` imports only the pure rule and the recap read, so every caller reaches it and none reach each other.

⚠ **The LABEL is deliberately still per-surface** ("The album" / "See the recap gallery" / "Photos"). What must never diverge again is WHETHER the door is offered and WHERE it points; callers that only want the address take `.href`.

⛔ **The live-wall branch of `publicAlbumHref` is untouched** — during the day "Photos" anchors to the wall mirrored inline on the page, a different destination.

**`getRecapStatus` is now `React.cache`d** (`lib/auto-recap.ts`), matching `loadDoorwayFacts` and the rest of the `[slug]` loaders. `/{slug}/recap` alone asked three times per request (its `generateMetadata`, its `loadRoomLinks` call, and its own publish check) and the event page's door adds another. ⚠ **Checked, not assumed:** all four call sites are pure reads, and the only writers (`publishRecap` / `unpublishRecap`) upsert and never read the row back, so a memoised value cannot go stale mid-request. Noted in the docblock so a future writer that needs to read its own write gets an uncached read rather than deleting the cache.

🛡 **Guard — `app/[slug]/_lib/the-album-door-is-one-decision.test.ts`, 9 assertions.** One fixture is fed to BOTH the rooms footer and the rule the hub + event-day bar use, in both directions (published ⇒ both offer it at the same address; unpublished ⇒ neither does). The file list is **DERIVED, never hand-enumerated** — it walks the guest tree, strips comments with a state machine (every file here carries prose quoting the defect, which a raw-source scan reads as an offender), and fails if any file outside the one rule module builds an album-door href. Absolute addresses are classified as the recap page naming ITSELF (canonical / OG / share) **by the expression, never by filename**, so no file is ever exempt as a whole.

**THREE anti-vacuous FLOORS**, because a scan that matches nothing looks exactly like a pass: the walk must reach >50 files, it must find the one legitimate door (so "no strays" cannot be satisfied by the rule module quietly ceasing to build it), and it must find at least one self-canonical address (so the classifier cannot have collapsed into one bucket). A fourth assertion runs the detector against the original defect string.

🪤 **THE FLOOR CAUGHT A REAL BUG IN THE GUARD ITSELF, FIRST RUN.** The href pattern carried `/g`, and a global regex keeps `lastIndex` between calls — so `assert.match` against it silently started mid-string and went red on input it should accept. Had the floor not existed, the fix would have been to delete the failing assertion. The pattern is now non-global and the scan builds its own global copy.

🛡 **7 mutations, every one printed before → after, every one landed (count 1 → 0) and every one RED:** hub back to the calendar · rooms footer offering unconditionally · the read failing OPEN instead of closed · the public event-day bar back to the calendar · the shared rule dropping its publication check · the recap read un-memoised · the rooms footer bypassing the shared rule **while keeping identical behaviour** (that last one exists because two rules that agree today are two rules that drift tomorrow).

⚠ **What this guard does NOT prove, stated rather than implied:** `album-door.server.ts` is `server-only` and the two page callers are server components, so the "no surface builds its own door" half is a STRUCTURAL assertion over source, not a rendered-page proof. That is the shape the defect actually took. Nothing here proves what Postgres returns.

🪤 **A correction to the house note on running bracketed tests:** `npx tsx --test "app/[[]slug[]]/…"` runs **ZERO tests and prints `# tests 0`** — measured. `app/**/<name>.test.ts` and `app/*slug*/…` both work.

SPEC IMPACT: None — no schema, no migration, no pricing, no SKU. The rule enforced (a doorway is gated on what the destination demands) is the one `room-links.ts` already carried; this makes two more surfaces obey it.
