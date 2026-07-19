## 2026-07-16 · feat(creator): public chapter timeline + chapter detail + shoppable substrate + creator badge (CP-3/CP-4)

Second slice of the Creator "Adventure Chapter" program (build plan
`Creator_Adventure_Chapter_Build_Plan_2026-07-16.md`, phases CP-3 + CP-4 + the
badge). Turns the CP-1/CP-2 foundation (PR #3304) into the PUBLIC-facing surface.
Locked model unchanged: EMBED the creator's finished edit (Setnayan never hosts
the full video), a profile is a TIMELINE not a feed, substrate is the moat,
vendor leads are 0% commission, creators are FREE.

**CP-3 — public chapter timeline on `/u/[userSlug]`.**
- When the account is a creator (`users.is_creator`), the profile now renders its
  PUBLISHED chapters as a reverse-chronological **timeline** (a dated spine of
  cards, deliberately not a feed) and NEVER auto-redirects into a single event —
  the chapters are the point of the page. Each card links to the chapter detail.
- A creator with a published timeline but no public events counts as "public
  content", so the name-oracle guard shows their name (and the empty "nothing to
  show" card is suppressed).
- Public reads go through the service-role admin client and filter in app code
  (same pattern the page already used for events); the `creator_chapters`
  public-read RLS from #3304 stays defense-in-depth. New helper
  `lib/creator-public.ts` (`fetchPublishedChapters`).

**CP-3 — chapter detail at `app/u/[userSlug]/c/[chapterId]/page.tsx`.**
- New non-colliding route (`c` is a 1-char static segment; real slugs are ≥3
  chars so it can never shadow an event slug). Addressed by the chapter's
  human-facing `public_id` (S89C-…), gated on `is_creator &&
  public_profile_enabled && status='published'`.
- Renders the EMBEDDED edit via the existing sandboxed, allowlisted
  `ChapterEmbedFrame` (reused verbatim — never hosts the video), plus title /
  kind / provider / published date and the badge. `teaser_r2_key` display stays
  optional/absent (owned-music teaser render is a separate agent).

**CP-4 — shoppable substrate.**
- The chapter's substrate (`substrate` jsonb) surfaces read-only: itinerary text,
  an optional Papic-gallery note, and vendor cards. `resolveShoppableVendors`
  resolves the substrate's `vendor_ids` (business_slug OR public_id) to
  PUBLICLY-VISIBLE vendors only (hidden/archived dropped; name respects the
  hybrid-anonymity mechanic via `resolveVendorDisplayName`) and links each to the
  vendor's existing public page `/v/[slug]` — a 0% commission lead. No new
  inquiry flow.

**Creator badge (owner sign-off).**
- New `app/_components/creator-badge.tsx` — a compact GOLD seal pill in the
  atelier gold token (`--m-orange` #A9834B), a soft four-point sparkle glyph + a
  Space Mono uppercase letter-spaced label (NOT a loud verified checkmark).
  Rendered next to the creator's name on the `/u` header and on the chapter
  detail; shown only when `is_creator = true`. Label is the single constant
  `CREATOR_BADGE_LABEL = 'Creator'` so the owner can flip it to 'Kwentista'
  in one place.

`lib/public-profile.ts` extended to select `is_creator` (additive; the shared
resolver stays the single source for the /u body + metadata + OG gate). No
migration (CP-1 owns the schema). typecheck + lint clean on touched files;
`migration:check` green (777 migrations).

Deferred (not in this PR): owned-music teaser render + save-to-device, CP-5
follower perks, creator self-apply→approve flow, per-chapter OG card.

SPEC IMPACT: Lands the CP-3/CP-4 + badge slice of
`~/Documents/Claude/Projects/Setnayan/Creator_Adventure_Chapter_Build_Plan_2026-07-16.md`
and closes the "creator badge" open owner sign-off from
`Creator_Program_Council_Verdict_2026-07-15.md`. DECISION_LOG.md row appended in
the spec corpus. No canonical iteration-spec stub touched (2026-07-02
archive-stub rule); the build plan + council verdict remain the reference.
