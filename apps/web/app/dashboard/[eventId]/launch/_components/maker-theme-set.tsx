'use client';

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Play, RotateCcw } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { PaidMark } from '@/app/_components/paid-mark';
import { makerProMark, paidMarkLabel } from '@/lib/paid-mark';
import { INVITE_THEMES, isInviteThemeId } from '@/lib/invite-themes';
import { tilesShown, type ThemeTile } from '@/lib/maker-theme-tiles';
import { THEME_SET_PIECES, THEME_SET_PIECE_LABEL, liveThemeSetSources, themeUseLabel, type ThemeSetLabDoors, type ThemeSetPiece, type ThemeSetSources } from '@/lib/theme-set';
import { ThemePickContext } from './theme-pick-context';
// The set's arrival and swap — Maker-only, so not in globals.css (every page parses that one).
import './maker-theme-set.css';

/**
 * 🎬 THE THEME, SHOWN AS ONE MOVING SET — the Maker's Look › Theme (owner 23 Nov 2026: *"animated yes"*; DECISION_LOG
 * "THEMES ARE SHOWN AS THE ANIMATED SET — APPROVED" and "EVENT HUB THEMES BATCH 6 APPROVED", which build it with Maker
 * parts 4–6; drawing `prototypes/maker_theme_set_animated_2026-11-23/` § "2 · Try it, in the Maker").
 *
 *   · THE SET IS THE PREVIEW (Look's body): the five shipped pieces of the theme being tried — the Event Hub page with
 *     its guest bar, the RSVP sheet, the digital ticket, the invitation and the table sign — overlapping as one
 *     composed picture (`lib/theme-set.ts` names each and where it is read from; no piece is drawn a second time here).
 *   · THEY ARRIVE IN TURN, ONCE: the page settles (grows from 94 % and fades in), the RSVP sheet rises a beat after,
 *     the ticket slides out from behind the phone, the invitation and the table sign land from above with a small
 *     turn — Rise 700 ms on the Spring, transform and opacity only. "Play again" repeats it.
 *   · TRYING ANOTHER THEME CROSS-FADES EVERY PIECE IN PLACE (Move 320 ms, Settle). Nothing is saved by trying.
 *   · REDUCE MOTION: no travel; a switch is a 120 ms fade.
 *   · THE CARDS (Look's sheet): one card per theme, its picture at 3 : 4, the picked one ringed and named, ◆ on a
 *     Pro theme. A tap TRIES it (the set re-dresses); "Use <theme>" — the one main button — picks it, through the
 *     ONE pick the shipped theme picker makes (`ThemePickProvider`: into the draft, Undo steps it back, ✓ Apply puts it
 *     live and names a Pro theme there — owner 20 Nov, "Free and Pro see one toolbar … a Free couple can try them").
 *
 * ⛔ Trying never moves the canvas, and the live pages in the set are sandboxed frames of the SAMPLE, never the
 * couple's own page: no top navigation, no pointer, no bridge (`browsing-themes-never-moves-the-canvas.test.ts`).
 */

type SetState = {
  /** The theme the set wears — the one being tried, or the couple's own. */
  trying: string;
  tryTheme: (id: string) => void;
  /** Bumped by "Play again": the arrival plays once more. */
  play: number;
  replay: () => void;
  sources: ThemeSetSources;
};

const ThemeSetContext = createContext<SetState | null>(null);

/** The set and its cards share what is being tried — the body and the sheet are drawn apart by the workspace. */
export function ThemeSetProvider({
  board,
  version,
  lab = null,
  children,
}: {
  /** The sample's palette (`sampleBoardQuery`) — the same board the samples have always worn. */
  board: string | null;
  /** The sample's print-inputs hash — its prints' cache key. */
  version: string | null;
  /** 🧪 A lab's own doors (no sample event there). Never set by the Maker. */
  lab?: ThemeSetLabDoors | null;
  children: ReactNode;
}) {
  const sources = useMemo(() => liveThemeSetSources({ board, version, lab }), [board, version, lab]);
  const pick = useContext(ThemePickContext);
  const picked = pick?.picked ?? 'house';
  const [trying, setTrying] = useState(picked);
  /* The couple's own theme moving (a pick, Undo, Apply) brings the set back to it. */
  useEffect(() => setTrying(picked), [picked]);
  const [play, setPlay] = useState(0);
  return (
    <ThemeSetContext.Provider value={{ trying, tryTheme: setTrying, play, replay: () => setPlay((n) => n + 1), sources }}>
      {children}
    </ThemeSetContext.Provider>
  );
}

