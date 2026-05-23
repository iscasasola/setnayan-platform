'use client';

import { useState, useTransition } from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';
import { saveAttireGuidePaletteColor } from '../actions';

/**
 * Wedding Attire Guide preview — owner directive 2026-05-23 PM.
 *
 * Reference: the owner shared a "WEDDING ATTIRE GUIDE — elegant · simple ·
 * classic" illustration showing the full wedding party arranged in a 2-tier
 * group portrait, each role group rendered in their palette-matched
 * attire, with annotated color swatch + descriptor labels beneath each
 * group. Directive verbatim: "i was thinking to have something like this
 * but using AI generated samples and not drawings. and the background
 * will be with ideal look of the venue."
 *
 * V1 reality: the actual AI-rendered output (Higgsfield/Recraft +
 * SAM2 segmentation + Color Range Manipulator) is V1.x engineering
 * scope, ships parallel with the Stylist marketplace launch per
 * CLAUDE.md 2026-05-22 Composite Scene row. Today this component is a
 * CLICKABLE MOCKUP using CSS-styled SVG silhouettes tinted from the
 * host's actual event palette so couples see the V1.x direction now
 * without a fake AI render.
 *
 * Interaction: tap any role group → highlight ring + expanded descriptor
 * pill animates in. Pure React state, no DB writes, no schema. The
 * tints come from the host's existing role palette (passed in from the
 * parent server component) so changes to the palette in the editor
 * above are reflected instantly.
 *
 * What this is NOT: it does NOT render real figures, does NOT pull
 * real venue background photos, does NOT segment via SAM2, does NOT
 * compose layers via Higgsfield. Those are all V1.x. The mockup is
 * deliberately stylized (silhouettes) so couples can't mistake it for
 * the real output and report bugs about figure rendering.
 *
 * Composition mirrors the reference: 2-tier portrait with back row =
 * Principal Sponsors (smaller figures) and front row = couple, parents,
 * wedding party, guests (larger figures). Legend below shows each role's
 * swatch + plain-English descriptor matching the reference's vocabulary
 * (e.g., "Burgundy" / "Navy blue + Burgundy ties" / "Polo or long-sleeve").
 */

type RoleKey =
  | 'female_ps'
  | 'male_ps'
  | 'mothers'
  | 'fathers'
  | 'bridesmaids'
  | 'bride'
  | 'groom'
  | 'groomsmen'
  | 'guests'
  | 'men_guests';

type RoleConfig = {
  key: RoleKey;
  label: string;
  /** Descriptor matching the reference image's vocabulary. */
  descriptor: string;
  /** Default fallback tint when palette key missing. Each role can also be
   *  overridden via the rolePalette prop. */
  defaultHex: string;
  /** Body silhouette shape — 'dress' for A-line skirts, 'suit' for vertical
   *  rectangle, 'barong' for the relaxed jacket cut. */
  shape: 'dress' | 'suit' | 'barong';
  /** How many figures to render in this role group. */
  count: number;
  /** Which row this role appears in. Back row = smaller figures (Principal
   *  Sponsors per the reference); front row = everyone else. */
  row: 'back' | 'front';
};

const ROLES: ReadonlyArray<RoleConfig> = [
  // Back row — Principal Sponsors (smaller figures per the reference)
  {
    key: 'female_ps',
    label: 'Female Principal Sponsors',
    descriptor: 'Light brown / Beige shade',
    defaultHex: '#D4B896',
    shape: 'dress',
    count: 4,
    row: 'back',
  },
  {
    key: 'male_ps',
    label: 'Male Principal Sponsors',
    descriptor: 'Barong / Navy blue suits',
    defaultHex: '#E8D9B8',
    shape: 'barong',
    count: 4,
    row: 'back',
  },
  // Front row — wedding party, parents, couple, guests
  {
    key: 'mothers',
    label: 'Mothers',
    descriptor: 'Light Gray',
    defaultHex: '#C5C8CC',
    shape: 'dress',
    count: 2,
    row: 'front',
  },
  {
    key: 'fathers',
    label: 'Fathers',
    descriptor: 'Barong / Navy blue suit',
    defaultHex: '#2E3F5C',
    shape: 'suit',
    count: 2,
    row: 'front',
  },
  {
    key: 'bridesmaids',
    label: 'Bridesmaids',
    descriptor: 'Burgundy',
    defaultHex: '#7E1F32',
    shape: 'dress',
    count: 3,
    row: 'front',
  },
  {
    key: 'bride',
    label: 'Bride',
    descriptor: 'White',
    defaultHex: '#FAFAFA',
    shape: 'dress',
    count: 1,
    row: 'front',
  },
  {
    key: 'groom',
    label: 'Groom',
    descriptor: 'Beige',
    defaultHex: '#C9A883',
    shape: 'barong',
    count: 1,
    row: 'front',
  },
  {
    key: 'groomsmen',
    label: 'Groomsmen',
    descriptor: 'Navy blue · Burgundy ties',
    defaultHex: '#2E3F5C',
    shape: 'suit',
    count: 3,
    row: 'front',
  },
  {
    key: 'guests',
    label: 'Guest women',
    descriptor: 'Any shades of burgundy',
    defaultHex: '#7E1F32',
    shape: 'dress',
    count: 2,
    row: 'front',
  },
  {
    key: 'men_guests',
    label: 'Guest men',
    descriptor: 'Polo / long-sleeve · earth tones',
    defaultHex: '#B8DCE8',
    shape: 'suit',
    count: 2,
    row: 'front',
  },
];

