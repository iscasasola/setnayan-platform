'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { PaidMark } from '@/app/_components/paid-mark';
import { makerProMark, paidMarkLabel } from '@/lib/paid-mark';
import { makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import { makerThemeTileSrc } from '@/lib/maker-made-once-pages';
import {
  TILE_GIVE_UP_MS,
  TILE_H,
  TILE_PAGE_H,
  TILE_PAGE_W,
  TILE_SCALE,
  TILE_W,
  nextTileToLoad,
  tilesShown,
  type ThemeTile,
} from '@/lib/maker-theme-tiles';
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import { FREE_THEMES, themeNames } from '@/lib/invite-themes';
import { hubDraftAction } from '../../website/hub-draft-actions';
import { useMaker } from './maker-context';

/**
 * THE THEME PICKER — on the Maker's Details page (owner 2026-09-28, verbatim:
 * *"this should be a quick preview of how the page would look like with the
 * template. but is should not be inside guestlist, it should be on event hub
 * maker on details"* · *"we don't want you moving the iframe. we want the theme
 * picker to be there actively editable and a complete preview of what each
 * theme would look like"*).
 *
 * ── WHAT EACH TILE IS ──────────────────────────────────────────────────────
 * The couple's OWN page — their names, their hero, their scenes, their draft —
 * drawn by the guest page itself in that theme (`makerThemeTileSrc` →
 * `?editor=1&theme=<id>`, honoured for a verified host only by
 * `canvasTriedTheme`), shrunk into a tile. Never a swatch, never sample words:
 * the one renderer and the one theme gate (`resolveHubTheme`) draw it.
 *
 * ── ⛔ BROWSING NEVER MOVES THE CANVAS ─────────────────────────────────────
 * The Maker's canvas iframe sits under this page, untouched. A tile is its OWN
 * small frame: scrolling the rail, hovering or looking at a tile loads only
 * that tile, and a tile never mounts the click-to-edit bridge, so nothing it
 * does is heard by the Maker as the canvas. The rail scrolls itself with
 * `scrollLeft` — never `scrollIntoView`, which also scrolls every ancestor.
 * Held by `browsing-themes-never-moves-the-canvas.test.ts`.
 *
 * ── ONLY A PICK CHANGES ANYTHING ───────────────────────────────────────────
 * A tap saves `invite_theme` into the DRAFT through the one generic draft
 * action (`hubDraftAction` intent=save — zero new server actions), exactly as
 * the RSVP page's switches do, so the toolbar's Undo steps it back and Apply
 * puts it live. The canvas then wears it the way every Details edit lands:
 * `makerSave` tells the canvas a write is coming, and one Maker refresh follows.
 *
 * ── LOAD WEIGHT (phone first) ──────────────────────────────────────────────
 * Ten whole pages must not load at once on a phone. A tile gets its frame only
 * once it is in (or next to) the rail's view, and ONE frame loads at a time —
 * the next waits for the last to finish (or a 12 s give-up). A loaded tile
 * keeps its frame, so scrolling back costs nothing.
 *
 * ── FREE VS PRO ────────────────────────────────────────────────────────────
 * The free themes — Classic, Modern and Cyber Neon since 2026-09-29 (*"Okay use
 * modern and cyber FREE"*), read from `FREE_THEMES`, never typed — are free;
 * every other theme is Event Hub Pro (owner 2026-09-28, "WHAT IS FREE VS PRO …
 * REDRAWN"). 💎 TRIED FREE, PAID AT APPLY (owner 2026-09-28,
 * verbatim: *"they can edit it with pro features. but need to upgrade to pro
 * when clicked on apply"*): a couple without Pro PICKS a Pro theme like any
 * other — it goes into the draft, the canvas wears it (`app/[slug]/page.tsx`,
 * `theme_try_on` for the verified host), the tile wears ◆ PRO, and Apply's sheet
 * names it ("Theme · Velvet"). Owning couples see the diamond. In the app-store
 * shell a Pro door is ABSENT: only the free themes, plus the couple's own theme
 * if it is already a Pro one (the shipped picker's rule).
 */
export function MakerThemePicker({
  eventId,
  home,
  themes,
  current,
  ownsPro,
  storeShell,
}: {
  eventId: string;
  /** The couple's public page (`/<slug>`), or null with no address yet. */
  home: string | null;
  /** `pickableInviteThemes` — already fenced to what this celebration may wear. */
  themes: ThemeTile[];
  /** The theme being edited: drafted over live, through the theme gate. */
  current: string;
  /** Event Hub Pro, as this viewer is shown it. */
  ownsPro: boolean;
  storeShell: boolean;
}) {
  const maker = useMaker();
  const stage: LifecyclePhase = maker?.stage ?? 'rsvp';
  const shown = tilesShown(themes, { ownsPro, storeShell, current });

  const [pending, start] = useTransition();
  const [picked, setPicked] = useState(current);
  const [error, setError] = useState<string | null>(null);
  /* 🔁 The draft is the one value: Undo, Apply, Restore or another tab move it,
     and the selection follows. */
  useEffect(() => setPicked(current), [current]);

  /* ── The lazy, one-at-a-time frames ── */
  const railRef = useRef<HTMLUListElement>(null);
  const [inView, setInView] = useState<ReadonlySet<string>>(() => new Set());
  const [mounted, setMounted] = useState<string[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const order = shown.map((t) => t.id);
  const orderKey = order.join(',');

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    if (typeof IntersectionObserver === 'undefined') {
      // No observer (an old webview): every tile counts as seen — still one at a time.
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
            if (e.isIntersecting) next.add(id);
            else next.delete(id);
          }
          return next;
        });
      },
      // The rail is the root: only what is in (or one tile beside) ITS view loads.
      { root: rail, rootMargin: `0px ${TILE_W + 16}px` },
    );
    rail.querySelectorAll<HTMLElement>('[data-theme-tile]').forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `order` is keyed by orderKey
  }, [orderKey]);

  useEffect(() => {
    if (!home) return;
    const id = nextTileToLoad(order, { inView, mounted, loading });
    if (!id) return;
    setMounted((m) => [...m, id]);
    setLoading(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `order` is keyed by orderKey
  }, [inView, mounted, loading, orderKey, home]);

  useEffect(() => {
    if (!loading) return;
    const t = window.setTimeout(() => setLoading((l) => (l === loading ? null : l)), TILE_GIVE_UP_MS);
    return () => window.clearTimeout(t);
  }, [loading]);

  /* The couple's own theme starts in view — the RAIL scrolls, nothing else. */
  useEffect(() => {
    const rail = railRef.current;
    const tile = rail?.querySelector<HTMLElement>(`[data-theme-tile="${current}"]`);
    if (rail && tile) rail.scrollLeft = Math.max(0, tile.offsetLeft - rail.offsetLeft - 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, []);

  const pick = (id: string) => {
    if (id === picked || pending) return;
    const before = picked;
    setPicked(id);
    setError(null);
    start(async () => {
      try {
        const fd = new FormData();
        fd.set('intent', 'save');
        fd.set('patch', JSON.stringify({ events: { invite_theme: id } }));
        const r = await makerSave(() => hubDraftAction(eventId, fd), requestMakerRefresh);
        if (!r.ok) {
          setPicked(before);
          setError(r.error);
        }
      } catch {
        setPicked(before);
        setError('That did not save. Please try again.');
      }
    });
  };

  return (
    <section data-maker-theme-picker="" aria-busy={pending} className="flex flex-col gap-2 border-b border-ink/10 pb-5">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <InfoTip label="Theme" align="start">
          Your whole Event Hub wears it — colours, lettering and motion. Each preview is your own page. Guests see a new
          theme when you press Apply. {themeNames(FREE_THEMES)} are free; the others come with Event Hub Pro.
        </InfoTip>
      </p>
      <ul
        ref={railRef}
        aria-label="Themes"
        data-theme-rail=""
        className="-mx-2 flex snap-x snap-mandatory scroll-px-2 gap-3 overflow-x-auto overscroll-x-contain px-2 pb-1 pt-1"
      >
        {shown.map((t) => {
          const mark = t.tier === 'pro' ? makerProMark({ owns: ownsPro, storeShell }) : null;
          const on = t.id === picked;
          const src = mounted.includes(t.id) ? makerThemeTileSrc(home, stage, t.id) : null;
          const face = (
            <>
              <span
                className={`relative block overflow-hidden rounded-md bg-white shadow-[0_1px_2px_rgba(40,34,24,.08)] ${
                  on ? 'ring-2 ring-ink ring-offset-2 ring-offset-cream' : 'ring-1 ring-ink/10'
                }`}
                style={{ width: TILE_W, height: TILE_H }}
              >
                {src ? (
                  <iframe
                    src={src}
                    title={`${t.name} — your page in this theme`}
                    aria-hidden
                    tabIndex={-1}
                    /* No top navigation, no pop-ups, no forms: a tile can never
                       move the Maker, whatever the page inside it does. */
                    sandbox="allow-scripts allow-same-origin"
                    data-theme-tile-frame={t.id}
                    onLoad={() => setLoading((l) => (l === t.id ? null : l))}
                    className="pointer-events-none absolute left-0 top-0 origin-top-left border-0 bg-white"
                    style={{ width: TILE_PAGE_W, height: TILE_PAGE_H, transform: `scale(${TILE_SCALE})` }}
                  />
                ) : (
                  <span aria-hidden className="absolute inset-0 animate-pulse bg-ink/[0.04]" />
                )}
                {on ? (
                  <span className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink text-cream">
                    <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </span>
                ) : null}
              </span>
              <span className="mt-1.5 flex items-center gap-1 text-[12.5px] font-semibold text-ink">
                <span className="truncate">{t.name}</span>
                {mark ? <PaidMark state={mark} label={paidMarkLabel(mark, 'Event Hub Pro')} size="xs" /> : null}
              </span>
            </>
          );
          return (
            <li key={t.id} data-theme-tile={t.id} className="shrink-0 snap-start" style={{ width: TILE_W }}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => pick(t.id)}
                data-theme-tile-pick=""
                className="sn-press block text-left"
              >
                {face}
              </button>
            </li>
          );
        })}
      </ul>
      {!home ? (
        <p className="text-xs text-ink/60">Choose your Event Hub address below to see your page in each theme.</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-danger-800">
          {error}
        </p>
      ) : null}
    </section>
  );
}