function useThemeSet(): SetState | null {
  return useContext(ThemeSetContext);
}

/** Where each piece sits in the composed picture, in % of the set's box (the drawing's "Try it" frame). */
const PLACE: Readonly<Record<ThemeSetPiece, string>> = {
  page: 'left-[3%] top-[3%] w-[52%] h-[86%] z-[2]',
  rsvp: 'left-0 bottom-0 w-[54%] h-[34%] z-[4]',
  ticket: 'right-[2%] bottom-[3%] w-[44%] h-[26%] z-[5]',
  invitation: 'right-[3%] top-0 w-[38%] h-[44%] z-[1]',
  sign: 'right-[6%] top-[42%] w-[28%] h-[30%] z-[3]',
};

/** The live page's own size — the sample is drawn at a phone's width and scaled into its piece. */
const PAGE_W = 390;
const PAGE_H = 760;

/** A live piece (the sample page, or its RSVP sheet): a sandboxed frame, scaled to its box, never touchable. */
function LivePiece({ src, title, bottom }: { src: string; title: string; bottom: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / PAGE_W);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="absolute inset-0 overflow-hidden">
      {scale > 0 ? (
        <iframe
          src={src}
          title={title}
          aria-hidden
          tabIndex={-1}
          sandbox="allow-scripts allow-same-origin"
          loading="lazy"
          data-theme-set-frame=""
          className={`pointer-events-none absolute left-0 origin-top-left border-0 bg-raised ${bottom ? 'bottom-0 origin-bottom-left' : 'top-0'}`}
          style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${scale})` }}
        />
      ) : null}
    </div>
  );
}

/** One piece in one theme. */
function PieceIn({ piece, themeId, sources }: { piece: ThemeSetPiece; themeId: string; sources: ThemeSetSources }) {
  const s = sources(piece, themeId);
  const title = `${THEME_SET_PIECE_LABEL[piece]} — the sample in ${isInviteThemeId(themeId) ? INVITE_THEMES[themeId].name : 'this theme'}`;
  if (s.kind === 'page') return <LivePiece src={s.src} title={title} bottom={piece === 'rsvp'} />;
  // eslint-disable-next-line @next/next/no-img-element -- the sample's print in this theme, an SVG from our own print door
  return <img src={s.src} alt="" decoding="async" className="absolute inset-0 h-full w-full object-contain" />;
}

/**
 * 🎬 THE SET — Look › Theme's body. Each piece keeps the theme it was showing until the next has drawn over it: the
 * last two themes are layered, the newer fading in over the older (Move, Settle), and the older leaves when that ends.
 */
export function ThemeSetBody() {
  const set = useThemeSet();
  const [layers, setLayers] = useState<{ now: string; was: string | null }>(() => ({ now: set?.trying ?? 'house', was: null }));
  useEffect(() => {
    if (!set) return;
    setLayers((l) => (l.now === set.trying ? l : { now: set.trying, was: l.now }));
  }, [set, set?.trying]);
  if (!set) return null;
  const name = isInviteThemeId(layers.now) ? INVITE_THEMES[layers.now].name : 'This theme';
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-3" data-theme-set-body="">
      <figure
        /* The arrival plays once per mount; "Play again" remounts the set. */
        key={set.play}
        role="img"
        aria-label={`${name} on every piece: ${THEME_SET_PIECES.map((p) => THEME_SET_PIECE_LABEL[p]).join(', ')}`}
        data-theme-set={layers.now}
        className="sn-frame relative aspect-[10/11] w-full max-w-[420px] overflow-hidden"
      >
        {THEME_SET_PIECES.map((piece) => (
          <div key={piece} data-theme-set-piece={piece} className={`sn-set-arrive sn-set-arrive--${piece} absolute overflow-hidden rounded-md shadow-sn-frame ${PLACE[piece]}`}>
            {layers.was ? (
              <div className="absolute inset-0" data-theme-set-layer="was">
                <PieceIn piece={piece} themeId={layers.was} sources={set.sources} />
              </div>
            ) : null}
            <div
              key={layers.now}
              className={`absolute inset-0 bg-raised ${layers.was ? 'sn-set-swap' : ''}`}
              data-theme-set-layer="now"
              onAnimationEnd={piece === 'page' ? () => setLayers((l) => (l.was ? { now: l.now, was: null } : l)) : undefined}
            >
              <PieceIn piece={piece} themeId={layers.now} sources={set.sources} />
            </div>
          </div>
        ))}
      </figure>
    </div>
  );
}

/** ◆ on a Pro theme a couple may still try and pick (information, never a lock); nothing in the app-store shell. */
function ProMark({ tier, ownsPro, storeShell }: { tier: ThemeTile['tier']; ownsPro: boolean; storeShell: boolean }) {
  if (tier !== 'pro') return null;
  const mark = makerProMark({ owns: ownsPro, storeShell });
  return mark ? <PaidMark state={mark} word="PLUS" label={paidMarkLabel(mark, 'the full Event Hub')} size="xs" /> : null;
}

/**
 * 🃏 THE CARDS — Look › Theme's sheet: ⓘ Theme, one card per theme (its picture at 3 : 4), then "Play again" and the one
 * main button, "Use <theme>". The theme already theirs reads "Your theme" in place of the button.
 */
export function ThemeSetCards({
  themes,
  posters,
  ownsPro,
  storeShell,
}: {
  /** `pickableInviteThemes` — already fenced to what this celebration may wear. */
  themes: ThemeTile[];
  /** Each theme's picture (its still, or its loop's first frame), resolved — the card's picture. Null: its paper colour. */
  posters: Record<string, string | null>;
  ownsPro: boolean;
  storeShell: boolean;
}) {
  const set = useThemeSet();
  const pick = useContext(ThemePickContext);
  if (!set || !pick) return null;
  const shown = tilesShown(themes, { ownsPro, storeShell, current: pick.picked });
  const tried = shown.find((t) => t.id === set.trying) ?? null;
  const isTheirs = set.trying === pick.picked;
  return (
    <div className="flex flex-col gap-3" data-theme-set-cards="">
      <div className="flex min-h-11 items-center gap-2">
        <InfoTip label="Theme" align="start">
          One theme dresses your whole Event Hub — every stage, page and guest bar — and the RSVP sheet, the digital
          ticket and every print. Tap a theme to see it on all of them; nothing changes until you use it. It goes into your
          draft: Undo steps it back, Apply puts it live.
        </InfoTip>
      </div>
      <ul aria-label="Themes" className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
        {shown.map((t) => {
          const on = t.id === set.trying;
          const poster = posters[t.id] ?? null;
          const paper = isInviteThemeId(t.id) ? INVITE_THEMES[t.id].palette.canvas : undefined;
          return (
            <li key={t.id} className="w-24 shrink-0 snap-start">
              <button
                type="button"
                aria-pressed={on}
                aria-label={`Try ${t.name}${t.id === pick.picked ? ' — your theme' : ''}`}
                onClick={() => set.tryTheme(t.id)}
                data-theme-set-try={t.id}
                className={`sn-press relative block aspect-[3/4] w-full overflow-hidden rounded-md ${on ? 'ring-2 ring-terracotta' : ''}`}
                /* The theme's own paper — product data from the one registry, shown until its picture draws. */
                style={paper ? { backgroundColor: paper } : undefined}
              >
                {poster ? (
                  // eslint-disable-next-line @next/next/no-img-element -- the theme's own picture, already on the public media bucket
                  <img src={poster} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
                ) : null}
                {t.id === pick.picked ? (
                  <span className="absolute left-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-ink text-cream">
                    <Check aria-hidden className="h-3 w-3" strokeWidth={2.5} />
                  </span>
                ) : null}
              </button>
              <span className={`mt-1 flex items-center gap-1 text-sn-12 ${on ? 'font-semibold text-terracotta' : 'text-ink/70'}`}>
                <span className="truncate">{t.name}</span>
                <ProMark tier={t.tier} ownsPro={ownsPro} storeShell={storeShell} />
              </span>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton tone="neutral" icon={RotateCcw} label="Play again" onClick={set.replay} data-theme-set-replay="" />
        {isTheirs ? (
          <span className="inline-flex min-h-11 items-center gap-1.5 text-sn-13 font-semibold text-ink/70" data-theme-set-theirs="">
            <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
            Your theme
          </span>
        ) : tried ? (
          <ActionButton
            tone="brand"
            main
            icon={Play}
            label={themeUseLabel(tried.name)}
            disabled={pick.pending}
            onClick={() => pick.pick(tried.id)}
            data-theme-set-use={tried.id}
          />
        ) : null}
      </div>
      {pick.error ? (
        <p role="alert" className="text-sn-12 text-danger-700">
          {pick.error}
        </p>
      ) : null}
    </div>
  );
}
