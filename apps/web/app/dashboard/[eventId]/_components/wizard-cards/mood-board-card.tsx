'use client';

/**
 * WAVE 2 · Card 09 Set Mood Board · inline palette picker.
 *
 * Iteration 0016 · CLAUDE.md Sixth 2026-05-23 row (V1 SCOPE EXPANSION).
 * Hard constraint per the wave brief: NO LINK to /add-ons/mood-board.
 * Hosts pick a palette INLINE inside the wizard card · 12 curated
 * PH-wedding palettes in a 2×6 grid + a "Custom palette" mode that
 * exposes 6 native color inputs.
 *
 * Pattern per data_input cards (Card 01 Set Wedding Date / Card 06
 * Prenup): client component owns its own local state, posts via
 * useTransition + FormData to completeMoodBoardTask. Server action does
 * defense-in-depth validation, writes events.role_palette.reception +
 * events.palette_finalized_at + events.mood_board_updated_at, and
 * stamps wizard_state.mood_board.completed_at.
 *
 * The 12 curated palettes are not arbitrary — they're picked from the
 * PH-wedding visual canon (Bridgerton burgundy · Bohemian sage · Capiz
 * garden · Tagaytay cream · etc.) so the host who doesn't have a
 * stylist yet gets a tasteful starting point that maps to the
 * 0010 Moodboard palette families. The first color in each palette is
 * the dominant; the rest are supporting + accents.
 *
 * Save advances the wizard past Card 09 to Card 10 Lights & Sound
 * (next vendor-pick task per the canonical 38-task sequence).
 */

import { useMemo, useState, useTransition } from 'react';
import { CheckCircle2, Palette as PaletteIcon } from 'lucide-react';
import { completeMoodBoardTask } from '../../wizard-actions';

type Props = {
  eventId: string;
  /** Pre-populate from events.role_palette.reception when set · lets
   *  hosts re-edit if they opened the full /add-ons/mood-board surface
   *  first and want to round-trip through the wizard. */
  initialPalette: string[] | null;
};

type CuratedPalette = {
  id: string;
  name: string;
  hint: string;
  /** 3-6 hex colors · dominant first. */
  colors: string[];
};

/**
 * 12 PH-wedding-canon palettes. First color = dominant · last 1-2 = accents.
 * Names + hints in brand-voice editorial Filipino register — no engineering
 * jargon, no exclamation marks, descriptive not promotional.
 */
const CURATED_PALETTES: ReadonlyArray<CuratedPalette> = [
  {
    id: 'bridgerton_burgundy',
    name: 'Bridgerton burgundy',
    hint: 'Deep wine, dusty rose, cream',
    colors: ['#7A1F2B', '#C29A9A', '#E8C8C0', '#FAF6F0', '#4F1019'],
  },
  {
    id: 'bohemian_sage',
    name: 'Bohemian sage',
    hint: 'Sage, terracotta, oat',
    colors: ['#8FA68E', '#C97B4B', '#D9C2A3', '#F5F0E8', '#5C7060'],
  },
  {
    id: 'capiz_garden',
    name: 'Capiz garden',
    hint: 'Pearl ivory, soft moss, blush',
    colors: ['#F5EBDC', '#A8B89B', '#E8C9C0', '#D4A574', '#3D4A38'],
  },
  {
    id: 'tagaytay_cream',
    name: 'Tagaytay cream',
    hint: 'Cream, fog grey, eucalyptus',
    colors: ['#FAF6F0', '#B8B5AC', '#9DAA9C', '#D9C9B0', '#5C5044'],
  },
  {
    id: 'modern_minimalist',
    name: 'Modern minimalist',
    hint: 'Ink, bone, soft terracotta',
    colors: ['#1A1A1A', '#F0EBE0', '#C97B4B', '#8C8378', '#FAF6F0'],
  },
  {
    id: 'tropical_heritage',
    name: 'Tropical heritage',
    hint: 'Banana leaf, mango, abaca',
    colors: ['#4A6B47', '#E8A547', '#D9C2A3', '#FAF6F0', '#2D4A3A'],
  },
  {
    id: 'filipiniana_terno',
    name: 'Filipiniana terno',
    hint: 'Maria Clara cream, sampaguita gold, ink',
    colors: ['#F5EBDC', '#D4A574', '#8C6D3F', '#1A1A1A', '#FAF6F0'],
  },
  {
    id: 'cebu_coast',
    name: 'Cebu coast',
    hint: 'Sand, sea glass, coral',
    colors: ['#E8DCC0', '#A8C0B8', '#E8A89A', '#FAF6F0', '#6B7F78'],
  },
  {
    id: 'sunset_pinks',
    name: 'Sunset pinks',
    hint: 'Blush, peach, dusty rose',
    colors: ['#F5D5C5', '#E8B098', '#D9A0A8', '#FAEDE5', '#B07868'],
  },
  {
    id: 'monochrome_classic',
    name: 'Monochrome classic',
    hint: 'Ivory, charcoal, gold',
    colors: ['#F5EFE5', '#1A1A1A', '#C9A66B', '#8C8378', '#FAF6F0'],
  },
  {
    id: 'lush_emerald',
    name: 'Lush emerald',
    hint: 'Emerald, gold, ivory',
    colors: ['#2D5A4A', '#C9A66B', '#F5EFE5', '#1F4038', '#E8DCC0'],
  },
  {
    id: 'royal_navy',
    name: 'Royal navy',
    hint: 'Navy, ivory, brass',
    colors: ['#1F2B47', '#F5EFE5', '#C9A66B', '#3D4A6B', '#D4C29A'],
  },
];

