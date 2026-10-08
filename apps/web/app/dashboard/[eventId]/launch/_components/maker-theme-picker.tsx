'use client';

import { useContext, useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import Image from 'next/image';
import { Check, Maximize2 } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { PaidMark } from '@/app/_components/paid-mark';
import { makerProMark, paidMarkLabel } from '@/lib/paid-mark';
import { makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import {
  SAMPLE_PRINT_PIECES,
  TILE_GIVE_UP_MS,
  TILE_H,
  TILE_PAGE_H,
  TILE_PAGE_W,
  TILE_SCALE,
  TILE_W,
  nextTileToLoad,
  samplePrintSrc,
  tilesShown,
  type ThemeTile,
} from '@/lib/maker-theme-tiles';
import { sampleHubTileSrc, themeStillSrc } from '@/lib/theme-sample-stills';
import { FREE_THEMES, themeNames } from '@/lib/invite-themes';
import { THEME_OWN_LOOK_RESET, themePickSends } from '@/lib/theme-own-look';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import { hubDraftAction } from '../../website/hub-draft-actions';
import { ThemePreviewOverlay } from './theme-preview-overlay';
import { ThemePickContext, type ThemePick } from './theme-pick-context';

/**
 * THE THEME PICKER — the ONE place the Event Hub's theme is chosen, on the
 * Maker's Details page (owner 2026-09-28, verbatim: *"can you place the themes
 * here? and a quick preview of what the page, prints looks like?"* · *"i we
 * will show a clean preview of each website, we want to show these as sample
 * template with the prints, with the sample event hub"*).
 *
 * Two faces of one picker, sharing one pick (`ThemePickProvider`):
 *   · the GALLERY (the Details body) — one entry per theme: the curated sample
 *     Event Hub's page in that theme, and its prints (The Invitation, The
 *     Finer Details, a pass) in that theme, the same for every couple;
 *   · the MENU (the Details editor) — the same themes as ONE dropdown (owner:
 *     "any set of choices is a dropdown"), with the theme's own line.
 *
 * ── WHAT AN ENTRY IS ───────────────────────────────────────────────────────
 * The SAMPLE (`is_sample`, Maria & Jose), never the couple's own page and
 * never sample words invented here. Its page is a STILL photographed from
 * `/maria-and-jose?theme=<id>` (`lib/theme-sample-stills.ts`); a theme with no
 * still yet shows the live sample page in a small frame, loaded lazily, one at
 * a time. Its prints come from the sample print door (`?sample=1`), public
 * and cached once for every couple.
 *
 * ── ⛔ BROWSING NEVER MOVES THE CANVAS ─────────────────────────────────────
 * The Maker's canvas iframe sits under this page, untouched. A live entry is
 * its OWN small frame of the SAMPLE page (never the couple's canvas door), is
 * sandboxed with no top navigation, takes no pointer and mounts no bridge.
 * Nothing runs on hover or scroll. `browsing-themes-never-moves-the-canvas.test.ts`.
 *
 * ── LOOKING CLOSER NEVER PICKS ─────────────────────────────────────────────
 * The ⤢ on an entry opens that theme full screen OVER the gallery
 * (`ThemePreviewOverlay`, owner 2026-09-28: *"there is no way of getting back
 * to choosing the theme"* · *"or a simple exit preview"*): "Exit preview",
 * Esc and the phone's back gesture all return to the gallery where it was.
 * "Use this theme" there is the same pick as tapping the entry.
 *
 * ── ONLY A PICK CHANGES ANYTHING ───────────────────────────────────────────
 * A pick saves `invite_theme` — and hands the page colour, button colour and
 * typeface back to the theme (`lib/theme-own-look.ts`: one patch, one Undo) —
 * into the DRAFT through the one generic draft
 * action (`hubDraftAction` intent=save — zero new server actions), so the
 * toolbar's Undo steps it back and Apply puts it live. The canvas then wears it
 * the way every Details edit lands: `makerSave` tells the canvas a write is
 * coming, and one Maker refresh follows — the couple's own print cards on
 * Details redraw in it too.
 *
 * ── FREE VS PRO ────────────────────────────────────────────────────────────
 * Each theme's tier is the registry's (`INVITE_THEMES[id].tier`, handed in as
 * `ThemeTile.tier`) — never a list here (owner 2026-09-29: Modern and Cyber Neon
 * joined Classic as free themes). 💎 TRIED FREE, PAID AT APPLY
 * (owner 2026-09-28: *"they can edit it with pro features. but need to upgrade
 * to pro when clicked on apply"*): a couple without Pro picks a Pro theme like
 * any other — it goes into the draft, wears ◆ PRO (information, never a lock),
 * and Apply names it. In the app-store shell a Pro theme is ABSENT: only
 * Classic, plus the couple's own theme if it is already a Pro one.
 *
 * 💡 "Suggested for you" labels the one theme matching the couple's onboarding
 * feel (`themeMatchingFeel`); it applies nothing (owner: *"4 keep it"*).
 */

type Pick = ThemePick;
const PickContext = ThemePickContext;

function usePick(): Pick {
  const v = useContext(PickContext);
  if (!v) throw new Error('A theme picker face is drawn outside its ThemePickProvider.');
  return v;
}

/** The gallery's label — plain words; never the names of somebody else's event on this one (B6). */
export const THEME_SAMPLES_LABEL = 'Each theme on a sample Event Hub';

export function ThemePickProvider({
  eventId,
  current,
  ownLook = false,
  seeds = null,
  samplePalette = null,
  children,
}: {
  eventId: string;
  current: string;
  /** The couple has their own page colour, button colour or typeface set (`hasOwnLook`) — re-tapping the current theme hands it back. */
  ownLook?: boolean;
  /**
   * 🎨 EVERY THEME'S COLOURS AS A MOOD BOARD PALETTE (`themeSeedPalettes`) —
   * handed in ONLY while the couple's Mood Board has no palette (owner
   * 2026-10-05: *"If the mood board does not have a palette, use our original
   * theme and place it on the moodboard's palette"*). A pick then drafts the
   * picked theme's colours into the board beside the theme, one patch, one
   * Undo; Apply puts them live ("Mood Board · Colours from <theme>"). Null =
   * the board has colours, and a pick never touches them.
   */
  seeds?: Record<string, unknown> | null;
  /** The palette the gallery's samples wear (`sampleBoardQuery`). */
  samplePalette?: string | null;
  children: ReactNode;
}) {
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState(current);
  const [error, setError] = useState<string | null>(null);
  /* 🔁 The draft is the one value: Undo, Apply, Restore or another tab move it,
     and the selection follows. */
  useEffect(() => setPicked(current), [current]);
  /* 🎨 An own look is handed back by any pick; the page's next read says if they set one again. */
  const [own, setOwn] = useState(ownLook);
  useEffect(() => setOwn(ownLook), [ownLook]);

  /* ⚡ EVERY TAP COUNTS, THE LAST ONE WINS (owner 2026-09-29: *"make sure 100%
     that there is no slow response on the maker"*). A tap while a save is on
     its way used to be dropped without a word. Now the theme is picked at once,
     and the saves run one after another; a pick already overtaken by a newer
     tap is never sent. A refused save puts back what is saved — only if no
     newer tap has replaced it. */
  const lastTap = useRef<string | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const saved = useRef(current);
  useEffect(() => {
    saved.current = current;
  }, [current]);
  const pick = (id: string) => {
    if (!themePickSends(id, picked, own)) return;
    const hadOwn = own;
    lastTap.current = id;
    setPicked(id);
    setOwn(false);
    setError(null);
    queue.current = queue.current.then(async () => {
      if (lastTap.current !== id) return; // overtaken — the newer tap is sent instead
      let r: { ok: true } | { ok: false; error: string };
      try {
        const fd = new FormData();
        fd.set('intent', 'save');
        const seed = seeds?.[id];
        fd.set('patch', JSON.stringify({ events: { invite_theme: id, ...THEME_OWN_LOOK_RESET, ...(seed ? { role_palette: seed } : {}) } }));
        r = await makerSave(() => hubDraftAction(eventId, fd), requestMakerRefresh);
      } catch {
        r = { ok: false, error: 'That did not save. Please try again.' };
      }
      /* What is saved — put back on a refusal, unless a newer tap took over. */
      const before = saved.current;
      if (r.ok) saved.current = id;
      else if (lastTap.current !== id) return;
      if (!r.ok) {
        setPicked(before);
        setError(r.error);
        setOwn(hadOwn);
      }
    });
    start(async () => {
      await queue.current;
    });
  };

  return <PickContext.Provider value={{ picked, pending, error, pick, samplePalette }}>{children}</PickContext.Provider>;
}

/** ◆ PRO on a Pro theme a couple may still pick (information, never a lock); the diamond once owned; nothing in the app-store shell (`makerProMark`, #6091). */
function ProMark({ tier, ownsPro, storeShell }: { tier: ThemeTile['tier']; ownsPro: boolean; storeShell: boolean }) {
  if (tier !== 'pro') return null;
  const mark = makerProMark({ owns: ownsPro, storeShell });
  return mark ? <PaidMark state={mark} label={paidMarkLabel(mark, 'Event Hub Pro')} size="xs" /> : null;
}

/**
 * THE GALLERY — the Details body while Theme is picked.
 */
export function MakerThemeGallery({
  themes,
  ownsPro,
  storeShell,
  suggested,
  sampleVersion,
  posters = {},
}: {
  /** `pickableInviteThemes` — already fenced to what this celebration may wear. */
  themes: ThemeTile[];
  /** Event Hub Pro, as this viewer is shown it. */
  ownsPro: boolean;
  storeShell: boolean;
  /** The theme matching the couple's onboarding feel, or null — a label only. */
  suggested: string | null;
  /** The sample's print-inputs hash — its prints' cache key. Null: 5 minutes. */
  sampleVersion: string | null;
  /** Each theme's SAVED poster (`INVITE_THEMES[id].media.poster`, the first
   *  frame of its background — already on R2), resolved to an address. Drawn
   *  under an entry until its page (still or live) is there. Classic has none. */
  posters?: Record<string, string | null>;
}) {
  const { picked, pending, error, pick, samplePalette } = usePick();
  const shown = tilesShown(themes, { ownsPro, storeShell, current: picked });
  const [preview, setPreview] = useState<string | null>(null);

  /* ── The lazy entries: only what is in (or near) view loads its pictures,
        and a live page (no still yet) loads one at a time. ── */
  const listRef = useRef<HTMLUListElement>(null);
  const [inView, setInView] = useState<ReadonlySet<string>>(() => new Set());
  const [mounted, setMounted] = useState<string[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const order = shown.map((t) => t.id);
  const orderKey = order.join(',');
  /* 🎨 A still is each theme in its OWN colours (captured with `palette=none`,
     `scripts/capture-theme-samples.ts`) — exactly what an empty board shows.
     A couple with a board of their own sees every entry as the live sample
     wearing it (owner 2026-10-05, "THE MOOD BOARD PALETTE IS THE PRIORITY"). */
  const stillOf = (id: string) => (samplePalette && samplePalette !== 'palette=none' ? null : themeStillSrc(id));
  const live = shown.filter((t) => !stillOf(t.id)).map((t) => t.id);
  const liveKey = live.join(',');

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (typeof IntersectionObserver === 'undefined') {
      // No observer (an old webview): every entry counts as seen — the live pages still one at a time.
      setInView(new Set(order));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        setInView((prev) => {
          const next = new Set(prev);
          for (const e of entries) {
            const id = (e.target as HTMLElement).dataset.themeTile;
            if (!id) continue;
            // Once seen, kept: scrolling back costs nothing.
            if (e.isIntersecting) next.add(id);
          }
          return next;
        });
      },
      { rootMargin: '240px 0px' },
    );
    list.querySelectorAll<HTMLElement>('[data-theme-tile]').forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `order` is keyed by orderKey
  }, [orderKey]);

  useEffect(() => {
    const id = nextTileToLoad(live, { inView, mounted, loading });
    if (!id) return;
    setMounted((m) => [...m, id]);
    setLoading(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `live` is keyed by liveKey
  }, [inView, mounted, loading, liveKey]);

  useEffect(() => {
    if (!loading) return;
    const t = window.setTimeout(() => setLoading((l) => (l === loading ? null : l)), TILE_GIVE_UP_MS);
    return () => window.clearTimeout(t);
  }, [loading]);

  const previewTheme = preview ? (shown.find((t) => t.id === preview) ?? null) : null;

  return (
    <section data-maker-theme-picker="" aria-busy={pending} className="flex flex-col gap-3">
      <p className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-dashed border-ink/25 px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink/60">
          {/* B6: plain words — never the names of somebody else's event. */}
          {THEME_SAMPLES_LABEL}
        </span>
        <InfoTip label="About the samples" align="start">
          Each theme on our sample Event Hub — its page and its prints. Tap one and your own Event Hub and every print wear
          it. Guests see a new theme when you press Apply.
        </InfoTip>
      </p>
      <ul ref={listRef} aria-label="Themes" data-theme-gallery="" className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-3">
        {shown.map((t) => {
          const on = t.id === picked;
          const seen = inView.has(t.id);
          const still = stillOf(t.id);
          const liveSrc = !still && mounted.includes(t.id) ? sampleHubTileSrc(t.id, samplePalette) : null;
          return (
            <li key={t.id} data-theme-tile={t.id} className="relative">
              <button
                type="button"
                aria-pressed={on}
                aria-label={`${t.name}${on ? ' — your theme' : ''}`}
                onClick={() => pick(t.id)}
                data-theme-tile-pick=""
                className={`sn-press flex w-full gap-2 rounded-xl bg-white/70 p-2 text-left shadow-[0_1px_2px_rgba(40,34,24,.08)] ${
                  on ? 'ring-2 ring-ink' : 'ring-1 ring-ink/10'
                }`}
              >
                <span className="relative block shrink-0 overflow-hidden rounded-md bg-white" style={{ width: TILE_W, height: TILE_H }}>
                  {/* ⚖ Pictures at the size they are drawn (next/image, 2× of 132 px),
                      never the full poster — a phone loads a few KB per entry. */}
                  {still && seen ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a committed still, already stored at 360 px (public/theme-samples), versioned by `v`
                    <img src={still} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover object-top" />
                  ) : liveSrc ? (
                    <iframe
                      src={liveSrc}
                      title={`${t.name} — the sample Event Hub in this theme`}
                      aria-hidden
                      tabIndex={-1}
                      /* No top navigation, no pop-ups, no forms: an entry can never
                         move the Maker, whatever the page inside it does. */
                      sandbox="allow-scripts allow-same-origin"
                      loading="lazy"
                      data-theme-tile-frame={t.id}
                      onLoad={() => setLoading((l) => (l === t.id ? null : l))}
                      className="pointer-events-none absolute left-0 top-0 origin-top-left border-0 bg-white"
                      style={{ width: TILE_PAGE_W, height: TILE_PAGE_H, transform: `scale(${TILE_SCALE})` }}
                    />
                  ) : posters[t.id] && seen ? (
                    <Image src={posters[t.id]!} alt="" fill sizes={`${TILE_W}px`} className="object-cover" />
                  ) : (
                    <span aria-hidden className="absolute inset-0 animate-pulse bg-ink/[0.04]" />
                  )}
                  {on ? (
                    <span className="absolute left-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink text-cream">
                      <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </span>
                  ) : null}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1.5" data-theme-tile-prints="">
                  {SAMPLE_PRINT_PIECES.map((p) => (
                    <span key={p} className="flex flex-1 items-center justify-center overflow-hidden rounded bg-ink/[0.04]">
                      {seen ? (
                        // eslint-disable-next-line @next/next/no-img-element -- the sample's print in this theme, from our own route
                        <img
                          src={samplePrintSrc(p, t.id, sampleVersion, samplePalette)}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : null}
                    </span>
                  ))}
                </span>
              </button>
              <div className="mt-1.5 flex items-center gap-1.5 px-1">
                <span className="truncate text-[13px] font-semibold text-ink">{t.name}</span>
                <ProMark tier={t.tier} ownsPro={ownsPro} storeShell={storeShell} />
                {suggested === t.id ? (
                  <span data-theme-suggested="" className="rounded-full bg-terracotta-50 px-2 py-0.5 text-[10.5px] font-semibold text-terracotta-800">
                    Suggested for you
                  </span>
                ) : null}
                {/* ⤢ Look closer — never a pick. */}
                <button
                  type="button"
                  aria-label={`See ${t.name} full screen`}
                  onClick={() => setPreview(t.id)}
                  data-theme-tile-expand={t.id}
                  className="sn-press ml-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink/65 hover:bg-ink/5 hover:text-ink"
                >
                  <Maximize2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p role="alert" className="text-xs text-danger-800">
          {error}
        </p>
      ) : null}
      {previewTheme ? (
        <ThemePreviewOverlay
          theme={previewTheme}
          mark={<ProMark tier={previewTheme.tier} ownsPro={ownsPro} storeShell={storeShell} />}
          picked={picked === previewTheme.id}
          onUse={() => pick(previewTheme.id)}
          onClose={() => setPreview(null)}
          samplePalette={samplePalette}
        />
      ) : null}
    </section>
  );
}

/**
 * THE MENU — the Details editor while Theme is picked: the same themes as ONE
 * dropdown, ◆ on a Pro one. No line under it (owner, live iPhone test
 * 2026-10-05: no captions under controls) — what a theme is shows on the page
 * above the sheet the moment it is picked, and the (i) says the rest.
 */
export function MakerThemeMenu({
  themes,
  ownsPro,
  storeShell,
  filmLine = null,
}: {
  themes: ThemeTile[];
  ownsPro: boolean;
  storeShell: boolean;
  /** 🎞 A line under Theme (it was the Save the Date film's "Same as the Event Hub", which left Look 2026-10-08 — nothing hands one today). */
  filmLine?: ReactNode;
}) {
  const { picked, error, pick } = usePick();
  const shown = tilesShown(themes, { ownsPro, storeShell, current: picked });
  return (
    <div data-maker-theme-menu="" className="flex flex-col gap-2">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <InfoTip label="Theme" align="start">
          Your whole Event Hub wears it — colours, lettering and motion — and so does every print.{' '}
          {themeNames(FREE_THEMES)} are free; the others come with Event Hub Pro. Pick one anyway — Apply names it and
          asks. It goes into your draft: Undo steps it back, Apply puts it live.
        </InfoTip>
        <PickMenu
          label="Theme"
          value={picked}
          dataAttr="data-theme-menu-pick"
          options={shown.map((t) => ({ key: t.id, label: t.tier === 'pro' && !(storeShell && !ownsPro) ? `${t.name} ◆` : t.name }))}
          onPick={pick}
        />
      </div>
      {filmLine}
      {error ? (
        <p role="alert" className="text-xs text-danger-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}

