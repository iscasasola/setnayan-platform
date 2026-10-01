## 2026-10-01 · feat(themes): Pro themes are offered to every event type — still Pro

The wedding-only fence on the Pro invite themes (Q7 = A, 2026-09-11) is retired. A birthday, hangout, wake or any other event type can now pick every theme in Pick a theme; a Pro theme still needs Event Hub Pro to apply (◆, trying is never blocked). `lib/invite-themes.ts` no longer takes an event-type fence (`resolveInviteTheme` / `suggestedInviteTheme` / `themeMatchingFeel` / `pickableInviteThemes`), and the three other copies of it — the guest-facing resolver (`hub-look.ts`, its `proThemeGate`), the invite panel and the draft-Apply server check (with its `not_for_this_celebration` hold) — are gone with it. The Save-the-Date film keeps its own wedding-only fence. No theme itself changed.

Guard: `lib/invite-themes.test.ts` — every Pro theme is offered to and worn by a non-wedding that owns Pro, ownership is still required, and no theme path asks `resolveWeddingOnlyParts` again (sabotage-checked: re-shutting the picker to free-only turns it red).

SPEC IMPACT: None — DECISION_LOG 2026-10-01 "PRO THEMES OPEN TO EVERY EVENT TYPE (STILL PRO)" already records it (part 1 only; part 2, onboarding pre-selecting a free theme, ships with the onboarding PR).
