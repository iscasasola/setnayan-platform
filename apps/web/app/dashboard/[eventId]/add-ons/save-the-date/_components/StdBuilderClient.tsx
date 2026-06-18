'use client';

/**
 * StdBuilderClient — the live Save-the-Date builder.
 * (iteration 0024 PR4 · live builder 2026-06-18)
 *
 * Three-step picker (Reveal → Theme → Information) + a small live preview
 * phone frame that updates in real-time as the couple makes changes.
 * One "Render" button saves everything in a single write.
 *
 * Step 3 has fully inline-editable fields that write to the std_film_*
 * snapshot columns — overriding live event data without changing the event
 * itself. The preview reflects every keystroke.
 *
 * Layout: two-column on lg+ (builder | sticky preview + Render), stacked on
 * mobile (builder → preview → Render).
 */

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { Check, ExternalLink, RotateCcw, Sparkles, Wand2 } from 'lucide-react';
import { SaveTheDateFilm } from '@/app/[slug]/_components/save-the-date-film';
import { STD_THEMES, type StdThemeId } from '@/lib/std-themes';
import { formatEventDate } from '@/lib/events';
import { shortDate } from '@/lib/save-the-date-content';
import { saveAllStdContent } from '../actions';
import type { StdFilmContent } from '@/lib/save-the-date-content';
import {
  REVEAL_LIBRARY,
  type RevealTemplate,
} from '@/app/[slug]/_components/reveal/reveal-templates';
import { RevealPreviewCard } from '@/app/dashboard/[eventId]/_components/reveal-preview-card';
import { RevealPreview } from '@/app/dashboard/[eventId]/_components/reveal-preview';
import type { RevealEffects } from '@/lib/std-reveal-effects';
import type { RevealEffectsLook, VeilLook } from '@/lib/reveal-config';
import {
  DeviceFrame,
  DeviceToggle,
  type PreviewDevice,
} from '@/app/dashboard/[eventId]/_components/device-frame';
import type { WaxSealConfig } from '@/lib/wax-seal/types';

type Props = {
  eventId: string;
  /** The couple's wedding page slug — used for the "View on your page" link. */
  slug: string | null;
  /** Pre-resolved film content from the server (presigned URLs already embedded). */
  initialContent: StdFilmContent;
  initialThemeId: StdThemeId;
  initialLaunchDate: string;
  initialRevealTemplate: RevealTemplate | null;
  /** The couple's saved reveal effect toggles (resolved; defaults applied). */
  initialEffects: RevealEffects;
  /** Raw std_film_* snapshot values — null means not yet set (falls back to live event data). */
  initialFilmDate?: string | null;
  initialFilmVenueName?: string | null;
  initialFilmVenueCity?: string | null;
  initialFilmStory?: string | null;
  // RevealPreviewCard props (forwarded)
  displayName: string;
  dateIso: string | null;
  markSvg?: string | null;
  waxColor?: string;
  sealConfig?: WaxSealConfig | null;
  sealFallbackSeed?: number;
  /** Mood-Board-derived veil tulle + petal colours (the inherit defaults). */
  veilColor?: string;
  petalsColor?: string;
  /** Admin Reveal Studio calibration — the veil look + rigid particle look, so
   *  the couple's preview matches the same tuned reveal you set in the admin. */
  veilLook?: VeilLook;
  effectLook?: RevealEffectsLook;
};

const STORY_MAX = 120;

