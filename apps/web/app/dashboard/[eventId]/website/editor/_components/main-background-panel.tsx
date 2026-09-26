'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { FileUpload } from '@/app/_components/file-upload';
import { extractPosterFrame } from '../../../_components/std-media-picker';
import { hubDraftAction } from '../../hub-draft-actions';
import { CALMER_CLIP_SCRIM, measureFrame, resolveAdaptiveTheme } from '@/lib/adaptive-theme';
import { hubThemePageTokens } from '@/lib/hub-theme-tokens';
import { INVITE_THEMES, type InviteThemeId } from '@/lib/invite-themes';
import { PaidMark } from '@/app/_components/paid-mark';
import { paidMarkLabel } from '@/lib/paid-mark';
import { isHubMainFollow, type HubMainGround, type HubMainOwn } from '@/lib/hub-canvas';
import { MAKER_MAX_CLIP_SECONDS, makeMakerVideoDurationValidator } from '@/lib/maker-media-limits';

/**
 * BEHIND EVERY SCENE — your hero, and the theme follows its colours
 * (Event Hub Maker Phase 10).
 *
 * 🔑 THE HERO IS THE MAIN BACKGROUND (owner, 2026-09-25, "six controller
 * questions" item 6): *"whatever they make on the hero scene will be their cover
 * and the main background."* So there is no second upload by default: "Same as
 * my hero" is the first choice and the default, and the adaptive theme — owner,
 * *"Adaptive theme is for PRO – i like this"* — reads the hero's own photo. A
 * couple who wants something else behind the page can still pick "A different
 * clip or photo": an opt-in override, never a step they have to repeat.
 *
 * ── ALL IN THE BROWSER, NO SERVER ─────────────────────────────────────────
 * The hero's photo is read once, here, straight off its public URL (the media
 * bucket answers the app's own origins with CORS) — `HeroFrameSync`, which the
 * Hero workspace mounts too, so a new hero is measured the moment it lands. An
 * override is read the moment it is picked: a photo as it is, a clip through
 * `extractPosterFrame` (the Save-the-Date's frame grab), its still uploaded
 * beside it. `measureFrame` turns the pixels into a handful of colours.
 *
 * ── THE DRAFT, NEVER LIVE ─────────────────────────────────────────────────
 * Every change posts `hubDraftAction` intent=save with the hero row's `main` —
 * the same one draft action the Reveal and the Logo use. A free couple may try
 * it; it goes live at Apply, where Event Hub Pro is asked for.
 *
 * 🔎 A REFUSED SAVE, OR A FRAME THAT COULD NOT BE READ, SAYS SO. Footage whose
 * colours were not measured is never used — its words would sit over pixels
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

/** Upload a clip's still through the same presign route `<FileUpload>` uses. */
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

async function saveMain(eventId: string, main: HubMainGround | null) {
  const fd = new FormData();
  fd.set('intent', 'save');
  fd.set('patch', JSON.stringify({ widgets: { hero: { main } } }));
  return hubDraftAction(eventId, fd);
}

/** Does the stored Main background still need the hero's photo measured? */
function heroNeedsMeasuring(current: HubMainGround | null, heroRef: string | null): boolean {
  if (!heroRef) return false;
  if (current && !isHubMainFollow(current)) return false; // an override is in charge
  return !current || current.of !== heroRef;
}

/**
 * READS THE HERO'S PHOTO so the Main background can follow it. Renders nothing
 * but a status line while it works (and says so if it cannot). Mounted in the
 * Main panel AND beside the Hero workspace — a new hero is measured where it
 * was made, without the couple being asked to do anything.
 *
 * It only ever writes a FOLLOW (`{ follow: 'hero', of, tint }`) and never
 * replaces an override. The couple's colour choice survives a new hero.
 */
