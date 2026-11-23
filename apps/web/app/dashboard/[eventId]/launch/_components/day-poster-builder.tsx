'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, CircleDot, Gem, Images, LayoutTemplate, ListChecks, Maximize2, Plus, RotateCcw, Sparkles, Trash2, TriangleAlert, Upload } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { RiseScreen } from '@/app/_components/rise/rise-screen';
import { Sheet } from '@/app/_components/sheet';
import { FormRow, FormRows, SwitchRow } from '@/app/_components/form-row';
import { FileUpload } from '@/app/_components/file-upload';
import { Sk } from '@/components/skeletons';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { useToast } from '@/app/_components/toast/toast-provider';
import { planScreenHref } from '@/lib/plan-buy-doors';
import { printFileName, type PosterPhoto } from '@/lib/print-pieces';
import {
  DAY_POSTER_KEY,
  DAY_POSTER_ROUTE,
  DAY_POSTER_SHOW_KEYS,
  DAY_POSTER_SHOW_LABEL,
  DAY_POSTER_SIZES,
  DAY_POSTER_STYLE_LABEL,
  DAY_POSTER_TEMPLATES,
  DAY_POSTER_TEMPLATE_KEYS,
  DAY_POSTER_FREE_SIZE,
  DEFAULT_DAY_POSTER,
  DEFAULT_DAY_POSTER_SHOW,
  DEFAULT_DAY_POSTER_TEMPLATE,
  DAY_POSTER_LINE_MAX,
  dayPosterChoiceIsPro,
  dayPosterHash,
  dayPosterHref,
  dayPosterLock,
  dayPosterLockWords,
  dayPosterNotReady,
  drawnSupporting,
  mainSlotMm,
  parseDayPoster,
  photoTooSmallFor,
  serializeDayPoster,
  showKeyApplies,
  sizesForTemplate,
  supportingCountLine,
  templateFitsSize,
  type DayPoster,
  type DayPosterLook,
  type DayPosterStyle,
  type DayPosterTemplateKey,
} from '@/lib/day-poster';
import { useRegisterSlide, type PrintSlide } from './prints-view-store';
import { PrintPreview } from './print-preview';
import { PrintSaveButton } from './print-save-button';

/**
 * 🖼 THE OUR DAY POSTER BUILDER (owner 2026-11-13, DECISION_LOG "OUR DAY POSTER — DRAWING APPROVED … IT GETS ITS OWN
 * FULL-SCREEN BUILDER": *"do we create a page so they can build this properly"*; approved drawing v4 §6,
 * `prototypes/approved_2026-11-13/our-day-poster-fable.html`).
 *
 * It RISES full screen (`RiseScreen`, the one full screen — no new page, no second Maker): the live poster on top, the
 * steps in the lower third — Template → Main photo → Supporting photos → What to show → Style & size → Finalize — and on
 * a computer the same steps as rows beside the poster. Every change saves in place (`POST /api/hub-print/day-poster`,
 * the shipped print route — no server action), and the picture is the route's own preview of the SAVED record, so the
 * file is exactly what the picture showed. A photo pick opens the house sheet (`Sheet`), never a page.
 *
 * 🔒 The free/Pro rule is `dayPosterLock` (lib/day-poster.ts) — the same function the route refuses with. A lock here
 * is Problem → Solution → one button to the plan screen; hiding a button is never the lock.
 *
 * Two doors open it: the Prints row ("Make your poster", `DayPosterSlide`) and the end of the Post Event story ("Print
 * your day", `?item=day-poster&build=1`).
 */

export type DayPosterBoot = {
  eventId: string;
  slug: string | null;
  saved: DayPoster | null;
  ownsPro: boolean;
  storeShell: boolean;
  /** The event's print inputs hash (`printInputsVersion`) — salted into each preview address. */
  previewVersion: string | null;
  /** The plan's name, read from the plans (`PLAN_NAME`) — never typed in a screen. */
  planName: string;
  /** 🧪 The dev lab's sample-data stand-in for the route (`app/dev/day-poster-lab`). Absent: the shipped route. */
  base?: string;
};

type PhotoPick = { ref: string; thumbUrl: string | null; source: 'memories' | 'supplier' | 'upload'; full: boolean };
type Picks =
  | { state: 'loading' }
  | { state: 'failed' }
  | { state: 'ok'; picks: PhotoPick[]; refused: boolean; signed: Record<string, string | null>; quality: { until: string | null; ended: boolean } | null; qualityRead: boolean };

type Step = 'template' | 'main' | 'supporting' | 'show' | 'size' | 'finalize';
const STEPS: ReadonlyArray<{ key: Step; label: string; Icon: typeof Check }> = [
  { key: 'template', label: 'Template', Icon: LayoutTemplate },
  { key: 'main', label: 'Main photo', Icon: CircleDot },
  { key: 'supporting', label: 'Supporting photos', Icon: Images },
  { key: 'show', label: 'What to show', Icon: ListChecks },
  { key: 'size', label: 'Style & size', Icon: Maximize2 },
  { key: 'finalize', label: 'Finalize', Icon: Check },
];

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/** The address `?build=1` opens the builder at once (the story's "Print your day"). */
function askedToBuild(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('build') === '1';
}

