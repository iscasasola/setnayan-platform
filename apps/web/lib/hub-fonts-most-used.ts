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
 * (`HUB_FONTS`) are ranked; a spec face we do not ship (EB Garamond, …)
 * is counted by `countThemeFaceSlots` but can never be offered.
 *
 * ── TIES (owner 2026-10-04, "Yes to both" — DECISION_LOG "THE TEN REAL THEME
 * FONTS JOIN THE FONT ▾ DROPDOWN…") ────────────────────────────────────────
 * Equal slot counts are ordered by HOW MANY THEMES use the face (`themes`): a
 * face spread over three themes outranks one used twice inside a single theme.
 *
 * ⚠ MEASURED 2026-10-04: that rule does NOT separate today's tie. Lora, Libre
 * Baskerville, Crimson Pro, Jost, Quicksand and Outfit each fill two slots
 * (body + labels) of exactly ONE theme — 2 slots, 1 theme, all six. The
 * recommendation the owner approved named the outcome, "Lora, Libre
 * Baskerville, Crimson Pro first", so that order is written down as
 * `MOST_USED_OWNER_TIE_ORDER`: a person's call, cited, and applied only after
 * both counts. The dropdown's list order (`HUB_FONTS`) comes last and may only
 * order faces BELOW the cut — `hub-fonts-most-used.test.ts` fails if it is ever
 * what decides who is in the five.
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

/** How many THEMES name each family in any slot — a theme counts once, however many slots it fills. */
export function countThemesUsingFace(themes: readonly Pick<InviteTheme, 'fonts'>[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of themes) {
    const families = new Set([t.fonts.heading, t.fonts.body, t.fonts.labels, t.fonts.script].filter((f): f is string => !!f));
    for (const family of families) counts.set(family, (counts.get(family) ?? 0) + 1);
  }
  return counts;
}

/**
 * 🔑 THE OWNER'S TIE ORDER — applied only when BOTH counts are equal.
 * Owner, 2026-10-04, approving "Lora, Libre Baskerville, Crimson Pro first"
 * (DECISION_LOG.md). Not a measurement: a person broke the tie the counts leave.
 */
export const MOST_USED_OWNER_TIE_ORDER: readonly HubFontKey[] = ['lora', 'baskerville', 'crimson'];

function ownerRank(key: HubFontKey): number {
  const i = MOST_USED_OWNER_TIE_ORDER.indexOf(key);
  return i === -1 ? MOST_USED_OWNER_TIE_ORDER.length : i;
}

/**
 * Every offered face with its counts, highest first: slot uses, then how many
 * themes use it, then the owner's tie order, then `HUB_FONTS` order.
 */
export function countHubFontUse(
  themes: readonly Pick<InviteTheme, 'fonts'>[] = HUB_THEMES,
): Array<{ key: HubFontKey; family: string; uses: number; themes: number }> {
  const slots = countThemeFaceSlots(themes);
  const spread = countThemesUsingFace(themes);
  return HUB_FONTS.map((f, i) => ({ key: f.key, family: f.family, uses: slots.get(f.family) ?? 0, themes: spread.get(f.family) ?? 0, i }))
    .sort((a, b) => b.uses - a.uses || b.themes - a.themes || ownerRank(a.key) - ownerRank(b.key) || a.i - b.i)
    .map(({ key, family, uses, themes: n }) => ({ key, family, uses, themes: n }));
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
