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

type Props = {
  /** Event ID — used by the per-role color-picker server-action calls. */
  eventId: string;
  /** Flattened role → primary hex from the host's V1 palette. Same shape
   *  the existing VisualPreviewSection consumes. */
  rolePalette: Record<string, string>;
  /** Host's saved per-role attire colors from events.attire_guide_palette
   *  (migration 20260610010000). Empty {} = use V1 palette + defaults. */
  attirePalette: Record<string, string>;
};

const STYLE_OPTIONS = [
  'elegant · simple · classic',
  'bridgerton · regal',
  'editorial cream',
  'tropical heritage',
  'modern minimalist',
] as const;

export function WeddingAttireGuide({
  eventId,
  rolePalette,
  attirePalette,
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
      <div className="relative overflow-hidden rounded-xl border border-ink/10 bg-[#F2E8D8] p-6 sm:p-8">
        {/* Inline marker that this is a preview — small, polite, doesn't
            overshadow the composition. */}
        <p className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-cream/85 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink/55 backdrop-blur-md">
          <Sparkles aria-hidden className="h-3 w-3" strokeWidth={1.75} />
          Stylized preview
        </p>

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
}: {
  role: RoleConfig;
  tint: string;
  isActive: boolean;
  onSelect: () => void;
  scale: number;
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
        {Array.from({ length: role.count }).map((_, i) => (
          <Silhouette
            key={i}
            shape={role.shape}
            tint={tint}
            scale={isBride ? scale * 1.05 : scale}
            highlighted={isActive}
          />
        ))}
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
 * One stylized figure silhouette. SVG with a head circle + body shape
 * tinted with the role's palette color. Shape varies by attire type:
 *   - 'dress': A-line skirt (trapezoid widening at the hem)
 *   - 'suit': vertical tapered rectangle
 *   - 'barong': vertical rectangle with relaxed open hem (no taper)
 */
function Silhouette({
  shape,
  tint,
  scale,
  highlighted,
}: {
  shape: 'dress' | 'suit' | 'barong';
  tint: string;
  scale: number;
  highlighted: boolean;
}) {
  // Base dimensions tuned for the front row; back row uses scale=0.75 to
  // appear tucked behind the front.
  const width = 24 * scale;
  const height = 60 * scale;
  const headR = 5 * scale;
  const skinTint = '#E8C9A8';

  // Body path varies by shape. All start at the shoulders (top) and end
  // at the hem (bottom) — coordinates assume viewBox 0 0 24 60.
  const bodyPath: Record<typeof shape, string> = {
    dress:
      // A-line skirt: narrow at top, widening at hem
      'M 7 16 L 17 16 L 22 60 L 2 60 Z',
    suit:
      // Vertical tapered rectangle (suit jacket + trousers silhouette)
      'M 6 16 L 18 16 L 19 60 L 5 60 Z',
    barong:
      // Relaxed vertical (loose barong cut)
      'M 5 16 L 19 16 L 19 60 L 5 60 Z',
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 60"
      className={highlighted ? 'drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)]' : ''}
      aria-hidden
    >
      {/* Head — skin tone, simple circle */}
      <circle cx="12" cy={headR + 2} r={headR} fill={skinTint} />
      {/* Body — tinted with role's palette color */}
      <path d={bodyPath[shape]} fill={tint} stroke="#0006" strokeWidth="0.3" />
    </svg>
  );
}
