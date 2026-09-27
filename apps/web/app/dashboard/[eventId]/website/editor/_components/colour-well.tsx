'use client';

import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronDown, Plus, X } from 'lucide-react';
import { colourOpacity, hexToHsv, hsvToHex, wheelPoint, wheelPosition, withOpacity, type Hsv } from '@/lib/colour-wheel';
import { hubElementColor } from '@/lib/element-style';

/**
 * 🎨 KEYNOTE'S SPLIT COLOUR WELL, AND ITS COLOUR PANEL.
 *
 * The approved prototype (`prototypes/maker_toolbars_keynote_pages_2026-09-27
 * .html`): *"Keynote's split well: a wide swatch plus a colour wheel. The wheel
 * opens the Colour panel — wheel, brightness, opacity, your saved colours."*
 * Owner's answer 7: *"yes"* — **a pop-over from the well on desktop, a section
 * of the sheet on the phone** (each is what its platform does). It is ONE panel
 * drawn once: from `lg` it floats under the well; below `lg` it is a plain block
 * in the sheet's flow, so nothing covers the scene on a phone.
 *
 * What it holds, top to bottom: the wheel (hue round the rim, saturation from
 * the centre) · Brightness · Opacity (only where the thing coloured can be
 * see-through) · Current · the theme's colours · Saved colours and "+".
 *
 * 💾 Every tap on a swatch is a choice at once. Dragging the wheel or a slider
 * PREVIEWS as it moves and commits once the hand stops (a short pause) — a
 * drag must not post a save per pixel.
 *
 * 🔖 SAVED COLOURS are (a) the colours this Event Hub already uses, handed in
 * by the page (every element and scene colour the couple chose — they sync
 * because they are the page), and (b) any colour saved with "+", kept on this
 * device for this event (a convenience; a cleared browser forgets only these).
 *
 * 🔒 Only hex digits leave this component — `#rrggbb`, or `#rrggbbaa` below
 * 100% opacity — through the same `hubElementColor` gate the sanitizer uses.
 */

const SAVED_MAX = 16;
const COMMIT_MS = 350;

function readSaved(key: string): string[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(key) ?? '[]');
    return Array.isArray(raw) ? raw.map(hubElementColor).filter((c): c is string => Boolean(c)).slice(0, SAVED_MAX) : [];
  } catch {
    return [];
  }
}
function writeSaved(key: string, list: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(list.slice(0, SAVED_MAX)));
  } catch {
    /* private mode / blocked storage: the colour is still used, only not remembered */
  }
}

