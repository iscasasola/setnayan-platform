## 2026-07-15 · feat(home): four-surface launcher remodel — Events · Alaala · Spaces · You + deterministic ⌘K

The `/dashboard` launcher's seven overlapping zones (Your events · Your year · Your spaces · Your account · Life-Flash · Your story) collapse into four surfaces with one job each (owner "build it" on the Fable final design, 2026-07-15):

- **EVENTS** — glass event cards (badge · monogram · place/date · gold ring · countdown · attention line), date-descending; completed stay behind "Show all" as "Celebrated"; New-event ghost card. Supersedes the 2026-07-13 timeline *presentation* (ordering rule kept).
- **ALAALA** (owner-confirmed name 2026-07-14) — the single memory dimension: Life Story doorway (flag-off Expandable / flag-on LifeFlashHomeCard, exactly one either way) · "This year" moments strip (the old "Your year" section, merged in) · Memories Hub · People — all still expand INLINE per the 2026-07-13 rule; flag-gated "Your story" renders inside it.
- **SPACES** — vendor shop(s) + admin HQ only, capability-gated (absent for a plain couple); glass cards.
- **YOU** — avatar menu only: AccountSwitcher gains a Setnayan AI link (hidden for anon-drafts); the on-page "Your account" section is gone.
- **HomeCommandBar** (new client island) — deterministic search & jump (⌘K): client-side filtering over the user's own events/spaces/destinations + router.push. No network call, no LLM (Setnayan AI Rule 1). Modal behavior via the shared `useModalA11y` (focus trap · Escape · scroll lock · focus restore); new `anyModalOpen()` export makes the ⌘K listener stand down while another dialog is open.

Preserved byte-for-byte: landing rules (owner 2026-07-04), OAuth-race graceful-degrade on every fetch, all flag defaults (LIFE_STORY / PERSON_LIFE_STORIES / ACCOUNT_AUTOSURFACE off), shop-card cap + attention signals, admin queue digest.

Reviewed by a 22-agent adversarial workflow; 15 confirmed findings fixed pre-PR (modal a11y, scroll-follow highlight, ⌘K-through-modal guard, Lucide 1.75 stroke, dead SetnayanAiInline + hero-tone indirection removed, dead backdrop-blur dropped, doc overclaims reworded).

SPEC IMPACT: `DECISION_LOG.md` — two rows appended (foundation shipped; four-surface home built, incl. the surfaced amendment of the 2026-07-13 expand-inline lock: palette + avatar-menu navigations to library/people/setnayan-ai/notifications are owner-approved). Corpus `CLAUDE.md` token line corrected separately (100-free-on-verification retired). Design source: `User_Home_Redesign_Council_Verdict_2026-07-14.md`.