/* ═══ THE PRINTS ROW ═════════════════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * The Prints page's Our Day poster: its slide (the picture, its spec line, its one free Download, and "Make your poster"
 * — the carousel's `build`), or, outside Studio, the same picture with the same button. The builder rises from here.
 */
export function DayPosterSlide({ boot, studio }: { boot: DayPosterBoot; studio: boolean }) {
  const [open, setOpen] = useState(false);
  const [record, setRecord] = useState<DayPoster>(boot.saved ?? DEFAULT_DAY_POSTER);
  useEffect(() => {
    if (askedToBuild()) setOpen(true);
  }, []);
  const size = DAY_POSTER_SIZES[record.size];
  const t = DAY_POSTER_TEMPLATES[record.template];
  const src = dayPosterHref(boot.eventId, 'screen', 'classic', `&v=${dayPosterHash(record, boot.previewVersion ?? '')}`, boot.base);
  const notReady = dayPosterNotReady(record);
  const started = Boolean(boot.saved || record.main);
  const freeFile = { href: dayPosterHref(boot.eventId, 'print', 'classic', '', boot.base), file: printFileName(boot.slug, `our-day-poster-${record.template}-${DAY_POSTER_FREE_SIZE}`), label: 'Download · A4 free' };
  const line = `${t.name} · ${DAY_POSTER_STYLE_LABEL[record.style]} · ${size.label}`;
  const openBuilder = useCallback(() => setOpen(true), []);
  const slide: PrintSlide = {
    name: 'Our Day poster',
    line,
    paper: {
      item: DAY_POSTER_KEY,
      eventId: boot.eventId,
      src,
      aspect: size.wMm / size.hMm,
      title: 'Our Day poster',
      chips: [line, record.finalizedAt ? 'Finalized' : 'Draft'],
      empty: started ? null : { title: 'Your day, on your wall', line: 'Pick a template and your own photos. Save A4 free.', door: { kind: 'edit', label: 'Make your poster' } },
    },
    // The one free file — only once the poster is ready (it is never saved with an empty photo box) and only A4 Classic.
    download: started && !notReady && record.style === 'photo' && record.size === DAY_POSTER_FREE_SIZE ? freeFile : null,
    build: { label: 'Make your poster', open: openBuilder },
    tip: `A keepsake of your day — your template, your photos, your people. Save A4 free; wall sizes, canvas and your theme come with ${boot.planName}.`,
  };
  return (
    <>
      {studio ? <RegisterDayPosterSlide slide={slide} /> : null}
      {studio ? null : (
        <div data-day-poster-row="" className="flex flex-col items-center gap-3">
          {started ? <PrintPreview src={src} alt="Our Day poster" label="Our Day poster" aspect={size.wMm / size.hMm} /> : null}
          <p className="text-sn-sm text-ink/60">{line}</p>
          <ActionButton tone="brand" main icon={Sparkles} label="Make your poster" onClick={openBuilder} data-day-poster-make="" />
        </div>
      )}
      {open ? (
        <DayPosterBuilder
          boot={boot}
          initial={record}
          onClose={(latest) => {
            setRecord(latest);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

/** The Studio carousel's slide — registered, never drawn here (`useRegisterSlide`, the carousel draws it). */
function RegisterDayPosterSlide({ slide }: { slide: PrintSlide }) {
  useRegisterSlide(DAY_POSTER_KEY, 'day-poster', slide);
  return null;
}

/* ═══ THE BUILDER ════════════════════════════════════════════════════════════════════════════════════════════════════════ */

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'failed'; why: string };

export function DayPosterBuilder({ boot, initial, onClose }: { boot: DayPosterBoot; initial: DayPoster; onClose: (latest: DayPoster) => void }) {
  const toast = useToast();
  const [record, setRecord] = useState<DayPoster>(initial);
  /** What the server holds — the preview draws THIS, so the picture is what the file will be. */
  const [saved, setSaved] = useState<DayPoster>(initial);
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  const [step, setStep] = useState<Step>('template');
  const [look, setLook] = useState<DayPosterLook>('classic');
  const [picks, setPicks] = useState<Picks>({ state: 'loading' });
  const [sheet, setSheet] = useState<null | 'templates' | 'main' | 'supporting'>(null);
  const queued = useRef<{ record: DayPoster; finalize: boolean } | null>(null);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPicks = useCallback(async () => {
    setPicks({ state: 'loading' });
    const res = await fetch(`${boot.base ?? DAY_POSTER_ROUTE}?event=${boot.eventId}&mode=picks`, { cache: 'no-store' }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as (Picks & { ok?: boolean }) | null;
    if (!res?.ok || !body?.ok) return setPicks({ state: 'failed' });
    setPicks({ ...(body as Extract<Picks, { state: 'ok' }>), state: 'ok' });
  }, [boot.eventId]);
  useEffect(() => {
    void loadPicks();
  }, [loadPicks]);

  /** ONE save at a time, the newest record last — a quick run of taps never lands out of order. */
  const flush = useCallback(async () => {
    if (inFlight.current || !queued.current) return;
    const next = queued.current;
    queued.current = null;
    inFlight.current = true;
    setSave({ kind: 'saving' });
    const fd = new FormData();
    fd.set('event_id', boot.eventId);
    fd.set('record', JSON.stringify(serializeDayPoster(next.record)));
    if (next.finalize) fd.set('finalize', '1');
    const res = await fetch(boot.base ?? DAY_POSTER_ROUTE, { method: 'POST', body: fd, headers: { accept: 'application/json' } }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { ok?: boolean; record?: unknown; error?: string } | null;
    inFlight.current = false;
    if (!res?.ok || !body?.ok) {
      const why = body?.error ?? 'That did not save — your poster is as it was.';
      setSave({ kind: 'failed', why });
      toast.error(why);
    } else {
      const back = parseDayPoster(body.record);
      setSaved(back);
      // The server measured a newly picked photo — keep its sides, keep the person's newer choices.
      setRecord((now) => (queued.current ? now : { ...now, main: back.main, supporting: back.supporting, finalizedAt: back.finalizedAt }));
      setSave({ kind: 'saved' });
      if (next.finalize) toast.success('Finalized — saved to your story.');
    }
    if (queued.current) void flush();
  }, [boot.eventId, toast]);

  const change = useCallback(
    (fn: (r: DayPoster) => DayPoster, opts: { now?: boolean; finalize?: boolean } = {}) => {
      setRecord((r) => {
        const next = { ...fn(r), finalizedAt: null };
        queued.current = { record: next, finalize: Boolean(opts.finalize) };
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void flush(), opts.now ? 0 : 350);
        return next;
      });
    },
    [flush],
  );
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const t = DAY_POSTER_TEMPLATES[record.template];
  const size = DAY_POSTER_SIZES[record.size];
  const quality = picks.state === 'ok' ? picks.quality : null;
  const ended = Boolean(quality?.ended);
  const lockOf = (l: DayPosterLook, r: Pick<DayPoster, 'style' | 'size'> = record) =>
    dayPosterLock({ ownsPro: boot.ownsPro, storeShell: boot.storeShell, style: r.style, size: r.size, look: l, fullQualityEnded: ended });
  const classicLock = lockOf('classic');
  const themeLock = lockOf('theme');
  const notReady = dayPosterNotReady(record);
  const shownLook: DayPosterLook = look === 'theme' && !themeLock ? 'theme' : 'classic';
  const src = dayPosterHref(boot.eventId, 'screen', shownLook, `&v=${dayPosterHash(saved, `${boot.previewVersion ?? ''}|${shownLook}`)}`, boot.base);
  const thumbs = useMemo(() => {
    const m = new Map<string, string | null>();
    if (picks.state === 'ok') {
      for (const p of picks.picks) m.set(p.ref, p.thumbUrl);
      for (const [k, v] of Object.entries(picks.signed)) if (!m.get(k)) m.set(k, v);
    }
    return m;
  }, [picks]);
  const keptLine = quality?.until ? (ended ? `Full quality ended ${quality.until}.` : `Print in full quality until ${quality.until}.`) : null;

  const close = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      void flush();
    }
    onClose(record);
  };

  const pickTemplate = (k: DayPosterTemplateKey) =>
    change((r) => {
      const nt = DAY_POSTER_TEMPLATES[k];
      const style: DayPosterStyle = nt.styles.includes(r.style) ? r.style : nt.styles[0]!;
      const fits = sizesForTemplate(nt, style);
      const keep = fits.find((s) => s.id === r.size);
      return { ...r, template: k, style, size: (keep ?? fits[0]!).id };
    });
  const pickStyle = (style: DayPosterStyle) =>
    change((r) => {
      const template = DAY_POSTER_TEMPLATES[r.template].styles.includes(style) ? r.template : DEFAULT_DAY_POSTER_TEMPLATE[style];
      const fits = sizesForTemplate(DAY_POSTER_TEMPLATES[template], style);
      return { ...r, style, template, size: (fits.find((s) => s.id === r.size) ?? fits[0]!).id };
    });

  /* ── The steps' bodies ─────────────────────────────────────────────────────────────────────────────────────────── */

  const stepLine: Record<Step, string> = {
    template: t.name,
    main: record.main ? '1 picked' : 'Not picked yet',
    supporting: supportingCountLine(record),
    show: `${DAY_POSTER_SHOW_KEYS.filter((k) => showKeyApplies(k, t) && record.show[k]).length} on · QR always`,
    size: `${DAY_POSTER_STYLE_LABEL[record.style]} · ${size.label}${dayPosterChoiceIsPro(record.style, record.size, 'classic') ? ' ◆' : ' · Free'}`,
    finalize: record.finalizedAt ? 'Finalized' : 'Saves to your story',
  };

  const photoTile = (p: PosterPhoto, onRemove?: () => void, big = false) => {
    const url = thumbs.get(p.ref) ?? null;
    return (
      <span key={p.ref} className={`relative flex-none overflow-hidden rounded bg-ink/[0.06] ${big ? 'h-28 w-24' : 'h-24 w-20'}`} data-day-poster-photo="">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- a signed, short-lived R2 address; never optimised.
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : picks.state === 'loading' ? (
          <Sk className="h-full w-full" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-center text-sn-3xs text-ink/55">Couldn’t show</span>
        )}
        {onRemove ? (
          <span className="absolute bottom-0 right-0">
            <ActionButton tone="neutral" iconOnly icon={Trash2} label="Take this photo off" onClick={onRemove} />
          </span>
        ) : null}
      </span>
    );
  };

  const lockPanel = (lock: NonNullable<ReturnType<typeof lockOf>>) => {
    const w = dayPosterLockWords(lock, boot.planName, quality?.until ?? null);
    return (
      <div role="note" className="sn-frame flex flex-col gap-2 p-3" data-day-poster-lock={lock}>
        <p className="flex items-center gap-1.5 text-sn-base font-semibold text-ink">
          <span aria-hidden>🔒</span>
          {w.title}
        </p>
        <p className="text-sn-md text-ink/70">
          <b className="font-semibold text-ink/80">Problem · </b>
          {w.problem}
        </p>
        <p className="text-sn-md text-ink/70">
          <b className="font-semibold text-ink/80">Solution · </b>
          {w.solution}
        </p>
        <div className="flex flex-wrap gap-2">
          {lock === 'pro-size' || lock === 'pro-canvas' || lock === 'pro-look' ? (
            <ActionButton tone="brand" icon={Gem} label={`Get ${boot.planName}`} href={planScreenHref(boot.eventId, 'pro')} data-day-poster-get-pro="" />
          ) : null}
          <ActionButton
            tone="neutral"
            icon={Check}
            label="Save A4 free"
            onClick={() => {
              setLook('classic');
              change((r) => {
                const tmpl = DAY_POSTER_TEMPLATES[r.template];
                const a4 = DAY_POSTER_SIZES[DAY_POSTER_FREE_SIZE];
                return templateFitsSize(tmpl, a4) ? { ...r, style: 'photo', size: DAY_POSTER_FREE_SIZE } : { ...r, template: 'collage', style: 'photo', size: DAY_POSTER_FREE_SIZE };
              });
            }}
            data-day-poster-to-a4=""
          />
        </div>
      </div>
    );
  };

  const saves = (
    <div className="flex flex-col gap-2" data-day-poster-saves="">
      {notReady ? (
        <p className="flex items-center gap-1.5 text-sn-md text-ink/70" data-day-poster-not-ready="">
          <TriangleAlert aria-hidden className="h-4 w-4 text-warn-700" strokeWidth={1.9} />
          {notReady}
        </p>
      ) : save.kind === 'saving' || JSON.stringify(serializeDayPoster({ ...record, finalizedAt: null })) !== JSON.stringify(serializeDayPoster({ ...saved, finalizedAt: null })) ? (
        <p className="text-sn-md text-ink/60">Saving your poster…</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {classicLock ? null : (
            <PrintSaveButton
              variant="action"
              href={dayPosterHref(boot.eventId, 'print', 'classic', '', boot.base)}
              file={printFileName(boot.slug, `our-day-poster-${record.template}-${record.size}`)}
              label="Save · Classic (PDF)"
            />
          )}
          {themeLock ? null : (
            <PrintSaveButton
              variant="action"
              main
              href={dayPosterHref(boot.eventId, 'print', 'theme', '', boot.base)}
              file={printFileName(boot.slug, `our-day-poster-${record.template}-${record.size}-theme`)}
              label="Save in your theme ◆"
            />
          )}
        </div>
      )}
      {!notReady && classicLock && themeLock ? lockPanel(classicLock) : null}
      {!notReady && !classicLock && themeLock && themeLock !== 'store' ? (
        <p className="text-sn-sm text-ink/60">Your theme on paper comes with {boot.planName}.</p>
      ) : null}
    </div>
  );

  const bodies: Record<Step, React.ReactNode> = {
    template: (
      <FormRows data="day-poster-template">
        <FormRow name="Template" line="Six keepsake layouts. Your photos stay when you switch.">
          <PickMenu
            label="Template"
            value={record.template}
            options={DAY_POSTER_TEMPLATE_KEYS.filter((k) => DAY_POSTER_TEMPLATES[k].styles.includes(record.style)).map((k) => ({ key: k, label: DAY_POSTER_TEMPLATES[k].name }))}
            onPick={(k) => pickTemplate(k as DayPosterTemplateKey)}
            dataAttr="data-day-poster-template-pick"
          />
        </FormRow>
        <div className="pt-2">
          <ActionButton tone="neutral" icon={LayoutTemplate} label="Browse all six" onClick={() => setSheet('templates')} data-day-poster-browse="" />
        </div>
      </FormRows>
    ),
    main: (
      <div className="flex flex-col gap-3" data-day-poster-step="main">
        <div className="flex items-center gap-3">
          {record.main ? photoTile(record.main, () => change((r) => ({ ...r, main: null })), true) : <span className="text-sn-md text-ink/60">Pick the one photo the poster is built around.</span>}
          <ActionButton tone="neutral" icon={Images} label={record.main ? 'Choose another' : 'Choose a photo'} onClick={() => setSheet('main')} data-day-poster-choose-main="" />
        </div>
        {record.main && photoTooSmallFor(record.main, mainSlotMm(record.template, size)) ? (
          <p role="alert" className="text-sn-md text-warn-700" data-day-poster-small="">
            This photo is {record.main.w} × {record.main.h} pixels — small for {size.label}, so it may print soft.
          </p>
        ) : null}
      </div>
    ),
    supporting: (
      <div className="flex flex-col gap-3" data-day-poster-step="supporting">
        {t.max === 0 ? (
          <p className="text-sn-md text-ink/60">{t.name} uses your main photo only. Your other picks stay for when you switch.</p>
        ) : (
          <>
            <p className="text-sn-md text-ink/70">
              {supportingCountLine(record)} · {t.name} takes {t.min === t.max ? t.max : `${t.min} to ${t.max}`}.
            </p>
            <div className="flex flex-wrap gap-2">
              {drawnSupporting(record).map((p) => photoTile(p, () => change((r) => ({ ...r, supporting: r.supporting.filter((x) => x.ref !== p.ref) }))))}
            </div>
            <span>
              <ActionButton tone="neutral" icon={Plus} label="Add photos" onClick={() => setSheet('supporting')} data-day-poster-add-supporting="" />
            </span>
          </>
        )}
      </div>
    ),
    show: (
      <FormRows data="day-poster-show">
        {DAY_POSTER_SHOW_KEYS.filter((k) => showKeyApplies(k, t)).map((k) => (
          <SwitchRow
            key={k}
            name={DAY_POSTER_SHOW_LABEL[k]}
            on={record.show[k]}
            onChange={(on) => change((r) => ({ ...r, show: { ...r.show, [k]: on } }))}
            data={`day-poster-show-${k}`}
            line={k === 'credits' ? 'Your booked suppliers, small, at the foot.' : k === 'line' ? 'Your closing words, or your own line below.' : undefined}
          />
        ))}
        {record.show.line ? (
          <label className="flex flex-col gap-1 py-2" data-form-row="day-poster-line">
            <span className="text-sn-base text-ink">Your line</span>
            <input
              className="input-field w-full"
              defaultValue={record.line ?? ''}
              maxLength={DAY_POSTER_LINE_MAX}
              placeholder="Your closing words"
              aria-label="Your line"
              onBlur={(e) => {
                const v = e.currentTarget.value.trim() || null;
                if (v !== record.line) change((r) => ({ ...r, line: v }), { now: true });
              }}
            />
          </label>
        ) : null}
        <FormRow name="QR · Our story" line="Always printed — it opens your Event Hub, and your story after the day." data="day-poster-qr" />
        {t.rolls ? null : <p className="pt-2 text-sn-sm text-ink/55">Sponsors and the entourage print on Collage and Words + one photo.</p>}
      </FormRows>
    ),
    size: (
      <div className="flex flex-col gap-3" data-day-poster-step="size">
        <FormRows data="day-poster-size">
          <FormRow name="Style">
            <PickMenu
              label="Style"
              value={record.style}
              options={(['photo', 'canvas'] as const).map((s) => ({ key: s, label: s === 'canvas' ? `${DAY_POSTER_STYLE_LABEL[s]} ◆` : DAY_POSTER_STYLE_LABEL[s] }))}
              onPick={(k) => pickStyle(k as DayPosterStyle)}
              dataAttr="data-day-poster-style-pick"
            />
          </FormRow>
          <FormRow name="Size">
            <PickMenu
              label="Size"
              value={record.size}
              options={sizesForTemplate(t, record.style).map((s) => ({ key: s.id, label: `${s.label}${s.id === DAY_POSTER_FREE_SIZE ? ' · Free' : ' ◆'}` }))}
              onPick={(k) => change((r) => ({ ...r, size: k as DayPoster['size'] }))}
              dataAttr="data-day-poster-size-pick"
            />
          </FormRow>
          <FormRow name="Look">
            <PickMenu
              label="Look"
              value={look}
              options={[
                { key: 'classic', label: 'Classic' },
                { key: 'theme', label: 'Your theme ◆' },
              ]}
              onPick={(k) => setLook(k as DayPosterLook)}
              dataAttr="data-day-poster-look-pick"
            />
          </FormRow>
        </FormRows>
        {keptLine ? (
          <p className="text-sn-md text-ink/70" data-day-poster-kept="">
            {keptLine}
          </p>
        ) : picks.state === 'ok' && !picks.qualityRead ? (
          <p className="text-sn-md text-ink/60">Couldn’t read your full-quality date just now.</p>
        ) : null}
        {look === 'theme' ? (themeLock ? lockPanel(themeLock) : null) : classicLock ? lockPanel(classicLock) : null}
      </div>
    ),
    finalize: (
      <div className="flex flex-col gap-3" data-day-poster-step="finalize">
        <p className="text-sn-md text-ink/70">
          {record.finalizedAt ? 'Finalized. Change anything and it is a draft again until you finalize once more.' : 'Finalize stamps this design as your poster and saves it with your story.'}
        </p>
        <span>
          <ActionButton
            tone="brand"
            main
            icon={Check}
            label={record.finalizedAt ? 'Finalize again' : 'Finalize'}
            disabled={Boolean(notReady)}
            onClick={() => change((r) => r, { now: true, finalize: true })}
            data-day-poster-finalize=""
          />
        </span>
        {saves}
      </div>
    ),
  };

  const at = STEPS.findIndex((s) => s.key === step);
  const nextStep = STEPS[at + 1];
  const saidSave =
    save.kind === 'saving' ? 'Saving…' : save.kind === 'failed' ? 'Couldn’t save' : save.kind === 'saved' || boot.saved ? 'Saved ✓' : null;

  return (
    <RiseScreen
      title="Our Day poster"
      line={`${t.name} · ${size.label}`}
      data="day-poster-builder"
      kind="zoom"
      fill
      onClose={close}
      actions={
        <>
          {saidSave ? (
            <span className={`text-sn-sm font-semibold ${save.kind === 'failed' ? 'text-warn-700' : 'text-success-700'}`} data-day-poster-saved={save.kind}>
              {saidSave}
            </span>
          ) : null}
          {save.kind === 'failed' ? (
            <ActionButton tone="neutral" icon={RotateCcw} label="Try again" onClick={() => change((r) => r, { now: true })} />
          ) : (
            <ActionButton
              tone="neutral"
              iconOnly
              icon={RotateCcw}
              label="Start the design over"
              onClick={() => {
                change((r) => ({ ...DEFAULT_DAY_POSTER, main: r.main, supporting: r.supporting, line: r.line, show: { ...DEFAULT_DAY_POSTER_SHOW } }), { now: true });
                setLook('classic');
                toast.success('Started over — your photos stay.');
              }}
              data-day-poster-reset=""
            />
          )}
        </>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* The poster — the route's own preview of the saved record. */}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 bg-ink/[0.04] px-4 py-3" data-day-poster-preview="">
          <div className="flex max-h-full min-h-0 w-full max-w-[320px] flex-1 items-center justify-center lg:max-w-[480px]">
            {record.main ? (
              <PrintPreview src={src} alt="Your Our Day poster" label="poster" priority aspect={size.style === 'canvas' ? (size.wMm + 101.6) / (size.hMm + 101.6) : size.wMm / size.hMm} />
            ) : (
              <div className="sn-frame flex aspect-[210/297] w-full max-w-[240px] flex-col items-center justify-center gap-2 p-4 text-center" data-day-poster-empty="">
                <Images aria-hidden className="h-6 w-6 text-ink/50" strokeWidth={1.75} />
                <p className="text-sn-base font-semibold text-ink">Pick your main photo</p>
                <p className="text-sn-sm text-ink/60">Your poster draws here as you build it.</p>
              </div>
            )}
          </div>
          <p className="text-sn-sm text-ink/60">
            {t.name} · {size.label}
            {shownLook === 'theme' ? ' · your theme' : ' · Classic'}
          </p>
        </div>

        {/* 📱 The lower third: the step strip, then the step. 🖥 The same steps as rows beside the poster. */}
        <div className="flex max-h-[46dvh] flex-none flex-col border-t border-ink/10 bg-cream lg:max-h-none lg:border-l lg:border-t-0">
          <p className="px-4 pt-2 text-sn-xs text-ink/55">
            Prints › Our Day poster › <b className="font-semibold text-ink/80">{STEPS[at]!.label}</b>
          </p>
          <nav aria-label="Steps" className="flex flex-none gap-1 overflow-x-auto px-2 pb-1 lg:hidden" data-day-poster-steps="">
            {STEPS.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-current={s.key === step ? 'step' : undefined}
                onClick={() => setStep(s.key)}
                className={`sn-press flex min-h-11 min-w-[64px] flex-1 flex-col items-center justify-center gap-0.5 rounded px-1 text-sn-2xs ${s.key === step ? 'font-semibold text-sn-accent' : 'text-ink/60'}`}
                data-day-poster-step-tab={s.key}
              >
                <s.Icon aria-hidden className="h-4 w-4" strokeWidth={1.9} />
                <span className="leading-tight">{s.label}</span>
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-2 lg:hidden">
            {bodies[step]}
            {nextStep ? (
              <div className="pt-3">
                <ActionButton tone="neutral" icon={Check} label={`Next · ${nextStep.label}`} onClick={() => setStep(nextStep.key)} className="w-full" data-day-poster-next="" />
              </div>
            ) : null}
          </div>
          {/* 🖥 Every step at once, as numbered rows. */}
          <div className="hidden min-h-0 flex-1 flex-col gap-0 overflow-y-auto px-4 pb-4 lg:flex" data-day-poster-desk="">
            {STEPS.map((s, i) => (
              <section key={s.key} className="border-b border-ink/10 py-3" data-day-poster-desk-step={s.key}>
                <button type="button" onClick={() => setStep(s.key)} className="flex min-h-11 w-full items-center gap-3 text-left" aria-expanded={step === s.key}>
                  <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-sn-xs font-semibold ${step === s.key ? 'bg-sn-accent text-sn-on-accent' : 'bg-ink/[0.08] text-ink/70'}`}>{i + 1}</span>
                  <span className="flex-1 text-sn-base font-semibold text-ink">{s.label}</span>
                  <span className="text-sn-sm text-ink/60">{stepLine[s.key]}</span>
                </button>
                {step === s.key ? <div className="pt-2">{bodies[s.key]}</div> : null}
              </section>
            ))}
            {step === 'finalize' ? null : <div className="pt-3">{saves}</div>}
          </div>
        </div>
      </div>

      {sheet === 'templates' ? <TemplatesSheet value={record.template} style={record.style} onPick={(k) => (pickTemplate(k), setSheet(null))} onClose={() => setSheet(null)} /> : null}
      {sheet === 'main' || sheet === 'supporting' ? (
        <PhotosSheet
          eventId={boot.eventId}
          mode={sheet}
          picks={picks}
          retry={loadPicks}
          chosen={sheet === 'main' ? (record.main ? [record.main.ref] : []) : record.supporting.map((p) => p.ref)}
          max={sheet === 'main' ? 1 : t.max}
          blocked={sheet === 'supporting' && record.main ? [record.main.ref] : []}
          onDone={(refs, uploaded) => {
            const as = (ref: string): PosterPhoto => [record.main, ...record.supporting].find((p) => p?.ref === ref) ?? { ref, w: null, h: null };
            if (sheet === 'main') change((r) => ({ ...r, main: refs[0] ? as(refs[0]) : r.main, supporting: r.supporting.filter((p) => p.ref !== refs[0]) }), { now: true });
            else change((r) => ({ ...r, supporting: [...refs.map(as), ...r.supporting.slice(t.max).filter((p) => !refs.includes(p.ref))] }), { now: true });
            setSheet(null);
            if (uploaded) void loadPicks();
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </RiseScreen>
  );
}

/* ═══ THE SHEETS ═════════════════════════════════════════════════════════════════════════════════════════════════════════ */

/** "Browse all six" — every template with its photos, its people and its styles (drawing v4 §2d). */
function TemplatesSheet({ value, style, onPick, onClose }: { value: DayPosterTemplateKey; style: DayPosterStyle; onPick: (k: DayPosterTemplateKey) => void; onClose: () => void }) {
  const head = useId();
  return (
    /* backCloses off: the builder holds the one history entry (`RiseScreen`) — closing this sheet must not close it. */
    <Sheet open onClose={onClose} title="Templates" labelledById={head} backCloses={false}>
      <h2 id={head} className="sr-only">
        Templates
      </h2>
      <ul className="flex flex-col gap-2 px-4 pb-4" data-day-poster-templates="">
        {DAY_POSTER_TEMPLATE_KEYS.map((k) => {
          const tt = DAY_POSTER_TEMPLATES[k];
          const on = k === value;
          return (
            <li key={k}>
              <button
                type="button"
                onClick={() => onPick(k)}
                aria-pressed={on}
                className={`sn-press sn-frame flex w-full flex-col items-start gap-1 p-3 text-left ${on ? 'ring-2 ring-sn-accent' : ''}`}
                data-day-poster-template={k}
              >
                <span className="flex items-center gap-2 text-sn-base font-semibold text-ink">
                  {tt.name}
                  {k === DEFAULT_DAY_POSTER_TEMPLATE.photo ? <span className="text-sn-2xs font-semibold uppercase tracking-[0.14em] text-sn-accent">Default</span> : null}
                </span>
                <span className="text-sn-md text-ink/70">{tt.line}</span>
                <span className="text-sn-sm text-ink/55">
                  {tt.styles.map((s) => DAY_POSTER_STYLE_LABEL[s]).join(' · ')}
                  {tt.rolls ? ' · your people' : ''}
                  {tt.minSize ? ` · ${DAY_POSTER_SIZES[tt.minSize].label.split(' · ')[0]} and larger` : ''}
                  {tt.styles.includes(style) ? '' : ` · switches to ${DAY_POSTER_STYLE_LABEL[tt.styles[0]!]}`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

/**
 * The photo picker — Memories (the Papic frames, a supplier's on-the-day shots among them) and the phone, in the house
 * sheet. Up to `max`; the order picked is the order drawn.
 */
function PhotosSheet({
  eventId,
  mode,
  picks,
  retry,
  chosen,
  max,
  blocked,
  onDone,
  onClose,
}: {
  eventId: string;
  mode: 'main' | 'supporting';
  picks: Picks;
  retry: () => void;
  chosen: string[];
  max: number;
  blocked: string[];
  onDone: (refs: string[], uploaded: boolean) => void;
  onClose: () => void;
}) {
  const head = useId();
  const [sel, setSel] = useState<string[]>(chosen.slice(0, max));
  const [uploaded, setUploaded] = useState<string[]>([]);
  const toggle = (ref: string) =>
    setSel((s) => (s.includes(ref) ? s.filter((r) => r !== ref) : max === 1 ? [ref] : s.length >= max ? s : [...s, ref]));
  const list = picks.state === 'ok' ? picks.picks.filter((p) => !blocked.includes(p.ref)) : [];
  const title = mode === 'main' ? 'Your main photo' : `Supporting photos · up to ${max}`;
  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      labelledById={head}
      backCloses={false}
      foot={
        <div className="flex gap-2 px-4 py-3">
          <ActionButton tone="brand" main icon={Check} label={mode === 'main' ? 'Use this photo' : `Use ${sel.length}`} disabled={sel.length === 0} onClick={() => onDone(sel, uploaded.length > 0)} data-day-poster-photos-done="" />
        </div>
      }
    >
      <h2 id={head} className="sr-only">
        {title}
      </h2>
      <div className="flex flex-col gap-3 px-4 pb-4" data-day-poster-photos={mode}>
        <FileUpload
          bucket="media"
          pathPrefix={`events/${eventId}/poster`}
          multiple={false}
          maxSizeMB={30}
          acceptedTypes={IMAGE_TYPES}
          onChange={(v) => {
            const ref = typeof v === 'string' ? v : null;
            if (!ref) return;
            setUploaded((u) => [...u, ref]);
            setSel((s) => (max === 1 ? [ref] : s.length >= max ? s : [...s, ref]));
          }}
          label="From your phone"
        />
        {uploaded.length ? <p className="text-sn-sm text-success-700">{uploaded.length === 1 ? 'Your photo is added.' : `${uploaded.length} photos added.`}</p> : null}
        <p className="text-sn-xs font-semibold uppercase tracking-[0.14em] text-ink/55">
          <Upload aria-hidden className="mr-1 inline h-3.5 w-3.5" strokeWidth={1.9} />
          From your Memories
        </p>
        {picks.state === 'loading' ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Sk key={i} className="aspect-[3/4] w-full" />
            ))}
          </div>
        ) : picks.state === 'failed' || (picks.state === 'ok' && picks.refused && list.length === 0) ? (
          <div className="flex flex-col items-start gap-2" data-day-poster-photos-failed="">
            <p className="text-sn-md text-ink/70">Couldn’t read your Memories just now.</p>
            <ActionButton tone="neutral" icon={RotateCcw} label="Try again" onClick={retry} />
          </div>
        ) : list.length === 0 ? (
          <p className="text-sn-md text-ink/60" data-day-poster-photos-none="">
            No photos in your Memories yet. Add one from your phone.
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {list.map((p) => {
              const n = sel.indexOf(p.ref);
              return (
                <li key={p.ref}>
                  <button
                    type="button"
                    aria-pressed={n >= 0}
                    aria-label={`${p.source === 'supplier' ? 'Your supplier’s photo' : 'Photo'}${n >= 0 ? `, picked ${n + 1}` : ''}`}
                    onClick={() => toggle(p.ref)}
                    className={`sn-press relative block aspect-[3/4] w-full overflow-hidden rounded bg-ink/[0.06] ${n >= 0 ? 'ring-2 ring-sn-accent' : ''}`}
                    data-day-poster-pick={p.source}
                  >
                    {p.thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a signed, short-lived R2 address.
                      <img src={p.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-sn-3xs text-ink/55">Couldn’t show</span>
                    )}
                    {n >= 0 ? (
                      <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-sn-accent text-sn-xs font-semibold text-sn-on-accent">{max === 1 ? '✓' : n + 1}</span>
                    ) : null}
                    {p.full ? null : <span className="absolute bottom-1 left-1 rounded-full bg-ink/70 px-1.5 text-sn-3xs text-cream">Web size</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