/** Default palette when the host has no prior pick · matches Bridgerton
 *  burgundy as the brand-anchor palette per CLAUDE.md theme system. */
const DEFAULT_PALETTE_ID = 'bridgerton_burgundy';
const DEFAULT_COLORS = CURATED_PALETTES[0]?.colors ?? [
  '#7A1F2B',
  '#C29A9A',
  '#E8C8C0',
  '#FAF6F0',
  '#4F1019',
];

/** Pad/truncate a color list to a 6-slot grid for the custom-mode UI.
 *  Defaults missing slots to cream so the picker always shows 6 squares. */
function pad6(colors: string[]): string[] {
  const out = [...colors];
  while (out.length < 6) out.push('#FAF6F0');
  return out.slice(0, 6);
}

export function MoodBoardCard({ eventId, initialPalette }: Props) {
  // Pick initial mode based on whether the prior palette matches one of
  // the curated picks. Hosts who picked custom should land back in
  // custom mode on re-edit.
  const initialMatchId = useMemo(() => {
    if (!initialPalette || initialPalette.length === 0) return DEFAULT_PALETTE_ID;
    const matchedById = CURATED_PALETTES.find(
      (p) =>
        p.colors.length === initialPalette.length &&
        p.colors.every(
          (c, i) => c.toUpperCase() === (initialPalette[i] ?? '').toUpperCase(),
        ),
    );
    return matchedById?.id ?? 'custom';
  }, [initialPalette]);

  const [mode, setMode] = useState<'curated' | 'custom'>(
    initialMatchId === 'custom' ? 'custom' : 'curated',
  );
  const [selectedId, setSelectedId] = useState<string>(
    initialMatchId === 'custom' ? DEFAULT_PALETTE_ID : initialMatchId,
  );
  const [customColors, setCustomColors] = useState<string[]>(
    pad6(initialPalette ?? DEFAULT_COLORS),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Build the active palette payload from the current mode + selection.
  const activePalette = useMemo(() => {
    if (mode === 'curated') {
      const found = CURATED_PALETTES.find((p) => p.id === selectedId);
      return found?.colors ?? DEFAULT_COLORS;
    }
    return customColors;
  }, [mode, selectedId, customColors]);

  const activeName = useMemo(() => {
    if (mode === 'curated') {
      return CURATED_PALETTES.find((p) => p.id === selectedId)?.name ?? '';
    }
    return 'Custom palette';
  }, [mode, selectedId]);

  function handleSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setErrorMessage(null);

    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('palette_json', JSON.stringify(activePalette));
    if (mode === 'curated') {
      formData.set('palette_name', activeName);
    }

    startTransition(async () => {
      try {
        await completeMoodBoardTask(formData);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't save your palette. Try again.";
        setErrorMessage(message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Mode toggle · curated grid vs custom 6-color picker. Two-tab
          pattern matching how the /add-ons/mood-board page exposes
          curated-vs-custom · keeps the muscle memory consistent. */}
      <div className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-cream/60 p-1">
        <button
          type="button"
          onClick={() => setMode('curated')}
          className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] transition-colors ${
            mode === 'curated'
              ? 'bg-terracotta text-cream'
              : 'text-ink/55 hover:text-ink'
          }`}
        >
          Curated picks
        </button>
        <button
          type="button"
          onClick={() => setMode('custom')}
          className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] transition-colors ${
            mode === 'custom'
              ? 'bg-terracotta text-cream'
              : 'text-ink/55 hover:text-ink'
          }`}
        >
          Custom
        </button>
      </div>

      {mode === 'curated' ? (
        <fieldset className="space-y-3">
          <legend className="sr-only">Pick a curated palette</legend>
          {/* 12 curated palettes · 2-col mobile, 3-col tablet. Each tile
              shows the name + a strip of color chips. Selected tile
              wears a terracotta border. */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CURATED_PALETTES.map((palette) => {
              const isSelected = selectedId === palette.id;
              return (
                <button
                  key={palette.id}
                  type="button"
                  onClick={() => setSelectedId(palette.id)}
                  aria-pressed={isSelected}
                  className={`flex flex-col gap-2 rounded-xl border-2 bg-cream p-3 text-left transition-colors ${
                    isSelected
                      ? 'border-terracotta'
                      : 'border-ink/10 hover:border-ink/25'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">
                      {palette.name}
                    </p>
                    {isSelected ? (
                      <CheckCircle2
                        aria-hidden
                        className="h-4 w-4 text-terracotta"
                        strokeWidth={2}
                      />
                    ) : null}
                  </div>
                  <div className="flex h-6 w-full overflow-hidden rounded-md border border-ink/5">
                    {palette.colors.map((color, idx) => (
                      <span
                        key={`${palette.id}-${idx}`}
                        aria-hidden
                        className="flex-1"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <p className="text-xs leading-relaxed text-ink/55">
                    {palette.hint}
                  </p>
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <fieldset className="space-y-3">
          <legend className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/60">
            Six colors · dominant first
          </legend>
          {/* 6 native color inputs · mobile keyboards / desktop browsers
              both show their native picker UI. No drag-to-reorder in
              V1 · slot order is dominant → supporting → accent. */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {customColors.map((color, idx) => (
              <label
                key={`custom-${idx}`}
                className="flex flex-col items-center gap-1"
              >
                <span className="font-mono text-[9px] uppercase tracking-wider text-ink/45">
                  {idx === 0
                    ? 'Dominant'
                    : idx === 1
                      ? 'Supporting'
                      : `Accent ${idx - 1}`}
                </span>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => {
                    const next = [...customColors];
                    next[idx] = e.target.value.toUpperCase();
                    setCustomColors(next);
                  }}
                  className="h-12 w-full cursor-pointer rounded-md border border-ink/15 bg-white p-0"
                  aria-label={`Color ${idx + 1}`}
                />
                <span className="font-mono text-[10px] text-ink/55">
                  {color.toUpperCase()}
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-ink/55">
            Pick at least three · all six get carried through to your
            invitations, save-the-date video, and signage.
          </p>
        </fieldset>
      )}

      {/* Live preview of the active palette as a single horizontal strip
          so the host sees exactly what gets saved. */}
      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/60">
          Your palette
        </p>
        <div className="flex h-10 w-full overflow-hidden rounded-lg border border-ink/10">
          {activePalette.map((color, idx) => (
            <span
              key={`preview-${idx}-${color}`}
              aria-hidden
              className="flex-1"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {errorMessage}
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-terracotta px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-700 focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            'Saving…'
          ) : (
            <>
              <PaletteIcon aria-hidden className="h-4 w-4" strokeWidth={2} />
              Save palette
            </>
          )}
        </button>
      </div>

      <p className="text-xs leading-relaxed text-ink/55">
        You can refine per-role palettes (bride, groom, sponsors) anytime
        from your Mood Board surface — this is your headline palette.
      </p>
    </form>
  );
}
