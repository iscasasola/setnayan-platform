## 2026-06-25 · feat(guests): branded invite URL `/{slug}/invite` (Invite/Join v2, PR5)

The invite link couples share is now the branded, memorable `setnayan.com/{slug}/invite`
(e.g. `/cale-ice/invite`) instead of the opaque `/join/{eventId}?token=…`. The join
token is resolved server-side, so it never appears in the shared URL or QR — and a
rotated/revoked/expired token still shows the invalid screen, so the couple keeps that
control.

- New `app/join/[eventId]/_components/join-flow.tsx` — the join experience extracted
  into one shared server component (accountless + signed-in branches, forms, role
  disclosure, optional-email field), so both routes render identically with zero
  duplication.
- `app/join/[eventId]/page.tsx` — slimmed to resolve event + token and delegate to
  `<JoinFlow>` (canonical opaque entry, unchanged behavior).
- New `app/[slug]/invite/page.tsx` — branded entry: slug → event → current join token
  (server-side) → same `<JoinFlow>`. Address stays `/{slug}/invite` (not a redirect).
- `guests/page.tsx` + `guests/invite/page.tsx` — the "Invite your guests" page + its QR
  now emit `/{slug}/invite` (fall back to the opaque URL for events with no slug yet).
  Also fixed the invite page's stale "Confirm" nudge to count unlisted guests
  (`entry_source='self_added_unlisted'`) instead of the dormant `guest_claims`.

No migration. typecheck ✅ · lint ✅ · **production build ✅** (route `/[slug]/invite`
registers as dynamic, no collision with `/[slug]`).

SPEC IMPACT: refines `0000_ADDENDUM_invite_join_model_2026-06-25.md` — the canonical
shared invite URL is the branded `/{slug}/invite`.
