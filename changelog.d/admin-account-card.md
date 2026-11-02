## 2026-07-03 · feat(admin): Account Card — per-user HQ view (header + lifecycle + 5 tabs), supersedes draft PR #2051

The HQ-facing per-user Account Card at `/admin/users/[userId]` — the final (wave 4) slice of the Customer Card respine. Reachable by clicking a user's email on `/admin/users`. Same card chrome as the shipped vendor Customer Card (sticky header, `?tab=` tabs) but with an account-lifecycle strip (Signed up → Onboarded → First event → First purchase → Active) in place of the sales pipeline.

- **`app/admin/users/[userId]/page.tsx`** (new) — read-only consolidated account view. 5 tabs: Overview (profile + flags, events & roles, entitlements/comps), Money (orders + logged payments + refunds, links into `/admin/payments`), Support (help tickets · disputes · reports · AI abuse flags — read-only slices that link into their queues), Activity (operational timeline, counts/metadata only), Governance (RA 10173 who-viewed-this-account trail from `admin_data_access_log` + a placeholder for consent-to-fix / takeover, "lands with Phases 2–3"). Reads via the service-role admin client; route gated by `app/admin/layout.tsx`. Appends an `admin_data_access_log` row per view via the existing `logAdminDataAccess` + `after()` pattern.
- **`app/admin/users/[userId]/_components/account-card-nav.tsx`** (new) — the lifecycle strip + `?tab=` tab rail (server-rendered, scrollable pills on mobile).
- **`app/admin/users/page.tsx`** — the user's email is now a link to the Account Card. Surgical; no list restructure.
- **HARD PRIVACY WALL:** deliberately never renders chat/message bodies, shared thread files, face vectors/enrollment data, or raw behavioral data — counts and statuses only. A footer note restates the exclusions. Passes `lint-admin-chat-guard`. View-only — no write actions; account mutations stay on the Users list.

No migration (read-only over existing tables). VIEW-ONLY by design.

SPEC IMPACT: None — design source 03_Strategy/Customer_Card_Prototype_2026-07-03.html (admin variant, owner-approved in session)
