# Cowork Inbox — Pending Spec Updates

> Worklist of spec-corpus updates the owner needs to apply via Cowork.
>
> **Read this** at the start of any Cowork session. **Action** each `[PENDING]` item by editing the indicated spec file at `~/Documents/Claude/Projects/Setnayan/`. When done, change `[PENDING]` to `[DONE <YYYY-MM-DD>]` (or delete the entry if you'd rather keep the file short).
>
> **Maintained by:** Claude Code sessions append new `[PENDING]` items here whenever a code change has spec impact. This is the single bridge between repo work and the spec corpus — `CHANGELOG.md` is the full history; this file is the active worklist.

---

## [PENDING] 2026-05-14 — Iteration 0036: Event-Day Pre-Load (couple + vendor)

**Spec target — owner should create:** new iteration folder
`~/Documents/Claude/Projects/Setnayan/03_Iterations/0036_event_day_preload/` with
the standard five files (`0036_event_day_preload.md`, `.html`, `.docx`,
`tests.md`, `fixtures.json`). Sits alongside the caching-strategy entry below —
the caching foundation is the platform infra, 0036 is the first feature on top
of it.

**Scope to capture (Locked 2026-05-14):**

> **Goal.** Day-of resilience for both couple and vendor against bad venue WiFi.
> Proactively pre-load the full event bundle into the client cache so every
> screen serves from local storage and revalidates in the background.
>
> **Visibility window — couple.** "Prepare for event day" banner CTA visible
> T-3 days through T+1 day on the dashboard home. Auto-preload (silent, no UI)
> fires inside T-24h to T+12h, deduped to once per 60 minutes via localStorage.
>
> **Visibility window — vendor.** Same T-3 / T+1 visibility window, per chat
> thread the vendor has with an upcoming event. One CTA card per upcoming
> event on the vendor dashboard.
>
> **Couple bundle contents (under TanStack-Query keys).** Event meta · guest
> list with RSVP + role + table assignment · tables + seat assignments ·
> schedule blocks · vendors · budget snapshot (line items + payments) · mood
> board palette · last 50 messages per open chat thread · asset URLs handed
> to the SW for cache warm-up.
>
> **Vendor bundle contents.** Their service slot in the schedule · masked
> couple contact (event display name + date) · last 50 messages with the
> couple.
>
> **Service worker contract.** Page posts `{ type: 'PRELOAD_ASSETS', urls: [...] }`
> to the active SW. SW fetches each URL with `mode: 'no-cors'` and stashes the
> response in the shell cache. Unknown message types are silently ignored.
>
> **RLS scoping.** No new policies — the existing couple-read + vendor-read
> policies already gate the underlying fetches. The server action runs under
> the user's session.
>
> **Out of scope for V1.** Native iOS/Android offline. Photo gallery archive
> downloads. Pre-load of guest invitation sites (those have their own
> per-guest offline path via the QR token).

**Why this is a spec change:** new feature not currently in any iteration spec. Implementation has landed in the repo (PR `claude/event-day-preload`) and depends on the parallel caching-foundation PR (`claude/caching-foundation`).

**Once the spec is created, tell Claude Code:** "Iteration 0036 spec is locked — sweep the implementation against `tests.md`."

---

## [PENDING] 2026-05-14 — Caching & Offline Strategy (new cross-cutting infra)

**Spec target — owner picks one:**

- **Option A (recommended, lighter):** Add a new section **§ Caching & Offline Strategy** inside the existing platform-foundation spec at `~/Documents/Claude/Projects/Setnayan/02_Specifications/` (whichever file holds the foundation decisions — e.g. `Platform_Foundation.md` or equivalent).
- **Option B (heavier):** Create a new mini-iteration folder `~/Documents/Claude/Projects/Setnayan/03_Iterations/0036_caching_strategy/` with just `0036_caching_strategy.md` + `tests.md`. Skip `.html`, `.docx`, `fixtures.json` since there's no UI prototype.

**Section content to drop in (Locked 2026-05-14):**

> **Goal.** Fast perceived load and tappable-instantly UI on return visits, without consuming user device storage unbounded.
>
> **Storage budget.** **100 MB total per user / per install**, gated by `navigator.storage.estimate()` at startup. If the browser reports < 100 MB headroom, the budget drops to 50% of available. Allocation inside the 100 MB:
> - **~75 MB images** (cover photos, vendor portraits, mood-board thumbnails, save-the-date previews, monograms)
> - **~20 MB JSON/data** (guest lists, vendor profiles, schedule, budget, mood board metadata)
> - **~5 MB headroom**
> - Splits are soft — whichever layer fills first triggers LRU eviction in *that* layer.
>
> **Two-layer architecture.**
> - **Data layer.** TanStack Query + `persistQueryClient` to IndexedDB. Stale-while-revalidate. Per-query TTL. Hard `maxAge` + buster key prevents the persisted blob from growing unbounded across schema changes.
> - **Asset layer.** Service worker (`apps/web/public/sw.js`) extended with route-scoped `CacheExpiration` (`maxEntries`, `maxAgeSeconds`) for images, JS chunks, fonts.
>
> **What MUST be cached.** App shell, JS chunks, fonts, public-read data (events list, guest list, vendor profiles, mood board, schedule, budget, save-the-date assets).
>
> **What MUST NEVER be cached.** Auth tokens, Supabase session, payment intents, BIR receipts, contract files (sensitive), API gateway responses bound to a per-request key, live chat messages (use Supabase realtime, never the cache).
>
> **Cache invalidation discipline.** Every mutation MUST invalidate its query key. Enforced via a thin wrapper around `useMutation` so it's hard to bypass.
>
> **Stale-time defaults** (overridable per query):
> - Hot lists (guests, schedule on day-of): 60 s
> - Warm data (vendor profiles, mood board): 5 min
> - Cold/immutable (BIR receipts metadata, finalized invitation themes): 1 hr
>
> **Eviction policy.** LRU within each layer. Asset layer evicts oldest images first. Data layer evicts queries by `dataUpdatedAt`.
>
> **Out of scope for this section.** Native iOS/Android offline (Phase 2). Photo gallery archive downloads (handled by 0009 photo-delivery via direct R2 + native share, not the PWA cache).

**Why this is a spec change:** New cross-cutting architectural decision touching the platform foundation. Not currently in any iteration spec. Affects how all future iterations think about data freshness and offline behavior.

**Once the spec is updated, tell Claude Code:** "Caching strategy is locked in the spec — proceed with implementation plan." Claude will then write the implementation plan, get your approval, and only then touch code.
