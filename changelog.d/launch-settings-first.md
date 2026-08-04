# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-24 · feat(website): Launch is settings-first + Website Pro band (PR-A)

Owner 2026-07-24: *"when we open Launch, instead of the website, we start by the settings — as free, and the settings when Website Pro is unlocked."* PR-A of a 3-PR plan (design: `Design_Launch_Settings_2026-07-24/`).

- **`customer-nav-config.ts`** — the sidebar "Launch" item stops opening the live `/[slug]` directly; it now always opens `/dashboard/[eventId]/website/launch`. (Supersedes the 2026-07-02 "open the live site directly" ruling; the live site is one click away via "View my site" on the new surface.)
- **`/website/launch/page.tsx`** rebuilt settings-first per spec §2: a go-live hero plaque (absorbs the existing `LaunchStdButton` + a "View my site" link), a **FREE band** of always-included settings (URL · who-can-view · open browsing · sections · hero photo · map link · theme · live-media), and the **WEBSITE PRO band** — the owner-locked seven (Cinematic Reveal · STD video · gallery · background music · editorial editing · background color · button color). The Pro band reads `eventCoupleWebsiteProActive`: **locked** shows "Part of Website Pro" per card + one umbrella "Unlock Website Pro · ₱3,500" CTA (→ `/studio/website-pro`); **unlocked** turns every card into a live deep-link. The old 4-phase `WebsiteLaunchPreview` is kept, moved below the settings.

Scope note (PR-A only): this page + the nav re-point. It does NOT yet gate the underlying editors (PR-B) and the two color settings are placeholders until PR-C — so a locked couple simply gets no deep-link from here. The guest website (`/[slug]`) is untouched.

SPEC IMPACT: Applied — `DECISION_LOG.md` 2026-07-24 (Launch settings-first + Website Pro split) + design corpus `Design_Launch_Settings_2026-07-24/`. No schema change in PR-A.