/**
 * Resolve the tint for a role group with 3-source priority:
 *   1. attirePalette (per-role override from the new
 *      events.attire_guide_palette column · owner directive 2026-05-23 PM)
 *   2. rolePalette (V1 5-key palette via tintFromV1Palette mapping below)
 *   3. role.defaultHex (reference image's baseline color)
 *
 * The attirePalette take precedence because it's the host's explicit
 * per-role choice on this specific surface; rolePalette is the
 * inherited tint from the V1 PaletteEditor above and serves as a
 * sensible default when the host hasn't yet picked an attire color
 * for that role.
 */
function resolveTint(
  role: RoleConfig,
  attirePalette: Record<string, string>,
  rolePalette: Record<string, string>,
): string {
  const override = attirePalette[role.key];
  if (override) return override;
  return tintFromV1Palette(role, rolePalette);
}

/**
 * Resolve the right RoleAsset for a (role, currentStyle) pair with a
 * 4-tier fallback chain matching the AssetsByRoleAndStyle JSDoc:
 *   1. assetsByRoleAndStyle[role][currentStyle]  (exact match · Recraft library)
 *   2. assetsByRoleAndStyle[role]['editorial cream']  (default style fallback)
 *   3. assetsByRoleAndStyle[role][<first populated style>]  (any-style fallback)
 *   4. assetsByRole[role]  (legacy flat map · pre-style-themed Pexels era)
 *   5. undefined → caller renders SVG silhouette (PR #451/#453 polished figures)
 *
 * Default-style fallback uses `editorial cream` because it's the
 * neutral-aesthetic seed Setnayan curates first (per the prompt-spec
 * doc's seed-generation ordering) — the most likely style to be
 * populated when the library is partially seeded.
 */
function resolveAsset(
  roleKey: RoleKey,
  currentStyle: (typeof STYLE_OPTIONS)[number],
  byRoleAndStyle: AssetsByRoleAndStyle | undefined,
  byRole: Partial<Record<RoleKey, RoleAsset>> | undefined,
): RoleAsset | undefined {
  const byStyle = byRoleAndStyle?.[roleKey];
  if (byStyle) {
    // Exact-style match wins.
    const exact = byStyle[currentStyle];
    if (exact) return exact;
    // Default-style fallback — picks the curated baseline aesthetic
    // even if the host's picked style isn't in the library yet.
    const defaultStyle = byStyle['editorial cream'];
    if (defaultStyle) return defaultStyle;
    // Any-style fallback — first populated style key wins.
    const anyStyle = Object.values(byStyle).find(
      (a): a is RoleAsset => Boolean(a),
    );
    if (anyStyle) return anyStyle;
  }
  // Legacy flat-map fallback (pre-Recraft seed era).
  return byRole?.[roleKey];
}

/**
 * Map the V1 mood-board palette keys (bride / groom / wedding_party /
 * principal_sponsors / etc.) to the role keys used in this mockup so
 * the host's actual saved palette tints the figures. Falls back to the
 * role's defaultHex when the palette doesn't have a value for that key.
 *
 * Used as the SECOND priority in resolveTint() above — only fires when
 * the host hasn't picked a specific attire color for this role yet.
 */
function tintFromV1Palette(
  role: RoleConfig,
  rolePalette: Record<string, string>,
): string {
  // wedding_party covers bridesmaids + groomsmen + MoH + best man per the
  // existing role-groups mapping. We use it as the source for those roles.
  const lookup: Partial<Record<RoleKey, string>> = {
    female_ps: rolePalette.principal_sponsors,
    male_ps: rolePalette.principal_sponsors,
    bridesmaids: rolePalette.wedding_party,
    groomsmen: rolePalette.wedding_party,
    bride: rolePalette.bride,
    groom: rolePalette.groom,
    guests: rolePalette.guest,
    men_guests: rolePalette.guest,
  };
  return lookup[role.key] ?? role.defaultHex;
}

/**
 * One real-photo asset for a role — pulled from moodboard_library_assets
 * filtered by asset_type='figure_attire' AND asset_subtype = RoleKey. When
 * absent for a role, the Silhouette falls back to the polished SVG.
 *
 * `sampledHex` is the dominant attire color in the source photo (slot 1 of
 * moodboard_asset_color_ranges). V1 placeholder uses CSS mix-blend overlay
 * for visible recolor feedback regardless of sampledHex; V1.x Color Range
 * Manipulator engine will do region-specific HSL substitution keyed on this
 * value. Sourced from migration 20260611000000 seed (Pexels stock photos).
 */
export type RoleAsset = {
  url: string;
  sampledHex: string;
  label: string;
};

/**
 * Nested asset map shipped by the Recraft V3 5-style × 10-role library
 * (owner directive 2026-05-23 PM third pass · prompt template + workflow
 * spec at 02_Specifications/Wedding_Attire_Guide_AI_Generation.md).
 *
 * Resolution order at render time:
 *   1. assetsByRoleAndStyle[role.key][current_style]  (exact match)
 *   2. assetsByRoleAndStyle[role.key]['editorial cream']  (default style fallback)
 *   3. assetsByRoleAndStyle[role.key][<any populated style>]  (any-style fallback)
 *   4. assetsByRole[role.key]  (legacy flat map — Pexels seed when re-enabled)
 *   5. polished SVG silhouette (Silhouette function below)
 *
 * Keys are the 5 STYLE_OPTIONS strings verbatim — matching the DB
 * style_theme CHECK constraint from migration 20260613000000.
 */
export type AssetsByRoleAndStyle = Partial<
  Record<RoleKey, Partial<Record<(typeof STYLE_OPTIONS)[number], RoleAsset>>>
>;

