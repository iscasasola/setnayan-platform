## 2026-07-15 · feat(samahan): routes + lib layer, dark (PR-2 of the minimal cut)

The working Samahan product surfaces — real and functional, but NOTHING links
to them yet (PR-4 is the home-door flip). Per
`Samahan_Minimal_Build_Plan_2026-07-15.md` §3–§6:

- `lib/communities.ts` — typed rows, `cache()`d `fetchUserCommunities`,
  `fetchCommunity` (null = membership gate), `fetchCommunityEvents` (user-JWT
  read via the community_member_can_read_events policy), `fetchViewerEventIds`,
  `fetchCommunityRoster` (admin client for display names ONLY — never email;
  action targets use the bigserial member_row_id, no auth UUIDs in the DOM),
  `fetchInviteToken` (organizer-RLS'd), `fetchPendingCommunityInvite`
  (terminal-state discriminated union), `generateCommunityInviteToken`
  (32-byte base64url, event-moderators recipe).
- `/dashboard/samahan` — index ("Your samahans", glass rows, honest empty
  state, "+ Create a Samahan").
- `/dashboard/samahan/new` — create flow (name 2–80 · 5 kind chips ·
  description ≤280); the action inserts community + organizer membership +
  standing invite token via the admin client, lands on `?created=1`.
- `/dashboard/samahan/[communityId]` — space page, `?tab=overview|members|events`
  on ONE server page (real links, zero client state). Overview: description +
  stat pair + honest "Usapan — group chat is coming soon." note + organizer
  panel (invite link + Copy + Rotate + Archive via `?confirm=archive`).
  Members: display-safe roster + organizer Promote/Demote/Remove + self Leave
  with the last-organizer guard. Events: community events, rows link ONLY when
  the viewer is an event member, else static + "Ask an organizer" note.
- `/samahan/join/[token]` — public accept mirroring `/host/accept/[token]`:
  signed-out shows name + kind + member COUNT only (never member names) +
  login round-trip; signed-in Join/No-thanks; admin-client upsert
  (`ignoreDuplicates`); token NOT cleared on accept (standing link — rotation
  is the kill switch); honest terminal cards (not_found/revoked/expired/archived).
- Server actions: create · leave (last-organizer guard; sole-member leave also
  archives) · promote/demote/remove (organizer-gated by RLS + app re-check) ·
  rotate (upsert — self-heals a missing token row) · archive.

All pages are chrome-less `(account)` spokes (slim top bar, Back pill, no
sidebar); atelier glass panels, gold(terracotta-500) rings not fills, Space
Mono counts/badges/IDs, Lucide 1.75.

SPEC IMPACT: `Samahan_Minimal_Build_Plan_2026-07-15.md` §3–§6 shipped as
specced. Deviations: sole-member leave archives the community (keeps the
soft-archive lifecycle tidy); reused the shared `CopyButton` instead of a new
client component.
