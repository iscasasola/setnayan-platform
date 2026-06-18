'use client';

/**
 * StdBuilderClient — the live Save-the-Date builder.
 * (iteration 0024 PR4 · live builder 2026-06-18)
 *
 * Three-step picker (Reveal → Theme → Information) + a small live preview
 * phone frame that updates in real-time as the couple makes changes.
 * One "Render" button saves everything in a single write.
 *
 * Layout: two-column on lg+ (builder | sticky preview + Render), stacked on
 * mobile (builder → preview → Render).
 *
 * The preview is rendered at the film's natural 384px width but scaled down
 * to ~220px display via CSS transform, so it looks pixel-sharp (not blurry)
 * while remaining too small to screen-record as a usable asset.
 */

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { Check, ExternalLink, Sparkles } from 'lucide-react';
import { SaveTheDateFilm } from '@/app/[slug]/_components/save-the-date-film';
import { STD_THEMES, type StdThemeId } from '@/lib/std-themes';
import { formatEventDate } from '@/lib/events';
import { saveAllStdContent } from '../actions';
import type { StdFilmContent } from '@/lib/save-the-date-content';
import type { RevealTemplate } from '@/app/[slug]/_components/reveal/reveal-templates';
import { RevealPreviewCard } from '@/app/dashboard/[eventId]/_components/reveal-preview-card';
import type { WaxSealConfig } from '@/lib/wax-seal/types';

type InfoRow = { label: string; done: boolean; value?: string; href?: string };

type Props = {
  eventId: string;
  /** The couple's wedding page slug — used for the "View on your page" link. */
  slug: string | null;
  /** Pre-resolved film content from the server (presigned URLs already embedded). */
  initialContent: StdFilmContent;
  initialThemeId: StdThemeId;
  initialLaunchDate: string;
  initialRevealTemplate: RevealTemplate | null;
  /** Status rows displayed in the "Your information" section. */
  infoRows: InfoRow[];
  // RevealPreviewCard props (forwarded)
  displayName: string;
  dateIso: string | null;
  markSvg?: string | null;
  waxColor?: string;
  sealConfig?: WaxSealConfig | null;
  sealFallbackSeed?: number;
  veilColor?: string;
};

/** Natural width of the film at max-w-sm; scale target → 220px display. */
const FILM_NATURAL_W = 384;
const PREVIEW_W = 220;
const PREVIEW_SCALE = PREVIEW_W / FILM_NATURAL_W; // ~0.573
const PREVIEW_H = Math.round(PREVIEW_W * (16 / 9));
const FILM_NATURAL_H = Math.round(FILM_NATURAL_W * (16 / 9));