type Props = {
  /** Event ID — used by the per-role color-picker server-action calls. */
  eventId: string;
  /** Flattened role → primary hex from the host's V1 palette. Same shape
   *  the existing VisualPreviewSection consumes. */
  rolePalette: Record<string, string>;
  /** Host's saved per-role attire colors from events.attire_guide_palette
   *  (migration 20260610010000). Empty {} = use V1 palette + defaults. */
  attirePalette: Record<string, string>;
  /** Legacy flat asset map (pre-style-themed library — Pexels seed era).
   *  Kept for backwards compat; new content should populate
   *  assetsByRoleAndStyle instead. When both are populated for a role,
   *  assetsByRoleAndStyle wins. */
  assetsByRole?: Partial<Record<RoleKey, RoleAsset>>;
  /** 5-style × 10-role nested asset map · Recraft V3 library per the
   *  2026-05-23 PM third-pass owner direction. When the host clicks a
   *  style chip in STYLE_OPTIONS, RoleCluster resolves the asset via
   *  `assetsByRoleAndStyle[role.key][current_style]` and the figure SET
   *  visibly swaps (not just the canvas backdrop + arch decoration). */
  assetsByRoleAndStyle?: AssetsByRoleAndStyle;
};

const STYLE_OPTIONS = [
  'elegant · simple · classic',
  'bridgerton · regal',
  'editorial cream',
  'tropical heritage',
  'modern minimalist',
] as const;

/**
 * Per-style aesthetic theme. Owner feedback 2026-05-23 PM: "also the
 * styles are not changing." The picker previously just toggled local
 * state without changing the visual — UX failure for an interactive
 * chip. This map binds each style to a concrete visual override set:
 * hair color, shoe color, canvas backdrop, decorative arch style.
 *
 * V1.x AI engine will use the active style as part of the Higgsfield
 * prompt (e.g., "bridgerton-regal romantic period setting with rich
 * jewel tones"). Today this map gives couples visible feedback that
 * the picker is real + lets them feel the aesthetic shift the AI
 * engine will eventually render fully.
 */
type StyleTheme = {
  /** Hair tint for ALL figures (single tint across the wedding party). */
  hairTint: string;
  /** Shoe oval tint. */
  shoeTint: string;
  /** CSS background string applied to the canvas. */
  background: string;
  /** CSS box-shadow inset string layered over the background. */
  innerShadow: string;
  /** Arch decoration stroke color (rgba). */
  archStroke: string;
  /** Arch stroke width in SVG units. */
  archStrokeWidth: number;
  /** Which decorative SVG pattern to render at the canvas bottom.
   *  - 'pointed' = gothic chapel arches (default · classic)
   *  - 'romanesque' = rounded full arches (regal)
   *  - 'minimal' = thin horizontal ground line + tick marks (editorial)
   *  - 'natural' = palm fronds + tropical silhouette (heritage)
   *  - 'absent' = no decoration (minimalist)
   */
  archStyle: 'pointed' | 'romanesque' | 'minimal' | 'natural' | 'absent';
  /** Body silhouette stroke opacity 0-1. Higher = more defined edges. */
  bodyStrokeOpacity: number;
};

const STYLE_THEMES: Record<(typeof STYLE_OPTIONS)[number], StyleTheme> = {
  'elegant · simple · classic': {
    hairTint: '#3A2B20',
    shoeTint: '#1F1410',
    background:
      'radial-gradient(ellipse at 50% 40%, #F7ECD4 0%, #EFDCB2 70%, #E5CFA0 100%)',
    innerShadow:
      'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 0 80px rgba(120,80,30,0.08)',
    archStroke: 'rgba(60,40,15,0.18)',
    archStrokeWidth: 1.2,
    archStyle: 'pointed',
    bodyStrokeOpacity: 0.15,
  },
  'bridgerton · regal': {
    hairTint: '#5C3A1C',
    shoeTint: '#4A1A1A',
    background:
      'radial-gradient(ellipse at 50% 40%, #F8E5E5 0%, #ECC9C9 60%, #D4A5A5 100%)',
    innerShadow:
      'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 0 100px rgba(120,40,40,0.12)',
    archStroke: 'rgba(120,60,40,0.28)',
    archStrokeWidth: 1.5,
    archStyle: 'romanesque',
    bodyStrokeOpacity: 0.25,
  },
  'editorial cream': {
    hairTint: '#2A1E15',
    shoeTint: '#C5B89E',
    background:
      'radial-gradient(ellipse at 50% 40%, #FFFBF2 0%, #F8F1E0 70%, #F0E6D0 100%)',
    innerShadow:
      'inset 0 1px 0 rgba(255,255,255,0.6), inset 0 0 60px rgba(200,180,140,0.06)',
    archStroke: 'rgba(120,100,70,0.12)',
    archStrokeWidth: 0.6,
    archStyle: 'minimal',
    bodyStrokeOpacity: 0.08,
  },
  'tropical heritage': {
    hairTint: '#1A1A1A',
    shoeTint: '#6B4A2A',
    background:
      'radial-gradient(ellipse at 50% 35%, #FDD9A8 0%, #F5B870 55%, #E89548 100%)',
    innerShadow:
      'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 0 100px rgba(180,90,30,0.15)',
    archStroke: 'rgba(80,40,15,0.32)',
    archStrokeWidth: 1.4,
    archStyle: 'natural',
    bodyStrokeOpacity: 0.2,
  },
  'modern minimalist': {
    hairTint: '#5C5C5C',
    shoeTint: '#9A9A9A',
    background:
      'radial-gradient(ellipse at 50% 50%, #FAFAFA 0%, #EDEDED 70%, #DCDCDC 100%)',
    innerShadow:
      'inset 0 1px 0 rgba(255,255,255,0.6), inset 0 0 40px rgba(100,100,100,0.05)',
    archStroke: 'rgba(60,60,60,0.15)',
    archStrokeWidth: 0.4,
    archStyle: 'absent',
    bodyStrokeOpacity: 0.1,
  },
};

