/**
 * apps/web/lib/hub-fonts-most-used.ts
 *
 * WHICH FACES THE EVENT HUB USES MOST — counted, so the Font dropdown's
 * "Most used" shelf is a measurement and never a taste call.
 *
 * Owner, 2026-09-27: *"place on top the top 5 most used fonts on the website.
 * so it is easy for them to manage."* And the standing rule: never ship a
 * guessed number.
 *
 * ── WHAT IS COUNTED ────────────────────────────────────────────────────────
 * The ten Event Hub themes (`INVITE_THEMES`, `lib/invite-themes.ts`) each name
 * four face slots — heading · body · labels · script. A family scores one per
 * slot that names it, across all ten. Only families the dropdown offers
 * (`HUB_FONTS`) are ranked; a spec face we do not ship (EB Garamond, Lora, …)
 * is counted by `countThemeFaceSlots` but can never be offered.
 *
 * Ties are broken by the dropdown's own order (`HUB_FONTS`), so the result is
 * deterministic — and `hub-fonts-most-used.test.ts` also asserts the fifth
 * place is NOT tied with the sixth, so no tie-break is ever what decides who
 * is in the five.
 *
 * ── WHAT IS NOT COUNTED, AND WHY ───────────────────────────────────────────
 * Couples' own saved choices (`events.site_font_key`, per-element fonts in a
 * draft) live only in production, which no build or test reads. Production
 * holds a handful of events, so the themes dominate either way.
 *
 * Pure. No I/O.
 */
import { HUB_FONTS, type HubFontKey } from '@/lib/hub-fonts';
import { HUB_THEMES, type InviteTheme } from '@/lib/invite-themes';

/** Face-slot count per family name, over the given themes. */
export function countThemeFaceSlots(themes: readonly Pick<InviteTheme, 'fonts'>[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of themes) {
    for (const family of [t.fonts.heading, t.fonts.body, t.fonts.labels, t.fonts.script]) {
      if (!family) continue;
      counts.set(family, (counts.get(family) ?? 0) + 1);
    }
  }
  return counts;
}

/** Every offered face with its count, highest first (ties keep `HUB_FONTS` order). */
export function countHubFontUse(
  themes: readonly Pick<InviteTheme, 'fonts'>[] = HUB_THEMES,
): Array<{ key: HubFontKey; family: string; uses: number }> {
  const slots = countThemeFaceSlots(themes);
  return HUB_FONTS.map((f, i) => ({ key: f.key, family: f.family, uses: slots.get(f.family) ?? 0, i }))
    .sort((a, b) => b.uses - a.uses || a.i - b.i)
    .map(({ key, family, uses }) => ({ key, family, uses }));
}

/** The `n` most-used offered faces. */
export function mostUsedHubFontKeys(
  n = 5,
  themes: readonly Pick<InviteTheme, 'fonts'>[] = HUB_THEMES,
): HubFontKey[] {
  return countHubFontUse(themes)
    .slice(0, n)
    .map((r) => r.key);
}
