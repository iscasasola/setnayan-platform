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
import { Check, ExternalLink, Moon, Music2, RotateCcw, Sparkles, Sun, Wand2 } from 'lucide-react';
import { SaveTheDateFilm } from '@/app/[slug]/_components/save-the-date-film';
import { STD_THEMES, type StdThemeId } from '@/lib/std-themes';
import { formatEventDate } from '@/lib/events';
import { shortDate } from '@/lib/save-the-date-content';
import { saveAllStdContent, presignStdBackground } from '../actions';
import { FileUpload } from '@/app/_components/file-upload';
import type { StdFilmContent } from '@/lib/save-the-date-content';
import {
  REVEAL_LIBRARY,
  NO_REVEAL,
  type RevealTemplate,
  type RevealChoice,
} from '@/app/[slug]/_components/reveal/reveal-templates';
import { RevealPreviewCard } from '@/app/dashboard/[eventId]/_components/reveal-preview-card';
import { RevealPreview } from '@/app/dashboard/[eventId]/_components/reveal-preview';
import { StdBackgroundPicker } from '@/app/dashboard/[eventId]/_components/std-background-picker';
import { StdMediaPicker, type StdVideoUpload } from '@/app/dashboard/[eventId]/_components/std-media-picker';
import { StdBackgroundLayer } from '@/app/[slug]/_components/std-background-layer';
import {
  realisticBgSrc,
  resolveStdLegibility,
  type StdBackground,
  type StdLegibility,
} from '@/lib/std-backgrounds';
import type { StdMedia } from '@/lib/std-media';
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
  initialRevealTemplate: RevealChoice | null;
  /** The couple's saved reveal effect toggles (resolved; defaults applied). */
  initialEffects: RevealEffects;
  /** The couple's saved Step-1 background (resolved; defaults to plain). */
  initialBackground: StdBackground;
  /** Presigned URL for the saved upload background (if kind === 'upload'). */
  initialUploadUrl?: string | null;
  /** The couple's saved Step-3 media choice (resolved; defaults to gallery). */
  initialMedia: StdMedia;
  /** Presigned URL for the saved uploaded video (if media.type === 'video'). */
  initialVideoUrl?: string | null;
  /** How many photos the couple has (the gallery option's content count). */
  galleryCount?: number;
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
  /** Admin "which openings couples may use" map (reveal_studio_config.templates). */
  allowedTemplates: Record<string, boolean>;
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
  initialBackground,
  initialUploadUrl,
  initialMedia,
  initialVideoUrl,
  galleryCount,
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
  allowedTemplates,
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
  // Default the preview to an admin-enabled opening — never one that's been
  // deactivated in the Reveal Studio (config.templates).
  const firstAllowed = (
    REVEAL_LIBRARY.find((t) => allowedTemplates[t.id] !== false) ?? REVEAL_LIBRARY[0]!
  ).id;
  const [previewing, setPreviewing] = useState<RevealChoice>(
    // 'none' (No Reveal) is always honoured; otherwise the saved opening if the
    // admin still allows it, else the first enabled opening.
    initialRevealTemplate === NO_REVEAL
      ? NO_REVEAL
      : initialRevealTemplate && allowedTemplates[initialRevealTemplate] !== false
        ? initialRevealTemplate
        : firstAllowed,
  );
  // True once the opening has auto-played + lifted away, revealing the film.
  const [revealDone, setRevealDone] = useState(false);
  // Per-opening effect toggles (butterflies / petals); saved on Render.
  const [effects, setEffects] = useState<RevealEffects>(initialEffects);
  // Step-1 background choice (plain / paper / realistic / upload); saved on Render.
  const [background, setBackground] = useState<StdBackground>(initialBackground);
  // Presigned URL for an uploaded background (kind === 'upload') — drives the preview.
  const [uploadUrl, setUploadUrl] = useState<string | null>(initialUploadUrl ?? null);
  const pickBackground = (bg: StdBackground) => {
    // Keep the chosen legibility when the background itself changes.
    setBackground({ ...bg, legibility: bg.legibility ?? background.legibility ?? 'auto' });
    if (result !== 'idle') setResult('idle');
  };
  const setLegibility = (legibility: StdLegibility) => {
    setBackground((b) => ({ ...b, legibility }));
    if (result !== 'idle') setResult('idle');
  };
  // Upload picked → set it + presign the ref so the preview shows it immediately.
  const handleUpload = (ref: string | null) => {
    if (!ref) {
      setUploadUrl(null);
      pickBackground({ kind: 'plain', value: '#f3ece1' });
      return;
    }
    pickBackground({ kind: 'upload', value: ref });
    presignStdBackground(eventId, ref)
      .then((r) => setUploadUrl(r.url))
      .catch(() => {});
  };

  // Step-3 media (gallery / uploaded video); saved on Render.
  const [media, setMedia] = useState<StdMedia>(initialMedia);
  // URL the preview film plays for the video beat: a fresh upload's local
  // object URL, or the saved video's presigned URL on reload. (The couple's
  // own preview shows their video regardless of NSFW status — the public gate
  // is approval-only, enforced on the live page.)
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(
    initialMedia.type === 'video' ? (initialVideoUrl ?? null) : null,
  );
  const pickMedia = (m: StdMedia) => {
    setMedia(m);
    if (result !== 'idle') setResult('idle');
  };
  // A new video upload resets the NSFW gate to pending (re-screened before live).
  const handleVideoUpload = (payload: StdVideoUpload | null) => {
    if (!payload) {
      setVideoPreviewUrl(null);
      pickMedia({ type: 'gallery' });
      return;
    }
    setVideoPreviewUrl(payload.previewUrl ?? initialVideoUrl ?? null);
    pickMedia({
      type: 'video',
      videoKey: payload.videoKey,
      posterKey: payload.posterKey,
      nsfw: 'pending',
    });
  };

  // Step-4 music: a newly-uploaded song (r2 ref) → persisted to the SINGLE-SOURCE
  // site music on Render. musicPreviewUrl drives the preview's soundtrack: a
  // fresh upload's local object URL, or the saved site song on load.
  const [siteMusicKey, setSiteMusicKey] = useState<string | null>(null);
  const [musicPreviewUrl, setMusicPreviewUrl] = useState<string | null>(
    initialContent.musicUrl ?? null,
  );
  const handleMusicFilePicked = (file: File) => {
    setMusicPreviewUrl((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };
  const handleMusicUpload = (ref: string | null) => {
    setSiteMusicKey(ref);
    if (!ref) setMusicPreviewUrl(initialContent.musicUrl ?? null);
    // Uploading a song implies you want it on — mirror the toggle.
    if (ref && !effects.music) setEffects((e) => ({ ...e, music: true }));
    if (result !== 'idle') setResult('idle');
  };

  // Any change that should replay the opening also resets the lifted state.
  const pickOpening = (t: RevealChoice) => {
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
    // The builder's venue field is the RECEPTION manual fallback; ceremony +
    // reception otherwise auto-fill from the finalized bookings (initialContent).
    const resolvedReception = venueName.trim() || initialContent.receptionVenue || null;
    const resolvedReceptionCity = venueCity.trim() || initialContent.receptionCity || null;
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
      receptionVenue: resolvedReception,
      receptionCity: resolvedReceptionCity,
      storyTeaser: resolvedStory,
      launchLabel,
      // Music mirrors the Step-4 "Play music" toggle (events.std_reveal_effects.music);
      // the URL is a fresh upload's local preview, else the saved site song.
      musicUrl: effects.music ? (musicPreviewUrl ?? null) : null,
      // Preview the chosen closing media: the uploaded video (when picked) plays
      // as the video island beat; otherwise the gallery beat shows.
      videoUrl: media.type === 'video' ? videoPreviewUrl : null,
    };
  }, [initialContent, filmDate, venueName, venueCity, filmStory, launchDate, media.type, videoPreviewUrl, effects.music, musicPreviewUrl]);

  // Autofill — pull the couple's event details into EVERY film field at once so
  // the Information step shows all the real values, ready to fine-tune. Client-
  // only: it fills the inputs; nothing persists until Render, and clearing a
  // field reverts that line to live event data.
  const autofillDate = dateIso ? dateIso.slice(0, 10) : '';
  const canAutofill = Boolean(
    autofillDate ||
      initialContent.receptionVenue ||
      initialContent.receptionCity ||
      initialContent.storyTeaser,
  );
  const handleAutofill = () => {
    if (autofillDate) setFilmDate(autofillDate);
    if (initialContent.receptionVenue) setVenueName(initialContent.receptionVenue);
    if (initialContent.receptionCity) setVenueCity(initialContent.receptionCity);
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
        background,
        media,
        siteMusicKey,
      });
      setResult(r.ok ? 'ok' : 'error');
    });
  };

  const inputCls =
    'w-full rounded-lg border border-ink/15 bg-cream px-3 py-2.5 text-sm text-ink placeholder:text-ink/35 focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta/30';
  const helperCls = 'mt-1.5 text-[11px] text-ink/45';

  return (
    <div className="space-y-8">
      {/* ── The 5 steps (left) + the single live preview (right) ──────────────
          1 Background (+ theme: fonts/colours) · 2 Content · 3 Video/Gallery ·
          4 Music · 5 Opening (reveal). */}
      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">

        {/* LEFT: Background+Theme → Content → Video/Gallery → Music → Opening */}
        <div className="space-y-8">

          {/* Step 1 · Background — the backdrop the whole film plays over */}
          <StdBackgroundPicker
            value={background}
            onChange={pickBackground}
            eventId={eventId}
            uploadUrl={uploadUrl}
            onUpload={handleUpload}
          />

          {/* Step 1 (cont.) · Readability — veil + text tone so the names always
              read over the background (Lighten = cream wash + dark text · Darken
              = dark wash + light text · Auto adapts to the chosen background). */}
          <section className="space-y-2.5">
            <div className="space-y-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                Step 1 · Readability
              </p>
              <p className="text-sm text-ink/65">
                Keep your names crisp over the background. <span className="font-medium text-ink/80">Auto</span> adapts to your choice — or <span className="font-medium text-ink/80">Lighten</span> / <span className="font-medium text-ink/80">Darken</span> to fine-tune.
              </p>
            </div>
            <div className="inline-flex rounded-xl border border-ink/15 bg-cream p-1">
              {([
                { id: 'auto', label: 'Auto', Icon: Sparkles },
                { id: 'lighten', label: 'Lighten', Icon: Sun },
                { id: 'darken', label: 'Darken', Icon: Moon },
              ] as const).map(({ id, label, Icon }) => {
                const active = (background.legibility ?? 'auto') === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setLegibility(id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      active ? 'bg-mulberry text-cream' : 'text-ink/65 hover:text-ink'
                    }`}
                  >
                    <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Step 1 (cont.) · Theme — folds into Background; sets the fonts +
              text colours only (the Background above sets the scene). */}
          <section className="space-y-3">
            <div className="space-y-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                Step 1 · Fonts &amp; colours
              </p>
              <h2 className="font-serif text-xl italic">Choose your look</h2>
              <p className="text-sm text-ink/65">
                Your theme sets the fonts and text colours. The Background above sets the scene — both recolour to your Mood Board by default.
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

          {/* Step 2 · Content — inline editable */}
          <section className="space-y-3">
            <div className="space-y-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                Step 2 · Content
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

              {/* Ceremony venue — read-only, auto-filled from the finalized booking. */}
              {initialContent.ceremonyVenue ? (
                <div>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-ink/60">
                    Ceremony venue
                  </span>
                  <p className="mt-1.5 rounded-lg border border-ink/10 bg-white/60 px-3 py-2.5 text-sm text-ink">
                    {initialContent.ceremonyVenue}
                  </p>
                  <p className={helperCls}>From your booked ceremony venue.</p>
                </div>
              ) : null}

              {/* Reception venue — auto-fills from the finalized booking; the field
                  is the manual fallback for couples who book off-platform. */}
              <div>
                <label htmlFor="film_venue_name" className="block text-xs font-semibold uppercase tracking-wide text-ink/60">
                  Reception venue
                </label>
                <input
                  id="film_venue_name"
                  type="text"
                  value={venueName}
                  onChange={(e) => { setVenueName(e.target.value); if (result !== 'idle') setResult('idle'); }}
                  placeholder={initialContent.receptionVenue ?? 'e.g. The Grand Ballroom'}
                  className={`mt-1.5 ${inputCls}`}
                />
                {!venueName && initialContent.receptionVenue ? (
                  <p className={helperCls}>Auto-filled from your booking · {initialContent.receptionVenue}</p>
                ) : null}
              </div>

              {/* Reception city / area */}
              <div>
                <label htmlFor="film_venue_city" className="block text-xs font-semibold uppercase tracking-wide text-ink/60">
                  City or area
                </label>
                <input
                  id="film_venue_city"
                  type="text"
                  value={venueCity}
                  onChange={(e) => { setVenueCity(e.target.value); if (result !== 'idle') setResult('idle'); }}
                  placeholder={initialContent.receptionCity ?? 'e.g. Makati, Metro Manila'}
                  className={`mt-1.5 ${inputCls}`}
                />
                {!venueCity && initialContent.receptionCity ? (
                  <p className={helperCls}>Auto-filled · {initialContent.receptionCity}</p>
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

            </ul>

            <p className="text-xs text-ink/45">
              Missing items are simply skipped — the film adapts to what it has.
            </p>
          </section>

          {/* Step 3 · Video / Gallery — the film's closing media */}
          <StdMediaPicker
            value={media}
            onChange={pickMedia}
            eventId={eventId}
            galleryCount={galleryCount}
            videoUrl={initialVideoUrl}
            onUploadVideo={handleVideoUpload}
          />

          {/* Step 4 · Music — the film's soundtrack + the play-music toggle */}
          <section className="space-y-3">
            <div className="space-y-1">
              <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                <Music2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Step 4 · Music
              </p>
              <h2 className="font-serif text-xl italic">Set the mood</h2>
              <p className="text-sm text-ink/65">
                Your film plays your website song. Add or change it, or turn music off for a silent film.
              </p>
            </div>

            {/* Play-music toggle (events.std_reveal_effects.music) */}
            <button
              type="button"
              role="switch"
              aria-checked={effects.music}
              onClick={() => toggleEffect('music')}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/70 px-4 py-3.5 text-left transition-colors hover:border-ink/25 sm:px-5"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink/85">Play music in your film</span>
                <span className="block text-xs text-ink/50">
                  {effects.music ? 'On — your song plays through the film.' : 'Off — your film plays silently.'}
                </span>
              </span>
              <span
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  effects.music ? 'bg-terracotta' : 'bg-ink/20'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    effects.music ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </span>
            </button>

            {/* Your song — inline upload (single-source: this sets the couple's
                website song, which the film plays). Status + Pakanta route. */}
            <div className="space-y-2.5 rounded-2xl border border-ink/10 bg-white/70 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-ink/85">Your song</p>
                {siteMusicKey || initialContent.musicUrl ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
                    {siteMusicKey ? 'New song ready' : 'Added'}
                  </span>
                ) : (
                  <span className="text-xs text-ink/45">No song yet</span>
                )}
              </div>
              <FileUpload
                bucket="media"
                pathPrefix={`events/${eventId}/site-music`}
                acceptedTypes={['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav']}
                maxSizeMB={40}
                variant="wide"
                currentValue={siteMusicKey}
                onFilePicked={handleMusicFilePicked}
                onChange={(v) => handleMusicUpload(typeof v === 'string' ? v : null)}
                help="MP3/M4A/AAC/OGG/WAV, up to 40 MB. This becomes your wedding-site song."
              />
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/dashboard/${eventId}/add-ons/pakanta`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-ink/55 hover:text-terracotta"
                >
                  Use your Pakanta song
                  <ExternalLink aria-hidden className="h-3 w-3" strokeWidth={1.75} />
                </Link>
                <Link
                  href={`/dashboard/${eventId}/website/site-chrome`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-ink/55 hover:text-terracotta"
                >
                  Manage site music
                  <ExternalLink aria-hidden className="h-3 w-3" strokeWidth={1.75} />
                </Link>
              </div>
            </div>
          </section>

          {/* Step 5 · Opening (reveal) — the premium opening that lifts away to
              reveal the film. Last step: the film is built, now choose its entrance. */}
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
            allowed={allowedTemplates}
          />
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
              {/* layer 0 — the Step-1 background, behind everything */}
              <StdBackgroundLayer
                background={background}
                imageUrl={
                  background.kind === 'realistic'
                    ? realisticBgSrc(background.value)
                    : background.kind === 'upload'
                      ? uploadUrl
                      : null
                }
              />
              {/* base — the content film (transparent stage so the background shows) */}
              <div className="absolute inset-0">
                <SaveTheDateFilm
                  key={restartKey}
                  content={liveContent}
                  themeId={themeId}
                  preview
                  fill
                  transparent
                  tone={resolveStdLegibility(background).tone}
                />
              </div>
              {/* overlay — the opening. Skipped entirely for No Reveal (the free
                  choice → the film plays straight away, nothing on top). The
                  rigid openings (envelope/doors) truly part and clear, so they
                  fade out once lifted. The VEIL is a persistent top layer
                  (two-way), so it STAYS on top over the playing film — matching
                  the live page. (2026-06-18) */}
              {previewing === NO_REVEAL ? null : (
                <div
                  className={`absolute inset-0 transition-opacity duration-700 ${
                    revealDone && previewing !== 'veil-sheer'
                      ? 'pointer-events-none opacity-0'
                      : 'opacity-100'
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
              )}
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
