'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { FileUpload } from '@/app/_components/file-upload';
import { extractPosterFrame } from '../../../_components/std-media-picker';
import { hubDraftAction } from '../../hub-draft-actions';
import { CALMER_CLIP_SCRIM, measureFrame, resolveAdaptiveTheme } from '@/lib/adaptive-theme';
import { hubThemePageTokens } from '@/lib/hub-theme-tokens';
import { INVITE_THEMES, type InviteThemeId } from '@/lib/invite-themes';
import type { HubMainGround } from '@/lib/hub-canvas';
import {
  MAKER_MAX_CLIP_SECONDS,
  makeMakerVideoDurationValidator,
} from '@/lib/maker-media-limits';

/**
 * YOUR OWN BACKGROUND — and the theme follows it (Event Hub Maker Phase 10).
 *
 * The Main background ("behind every scene") is the theme's own moving loop.
 * Here a couple swaps it for their OWN clip or photo, and — the adaptive
 * theme, owner 2026-09-25: *"Adaptive theme is for PRO – i like this"* — the
 * theme's accent, button and ornament move toward the colours of their
 * footage. Fonts, ornaments' shapes, the reveal and the transitions stay.
 *
 * ── ALL IN THE BROWSER, NO SERVER ─────────────────────────────────────────
 * The moment a file is picked (before it uploads) one frame is read here: a
 * photo as it is, a clip through `extractPosterFrame` — the Save-the-Date's own
 * frame grab. `measureFrame` turns its pixels into a handful of colours, and a
 * clip's frame is uploaded beside it as its still. Nothing is processed on a
 * server and nothing new is billed.
 *
 * ── THE DRAFT, NEVER LIVE ─────────────────────────────────────────────────
 * Every change posts `hubDraftAction` intent=save with the hero row's `main`
 * (the same one draft action the Reveal and the Logo use). A free couple may
 * try it — their preview shows it — and it goes live at Apply, where Event Hub
 * Pro is asked for (`planHubDraftApply`: own media behind the page is Pro).
 *
 * 🔎 A REFUSED SAVE, OR A FRAME THAT COULD NOT BE READ, SAYS SO. Footage whose
 * colours were not measured is never saved — its words would sit over pixels
 * nobody looked at.
 */

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

/** The long edge the frame is measured at — plenty for colour, cheap to read. */
const MEASURE_EDGE = 96;

type Measured = { frame: string[]; kind: 'photo' | 'snippet'; poster: string | null };

async function readFrame(blob: Blob): Promise<string[]> {
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = MEASURE_EDGE / Math.max(bitmap.width, bitmap.height, 1);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];
    ctx.drawImage(bitmap, 0, 0, w, h);
    return measureFrame(ctx.getImageData(0, 0, w, h).data, w, h);
  } finally {
    bitmap.close();
  }
}

/** Upload the clip's still through the same presign route `<FileUpload>` uses. */
async function uploadStill(blob: Blob, eventId: string): Promise<string | null> {
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bucket: 'media',
        pathPrefix: `events/${eventId}/main-background`,
        filename: 'still.jpg',
        contentType: 'image/jpeg',
        sizeBytes: blob.size,
      }),
    });
    const data = (await res.json()) as { uploadUrl: string; r2Ref: string } | { error: string };
    if (!res.ok || 'error' in data) return null;
    const put = await fetch(data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
    return put.ok ? data.r2Ref : null;
  } catch {
    return null;
  }
}

function Swatch({ hex, label }: { hex: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink/70">
      <span aria-hidden className="h-4 w-4 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]" style={{ backgroundColor: hex }} />
      {label}
    </span>
  );
}

