'use client';

/**
 * Theme TEMPLATE gallery — "pick a look, seed your board" (Mood Board
 * redesign follow-up, 2026-09-03), backed by public.moodboard_theme_templates
 * (2,600 rows: 100 hand-authored + 2,500 procedurally generated, see
 * apps/web/lib/moodboard-theme-generator.ts, across 10 style families ×
 * 10 moods).
 *
 * ── 🛑 THIS COMPONENT NO LONGER RECEIVES THE TABLE ──────────────────────────
 * It used to take a `templates: MoodboardThemeTemplate[]` prop — the ENTIRE
 * table, selected unfiltered and unlimited by page.tsx, shipped through the
 * RSC payload on every mood-board load and then filtered here in a `useMemo`.
 * That was survivable at 100 rows and a real cost at 2,600 (two JSONB blobs
 * per row). It now asks the server for ONE PAGE at a time through
 * `fetchThemeTemplates`, and it does not ask at all until the couple has
 * answered both narrowing questions. The facet vocabulary is static
 * (MOODBOARD_MOOD_TAGS / MOODBOARD_STYLE_FAMILIES + their label maps), so
 * drawing the first screen costs zero queries.
 *
 * ── THE SHAPE: ONE QUESTION AT A TIME ───────────────────────────────────────
 * Hundreds of cards behind two chip rows is a catalogue, not a decision. The
 * approved design is a narrowing conversation:
 *
 *   1. ONE calm choice — "Start from a designed theme" vs "Start with a blank
 *      board". Choosing blank ends here and loads NOTHING.
 *   2. A FEELING (the mood axis, in MOOD_LABELS' warm copy), then a SETTING
 *      (the style-family axis, STYLE_FAMILY_LABELS) — ~6 large choices per
 *      screen, the rest a tap away, one question visible at a time.
 *   3. ~6 matching themes, with a quiet "Show more" that pages via `offset`
 *      and a small "Start over".
 *
 * Preserved verbatim from the previous cut (do NOT re-inflate this with badge
 * rows or filter chips): the single primary "Apply" button per card — always
 * the safe `fill_empty` mode, no confirm — plus the small underlined
 * "or replace everything instead" secondary link for the destructive mode,
 * gated by `window.confirm`, mirroring the small-secondary-link idiom in
 * app/dashboard/(launcher)/_components/event-card-menu.tsx; the applying /
 * applied states; and the swatch strip with `nearestColorName` labels.
 *
 * The merge math itself lives server-side in lib/moodboard-templates.ts
 * (mergeRolePalette/mergeReceptionDesign/mergeTheme for fill_empty;
 * replaceRolePalette/replaceReceptionDesign/replaceTheme for replace_all),
 * independently unit-tested in lib/moodboard-templates.test.ts.
 */

import { useState, useTransition } from 'react';
import { ArrowLeft, Check, Sparkles } from 'lucide-react';
import { useToast } from '@/app/_components/toast/toast-provider';
import { nearestColorName } from '@/lib/color-names';
import {
  MOODBOARD_MOOD_TAGS,
  MOODBOARD_STYLE_FAMILIES,
  STYLE_FAMILY_LABELS,
  MOOD_LABELS,
  THEME_TEMPLATE_PAGE_SIZE,
  type ApplyMode,
  type MoodboardMoodTag,
  type MoodboardStyleFamily,
  type MoodboardThemeTemplate,
  type ThemeTemplatePage,
} from '@/lib/moodboard-templates';

type ApplyResult = {
  mode: ApplyMode;
  filledPaletteRoles: string[];
  filledReceptionZones: string[];
  filledInspirationSlots: string[];
  filledThemeName: boolean;
  filledThemeDescription: boolean;
  nothingToFill: boolean;
};

type Props = {
  eventId: string;
  /** Server action — one filtered, capped page of templates. */
  fetchAction: (input: {
    styleFamily: string;
    moodTag: string;
    limit?: number;
    offset?: number;
  }) => Promise<ThemeTemplatePage>;
  applyAction: (eventId: string, templateId: string, mode?: ApplyMode) => Promise<ApplyResult>;
};

/** How many choices to show before "show the rest" — the design's "about 6
 *  large choices per step". Both axes carry 10 values; the remaining 4 are one
 *  tap away rather than hidden. */
