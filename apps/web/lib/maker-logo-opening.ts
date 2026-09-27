import { resolveMonogram } from './monogram';
import { resolveEventMonogramSvg } from './monogram-svg-safe';
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
 * The mark is read through `resolveEventMonogramSvg` — the ONE resolver every
 * surface uses (composition first, then the upload, with its ink policy) — so
 * the editor opens on exactly the mark guests see.
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
  const mark = resolveEventMonogramSvg(row);
  const names = resolveMonogram(row).text;
  if (!mark) return { source: 'names', layers: [], svg: null, names, anim: null };
  // A composition exists (the resolver drew it, not the upload) → its config is
  // the design's; with none, the config is an upload's leftovers.
  const composed = typeof row.monogram_custom_svg === 'string' && row.monogram_custom_svg.length > 0;
  const cfg = composed ? sanitizeStudioConfig(row.monogram_studio_config) : null;
  const anim = cfg?.anim ?? null;
  if (cfg?.layers?.length && isLayeredLogo(mark)) return { source: 'layers', layers: cfg.layers, svg: mark, names, anim };
  return { source: composed ? 'mark' : 'upload', layers: [], svg: mark, names, anim };
}
