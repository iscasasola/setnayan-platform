## 2026-06-26 · feat(guests): no-login photo grace — 24h to download, account = permanent

Invite/Join v2 incentive: a **no-login guest's** access to their tagged photos now stays
open from the live window through the **post-event grace (~24h after the wedding,
`dayOfPhase 'post'`)** so they can download — then it closes for them. Account-holders
keep theirs forever (the Collection hub). Previously the guest gallery was live-window
only, so accountless guests had *no* post-event access at all.

- `app/[slug]/page.tsx`
  - The per-guest tagged-photo gallery is now fetched + rendered through `live` **and**
    `post` (was `live`-only).
  - During the post grace, accountless guests see a "these close ~a day after the
    wedding — save them, or make a free account to keep them forever" banner; each photo
    is wrapped in a link so a tap opens it full-size to save (the download path).
  - After the grace, an accountless guest sees a gentle "keep this event for good — make
    an account" close-out (accurate regardless of photo count); the existing claim CTA
    near the top is the action. Account-holders are never gated.

No migration. typecheck ✅ · lint ✅ · production build ✅.

SPEC IMPACT: refines `0000_ADDENDUM_invite_join_model_2026-06-25.md` — no-login access is
event-only + a 24h post-event photo grace; an account makes photos permanent.