const CHOICES_PER_SCREEN = 6;

/** Every hex in a template's role_palette, deduped, for the swatch strip —
 *  RECEPTION FIRST.
 *
 *  The reception palette IS the theme's color scheme, and since 2026-09-03 it
 *  is exactly five colors (owner: "themes must be 5 colors"). The strip caps
 *  at 6, and this used to walk the palette in key order — ceremony first — so
 *  the two ceremony colors took the front of a 6-chip strip and the card could
 *  cut off the theme's own Accent 2 to make room for them. Lead with the five
 *  the theme is actually named for; the remaining slot picks up whatever
 *  attire color is next and distinct. */
function swatchesFor(template: MoodboardThemeTemplate): string[] {
  // Templates never author `custom_roles` (only the couple does — see
  // mood-board.ts), but the field is part of RolePalette's shape, so exclude
  // it alongside `room_dressing` for the type to hold.
  const rest = Object.entries(template.role_palette)
    .filter(([key]) => key !== 'room_dressing' && key !== 'custom_roles' && key !== 'reception')
    .flatMap(([, v]) => (Array.isArray(v) ? (v as string[]) : []));
  const all = [...(template.role_palette.reception ?? []), ...rest];
  return Array.from(new Set(all)).slice(0, 6);
}

function summarize(result: ApplyResult): string {
  if (result.mode === 'replace_all') {
    const parts: string[] = [];
    if (result.filledPaletteRoles.length > 0) parts.push('palette');
    if (result.filledReceptionZones.length > 0) parts.push('reception design');
    if (result.filledThemeName || result.filledThemeDescription) parts.push('theme');
    return parts.length > 0
      ? `Replaced your ${parts.join(', ')} with this theme.`
      : 'Nothing on this template to replace with.';
  }
  if (result.nothingToFill) return 'Already personalized — nothing to fill in.';
  const parts: string[] = [];
  if (result.filledPaletteRoles.length > 0) {
    parts.push(`palette (${result.filledPaletteRoles.length})`);
  }
  if (result.filledReceptionZones.length > 0) {
    parts.push(`reception (${result.filledReceptionZones.length})`);
  }
  if (result.filledInspirationSlots.length > 0) {
    parts.push(
      `${result.filledInspirationSlots.length} inspiration ${result.filledInspirationSlots.length === 1 ? 'photo' : 'photos'}`,
    );
  }
  if (result.filledThemeName || result.filledThemeDescription) parts.push('theme');
  return `Filled in: ${parts.join(', ')}.`;
}

/** One large, calm choice button — the shared shape of every step's options. */
function ChoiceButton({
  label,
  onClick,
  primary = false,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        primary
          ? 'sn-press rounded-2xl border border-terracotta/40 bg-terracotta/[0.06] px-5 py-4 text-left text-sm font-semibold text-ink transition hover:bg-terracotta/10'
          : 'sn-press rounded-2xl border border-ink/12 bg-white px-5 py-4 text-left text-sm font-medium text-ink/80 transition hover:border-terracotta/40 hover:text-ink'
      }
    >
      {label}
    </button>
  );
}