export function HeroFrameSync({
  eventId,
  heroRef,
  heroUrl,
  current,
  quiet = false,
}: {
  eventId: string;
  /** The hero photo as the preview shows it (the draft over live), or null. */
  heroRef: string | null;
  /** Its public URL, to read the pixels from. */
  heroUrl: string | null;
  current: HubMainGround | null;
  /** Say nothing while working (the Hero workspace); still says a failure. */
  quiet?: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'reading' | 'failed'>('idle');
  const tried = useRef<string | null>(null);
  const needs = heroNeedsMeasuring(current, heroRef);
  const match = current && isHubMainFollow(current) ? current.tint.match : true;

  useEffect(() => {
    if (!needs || !heroRef || !heroUrl || tried.current === heroRef) return;
    tried.current = heroRef;
    let cancelled = false;
    setState('reading');
    (async () => {
      try {
        const res = await fetch(heroUrl, { mode: 'cors' });
        if (!res.ok) throw new Error(String(res.status));
        const frame = await readFrame(await res.blob());
        if (frame.length === 0) throw new Error('empty frame');
        const r = await saveMain(eventId, { follow: 'hero', of: heroRef, tint: { match, frame } });
        if (!r.ok) throw new Error(r.error);
        if (!cancelled) {
          setState('idle');
          router.refresh();
        }
      } catch {
        if (!cancelled) setState('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needs, heroRef, heroUrl, eventId, match, router]);

  // Once the saved frame is this hero's, there is nothing left to say — the
  // effect may have been torn down by that very refresh before it could.
  if (!needs) return null;
  if (state === 'failed') {
    return (
      <p role="alert" className="text-[12px] text-terracotta-700" data-hero-frame-sync="failed">
        We could not read your hero photo&rsquo;s colours, so the theme&rsquo;s own background stays behind your scenes
        for now. Re-open this panel to try again.
      </p>
    );
  }
  if (state === 'reading' && !quiet) {
    return (
      <p className="text-[12px] text-ink/60" data-hero-frame-sync="reading">
        Reading your hero photo&rsquo;s colours…
      </p>
    );
  }
  return null;
}

function Swatch({ hex, label }: { hex: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink/70">
      <span aria-hidden className="h-4 w-4 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]" style={{ backgroundColor: hex }} />
      {label}
    </span>
  );
}

function Choice({
  on,
  label,
  note,
  disabled,
  onClick,
  data,
}: {
  on: boolean;
  label: string;
  note?: string;
  disabled: boolean;
  onClick: () => void;
  data: Record<string, string>;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled || on}
      onClick={onClick}
      {...data}
      className={`sn-press flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors duration-sn-control ease-sn disabled:cursor-default ${
        on ? 'bg-ink text-cream' : 'bg-white text-ink hover:bg-white/80'
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold">{label}</span>
        {note ? <span className={`block text-[11.5px] ${on ? 'text-cream/80' : 'text-ink/60'}`}>{note}</span> : null}
      </span>
      {on ? <Check aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2.25} /> : null}
    </button>
  );
}

export function MainBackgroundPanel({
  eventId,
  themeId,
  current,
  hero,
  overrideStillUrl,
  drafted,
  ownsPro,
}: {
  eventId: string;
  /** The couple's saved theme. Classic has no moving background at all. */
  themeId: InviteThemeId;
  /** The stored Main background as the preview shows it — the draft over live. */
  current: HubMainGround | null;
  /** The hero (the draft over live): its photo ref and a URL for it. */
  hero: { photoRef: string | null; photoUrl: string | null; hasClip: boolean };
  /** A signed URL for an override's photo or still, for the thumbnail. */
  overrideStillUrl: string | null;
  /** The draft holds a different Main background from what guests see. */
  drafted: boolean;
  ownsPro: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [choosingOwn, setChoosingOwn] = useState(false);
  const measuring = useRef<Promise<Measured | null> | null>(null);

  const theme = INVITE_THEMES[themeId];
  const own: HubMainOwn | null = current && !isHubMainFollow(current) ? current : null;
  const follow = current && isHubMainFollow(current) && current.of === hero.photoRef ? current : null;
  const tint = own?.tint ?? follow?.tint ?? null;
  const onHero = !own && !choosingOwn;

  const adaptive = useMemo(() => (tint ? resolveAdaptiveTheme(theme, tint) : null), [tint, theme]);
  // What the theme would paint with the toggle ON — shown even while it is off,
  // so the couple can see what "match" would do before they choose it.
  const matched = useMemo(
    () => (tint ? resolveAdaptiveTheme(theme, { ...tint, match: true }).tint : null),
    [tint, theme],
  );

  const save = (main: HubMainGround | null, failure: string, after?: () => void) =>
    start(async () => {
      setError(null);
      try {
        const r = await saveMain(eventId, main);
        if (!r.ok) setError(r.error);
        else {
          after?.();
          router.refresh();
        }
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
      () => setChoosingOwn(false),
    );
  };

  if (themeId === 'house') {
    return (
      <section className="rounded-md bg-white/70 px-3 py-3" data-maker-main-background="">
        <p className="text-[14px] font-semibold text-ink">Behind every scene</p>
        <p className="mt-0.5 text-[12.5px] text-ink/65">
          Classic is plain paper by design, with nothing behind your scenes. Pick another theme and your hero photo
          goes behind every scene — and the theme&rsquo;s colours follow it.
        </p>
      </section>
    );
  }

  const noun = own?.kind === 'snippet' ? 'video' : 'photo';
  const themeTokens = hubThemePageTokens(theme);
  const thumb = own ? overrideStillUrl : hero.photoUrl;

  return (
    <section className="flex flex-col gap-3 rounded-md bg-white/70 px-3 py-3" data-maker-main-background="">
      <div>
        <p className="text-[14px] font-semibold text-ink">
          Behind every scene
          <PaidMark
            state={ownsPro ? 'unlocked' : 'locked'}
            text="Pro"
            label={paidMarkLabel(ownsPro ? 'unlocked' : 'locked', 'Event Hub Pro')}
            className="ml-2 align-middle"
          />
        </p>
        <p className="mt-0.5 text-[12.5px] text-ink/65">
          Your hero goes behind every scene, in place of {theme.name}&rsquo;s moving background, and your{' '}
          {theme.name} buttons and accents take on its colours. Your words stay readable over it.
          {!ownsPro ? ' Try it here — it goes live when you Apply with Event Hub Pro.' : ''}
        </p>
      </div>

      <div className="flex flex-col gap-1.5" role="group" aria-label="What is behind every scene">
        <Choice
          on={onHero}
          label="Same as my hero"
          note={hero.photoRef ? 'Change it in Hero and it changes here too.' : 'Add a hero photo in Hero and it goes here too.'}
          disabled={pending}
          data={{ 'data-main-ground-source': 'hero' }}
          onClick={() =>
            own ? save(null, 'Your background could not be changed. Please try again.', () => setChoosingOwn(false)) : setChoosingOwn(false)
          }
        />
        <Choice
          on={!onHero}
          label="A different clip or photo"
          note="Only if you want something other than your hero behind the page."
          disabled={pending}
          data={{ 'data-main-ground-source': 'own' }}
          onClick={() => setChoosingOwn(true)}
        />
      </div>

      {onHero ? (
        hero.photoRef ? (
          <HeroFrameSync eventId={eventId} heroRef={hero.photoRef} heroUrl={hero.photoUrl} current={current} />
        ) : (
          <p className="text-[12.5px] text-ink/65">
            Your hero is the written invitation card, so {theme.name}&rsquo;s own background stays behind your scenes.
          </p>
        )
      ) : null}

      {(onHero && follow) || own ? (
        <div className="flex items-start gap-3">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-16 w-24 shrink-0 rounded-md object-cover" />
          ) : null}
          <div className="min-w-0 text-[12.5px] text-ink/70">
            <p className="font-semibold text-ink">
              {own ? `Your ${noun}` : hero.hasClip ? 'Your hero (its clip plays where it may)' : 'Your hero photo'}
              {drafted ? ' · in your draft' : ''}
            </p>
            {adaptive ? (
              <p className="mt-0.5">
                Words read at {adaptive.bodyContrast.toFixed(1)}:1 over it
                {adaptive.scrim > 0 ? ` with a ${Math.round(adaptive.scrim * 100)}% veil` : ''}.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {adaptive && adaptive.scrim >= CALMER_CLIP_SCRIM && (onHero ? follow : own) ? (
        <p role="status" className="rounded-md bg-ink/[0.04] px-2.5 py-2 text-[12px] text-ink/75" data-main-ground-advice="">
          Your words need a strong veil over this {own ? noun : 'photo'} to stay readable, so less of it shows. A calmer
          one — softer light, fewer bright-and-dark patches — will show more of itself.
        </p>
      ) : null}

      {tint && ((onHero && follow) || own) ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="sr-only">Colours</legend>
          {([true, false] as const).map((value) => (
            <Choice
              key={String(value)}
              on={tint.match === value}
              label={value ? `Match my ${own ? noun : 'photo'}’s colours` : 'Keep the theme’s colours'}
              disabled={pending}
              data={{ 'data-main-ground-match': value ? 'on' : 'off' }}
              onClick={() =>
                save(
                  own ? { ...own, tint: { ...tint, match: value } } : { ...follow!, tint: { ...tint, match: value } },
                  'Your choice could not be saved. Please try again.',
                )
              }
            />
          ))}
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {matched ? (
              <>
                <Swatch hex={matched.button ?? themeTokens.cta} label="Buttons" />
                <Swatch hex={matched.accent ?? themeTokens.gild} label="Accents" />
                <Swatch hex={matched.ornament} label="Ornaments" />
              </>
            ) : (
              <span className="text-[12px] text-ink/60">
                This has no strong colour to follow, so the theme keeps its own.
              </span>
            )}
          </div>
        </fieldset>
      ) : null}

      {!onHero ? (
        <>
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
            label={own ? 'Choose a different clip or photo' : 'Choose a clip or photo'}
            help={`A clip up to ${MAKER_MAX_CLIP_SECONDS} seconds (it plays silently, on a loop) or a photo.`}
          />
          {reading ? <p className="text-[12px] text-ink/60">Reading its colours…</p> : null}
        </>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md bg-terracotta/10 px-2.5 py-1.5 text-[12px] text-terracotta-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}
