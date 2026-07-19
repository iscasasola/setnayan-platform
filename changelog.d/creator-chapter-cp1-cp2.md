## 2026-07-16 · feat(creator): Adventure Chapter foundation — is_creator flag + creator_chapters schema + authoring dashboard (CP-1/CP-2)

First slice of the Creator "Adventure Chapter" program (build plan
`Creator_Adventure_Chapter_Build_Plan_2026-07-16.md`, phases CP-1 + CP-2). The
locked model: a Chapter EMBEDS the creator's finished edit hosted on their own
platform (Setnayan never hosts the full video), wrapped with the raw substrate
(Papic gallery / itinerary / vendor refs) that is the moat. A profile is a
timeline of chapters, not a feed. Creators are FREE — `is_creator` is an access
flag, not a SKU.

**CP-1 — schema (`20270813337233_creator_adventure_chapter_foundation_cp1.sql`).**
- `users.is_creator boolean default false` (admin-granted for now; self-apply is
  a follow-up). The public gate the chapter public-read joins to,
  `users.public_profile_enabled` (default false / opt-in), is REUSED from the
  Social-Share #7b migration `20270812020691` — not re-added here.
- New `creator_chapters` table — public id prefix **`S89C-`** (C = Chapter),
  `user_id`, nullable `event_id`, `title`, `kind` (wedding|travel|food|
  lifestyle), `embed_url` + `embed_provider` (allowlist youtube|instagram|
  tiktok), nullable `teaser_r2_key` (teaser render deferred), `substrate` jsonb,
  `status` (draft|published), `published_at`. RLS enabled at CREATE using
  canonical patterns only: **Pattern A** owner-write (`user_id = auth.uid()`),
  **Pattern D** public-read (`status='published'` AND a subquery to `users` for
  `is_creator` + `public_profile_enabled`), plus the Setnayan admin override.
  The users-subquery errs CLOSED under users' own RLS (never leaks drafts /
  hidden profiles); the real public render path (CP-3) is service-role, like
  `/u/[userSlug]`.

**CP-2 — authoring dashboard (`/dashboard/creator`).**
- New account-group surface, gated on `is_creator` (page + every server action).
  Create / edit / publish / unpublish / delete chapters; attach substrate;
  creator-only sandboxed embed PREVIEW.
- **Embed security** (`lib/creator-chapters.ts` + 11 unit tests): pasted links
  are validated against the provider allowlist server-side and normalized to a
  privacy-enhanced embed src (youtube-nocookie · instagram `/embed` · tiktok
  `/embed/v2`); only the normalized URL is stored. The render frame
  (`ChapterEmbedFrame`) is sandboxed (`allow-scripts allow-same-origin
  allow-presentation`, no top-navigation/popups). CSP `frame-src` extended with
  instagram.com + tiktok.com.

Deferred (follow-ups, not in this PR): owned-music teaser render
(`teaser_r2_key` stays null), CP-3 public `/u/[slug]` chapter timeline (a
separate PR owns `app/u/[userSlug]/page.tsx`), CP-4 shoppable vendor leads
(substrate stored, not surfaced), creator self-apply→approve flow + admin grant
UI, creator badge.

SPEC IMPACT: New feature landing the CP-1/CP-2 slice of
`~/Documents/Claude/Projects/Setnayan/Creator_Adventure_Chapter_Build_Plan_2026-07-16.md`.
DECISION_LOG.md row appended in the spec corpus (S89C- type-letter allocation +
the errs-closed public-read note). No canonical iteration-spec stub touched
(per the 2026-07-02 archive-stub rule); the build plan + council verdict remain
the reference.
