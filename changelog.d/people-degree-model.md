## 2026-07-17 · feat(people): the degree model — Alaga + Samahan listed with People

Owner decision 2026-07-17: Alaga and Samahan belong WITH People, under a degree model — **your first degree** is the people you're connected to, your alaga, and your samahan *groups*; **your second degree** is the people *inside* those samahans.

- `/dashboard/people` now shows all three first-degree layers: Connections (flag-gated) · Alaga (live) · **Samahan** (new section — your groups with kind/role/member count, linking to each samahan page) plus a **"Through your samahan — second degree"** strip: co-members across all your samahans, deduped, labeled with which samahan you share.
- New `fetchSamahanSecondDegree` in `lib/communities.ts` — same security posture as `fetchCommunityRoster`: membership rows via the user client (RLS scopes to own communities), names via admin (`user_id → display_name` only, never email), no auth UUIDs in the render.
- The home launcher's People peek now states the degree model and shows four facets (Family & friends · Ninong/Ninang · **Alaga** · **Samahan**) — the word "Alaga" is now visible from the home.
- Samahan *management* (roster, invites, roles) stays on its own pages under Spaces — People is the relational view, not a second door, so the 4-surface no-dupe home layout is preserved.

Typecheck clean; auth-gated pages verified to compile + redirect on the dev server (signed-in render covered by CI build/e2e).

SPEC IMPACT: DECISION_LOG.md 2026-07-17 row (People degree model — first degree = connections+alaga+samahan groups; second degree = samahan co-members)