export function StdBuilderClient({
  eventId,
  slug,
  initialContent,
  initialThemeId,
  initialLaunchDate,
  initialRevealTemplate,
  initialEffects,
  initialFilmDate,
  initialFilmVenueName,
  initialFilmVenueCity,
  initialFilmStory,
  dateIso,
  markSvg,
  waxColor,
  sealConfig,
  sealFallbackSeed,
  veilColor,
  petalsColor,
  veilLook,
  effectLook,
}: Props) {
  const [themeId, setThemeId] = useState<StdThemeId>(initialThemeId);
  const [launchDate, setLaunchDate] = useState(initialLaunchDate);

  // Film-snapshot overrides — each drives both the preview AND what gets saved.
  const [filmDate, setFilmDate] = useState(initialFilmDate ?? '');
  const [venueName, setVenueName] = useState(initialFilmVenueName ?? '');
  const [venueCity, setVenueCity] = useState(initialFilmVenueCity ?? '');
  const [filmStory, setFilmStory] = useState(initialFilmStory ?? '');

  const [saving, startSave] = useTransition();
  const [result, setResult] = useState<'idle' | 'ok' | 'error'>('idle');
  const [device, setDevice] = useState<PreviewDevice>('iphone');
  // Bumping this remounts the preview (opening + film) → replays from the first beat.
  const [restartKey, setRestartKey] = useState(0);
  // The opening shown in the single shared preview (Step 1 picker drives this).
  const [previewing, setPreviewing] = useState<RevealTemplate>(
    initialRevealTemplate ?? REVEAL_LIBRARY[0]!.id,
  );
  // True once the opening has auto-played + lifted away, revealing the film.
  const [revealDone, setRevealDone] = useState(false);
  // Per-opening effect toggles (butterflies / petals); saved on Render.
  const [effects, setEffects] = useState<RevealEffects>(initialEffects);

  // Any change that should replay the opening also resets the lifted state.
  const pickOpening = (t: RevealTemplate) => {
    setPreviewing(t);
    setRevealDone(false);
  };
  const changeDevice = (d: PreviewDevice) => {
    setDevice(d);
    setRevealDone(false);
  };
  const restartPreview = () => {
    setRestartKey((k) => k + 1);
    setRevealDone(false);
  };
  // Flip a boolean effect + replay the opening so the change is visible immediately.
  const toggleEffect = (key: 'butterflies' | 'petals' | 'music') => {
    setEffects((e) => ({ ...e, [key]: !e[key] }));
    setRestartKey((k) => k + 1);
    setRevealDone(false);
    if (result !== 'idle') setResult('idle');
  };
  // Set (or clear, with null = inherit the Mood Board) a veil colour override.
  const setColor = (key: 'veilColor' | 'petalColor', value: string | null) => {
    setEffects((e) => ({ ...e, [key]: value }));
    setRestartKey((k) => k + 1);
    setRevealDone(false);
    if (result !== 'idle') setResult('idle');
  };

  // Every state change re-derives the full content object so the preview
  // reflects exactly what would render on the live page after saving.
  const liveContent = useMemo<StdFilmContent>(() => {
    const dateOverride = filmDate.trim() || null;
    const dateBig = shortDate(dateOverride) ?? initialContent.dateBig;
    const dateLabel = dateOverride ? formatEventDate(dateOverride) : initialContent.dateLabel;
    const resolvedVenueName = venueName.trim() || initialContent.venueName || null;
    const resolvedVenueCity = venueCity.trim() || initialContent.venueCity || null;
    const storyRaw = filmStory.trim();
    const resolvedStory = storyRaw
      ? storyRaw.length > STORY_MAX
        ? storyRaw.slice(0, STORY_MAX - 2).trimEnd() + '…'
        : storyRaw
      : (initialContent.storyTeaser ?? null);
    const launchLabel = launchDate ? formatEventDate(launchDate) : null;
    return {
      ...initialContent,
      dateBig,
      dateLabel,
      venueName: resolvedVenueName,
      venueCity: resolvedVenueCity,
      storyTeaser: resolvedStory,
      launchLabel,
    };
  }, [initialContent, filmDate, venueName, venueCity, filmStory, launchDate]);

  // Autofill — pull the couple's event details into EVERY film field at once so
  // the Information step shows all the real values, ready to fine-tune. Client-
  // only: it fills the inputs; nothing persists until Render, and clearing a
  // field reverts that line to live event data.
  const autofillDate = dateIso ? dateIso.slice(0, 10) : '';
  const canAutofill = Boolean(
    autofillDate ||
      initialContent.venueName ||
      initialContent.venueCity ||
      initialContent.storyTeaser,
  );
  const handleAutofill = () => {
    if (autofillDate) setFilmDate(autofillDate);
    if (initialContent.venueName) setVenueName(initialContent.venueName);
    if (initialContent.venueCity) setVenueCity(initialContent.venueCity);
    if (initialContent.storyTeaser) setFilmStory(initialContent.storyTeaser);
    if (result !== 'idle') setResult('idle');
  };

  const handleRender = () => {
    startSave(async () => {
      const r = await saveAllStdContent(eventId, {
        theme: themeId,
        launchDate: launchDate || null,
        filmDate: filmDate.trim() || null,
        filmVenueName: venueName.trim() || null,
        filmVenueCity: venueCity.trim() || null,
        filmStory: filmStory.trim() || null,
        revealEffects: effects,
      });
      setResult(r.ok ? 'ok' : 'error');
    });
  };

  const inputCls =
    'w-full rounded-lg border border-ink/15 bg-cream px-3 py-2.5 text-sm text-ink placeholder:text-ink/35 focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta/30';
  const helperCls = 'mt-1.5 text-[11px] text-ink/45';

  return (
    <div className="space-y-8">
      {/* ── Steps 1 + 2 + 3 (left) + the single live preview (right) ───────── */}
      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">

        {/* LEFT: Opening picker + Theme + Info */}
        <div className="space-y-8">

          {/* Step 1 · Opening picker — drives the single shared preview → */}
          <RevealPreviewCard
            eventId={eventId}
            previewing={previewing}
            onPreview={pickOpening}
            chosenTemplate={initialRevealTemplate}
            effects={effects}
            onToggleEffect={toggleEffect}
            onSetColor={setColor}
            inheritedVeilColor={veilColor ?? '#f3ece1'}
            inheritedPetalColor={petalsColor ?? '#e87a93'}
          />

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

          {/* Step 3 · Information — inline editable */}
          <section className="space-y-3">
            <div className="space-y-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                Step 3 · Information
              </p>
              <h2 className="font-serif text-xl italic">What your film shows</h2>
              <p className="text-sm text-ink/65">
                Your film fills from your event. Edit here to set film-specific text — your event stays unchanged.
              </p>
            </div>

            {/* Autofill — drop every event detail into the fields below in one tap. */}
            {canAutofill ? (
              <button
                type="button"
                onClick={handleAutofill}
                className="inline-flex items-center gap-2 self-start rounded-full border border-terracotta/30 bg-terracotta/5 px-4 py-2 text-sm font-medium text-terracotta transition hover:bg-terracotta/10"
              >
                <Wand2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Autofill from my event details
              </button>
            ) : null}

            {/* Editable fields */}
            <div className="space-y-5 rounded-2xl border border-ink/10 bg-white/70 p-5">

              {/* Wedding date */}
              <div>
                <label htmlFor="film_date" className="block text-xs font-semibold uppercase tracking-wide text-ink/60">
                  Wedding date
                </label>
                <input
                  id="film_date"
                  type="date"
                  value={filmDate}
                  onChange={(e) => { setFilmDate(e.target.value); if (result !== 'idle') setResult('idle'); }}
                  className={`mt-1.5 ${inputCls}`}
                />
                {!filmDate && initialContent.dateLabel ? (
                  <p className={helperCls}>Auto-filled · {initialContent.dateLabel}</p>
                ) : !filmDate ? (
                  <p className={helperCls}>No date set yet — add it in your event dashboard.</p>
                ) : null}
              </div>

              {/* Venue name */}
              <div>
                <label htmlFor="film_venue_name" className="block text-xs font-semibold uppercase tracking-wide text-ink/60">
                  Venue name
                </label>
                <input
                  id="film_venue_name"
                  type="text"
                  value={venueName}
                  onChange={(e) => { setVenueName(e.target.value); if (result !== 'idle') setResult('idle'); }}
                  placeholder={initialContent.venueName ?? 'e.g. The Grand Ballroom'}
                  className={`mt-1.5 ${inputCls}`}
                />
                {!venueName && initialContent.venueName ? (
                  <p className={helperCls}>Auto-filled · {initialContent.venueName}</p>
                ) : null}
              </div>

              {/* Venue city / area */}
              <div>
                <label htmlFor="film_venue_city" className="block text-xs font-semibold uppercase tracking-wide text-ink/60">
                  City or area
                </label>
                <input
                  id="film_venue_city"
                  type="text"
                  value={venueCity}
                  onChange={(e) => { setVenueCity(e.target.value); if (result !== 'idle') setResult('idle'); }}
                  placeholder={initialContent.venueCity ?? 'e.g. Makati, Metro Manila'}
                  className={`mt-1.5 ${inputCls}`}
                />
                {!venueCity && initialContent.venueCity ? (
                  <p className={helperCls}>Auto-filled · {initialContent.venueCity}</p>
                ) : null}
              </div>

              {/* Story teaser */}
              <div>
                <label htmlFor="film_story" className="block text-xs font-semibold uppercase tracking-wide text-ink/60">
                  A line from your story
                </label>
                <textarea
                  id="film_story"
                  rows={2}
                  maxLength={STORY_MAX}
                  value={filmStory}
                  onChange={(e) => { setFilmStory(e.target.value); if (result !== 'idle') setResult('idle'); }}
                  placeholder={initialContent.storyTeaser ?? 'A short sentence about your love story…'}
                  className={`mt-1.5 resize-none ${inputCls}`}
                />
                <div className="mt-1.5 flex items-start justify-between gap-2">
                  {!filmStory && initialContent.storyTeaser ? (
                    <p className={helperCls}>Auto-filled from your love story</p>
                  ) : (
                    <span />
                  )}
                  <p className={`shrink-0 ${helperCls} ${filmStory.length >= STORY_MAX ? 'text-terracotta' : ''}`}>
                    {filmStory.length}/{STORY_MAX}
                  </p>
                </div>
              </div>

              {/* Invitation launch date */}
              <div>
                <label htmlFor="std_launch_date" className="block text-xs font-semibold uppercase tracking-wide text-ink/60">
                  Invitation goes live <span className="font-normal normal-case tracking-normal text-ink/40">(optional)</span>
                </label>
                <input
                  id="std_launch_date"
                  type="date"
                  value={launchDate}
                  onChange={(e) => { setLaunchDate(e.target.value); if (result !== 'idle') setResult('idle'); }}
                  className={`mt-1.5 ${inputCls}`}
                />
                <p className={helperCls}>
                  We&rsquo;ll add a &ldquo;remind me when the invite arrives&rdquo; to the end-of-film calendar.
                </p>
              </div>
            </div>

            {/* Non-editable status items */}
            <ul className="divide-y divide-ink/10 overflow-hidden rounded-2xl border border-ink/10 bg-white/70">
              {/* Names & monogram — core event data, edit via dashboard */}
              <li className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink/85">Your names</p>
                  <p className="truncate text-xs text-ink/50">{initialContent.names}</p>
                </div>
                <Link
                  href={`/dashboard/${eventId}`}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-ink/50 hover:text-terracotta"
                >
                  Edit
                  <ExternalLink aria-hidden className="h-3 w-3" strokeWidth={1.75} />
                </Link>
              </li>

              {/* Soundtrack */}
              <li className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink/85">Soundtrack</p>
                  {!initialContent.musicUrl ? (
                    <p className="text-xs text-ink/45">Not added yet</p>
                  ) : (
                    <p className="text-xs text-emerald-600">Added</p>
                  )}
                </div>
                {initialContent.musicUrl ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Added
                  </span>
                ) : (
                  <Link
                    href={`/dashboard/${eventId}/website/site-chrome`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ink/15 bg-cream px-3 py-1 text-xs font-medium text-ink/70 hover:border-terracotta hover:text-terracotta"
                  >
                    Add
                  </Link>
                )}
              </li>

              {/* Closing photos */}
              <li className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink/85">Closing photos</p>
                  {(initialContent.gallery?.length ?? 0) > 0 ? (
                    <p className="text-xs text-emerald-600">
                      {initialContent.gallery!.length} photo{initialContent.gallery!.length > 1 ? 's' : ''}
                    </p>
                  ) : (
                    <p className="text-xs text-ink/45">Not added yet</p>
                  )}
                </div>
                {(initialContent.gallery?.length ?? 0) > 0 ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Added
                  </span>
                ) : (
                  <Link
                    href={`/dashboard/${eventId}/website/our-photos`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ink/15 bg-cream px-3 py-1 text-xs font-medium text-ink/70 hover:border-terracotta hover:text-terracotta"
                  >
                    Add
                  </Link>
                )}
              </li>
            </ul>

            <p className="text-xs text-ink/45">
              Missing items are simply skipped — the film adapts to what it has.
            </p>
          </section>
        </div>

        {/* RIGHT: Sticky preview + Render */}
        <div className="mt-8 lg:mt-0 lg:sticky lg:top-24 space-y-4">
          {/* Live preview — phone / laptop device frames (same as Step 1) */}
          <div className="space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
              Live preview
            </p>
            <div className="flex items-center justify-center gap-2">
              <DeviceToggle device={device} onChange={changeDevice} />
              <button
                type="button"
                onClick={restartPreview}
                aria-label="Replay the opening from the beginning"
                className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:border-ink/30 hover:text-ink"
              >
                <RotateCcw aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Replay
              </button>
            </div>
            {/* The single live preview: the film plays as the BASE layer while the
                chosen opening auto-plays ON TOP and lifts away (onDone) to reveal
                it — exactly how a guest experiences the live page, in miniature.
                key={restartKey} on both lets Replay remount → opening + film from beat 1. */}
            <DeviceFrame device={device}>
              {/* base — the content film, running underneath */}
              <div className="absolute inset-0">
                <SaveTheDateFilm
                  key={restartKey}
                  content={liveContent}
                  themeId={themeId}
                  preview
                  fill
                />
              </div>
              {/* overlay — the opening; fades out once it has lifted away */}
              <div
                className={`absolute inset-0 transition-opacity duration-700 ${
                  revealDone ? 'pointer-events-none opacity-0' : 'opacity-100'
                }`}
              >
                <RevealPreview
                  key={`${device}-${previewing}-${restartKey}`}
                  template={previewing}
                  markSvg={markSvg}
                  monogram={liveContent.monogram}
                  waxColor={waxColor}
                  sealConfig={sealConfig}
                  sealFallbackSeed={sealFallbackSeed}
                  veilColor={veilColor}
                  petalsColor={petalsColor}
                  veilLook={veilLook}
                  effectLook={effectLook}
                  effects={effects}
                  onDone={() => setRevealDone(true)}
                />
              </div>
            </DeviceFrame>
          </div>

          {/* Quality notice */}
          <p className="text-center text-xs text-ink/50">
            Your opening plays, then your film — tap to flip through, press &amp; hold to pause.{' '}
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