export function WeddingAttireGuide({
  eventId,
  rolePalette,
  attirePalette,
  assetsByRole,
  assetsByRoleAndStyle,
}: Props) {
  const [activeRole, setActiveRole] = useState<RoleKey | null>(null);
  const [style, setStyle] = useState<(typeof STYLE_OPTIONS)[number]>(
    STYLE_OPTIONS[0],
  );
  // Optimistic local state for the per-role colors. Seeded from the
  // server-saved attirePalette prop; updates immediately on color picker
  // change for instant feedback, then the server action persists in the
  // background. On server failure we roll back to the prop value (TODO
  // V1.1: toast surface for the rollback case; today fail-silently).
  const [localAttire, setLocalAttire] =
    useState<Record<string, string>>(attirePalette);
  const [pending, startTransition] = useTransition();

  const back = ROLES.filter((r) => r.row === 'back');
  const front = ROLES.filter((r) => r.row === 'front');
  // Resolve the active style theme — drives canvas backdrop, arch
  // decoration, hair/shoe tints across all figures. Default to the
  // first STYLE_OPTIONS entry's theme if for any reason `style` is
  // out of sync (safety net for the union narrowing).
  const theme = STYLE_THEMES[style];

  /**
   * Handle a per-role color change from a native <input type="color">.
   * Updates optimistic local state immediately + fires the persistence
   * server action inside a transition so the click doesn't block. The
   * `pending` flag is exposed via aria-busy on the color input wrapper
   * so screen readers know there's an in-flight save.
   */
  function handleColorChange(roleKey: RoleKey, hex: string) {
    const upper = hex.toUpperCase();
    const prev = localAttire[roleKey] ?? null;
    setLocalAttire((curr) => ({ ...curr, [roleKey]: upper }));
    startTransition(async () => {
      try {
        await saveAttireGuidePaletteColor(eventId, roleKey, upper);
      } catch {
        // Roll back the optimistic update if persistence failed. The
        // host sees their color revert; the V1.1 toast pass will
        // surface "couldn't save" copy.
        setLocalAttire((curr) => {
          const next = { ...curr };
          if (prev === null) delete next[roleKey];
          else next[roleKey] = prev;
          return next;
        });
      }
    });
  }

  /**
   * Reset a single role to its default (clears the entry from localAttire
   * so resolveTint falls through to the V1 palette / reference default).
   * Quick affordance for hosts who picked a wrong color and want to start
   * over without launching the color picker.
   */
  function handleResetRole(roleKey: RoleKey) {
    const prev = localAttire[roleKey] ?? null;
    if (prev === null) return; // already on default
    setLocalAttire((curr) => {
      const next = { ...curr };
      delete next[roleKey];
      return next;
    });
    startTransition(async () => {
      try {
        // Server stores the default hex back to the column so the next
        // page load sees an explicit "use default" intent. The component
        // treats explicit defaults the same as missing keys.
        const defaultHex = ROLES.find((r) => r.key === roleKey)?.defaultHex;
        if (defaultHex) {
          await saveAttireGuidePaletteColor(eventId, roleKey, defaultHex);
        }
      } catch {
        if (prev !== null) {
          setLocalAttire((curr) => ({ ...curr, [roleKey]: prev }));
        }
      }
    });
  }

  return (
    <section className="space-y-5 border-t border-ink/10 pt-6">
      <header className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-2xl font-semibold text-ink">Wedding Attire Guide</h2>
          <span className="rounded-full bg-terracotta/15 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta">
            Preview · V1.x
          </span>
        </div>
        <p className="max-w-prose text-sm text-ink/65">
          Click any role&rsquo;s swatch below to change its attire color — your
          picks save automatically and feed into the AI-rendered version when
          Professional Mood Board ships.
          {pending ? (
            <span
              role="status"
              className="ml-2 text-xs italic text-ink/55"
            >
              Saving…
            </span>
          ) : null}
        </p>
      </header>

      {/* Style theme picker — anchor only in V1; the V1.x engine will use
          this string as part of the AI prompt to shape the aesthetic. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
          Style
        </span>
        {STYLE_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setStyle(option)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              style === option
                ? 'bg-ink text-cream'
                : 'border border-ink/15 bg-cream text-ink/70 hover:border-ink/30'
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      {/* Composition canvas — beige backdrop standing in for the venue
          background. Front row larger figures with shadow; back row smaller
          tucked behind. Click a figure cluster to highlight + reveal the
          descriptor pill below. */}
      <div
        className="relative overflow-hidden rounded-2xl border border-ink/10 p-8 pb-16 sm:p-10 sm:pb-20 transition-all duration-500"
        style={{
          background: theme.background,
          boxShadow: theme.innerShadow,
        }}
      >
        {/* Inline marker that this is a preview — small, polite, doesn't
            overshadow the composition. */}
        <p className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-cream/85 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink/55 backdrop-blur-md">
          <Sparkles aria-hidden className="h-3 w-3" strokeWidth={1.75} />
          Stylized preview
        </p>

        {/* Decorative bottom-of-canvas — varies by style theme to feel
            like the right venue archetype. Pointed arches = gothic
            chapel (classic); romanesque = round arches (regal);
            minimal = thin ground tick line (editorial); natural =
            palm fronds + tropical silhouette (heritage); absent =
            empty (minimalist). All pure SVG, low-opacity strokes per
            the theme. Re-rendered on theme change so each style picker
            click swaps the venue feel. */}
        <CanvasArches theme={theme} />

        {/* Back row · Principal Sponsors */}
        <div className="flex flex-wrap items-end justify-center gap-1 sm:gap-2">
          {back.map((role) => (
            <RoleCluster
              key={role.key}
              role={role}
              tint={resolveTint(role, localAttire, rolePalette)}
              isActive={activeRole === role.key}
              onSelect={() =>
                setActiveRole(activeRole === role.key ? null : role.key)
              }
              scale={0.75}
              theme={theme}
              asset={resolveAsset(
                role.key,
                style,
                assetsByRoleAndStyle,
                assetsByRole,
              )}
            />
          ))}
        </div>

        {/* Front row · couple + wedding party + parents + guests */}
        <div className="mt-2 flex flex-wrap items-end justify-center gap-1 sm:gap-1.5">
          {front.map((role) => (
            <RoleCluster
              key={role.key}
              role={role}
              tint={resolveTint(role, localAttire, rolePalette)}
              isActive={activeRole === role.key}
              onSelect={() =>
                setActiveRole(activeRole === role.key ? null : role.key)
              }
              scale={1}
              theme={theme}
              asset={resolveAsset(
                role.key,
                style,
                assetsByRoleAndStyle,
                assetsByRole,
              )}
            />
          ))}
        </div>
      </div>

      {/* Legend — annotated swatch + descriptor per role group. Mirrors
          the reference image's bottom strip. Each swatch is a native
          HTML5 `<input type="color">` so clicking it opens the OS's
          color picker — zero extra deps, zero animation latency, full
          keyboard + screen reader support out of the box. The host's
          pick fires handleColorChange which optimistically updates
          localAttire + persists via the saveAttireGuidePaletteColor
          server action. The reset button (small chevron-back icon)
          clears the role to its V1-palette / reference-image default.
          The active role gets a highlight ring so the tap-to-detail
          loop is obvious. */}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {ROLES.map((role) => {
          const isActive = activeRole === role.key;
          const tint = resolveTint(role, localAttire, rolePalette);
          const isOverridden = !!localAttire[role.key];
          return (
            <li key={role.key}>
              <div
                className={`flex w-full items-start gap-2.5 rounded-lg border bg-cream p-2.5 transition-colors ${
                  isActive
                    ? 'border-terracotta ring-1 ring-terracotta/30'
                    : 'border-ink/10 hover:border-ink/25'
                }`}
              >
                {/* Color picker — native HTML5 input. The wrapping label
                    + sized container makes the visible chip look like the
                    prior static swatch but clicking opens the OS picker. */}
                <label
                  className="relative mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer overflow-hidden rounded-sm ring-1 ring-ink/15 transition-shadow hover:ring-ink/40"
                  style={{ backgroundColor: tint }}
                  aria-label={`Change attire color for ${role.label}`}
                  aria-busy={pending}
                >
                  <input
                    type="color"
                    value={tint}
                    onChange={(e) =>
                      handleColorChange(role.key, e.currentTarget.value)
                    }
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setActiveRole(activeRole === role.key ? null : role.key)
                  }
                  className="min-w-0 flex-1 space-y-0.5 text-left"
                >
                  <span className="block text-xs font-medium text-ink">
                    {role.label}
                  </span>
                  <span className="block text-[11px] text-ink/55">
                    {role.descriptor}
                  </span>
                </button>
                {/* Reset chip — only renders when the host has actually
                    overridden the default. Click reverts to V1 palette /
                    reference default and persists the revert. */}
                {isOverridden ? (
                  <button
                    type="button"
                    onClick={() => handleResetRole(role.key)}
                    aria-label={`Reset ${role.label} to default color`}
                    className="flex-shrink-0 rounded p-1 text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink/70"
                  >
                    <RotateCcw aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Footer · V1.x positioning */}
      <p className="rounded-md border border-ink/10 bg-cream/60 px-4 py-3 text-xs text-ink/60">
        Real AI-generated figures composed against your venue&rsquo;s background
        ship with Professional Mood Board (V1.x · ships parallel with the
        Stylist marketplace). Pick a Style above to anchor the aesthetic now —
        Setnayan saves it and applies it when the engine launches.
      </p>
    </section>
  );
}

/**
 * One role group cluster — N stacked SVG silhouette figures with the
 * role's tint applied. Pure presentation; click bubbles up to the
 * parent's setActiveRole.
 */
function RoleCluster({
  role,
  tint,
  isActive,
  onSelect,
  scale,
  theme,
  asset,
}: {
  role: RoleConfig;
  tint: string;
  isActive: boolean;
  onSelect: () => void;
  scale: number;
  /** Style theme drives hair tint + shoe tint + body stroke opacity on
   *  each Silhouette rendered inside this cluster. */
  theme: StyleTheme;
  /** Optional real-photo asset for this role. When present, renders ONE
   *  photo (with a small "× N" count badge for role.count > 1) instead
   *  of N stacked SVG silhouettes — same-photo-× N would Warhol-effect
   *  the visual. When absent, renders the existing N-silhouette stack. */
  asset?: RoleAsset;
}) {
  // Bride figure gets a slight emphasis (taller dress, more bouquet detail
  // hinted) — matches the reference where the bride is the visual anchor.
  const isBride = role.key === 'bride';

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${role.label} — ${role.descriptor}`}
      aria-pressed={isActive}
      className={`group relative flex flex-col items-center gap-0.5 rounded-md px-1.5 py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40 ${
        isActive ? 'bg-cream/85 ring-1 ring-terracotta/40' : 'hover:bg-cream/40'
      }`}
    >
      <div className="flex items-end gap-0.5">
        {asset ? (
          // Photo mode: ONE photo per role with a count badge when role.count > 1.
          // Multiple copies of the same Pexels photo look like a Warhol print;
          // a single photo + "× N" badge communicates the count cleanly. The
          // photo width scales to roughly match what role.count silhouettes
          // would have occupied so the row layout still feels balanced.
          <PhotoFigure
            asset={asset}
            tint={tint}
            scale={isBride ? scale * 1.05 : scale}
            count={role.count}
            highlighted={isActive}
            bodyStrokeOpacity={theme.bodyStrokeOpacity}
          />
        ) : (
          Array.from({ length: role.count }).map((_, i) => (
            <Silhouette
              key={i}
              shape={role.shape}
              tint={tint}
              scale={isBride ? scale * 1.05 : scale}
              highlighted={isActive}
              theme={theme}
            />
          ))
        )}
      </div>
      {isActive ? (
        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-2 py-0.5 text-[10px] font-medium text-cream shadow-sm">
          {role.label}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Photo-mode figure renderer — used when the host has a real Pexels/stock
 * photo for the role via moodboard_library_assets. Renders the photo at a
 * size proportional to the silhouette equivalent + applies a CSS overlay
 * for visible recolor feedback when the host picks a tint.
 *
 * Recolor approach (V1):
 *   - Photo loads as-is via plain <img> (Pexels CDN, no next/image to
 *     avoid the next.config.ts allowlist for placeholder content)
 *   - Absolutely-positioned overlay div with `background: tint` +
 *     `mix-blend-mode: multiply` + opacity 0.55 — multiplies the photo
 *     pixels by the tint, so white/light areas (dress fabric) take the
 *     tint while darker areas (skin, hair, shadows) keep their natural
 *     value. Imperfect (skin gets a slight color cast) but unmistakable
 *     visual feedback that picking a color does something.
 *
 * V1.x Color Range Manipulator engine swaps to proper region-specific
 * canvas-based HSL substitution keyed on asset.sampledHex per the
 * 2026-05-21 lock. Today's CSS overlay is the V1-placeholder honest path.
 *
 * Width math: a base silhouette is 28×92 SVG units rendered at `scale`
 * pixels-per-unit. A single photo for the role takes the visual budget
 * of `role.count` silhouettes — roughly 28 × count × scale wide. We cap
 * the photo aspect ratio at ~9:16 (vertical figure) so it doesn't
 * stretch sideways for high-count roles.
 */
function PhotoFigure({
  asset,
  tint,
  scale,
  count,
  highlighted,
  bodyStrokeOpacity,
}: {
  asset: RoleAsset;
  tint: string;
  scale: number;
  count: number;
  highlighted: boolean;
  bodyStrokeOpacity: number;
}) {
  // Width budget: roughly the width count silhouettes would occupy, capped
  // at ~9:16 portrait aspect so high-count roles (Principal Sponsors × 4)
  // don't go wider than they go tall.
  const heightPx = 92 * scale;
  const widthCap = heightPx * (9 / 16);
  const widthFromCount = 28 * scale * Math.min(count, 4);
  const widthPx = Math.min(widthFromCount, widthCap);

  return (
    <div
      className={`relative overflow-hidden rounded-md ring-1 ring-ink/20 ${
        highlighted
          ? 'drop-shadow-[0_4px_8px_rgba(80,40,10,0.25)]'
          : 'drop-shadow-[0_2px_4px_rgba(80,40,10,0.12)]'
      }`}
      style={{
        width: widthPx,
        height: heightPx,
        // Use the theme's bodyStrokeOpacity to drive a subtle outer ring
        // hue — keeps the photo visually consistent with the SVG figures'
        // stroke definition on the same canvas.
        boxShadow: `inset 0 0 0 0.5px rgba(0,0,0,${bodyStrokeOpacity * 0.7})`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset.url}
        alt={asset.label}
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
      {/* Tint overlay — the V1 recolor feedback. mix-blend-mode: multiply
          tints fabric without flattening features completely. Opacity 0.55
          balances "color picker doing something" against "photo still
          readable." V1.x Color Range Manipulator swaps to region-tagged
          canvas substitution per asset.sampledHex. */}
      <div
        aria-hidden
        className="absolute inset-0 mix-blend-multiply transition-opacity duration-300"
        style={{ backgroundColor: tint, opacity: 0.55 }}
      />
      {/* Count badge — communicates role.count without rendering N copies
          of the same photo. Only renders when count > 1 (Bride/Groom = 1
          each, so badge would just say "× 1" needlessly). */}
      {count > 1 ? (
        <span className="absolute right-1 top-1 rounded-full bg-ink/85 px-1.5 py-0.5 text-[9px] font-semibold text-cream shadow-sm">
          × {count}
        </span>
      ) : null}
    </div>
  );
}

/**
 * One stylized figure silhouette. Significantly polished after owner
 * feedback 2026-05-23 PM ("feels like a cheap look like a 2 yr old
 * drew it"). The prior crude head-circle + triangle-body has been
 * replaced with a layered figure built from:
 *
 *   1. Ground shadow ellipse beneath the feet — gives the figure
 *      weight and grounding in the venue scene
 *   2. Hair path BEHIND the head — long flowing shape for dress
 *      attire (women); short cropped shape for suit/barong (men).
 *      Single dark hair tint #3A2B20 (V1.1+ candidate: per-role hair
 *      color variation)
 *   3. Skin-tone head circle — larger radius (6 vs prior 5) for
 *      better proportions
 *   4. Body path with smooth bezier curves — fitted bodice on dress,
 *      jacket+trousers silhouette on suit (with hinted leg split at
 *      hem), loose vertical on barong. Each path has a subtle dark
 *      stroke for definition
 *   5. Attire detail overlays — neckline V on dress (light highlight),
 *      lapel V + thin tie on suit (dark accents), embroidery dashed
 *      line down center on barong
 *   6. Two small shoe ovals at the foot — anchors the figure visually
 *
 * Shape variants:
 *   - 'dress' = fitted-bodice A-line skirt (women)
 *   - 'suit' = jacket + trousers with hinted leg split (men)
 *   - 'barong' = loose traditional Filipino shirt over trousers
 *
 * All paths use viewBox 0 0 28 92 for elegant tall proportions (the
 * prior 24 60 viewBox produced squat figures that read as cartoonish).
 *
 * Pure SVG, no external dependencies. Per-role tint applied to the
 * body path via the `tint` prop. Same composition + scale + highlight
 * model as before — only the figure rendering is upgraded.
 */
function Silhouette({
  shape,
  tint,
  scale,
  highlighted,
  theme,
}: {
  shape: 'dress' | 'suit' | 'barong';
  tint: string;
  scale: number;
  highlighted: boolean;
  /** Active style theme — drives hair tint + shoe tint + body stroke
   *  opacity. Owner directive 2026-05-23 PM: style picker must change
   *  the visual. Each STYLE_THEMES entry binds these three properties
   *  so each style picker click visibly shifts every figure. */
  theme: StyleTheme;
}) {
  // Base dimensions — viewBox 0 0 28 92 for elegant tall proportions.
  // Back row uses scale=0.75 to appear tucked behind the front.
  const width = 28 * scale;
  const height = 92 * scale;
  const skinTint = '#E8C9A8';
  // Hair + shoe tints come from the active style theme, not hardcoded.
  // Lets the bridgerton-regal style ship auburn hair + oxblood shoes;
  // tropical heritage ship rich black hair + tan shoes; etc.
  const hairTint = theme.hairTint;
  const shoeTint = theme.shoeTint;

  // Hair shape: long flowing behind head for dress (women's roles);
  // short cropped on top for suit / barong (men's roles).
  const hairPath =
    shape === 'dress'
      ? // Long flowing — wraps around head + falls past shoulders
        'M 6 10 Q 6 4 14 4 Q 22 4 22 10 L 22 22 Q 22 25 19 24 Q 14 26 9 24 Q 6 25 6 22 Z'
      : // Short cropped — sits on top of head
        'M 9 6 Q 9 4 14 4 Q 19 4 19 6 L 19 10 Q 14 12 9 10 Z';

  // Body path with smooth bezier curves per attire type. All coordinates
  // assume viewBox 0 0 28 92. Hem is around y=84 leaving room for shoes
  // + ground shadow below.
  const bodyPath: Record<typeof shape, string> = {
    dress:
      // Fitted bodice (narrows at waist) → flares to A-line skirt at hem
      'M 10 19 Q 9 19 9 20 L 9 32 Q 9 34 10 35 L 5 84 Q 5 85 6 85 L 22 85 Q 23 85 23 84 L 18 35 Q 19 34 19 32 L 19 20 Q 19 19 18 19 Z',
    suit:
      // Jacket → trousers with hinted leg split at the hem
      'M 9 19 Q 8 19 8 20 L 8 56 L 7 84 Q 7 85 8 85 L 13 85 Q 14 85 14 84 L 14 56 L 14 84 Q 14 85 15 85 L 20 85 Q 21 85 21 84 L 20 56 L 20 20 Q 20 19 19 19 Z',
    barong:
      // Loose vertical with subtle bell at the hem
      'M 8 19 Q 7 19 7 20 L 6 60 L 5 84 Q 5 85 6 85 L 13 85 Q 14 85 14 84 L 14 60 L 14 84 Q 14 85 15 85 L 22 85 Q 23 85 23 84 L 22 60 L 21 20 Q 21 19 20 19 Z',
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 28 92"
      className={
        highlighted
          ? 'drop-shadow-[0_4px_8px_rgba(80,40,10,0.25)]'
          : 'drop-shadow-[0_2px_4px_rgba(80,40,10,0.12)]'
      }
      aria-hidden
    >
      {/* Ground shadow — soft ellipse beneath the figure */}
      <ellipse cx="14" cy="88" rx="11" ry="2" fill="rgba(0,0,0,0.12)" />

      {/* Hair behind head — paints first so the head circle sits on top */}
      <path d={hairPath} fill={hairTint} />

      {/* Head — skin-tone circle with subtle inner shadow */}
      <circle cx="14" cy="11" r="6" fill={skinTint} />
      <circle cx="14" cy="11" r="6" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="0.3" />

      {/* Neck — thin skin-tone rectangle bridging head to shoulders */}
      <rect x="12" y="16" width="4" height="4" fill={skinTint} />

      {/* Body — tinted with role's attire color + subtle dark stroke for
          definition */}
      <path
        d={bodyPath[shape]}
        fill={tint}
        stroke={`rgba(0,0,0,${theme.bodyStrokeOpacity})`}
        strokeWidth="0.35"
      />

      {/* Per-attire detail overlay — gives each role a visual signature
          beyond just color. Light overlays on dress show a neckline V;
          suit shows a lapel V + tie; barong shows a center embroidery
          dashed line. All low-opacity so they don't overwhelm. */}
      {shape === 'dress' ? (
        <path
          d="M 11 19 L 14 24 L 17 19"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth="0.5"
          fill="none"
        />
      ) : null}
      {shape === 'suit' ? (
        <>
          {/* Lapel V */}
          <path
            d="M 10 19 L 14 31 L 18 19"
            stroke="rgba(0,0,0,0.3)"
            strokeWidth="0.45"
            fill="none"
          />
          {/* Tie — thin vertical accent */}
          <rect
            x="13.4"
            y="23"
            width="1.2"
            height="14"
            fill="rgba(0,0,0,0.4)"
            rx="0.3"
          />
        </>
      ) : null}
      {shape === 'barong' ? (
        // Embroidery hint — dashed vertical line down center
        <path
          d="M 14 23 L 14 44"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="0.7"
          fill="none"
          strokeDasharray="1.5,2"
        />
      ) : null}

      {/* Shoes — small dark ovals at the figure base */}
      <ellipse cx="10" cy="86" rx="3" ry="1.5" fill={shoeTint} />
      <ellipse cx="18" cy="86" rx="3" ry="1.5" fill={shoeTint} />
    </svg>
  );
}

/**
 * Decorative venue silhouette at the bottom of the canvas. Owner
 * directive 2026-05-23 PM: style picker must visibly change the
 * aesthetic. The CanvasArches component reads `theme.archStyle` and
 * renders the matching venue-archetype SVG:
 *
 *   - 'pointed'    = gothic chapel arches (classic style · 3 pointed)
 *   - 'romanesque' = rounded full arches (regal style · 3 rounded)
 *   - 'minimal'    = thin ground tick line + tiny seams (editorial)
 *   - 'natural'    = palm fronds + tropical canopy (heritage)
 *   - 'absent'     = empty (modern minimalist · no decoration)
 *
 * All variants use the theme's archStroke + archStrokeWidth for the
 * line color/thickness. The figure rows render OVER this SVG (DOM
 * order = paint order) so the venue silhouette sits behind the
 * wedding party.
 */
function CanvasArches({ theme }: { theme: StyleTheme }) {
  if (theme.archStyle === 'absent') return null;

  const stroke = theme.archStroke;
  const sw = theme.archStrokeWidth;

  return (
    <svg
      className="pointer-events-none absolute inset-x-0 bottom-0 h-16 w-full transition-opacity duration-500"
      viewBox="0 0 1200 80"
      preserveAspectRatio="none"
      aria-hidden
    >
      {/* Ground line — always present except for 'absent' */}
      <line
        x1="0"
        y1="75"
        x2="1200"
        y2="75"
        stroke={stroke}
        strokeWidth={Math.max(0.6, sw * 0.75)}
      />

      {theme.archStyle === 'pointed' ? (
        // Classic gothic chapel — pointed arch profile
        <>
          <path
            d="M 100 75 L 100 50 Q 100 20 150 20 Q 200 20 200 50 L 200 75"
            stroke={stroke}
            strokeWidth={sw}
            fill="none"
          />
          <path
            d="M 550 75 L 550 35 Q 550 5 600 5 Q 650 5 650 35 L 650 75"
            stroke={stroke}
            strokeWidth={sw}
            fill="none"
          />
          <path
            d="M 1000 75 L 1000 50 Q 1000 20 1050 20 Q 1100 20 1100 50 L 1100 75"
            stroke={stroke}
            strokeWidth={sw}
            fill="none"
          />
        </>
      ) : null}

      {theme.archStyle === 'romanesque' ? (
        // Bridgerton regal — rounded full-arch profile
        <>
          <path
            d="M 100 75 L 100 45 A 50 25 0 0 1 200 45 L 200 75"
            stroke={stroke}
            strokeWidth={sw}
            fill="none"
          />
          <path
            d="M 525 75 L 525 30 A 75 30 0 0 1 675 30 L 675 75"
            stroke={stroke}
            strokeWidth={sw}
            fill="none"
          />
          <path
            d="M 1000 75 L 1000 45 A 50 25 0 0 1 1100 45 L 1100 75"
            stroke={stroke}
            strokeWidth={sw}
            fill="none"
          />
        </>
      ) : null}

      {theme.archStyle === 'minimal' ? (
        // Editorial cream — just a few thin tick marks on the ground line
        <>
          {[100, 300, 500, 700, 900, 1100].map((x) => (
            <line
              key={x}
              x1={x}
              y1="70"
              x2={x}
              y2="75"
              stroke={stroke}
              strokeWidth={sw}
            />
          ))}
        </>
      ) : null}

      {theme.archStyle === 'natural' ? (
        // Tropical heritage — palm-frond silhouettes + sun arc
        <>
          {/* Sun arc on the right */}
          <path
            d="M 950 75 A 80 80 0 0 1 1110 75"
            stroke={stroke}
            strokeWidth={sw * 0.7}
            fill="none"
          />
          {/* Palm fronds left + center */}
          <g stroke={stroke} strokeWidth={sw} fill="none">
            {/* Left palm */}
            <path d="M 140 75 L 140 35" />
            <path d="M 140 50 Q 110 40 80 50" />
            <path d="M 140 45 Q 170 30 200 40" />
            <path d="M 140 38 Q 115 25 90 28" />
            <path d="M 140 38 Q 165 22 195 26" />
            {/* Center palm */}
            <path d="M 600 75 L 600 30" />
            <path d="M 600 45 Q 560 32 520 42" />
            <path d="M 600 40 Q 640 28 685 38" />
            <path d="M 600 33 Q 570 18 540 22" />
            <path d="M 600 33 Q 635 18 665 22" />
          </g>
        </>
      ) : null}
    </svg>
  );
}