export function MainBackgroundPanel({
  eventId,
  themeId,
  current,
  stillUrl,
  drafted,
  ownsPro,
}: {
  eventId: string;
  /** The couple's saved theme. Classic has no moving background to swap. */
  themeId: InviteThemeId;
  /** The Main background as the preview shows it — the draft over live. */
  current: HubMainGround | null;
  /** A signed URL for its photo or still, for the thumbnail. */
  stillUrl: string | null;
  /** The draft holds a different Main background from what guests see. */
  drafted: boolean;
  ownsPro: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const measuring = useRef<Promise<Measured | null> | null>(null);

  const theme = INVITE_THEMES[themeId];
  const isVideo = current?.kind === 'snippet';
  const adaptive = useMemo(
    () => (current ? resolveAdaptiveTheme(theme, current.tint ?? null) : null),
    [current, theme],
  );
  // What the theme would paint with the toggle ON — shown even while it is off,
  // so the couple can see what "match" would do before they choose it.
  const matched = useMemo(
    () => (current?.tint ? resolveAdaptiveTheme(theme, { ...current.tint, match: true }).tint : null),
    [current, theme],
  );

  const save = (main: HubMainGround | null, failure: string) =>
    start(async () => {
      setError(null);
      try {
        const fd = new FormData();
        fd.set('intent', 'save');
        fd.set('patch', JSON.stringify({ widgets: { hero: { main } } }));
        const r = await hubDraftAction(eventId, fd);
        if (!r.ok) setError(r.error);
        else router.refresh();
      } catch {
        setError(failure);
      }
    });

  const onFilePicked = (file: File) => {
    setError(null);
    setReading(true);
    const kind: Measured['kind'] = file.type.startsWith('video/') ? 'snippet' : 'photo';
    measuring.current = (async () => {
      try {
        if (kind === 'photo') return { kind, frame: await readFrame(file), poster: null };
        const still = await extractPosterFrame(file);
        if (!still) return null;
        const [frame, poster] = await Promise.all([readFrame(still), uploadStill(still, eventId)]);
        return poster ? { kind, frame, poster } : null;
      } catch {
        return null;
      } finally {
        setReading(false);
      }
    })();
  };

  const onUploaded = async (value: string | string[] | null) => {
    const ref = typeof value === 'string' ? value : null;
    if (!ref) return;
    const measured = await measuring.current;
    measuring.current = null;
    if (!measured || measured.frame.length === 0) {
      setError(
        'We could not read the colours of that file, so it was not used — the words over it could not be checked. Please try another one.',
      );
      return;
    }
    save(
      {
        kind: measured.kind,
        media: ref,
        ...(measured.poster ? { poster: measured.poster } : {}),
        tint: { match: true, frame: measured.frame },
      },
      'Your background could not be saved. Please try again.',
    );
  };

  if (themeId === 'house') {
    return (
      <section className="rounded-md bg-white/70 px-3 py-3" data-maker-main-background="">
        <p className="text-[14px] font-semibold text-ink">Your own background</p>
        <p className="mt-0.5 text-[12.5px] text-ink/65">
          Classic is plain paper by design, with no moving background to swap. Pick another theme and you can put
          your own clip or photo behind every scene — and the theme&rsquo;s colours will follow it.
        </p>
      </section>
    );
  }

  const noun = isVideo ? 'video' : 'photo';
  const themeTokens = hubThemePageTokens(theme);

  return (
    <section className="flex flex-col gap-3 rounded-md bg-white/70 px-3 py-3" data-maker-main-background="">
      <div>
        <p className="text-[14px] font-semibold text-ink">
          Your own background
          {!ownsPro ? <span className="ml-2 text-[11px] font-semibold text-ink/55">Pro</span> : null}
        </p>
        <p className="mt-0.5 text-[12.5px] text-ink/65">
          Swap {theme.name}&rsquo;s moving background for your own short clip or photo. Your {theme.name} buttons and
          accents take on its colours; your words stay readable over it.
          {!ownsPro ? ' Try it here — it goes live when you Apply with Event Hub Pro.' : ''}
        </p>
      </div>

      {current ? (
        <div className="flex items-start gap-3">
          {stillUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={stillUrl} alt="" className="h-16 w-24 shrink-0 rounded-md object-cover" />
          ) : null}
          <div className="min-w-0 text-[12.5px] text-ink/70">
            <p className="font-semibold text-ink">Your {noun}{drafted ? ' · in your draft' : ''}</p>
            {adaptive ? (
              <p className="mt-0.5">
                Words read at {adaptive.bodyContrast.toFixed(1)}:1 over it
                {adaptive.scrim > 0 ? ` with a ${Math.round(adaptive.scrim * 100)}% veil` : ''}.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {adaptive && adaptive.scrim >= CALMER_CLIP_SCRIM ? (
        <p role="status" className="rounded-md bg-ink/[0.04] px-2.5 py-2 text-[12px] text-ink/75" data-main-ground-advice="">
          Your words need a strong veil over this {noun} to stay readable, so less of it shows. Try a calmer clip —
          softer light, fewer bright-and-dark patches — and more of it will come through.
        </p>
      ) : null}

      {current?.tint ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="sr-only">Colours</legend>
          {(
            [
              [true, `Match my ${noun}’s colours`],
              [false, 'Keep the theme’s colours'],
            ] as const
          ).map(([value, label]) => {
            const on = (current.tint?.match ?? true) === value;
            return (
              <button
                key={label}
                type="button"
                aria-pressed={on}
                disabled={pending || on}
                data-main-ground-match={value ? 'on' : 'off'}
                onClick={() =>
                  save(
                    { ...current, tint: { ...current.tint!, match: value } },
                    'Your choice could not be saved. Please try again.',
                  )
                }
                className={`sn-press flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors duration-sn-control ease-sn disabled:cursor-default ${
                  on ? 'bg-ink text-cream' : 'bg-white text-ink hover:bg-white/80'
                }`}
              >
                <span className="min-w-0 flex-1 text-[13px] font-semibold">{label}</span>
                {on ? <Check aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2.25} /> : null}
              </button>
            );
          })}
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {matched ? (
              <>
                <Swatch hex={matched.button ?? themeTokens.cta} label="Buttons" />
                <Swatch hex={matched.accent ?? themeTokens.gild} label="Accents" />
                <Swatch hex={matched.ornament} label="Ornaments" />
              </>
            ) : (
              <span className="text-[12px] text-ink/60">
                This {noun} has no strong colour to follow, so the theme keeps its own.
              </span>
            )}
          </div>
        </fieldset>
      ) : null}

      <FileUpload
        bucket="media"
        pathPrefix={`events/${eventId}/main-background`}
        multiple={false}
        maxSizeMB={100}
        acceptedTypes={[...IMAGE_TYPES, ...VIDEO_TYPES]}
        compressImage
        compressVideo
        videoCompressProfile="maker"
        videoSilent
        maxVideoDurationS={MAKER_MAX_CLIP_SECONDS}
        validateFile={makeMakerVideoDurationValidator()}
        onFilePicked={onFilePicked}
        onChange={onUploaded}
        disabled={pending}
        label={current ? 'Choose a different clip or photo' : 'Choose a clip or photo'}
        help={`A clip up to ${MAKER_MAX_CLIP_SECONDS} seconds (it plays silently, on a loop) or a photo.`}
      />
      {reading ? <p className="text-[12px] text-ink/60">Reading its colours…</p> : null}

      {current ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => save(null, 'Your background could not be changed. Please try again.')}
          className="self-start text-[12.5px] font-medium text-ink/60 underline underline-offset-2 transition-colors hover:text-ink disabled:opacity-60"
        >
          Use {theme.name}&rsquo;s own background again
        </button>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md bg-terracotta/10 px-2.5 py-1.5 text-[12px] text-terracotta-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}