export function TemplateGallery({ eventId, fetchAction, applyAction }: Props) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  // ── the narrowing conversation ────────────────────────────────────────
  const [step, setStep] = useState<'intent' | 'mood' | 'family' | 'results' | 'blank'>('intent');
  const [mood, setMood] = useState<MoodboardMoodTag | null>(null);
  const [family, setFamily] = useState<MoodboardStyleFamily | null>(null);
  const [showAllMoods, setShowAllMoods] = useState(false);
  const [showAllFamilies, setShowAllFamilies] = useState(false);

  // ── the fetched page(s) ───────────────────────────────────────────────
  const [templates, setTemplates] = useState<MoodboardThemeTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  function reset() {
    setStep('intent');
    setMood(null);
    setFamily(null);
    setShowAllMoods(false);
    setShowAllFamilies(false);
    setTemplates([]);
    setTotal(0);
    setLoadError(false);
  }

  /**
   * Fetch one page. `offset === 0` starts a fresh result set (both answers
   * just given); a later offset appends. A failure is SHOWN — an empty grid
   * that means "the fetch died" must never render identically to "no themes
   * match", which is itself a real, different answer.
   */
  async function loadPage(
    nextFamily: MoodboardStyleFamily,
    nextMood: MoodboardMoodTag,
    offset: number,
  ) {
    setLoading(true);
    setLoadError(false);
    try {
      const page = await fetchAction({
        styleFamily: nextFamily,
        moodTag: nextMood,
        limit: THEME_TEMPLATE_PAGE_SIZE,
        offset,
      });
      setTotal(page.total);
      setTemplates((prev) => (offset === 0 ? page.templates : [...prev, ...page.templates]));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  function chooseFamily(nextFamily: MoodboardStyleFamily) {
    setFamily(nextFamily);
    setStep('results');
    if (mood) void loadPage(nextFamily, mood, 0);
  }

  function apply(template: MoodboardThemeTemplate, mode: ApplyMode) {
    if (pending) return;
    if (mode === 'replace_all') {
      const ok = window.confirm(
        `Replace your current palette, reception design, and theme with "${template.name}"? This can't be undone.`,
      );
      if (!ok) return;
    }
    setApplyingId(template.template_id);
    startTransition(async () => {
      try {
        const result = await applyAction(eventId, template.template_id, mode);
        if (mode === 'fill_empty' && result.nothingToFill) {
          toast.info(summarize(result));
        } else {
          toast.success(summarize(result));
          setAppliedIds((prev) => new Set(prev).add(template.template_id));
        }
      } catch {
        toast.error('Could not apply that template — try again.');
      } finally {
        setApplyingId(null);
      }
    });
  }

  const moodChoices = showAllMoods
    ? MOODBOARD_MOOD_TAGS
    : MOODBOARD_MOOD_TAGS.slice(0, CHOICES_PER_SCREEN);
  const familyChoices = showAllFamilies
    ? MOODBOARD_STYLE_FAMILIES
    : MOODBOARD_STYLE_FAMILIES.slice(0, CHOICES_PER_SCREEN);

  return (
    <section
      aria-label="Start from a designed theme"
      className="space-y-4 rounded-2xl border border-ink/10 bg-white/70 p-5"
    >
      {/* ── STATE 1 · one calm choice ─────────────────────────────────── */}
      {step === 'intent' ? (
        <div className="space-y-3">
          <header className="space-y-1">
            <h2 className="text-xl font-semibold text-ink">How would you like to begin?</h2>
            <p className="max-w-prose text-sm text-ink/65">
              We can start you from a designed theme — a palette and a reception look chosen to
              go together — or leave the board completely blank for you to build.
            </p>
          </header>
          <div className="grid gap-3 sm:grid-cols-2">
            <ChoiceButton
              primary
              label="Start from a designed theme"
              onClick={() => setStep('mood')}
            />
            <ChoiceButton label="Start with a blank board" onClick={() => setStep('blank')} />
          </div>
        </div>
      ) : null}

      {/* Blank board — deliberately loads NOTHING. */}
      {step === 'blank' ? (
        <div className="space-y-2">
          <p className="text-sm text-ink/70">
            Your board stays blank — set your palette and reception design below, in your own
            order.
          </p>
          <button
            type="button"
            onClick={() => setStep('mood')}
            className="sn-press text-[12px] font-bold text-ink/60 underline underline-offset-2 hover:text-ink"
          >
            Actually, show me some designed themes
          </button>
        </div>
      ) : null}

      {/* ── STATE 2 · two-step narrowing, one question at a time ──────── */}
      {step === 'mood' ? (
        <div className="space-y-3">
          <header className="space-y-1">
            <button
              type="button"
              onClick={reset}
              className="sn-press inline-flex items-center gap-1 text-xs font-medium text-ink/50 hover:text-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Back
            </button>
            <h2 className="text-xl font-semibold text-ink">First — how should the day feel?</h2>
            <p className="text-sm text-ink/65">Pick the one closest to what you picture.</p>
          </header>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {moodChoices.map((m) => (
              <ChoiceButton
                key={m}
                label={MOOD_LABELS[m] ?? m}
                onClick={() => {
                  setMood(m);
                  setStep('family');
                }}
              />
            ))}
          </div>
          {!showAllMoods ? (
            <button
              type="button"
              onClick={() => setShowAllMoods(true)}
              className="sn-press text-[12px] font-bold text-ink/60 underline underline-offset-2 hover:text-ink"
            >
              More feelings
            </button>
          ) : null}
        </div>
      ) : null}

      {step === 'family' ? (
        <div className="space-y-3">
          <header className="space-y-1">
            <button
              type="button"
              onClick={() => setStep('mood')}
              className="sn-press inline-flex items-center gap-1 text-xs font-medium text-ink/50 hover:text-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Back
            </button>
            <h2 className="text-xl font-semibold text-ink">
              And where are you imagining it?
            </h2>
            <p className="text-sm text-ink/65">
              {mood ? `${MOOD_LABELS[mood] ?? mood} — in what kind of setting?` : null}
            </p>
          </header>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {familyChoices.map((f) => (
              <ChoiceButton
                key={f}
                label={STYLE_FAMILY_LABELS[f] ?? f}
                onClick={() => chooseFamily(f)}
              />
            ))}
          </div>
          {!showAllFamilies ? (
            <button
              type="button"
              onClick={() => setShowAllFamilies(true)}
              className="sn-press text-[12px] font-bold text-ink/60 underline underline-offset-2 hover:text-ink"
            >
              More settings
            </button>
          ) : null}
        </div>
      ) : null}

      {/* ── STATE 3 · the ~6 matching themes ──────────────────────────── */}
      {step === 'results' ? (
        <div className="space-y-3">
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="space-y-0.5">
              <h2 className="text-xl font-semibold text-ink">
                {mood ? (MOOD_LABELS[mood] ?? mood) : ''}
                {mood && family ? ' · ' : ''}
                {family ? (STYLE_FAMILY_LABELS[family] ?? family) : ''}
              </h2>
              <p className="text-sm text-ink/65">
                {loading && templates.length === 0
                  ? 'Finding themes…'
                  : loadError
                    ? 'We couldn’t load themes just now.'
                    : total > 0
                      ? `${total} ${total === 1 ? 'theme' : 'themes'} match.`
                      : 'No themes match that pairing yet.'}
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="sn-press text-[12px] font-bold text-ink/60 underline underline-offset-2 hover:text-ink"
            >
              Start over
            </button>
          </header>

          {loadError ? (
            <button
              type="button"
              onClick={() => {
                if (family && mood) void loadPage(family, mood, 0);
              }}
              className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:bg-ink/5"
            >
              Try again
            </button>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => {
              const swatches = swatchesFor(t);
              const isApplying = applyingId === t.template_id && pending;
              const applied = appliedIds.has(t.template_id);
              return (
                <div key={t.template_id} className="sn-tile space-y-2.5 p-4">
                  <p className="text-sm font-semibold text-ink">{t.name}</p>
                  <p className="line-clamp-3 text-xs text-ink/65">{t.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {swatches.map((hex) => (
                      <span key={hex} className="flex flex-col items-center gap-0.5">
                        <span
                          className="h-5 w-5 rounded-full border border-ink/10"
                          style={{ backgroundColor: hex }}
                          title={nearestColorName(hex) ?? hex}
                        />
                        <span className="text-center text-[9px] leading-tight text-ink/50">
                          {nearestColorName(hex) ?? hex}
                        </span>
                      </span>
                    ))}
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => apply(t, 'fill_empty')}
                      disabled={isApplying}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-terracotta/40 px-3 py-1.5 text-xs font-medium text-terracotta-700 transition hover:bg-terracotta/10 disabled:opacity-50"
                    >
                      {applied ? (
                        <>
                          <Check className="h-3.5 w-3.5" aria-hidden />
                          Applied
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" aria-hidden />
                          {isApplying ? 'Applying…' : 'Apply'}
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => apply(t, 'replace_all')}
                      disabled={isApplying}
                      className="sn-press mt-1.5 block w-full text-center text-[11px] font-medium text-ink/50 underline underline-offset-2 hover:text-ink disabled:opacity-50"
                    >
                      or replace everything instead
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {templates.length < total ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                if (family && mood) void loadPage(family, mood, templates.length);
              }}
              className="rounded-full border border-ink/15 px-4 py-1.5 text-xs font-medium text-ink/70 transition hover:bg-ink/5 disabled:opacity-50"
            >
              {loading ? 'Loading…' : `Show more (${total - templates.length} left)`}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