export function StdBuilderClient({
  eventId,
  slug,
  initialContent,
  initialThemeId,
  initialLaunchDate,
  initialRevealTemplate,
  infoRows,
  displayName,
  dateIso,
  markSvg,
  waxColor,
  sealConfig,
  sealFallbackSeed,
  veilColor,
}: Props) {
  const [themeId, setThemeId] = useState<StdThemeId>(initialThemeId);
  const [launchDate, setLaunchDate] = useState(initialLaunchDate);
  const [saving, startSave] = useTransition();
  const [result, setResult] = useState<'idle' | 'ok' | 'error'>('idle');

  // Derive live content: all fields come from the server (presigned URLs, names,
  // date, venue, story) — only launchLabel can change in this builder.
  const liveContent = useMemo<StdFilmContent>(() => {
    const launchLabel = launchDate ? formatEventDate(launchDate) : null;
    return { ...initialContent, launchLabel };
  }, [initialContent, launchDate]);

  const handleRender = () => {
    startSave(async () => {
      const r = await saveAllStdContent(eventId, {
        theme: themeId,
        launchDate: launchDate || null,
      });
      setResult(r.ok ? 'ok' : 'error');
    });
  };

  return (
    <div className="space-y-8">
      {/* ── Step 1 · Reveal opening ───────────────────────────────────────── */}
      <RevealPreviewCard
        displayName={displayName}
        dateIso={dateIso}
        markSvg={markSvg}
        waxColor={waxColor}
        sealConfig={sealConfig}
        sealFallbackSeed={sealFallbackSeed}
        veilColor={veilColor}
        eventId={eventId}
        chosenTemplate={initialRevealTemplate}
      />

      {/* ── Steps 2 + 3 + Preview — two-column on desktop ─────────────────── */}
      <div className="lg:grid lg:grid-cols-[1fr_260px] lg:items-start lg:gap-8">

        {/* LEFT: Theme + Info + Launch date */}
        <div className="space-y-8">

          {/* Step 2 · Theme */}
          <section className="space-y-3">
            <div className="space-y-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                Step 2 · Theme
              </p>
              <h2 className="font-serif text-xl italic">Choose your look</h2>
              <p className="text-sm text-ink/65">
                Background, font, and colour style for your film. All themes recolour to your Mood Board by default.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
              {STD_THEMES.map((t) => {
                const active = themeId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setThemeId(t.id)}
                    aria-pressed={active}
                    className={`relative flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all ${
                      active
                        ? 'border-terracotta ring-2 ring-terracotta ring-offset-2'
                        : 'border-ink/10 hover:border-ink/25'
                    }`}
                    style={{ backgroundColor: t.swatchBg }}
                  >
                    {active ? (
                      <Check
                        aria-hidden
                        className="absolute right-2 top-2 h-3.5 w-3.5 text-terracotta"
                        strokeWidth={2.5}
                      />
                    ) : null}
                    <span
                      className="h-5 w-5 rounded-full border border-white/20"
                      style={{ backgroundColor: t.swatchFg }}
                    />
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: t.swatchFg }}>
                      {t.label}
                    </span>
                    <span className="text-[11px] leading-tight opacity-60" style={{ color: t.swatchFg }}>
                      {t.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Step 3 · Your information */}
          <section className="space-y-3">
            <div className="space-y-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                Step 3 · Information
              </p>
              <h2 className="font-serif text-xl italic">What your film shows</h2>
              <p className="text-sm text-ink/65">
                Auto-filled from your event. Tap <strong>Add</strong> to fill any gap.
              </p>
            </div>
            <ul className="divide-y divide-ink/10 overflow-hidden rounded-2xl border border-ink/10 bg-white/70">
              {infoRows.map((r) => (
                <li key={r.label} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink/85">{r.label}</p>
                    {r.done && r.value ? (
                      <p className="truncate text-xs text-ink/55">{r.value}</p>
                    ) : null}
                  </div>
                  {r.done ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
                      Added
                    </span>
                  ) : r.href ? (
                    <Link
                      href={r.href}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ink/15 bg-cream px-3 py-1 text-xs font-medium text-ink/70 hover:border-terracotta hover:text-terracotta"
                    >
                      Add
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="text-xs text-ink/50">
              Missing items are simply skipped — the film adapts to what it has.
            </p>
          </section>

          {/* Invitation launch date */}
          <section className="space-y-2 rounded-2xl border border-ink/10 bg-white/70 p-4 sm:p-5">
            <label htmlFor="std_launch_date" className="text-sm font-medium text-ink/85">
              When does your full invitation go live?
            </label>
            <p className="text-xs text-ink/55">
              We&rsquo;ll add a &ldquo;remind me when the invite arrives&rdquo; to the end-of-film calendar. Optional.
            </p>
            <input
              id="std_launch_date"
              type="date"
              value={launchDate}
              onChange={(e) => {
                setLaunchDate(e.target.value);
                if (result !== 'idle') setResult('idle');
              }}
              className="mt-1 rounded-md border border-ink/20 bg-cream px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none"
            />
          </section>
        </div>

        {/* RIGHT: Sticky preview + Render */}
        <div className="mt-8 lg:mt-0 lg:sticky lg:top-24 space-y-4">
          {/* Small phone frame — CSS-scaled for real-animation preview */}
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
              Live preview
            </p>
            <div
              className="relative mx-auto overflow-hidden rounded-3xl shadow-lg"
              style={{ width: PREVIEW_W, height: PREVIEW_H }}
            >
              <div
                style={{
                  width: FILM_NATURAL_W,
                  height: FILM_NATURAL_H,
                  transform: `scale(${PREVIEW_SCALE})`,
                  transformOrigin: 'top left',
                  pointerEvents: 'none',
                }}
              >
                <SaveTheDateFilm content={liveContent} themeId={themeId} preview />
              </div>
              {/* Watermark overlay — makes the small preview non-recordable as a final asset */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-3">
                <span className="rounded-full bg-black/25 px-3 py-0.5 font-mono text-[9px] uppercase tracking-widest text-white/80 backdrop-blur-sm">
                  Preview
                </span>
              </div>
            </div>
          </div>

          {/* Quality notice */}
          <p className="text-center text-xs text-ink/50">
            This preview is intentionally small.{' '}
            <span className="text-ink/70">Upon finalizing, your Save the Date plays at full quality on your page.</span>
          </p>

          {/* Result messages */}
          {result === 'ok' ? (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-800">
              <span className="font-medium">Saved.</span> Your film is live at full quality.{' '}
              {slug ? (
                <Link
                  href={`/${slug}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 font-medium underline decoration-emerald-500 underline-offset-2 hover:text-emerald-900"
                >
                  View your page
                  <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                </Link>
              ) : null}
            </div>
          ) : result === 'error' ? (
            <p className="rounded-xl border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-center text-sm text-terracotta">
              Something went wrong — please try again.
            </p>
          ) : null}

          {/* Render button */}
          <button
            type="button"
            onClick={handleRender}
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-mulberry px-5 py-3 text-sm font-semibold text-cream shadow-sm transition hover:bg-mulberry-600 disabled:opacity-60"
          >
            <Sparkles aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            {saving ? 'Saving…' : 'Render my Save the Date'}
          </button>
        </div>
      </div>
    </div>
  );
}
