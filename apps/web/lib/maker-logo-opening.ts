import { resolveMonogram } from './monogram';
import { safeMonogramSvg } from './monogram-svg-safe';
import { sanitizeStudioConfig, type StudioConfig } from './monogram-studio-shared';
import { isLayeredLogo, type LogoLayerMeta } from './logo-layers';

/**
 * WHAT THE MAKER'S LOGO PAGE OPENS ON — the couple's own logo and names, never
 * a sample (owner 2026-09-27: *"each editor of each event will adapt to their
 * event"*).
 *
 * The Logo page is a stack of layers (`lib/logo-layers.ts`). It opens on:
 *
 *   · `layers` — a logo made here before: its layers, their shapes read back
 *     from the saved file;
 *   · `mark`   — a logo made anywhere else (the Monogram Maker's studio): that
 *     mark as ONE image layer, as it is, so nothing the couple had is lost;
 *   · `upload` — their uploaded logo, the same way, when no mark was designed;
 *   · `names`  — nothing yet: one Text layer holding the couple's OWN initials
 *     (`resolveMonogram`: the chosen monogram text, else derived from
 *     `display_name`; "S" only for an event with no name at all).
 *
 * A studio config beside no composition (an upload's leftover reveal settings,
 * `text: ""`) is NOT a design — the leak that drew "M & J" over the owner's logo.
 *
 * Opening writes nothing: the Logo page's save gate waits for a real touch
 * (`lib/maker-logo-save-gate.ts`). Pure, so `lib/the-logo-is-layers.test.ts`
 * can hold it.
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
  source: 'layers' | 'mark' | 'upload' | 'names';
  /** The saved layers' metadata (`layers` only). */
  layers: LogoLayerMeta[];
  /** The file the shapes are read from (`layers` · `mark` · `upload`). */
  svg: string | null;
  /** The couple's initials. */
  names: string;
  /** The studio's reveal settings, kept as they are when the logo is saved. */
  anim: StudioConfig['anim'] | null;
};

export function makerLogoOpening(row: MakerLogoRow): MakerLogoOpening {
  const custom = safeMonogramSvg(row.monogram_custom_svg);
  const uploaded = safeMonogramSvg(row.monogram_uploaded_svg);
  const cfg = custom ? sanitizeStudioConfig(row.monogram_studio_config) : null;
  const names = resolveMonogram(row).text;
  const anim = cfg?.anim ?? null;
  if (custom && cfg?.layers?.length && isLayeredLogo(custom)) {
    return { source: 'layers', layers: cfg.layers, svg: custom, names, anim };
  }
  if (custom) return { source: 'mark', layers: [], svg: custom, names, anim };
  if (uploaded) return { source: 'upload', layers: [], svg: uploaded, names, anim: null };
  return { source: 'names', layers: [], svg: null, names, anim: null };
}
