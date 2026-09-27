import { resolveMonogram } from './monogram';
import { safeMonogramSvg } from './monogram-svg-safe';
import { sanitizeStudioConfig, type StudioConfig } from './monogram-studio-shared';

/**
 * WHAT THE MAKER'S LOGO PAGE OPENS ON — the couple's own logo and names, never
 * a sample (owner 2026-09-27, measured on his own event).
 *
 * His event's mark was an uploaded logo. Beside it sat a studio config holding
 * only reveal settings and `text: ""` — an upload saves its animation there. The
 * page took that config for a DESIGN, reopened it, the studio read the empty
 * names as "no names" and drew its sample "M & J" — and then autosaved it.
 *
 *   · A studio config counts as a design ONLY beside a composition
 *     (`monogram_custom_svg`) — the Monogram Maker page's own `hasStudio` rule.
 *   · An uploaded logo with no composition IS the couple's mark: the page shows
 *     it as it is ("Upload a different one" / "Design one instead").
 *   · The names are the couple's own initials (`resolveMonogram`: the chosen
 *     monogram text, else derived from `display_name`; "S" only for an event
 *     with no name at all).
 *
 * Pure, so `lib/the-logo-never-saves-on-open.test.ts` can hold it.
 */
export type MakerLogoRow = {
  display_name: string | null;
  monogram_text: string | null;
  monogram_color: string | null;
  monogram_custom_svg: string | null;
  monogram_studio_config: unknown;
  monogram_uploaded_svg: string | null;
};

export type MakerLogoOpening = {
  /** The re-editable design to reopen, or null to start fresh from `names`. */
  config: StudioConfig | null;
  /** The couple's initials — the studio's Names box. */
  names: string;
  /** The uploaded logo (sanitised) to show as it is, or null. */
  uploadedSvg: string | null;
};

export function makerLogoOpening(row: MakerLogoRow): MakerLogoOpening {
  const hasComposition = typeof row.monogram_custom_svg === 'string' && row.monogram_custom_svg.length > 0;
  const uploaded = safeMonogramSvg(row.monogram_uploaded_svg);
  return {
    config: hasComposition ? sanitizeStudioConfig(row.monogram_studio_config) : null,
    names: resolveMonogram(row).text,
    uploadedSvg: uploaded && !hasComposition ? uploaded : null,
  };
}