export function ColourWell({
  value,
  shown,
  what,
  themeColours,
  usedColours = [],
  savedKey,
  alpha = false,
  onPreview,
  onPick,
  data,
}: {
  /** The colour chosen, or null while it is the theme's own. */
  value: string | null;
  /** What the well paints while `value` is null (the theme's own colour). */
  shown: string;
  /** Whose colour this is, for the panel's heading ("the Names", "this scene"). */
  what: string;
  themeColours: readonly string[];
  /** Colours this Event Hub already uses — the synced half of "Saved colours". */
  usedColours?: readonly string[];
  /** The device key for "+"-saved colours (per event). */
  savedKey: string;
  /** Offer Opacity (a see-through colour). */
  alpha?: boolean;
  /** Show a colour NOW, without saving (a drag in progress). */
  onPreview?: (hex: string) => void;
  /** Choose a colour (saved). */
  onPick: (hex: string) => void;
  data?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const current = value ?? shown;
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(current) ?? { h: 0, s: 0, v: 1 });
  const [opacity, setOpacity] = useState(() => colourOpacity(current));
  const [saved, setSaved] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  /* The value from outside (a save came back, another element was picked). */
  useEffect(() => {
    const next = hexToHsv(current);
    if (next) setHsv(next);
    setOpacity(colourOpacity(current));
  }, [current]);
  useEffect(() => setSaved(readSaved(savedKey)), [savedKey]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  /* Desktop: a pop-over closes on a click outside and on Escape. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (window.matchMedia('(min-width: 1024px)').matches && !wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const hexOf = (h: Hsv, o: number) => (alpha ? withOpacity(hsvToHex(h), o) : hsvToHex(h));
  const pickNow = (hex: string) => {
    if (timer.current) clearTimeout(timer.current);
    const c = hubElementColor(hex);
    if (c) onPick(c);
  };
  /** A drag: on screen now, saved once the hand stops. */
  const drag = (h: Hsv, o: number) => {
    setHsv(h);
    setOpacity(o);
    const hex = hexOf(h, o);
    onPreview?.(hex);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => pickNow(hex), COMMIT_MS);
  };

  const wheelRef = useRef<HTMLDivElement>(null);
  const fromPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = wheelRef.current?.getBoundingClientRect();
    if (!r) return;
    const { h, s } = wheelPoint(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), r.width / 2);
    drag({ h, s, v: hsv.v || 1 }, opacity);
  };
  const dot = wheelPosition(hsv.h, hsv.s, 50);

  const own = [...new Set([...saved, ...usedColours.map((c) => c.toLowerCase())])].filter(
    (c) => !themeColours.map((t) => t.toLowerCase()).includes(c),
  );
  const shownHex = current.slice(0, 7).toUpperCase();

  return (
    <div ref={wrapRef} className="relative min-w-0 flex-1" data-colour-well={data}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          data-colour-well-wide=""
          className="sn-press flex h-11 min-w-0 flex-1 items-center justify-between rounded-lg border border-ink/20 px-2.5 font-mono text-[11px] tracking-wide lg:h-9"
          style={{ background: current, color: readableOn(current) }}
        >
          <span>{value ? shownHex : 'Theme'}</span>
          <ChevronDown aria-hidden className="h-3.5 w-3.5 opacity-80" strokeWidth={2.2} />
        </button>
        <button
          type="button"
          aria-label="Open the Colour panel"
          title="Open the Colour panel"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          data-colour-wheel-button=""
          className="sn-press h-11 w-11 shrink-0 rounded-full shadow-[0_0_0_2px_#fff,0_0_0_3px_rgba(27,26,23,.18)] lg:h-9 lg:w-9"
          style={{ background: WHEEL_BG }}
        />
      </div>

      {/* 📱 On the phone the panel is a full-width section of the sheet: it
          reaches back over the row's label column (`IRow`'s 4.5rem + gap), so
          the wheel is thumb-sized rather than squeezed beside "Colour". */}
      <div
        id={panelId}
        hidden={!open}
        role="group"
        aria-label={`Colour for ${what}`}
        data-colour-panel=""
        className="-ml-[5.125rem] mt-2 rounded-xl border border-ink/10 bg-white p-3 lg:absolute lg:ml-0 lg:right-0 lg:top-full lg:z-40 lg:mt-2 lg:w-[19rem] lg:shadow-[0_24px_48px_-28px_rgba(30,26,18,.45)]"
      >
        <div className="mb-2 flex items-center gap-2 text-[13px]">
          <b className="font-semibold text-ink">Colour</b>
          <span className="text-ink/50">{what}</span>
          <button
            type="button"
            aria-label="Close the Colour panel"
            onClick={() => setOpen(false)}
            className="sn-press ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink/5 text-ink/70 hover:bg-ink/10"
          >
            <X aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div
          ref={wheelRef}
          role="slider"
          aria-label="Colour wheel"
          aria-valuemin={0}
          aria-valuemax={359}
          aria-valuenow={Math.round(hsv.h)}
          aria-valuetext={`Hue ${Math.round(hsv.h)}°, ${Math.round(hsv.s * 100)}% colour`}
          tabIndex={0}
          data-colour-wheel=""
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            fromPointer(e);
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e);
          }}
          onKeyDown={(e) => {
            const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 10 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -10 : 0;
            if (d) {
              e.preventDefault();
              drag({ ...hsv, h: (hsv.h + d + 360) % 360, s: hsv.s || 0.6 }, opacity);
            }
          }}
          className="relative mx-auto mb-2 aspect-square w-[10.5rem] touch-none rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,.08)]"
          style={{ background: WHEEL_BG }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full bg-black"
            style={{ opacity: 1 - hsv.v }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.45)]"
            style={{ left: `${50 + dot.x}%`, top: `${50 + dot.y}%`, background: hsvToHex(hsv) }}
          />
        </div>

        <Slider label="Brightness" value={Math.round(hsv.v * 100)} onChange={(n) => drag({ ...hsv, v: n / 100 }, opacity)} />
        {alpha ? <Slider label="Opacity" value={opacity} onChange={(n) => drag(hsv, n)} /> : null}
        <div className="flex items-center gap-2 py-1.5">
          <span className="w-[4.25rem] shrink-0 text-[11.5px] text-ink/60">Current</span>
          <span className="h-7 w-7 rounded-md border border-black/10" style={{ background: current }} />
          <span className="font-mono text-[11.5px] text-ink/60">{shownHex}</span>
        </div>

        <p className="pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-ink/45">Theme colours</p>
        <div className="grid grid-cols-6 gap-1.5 lg:grid-cols-8">
          {themeColours.map((c) => (
            <Swatch key={c} colour={c} on={value?.slice(0, 7) === c.toLowerCase()} onClick={() => pickNow(c)} />
          ))}
        </div>
        <p className="pb-1.5 pt-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink/45">Saved colours</p>
        <div className="grid grid-cols-6 gap-1.5 lg:grid-cols-8">
          {own.slice(0, SAVED_MAX - 1).map((c) => (
            <Swatch key={c} colour={c} on={value === c} onClick={() => pickNow(c)} />
          ))}
          <button
            type="button"
            title="Save the current colour"
            aria-label="Save the current colour"
            data-colour-save=""
            onClick={() => {
              const c = hubElementColor(current);
              if (!c) return;
              const next = [c, ...saved.filter((s) => s !== c)];
              setSaved(next);
              writeSaved(savedKey, next);
            }}
            className="sn-press grid aspect-square min-h-11 place-items-center lg:min-h-9 rounded-md border border-dashed border-ink/25 text-ink/50 hover:text-ink"
          >
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

const WHEEL_BG =
  'radial-gradient(circle, #fff 0, rgba(255,255,255,0) 68%), conic-gradient(from 0deg, #ff0000, #ffff00 60deg, #00ff00 120deg, #00ffff 180deg, #0000ff 240deg, #ff00ff 300deg, #ff0000 360deg)';

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="flex items-center gap-2 py-1.5">
      <span className="w-[4.25rem] shrink-0 text-[11.5px] text-ink/60">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        data-colour-slider={label.toLowerCase()}
        className="h-11 min-w-0 flex-1 accent-ink lg:h-6"
      />
      <span className="w-9 text-right text-[11.5px] tabular-nums text-ink/70">{value}%</span>
    </label>
  );
}

function Swatch({ colour, on, onClick }: { colour: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`Colour ${colour}`}
      onClick={onClick}
      style={{ background: colour }}
      className={`sn-press aspect-square min-h-11 rounded-md lg:min-h-9 border border-black/10 ${on ? 'ring-2 ring-ink ring-offset-1' : ''}`}
    />
  );
}

/** Black or white — whichever reads on the well's own colour. */
function readableOn(hex: string): string {
  const n = parseInt(hex.slice(1, 7), 16);
  if (Number.isNaN(n)) return '#1b1a17';
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#1b1a17' : '#ffffff';
}
