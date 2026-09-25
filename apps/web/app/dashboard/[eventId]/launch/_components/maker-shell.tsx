'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Info, Monitor, MoreHorizontal, PanelLeft, Play, Plus, Smartphone, X } from 'lucide-react';
import type { TourKey } from '@/lib/tours';
import { useModalA11y } from '@/lib/use-modal-a11y';
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import { MAKER_BAR, MAKER_COMING_NEXT, isStagePhase, type MakerBarItem } from './maker-bar';
import {
  MakerContext,
  MAKER_MORE_ROWS_ID,
  type MakerDevice,
  type MakerSelection,
  type MakerState,
} from './maker-context';
import { MakerTour } from './maker-tour';

/**
 * THE EVENT HUB MAKER — the full-screen shell (Phase 1 of
 * `EVENT_HUB_MAKER_BUILD_PLAN_2026-09-25.md`; drawing
 * `prototypes/event_hub_editor_FINAL_2026-09-24.html`).
 *
 * Four regions, and only four (owner 2026-09-24: *"a main editing screen, a
 * scrollable navigation, and editing tools each"* · *"we can opt to not have
 * the sidebar and top nav. we can have a button to exit editor"*):
 *
 *   1 · the toolbar — ✕ Exit · ▤ · ▶ · ＋ · THE BAR · Desktop/Phone/Both · ⊞ · ⓘ · ⋯
 *   2 · the navigator  ┐
 *   3 · the canvas     ├ the work area — `children`, built by the editor page
 *   4 · the inspector  ┘ with every panel and its own bound action
 *
 * 🔑 CHROMELESS WITHOUT A NEW PAGE. The event layout cannot skip its rail by
 * segment (a layout is handed `params`, never the path), so instead of a +1
 * route this shell covers the viewport: `fixed inset-0` above the rail, the
 * top bar and the phone's bottom nav, with the document scroll locked while it
 * is open. The menu key `launch` and its route are unchanged (owner 2026-09-25:
 * "label change only").
 *
 * ⛔ NO DEAD BUTTONS. Every bar item does something: a stage switches the
 * canvas, a tool opens a panel that already ships, and an item with no build
 * yet opens ONE line saying it is coming in the next build.
 *
 * 🧩 THE APPLY BAR MOUNTS HERE. Phase 2 (draft · Apply · Restore · Reset) is
 * built in parallel as a mountable component; it goes in `applySlot`, which
 * the toolbar renders between the bar and the device switch.
 */
export function MakerShell({
  eventId,
  slug,
  liveStage,
  initialStage,
  initialSelection = null,
  storeShell,
  priceLabel,
  firstVisit,
  completeTourAction,
  renderStamp,
  more,
  applySlot = null,
  hasWork,
  viewAs = {},
  children,
}: {
  /** VIEW AS, per stage — each role's chip word and its server-gated preview
   *  door (`resolveHubRoleView`), or null when there is honestly none. */
  viewAs?: Partial<Record<LifecyclePhase, ReadonlyArray<{ role: string; name: string; href: string | null }>>>;
  eventId: string;
  slug: string | null;
  /** The stage guests meet today — the bar's red dot. Null when unmeasured. */
  liveStage: LifecyclePhase | null;
  initialStage: LifecyclePhase;
  initialSelection?: MakerSelection;
  storeShell: boolean;
  /** The live catalogue price of Event Hub Pro, formatted; null when unread. */
  priceLabel: string | null;
  firstVisit: boolean;
  completeTourAction: (tourKey: TourKey) => Promise<void>;
  renderStamp: string;
  /** The ⋯ sheet: the address, who and when, and the doors the controller kept. */
  more: ReactNode;
  /** Phase 2's Apply · Restore · Reset bar. */
  applySlot?: ReactNode;
  /** False when the work area is not the editor (a coordinator, or an event
   *  type with no Event Hub): the tool items then have nothing to open. */
  hasWork: boolean;
  children: ReactNode;
}) {
  const [stage, setStage] = useState<LifecyclePhase>(initialStage);
  const [device, setDevice] = useState<MakerDevice>('desktop');
  const [navOpen, setNavOpen] = useState(true);
  const [selection, setSelection] = useState<MakerSelection>(initialSelection);
  const [moreOpen, setMoreOpen] = useState(false);
  const [tour, setTour] = useState<'first' | 'again' | null>(firstVisit ? 'first' : null);
  const [viewAsRole, setViewAsRole] = useState<string | null>(null);
  const stageRoles = viewAs[stage] ?? [];
  const viewAsHref = viewAsRole ? (stageRoles.find((r) => r.role === viewAsRole)?.href ?? null) : null;

  /*
    🪤 MEASURED IN THE BROWSER: EVERY SAVE REMOUNTS THIS SHELL. Each panel
    posts to an action that redirects back here with a new query (`?scene=`,
    `?saved=1`), and the App Router keys a page by its search params — so the
    whole Maker mounts fresh after each write, and the stage, the device and
    the open navigator all snapped back to their defaults. What the couple was
    looking at is kept for the tab in sessionStorage and put back on mount (a
    convenience only: every fact the Maker shows is re-read from the server).
  */
  const memoryKey = `sn-maker:${eventId}`;
  const restored = useRef(false);
  useEffect(() => {
    let saved: { stage?: string; device?: string; navOpen?: boolean; selection?: MakerSelection } | null = null;
    try {
      saved = JSON.parse(window.sessionStorage.getItem(memoryKey) ?? 'null');
    } catch {
      saved = null;
    }
    if (saved && isStagePhase(saved.stage)) setStage(saved.stage);
    if (saved?.device === 'desktop' || saved?.device === 'phone') setDevice(saved.device);
    else if (window.matchMedia('(max-width: 767px)').matches) setDevice('phone');
    if (typeof saved?.navOpen === 'boolean') setNavOpen(saved.navOpen);
    // An address that names what to open (a save's `?scene=`) wins over memory.
    if (saved?.selection) setSelection((cur) => cur ?? saved!.selection ?? null);
    restored.current = true;
  }, [memoryKey]);
  useEffect(() => {
    if (!restored.current) return;
    try {
      window.sessionStorage.setItem(memoryKey, JSON.stringify({ stage, device, navOpen, selection }));
    } catch {
      /* private mode / blocked storage: the Maker simply opens on its defaults */
    }
  }, [memoryKey, stage, device, navOpen, selection]);

  /* A role is read per stage: a new stage starts back on the host's preview. */
  useEffect(() => setViewAsRole(null), [stage]);

  /* The document under the Maker must not scroll behind it. */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('sn-maker-open');
    return () => root.classList.remove('sn-maker-open');
  }, []);

  const select = useCallback((next: MakerSelection) => setSelection(next), []);

  const value = useMemo<MakerState>(
    () => ({
      eventId,
      stage,
      setStage,
      device,
      navOpen,
      selection,
      select,
      moreOpen,
      renderStamp,
      storeShell,
      viewAsHref,
    }),
    [eventId, stage, device, navOpen, selection, select, moreOpen, renderStamp, storeShell, viewAsHref],
  );

  /* ONE HIGHLIGHT (owner 2026-09-25: "there should also be only one highlighted
     here. stage must leave" · "allow other to be highlighted"). Picking a stage
     closes an open made-once tool; opening a tool takes the highlight from the
     stage (see `MakerBar`). The canvas keeps showing the stage either way. */
  const pressBar = (item: MakerBarItem) => {
    if (item.kind === 'stage') {
      setStage(item.key);
      if (selection?.kind === 'tool') select(null);
      return;
    }
    if (item.kind === 'tool' && hasWork) select({ kind: 'tool', key: item.key });
  };

  const playHref = slug ? `/${slug}?phase=${stage}` : null;

  return (
    <MakerContext.Provider value={value}>
      {/* An inline <style>, not a CSS import: unit tests load these modules.
          ① The scroll lock. ② 🪤 MEASURED IN THE BROWSER: the layout's
          `.sn-vt-page` carries `view-transition-name`, which makes it a
          STACKING CONTEXT — so this shell's z-index was trapped inside it and
          the app's sticky top bar (z-20, outside it) painted over the Maker's
          toolbar. While the Maker is on the page that name is dropped, so
          `fixed inset-0 z-[80]` really is above the rail, the top bar and the
          bottom nav. `:has()` applies it from the first server paint; the
          class is the fallback once hydrated. */}
      <style>
        {'html.sn-maker-open,html.sn-maker-open body,html:has([data-maker-shell]),html:has([data-maker-shell]) body{overflow:hidden}' +
          'html.sn-maker-open .sn-vt-page,.sn-vt-page:has([data-maker-shell]){view-transition-name:none}'}
      </style>
      <div
        className="fixed inset-0 z-[80] flex flex-col bg-cream text-ink"
        data-maker-shell=""
        aria-label="Event Hub Maker"
        role="region"
      >
        {/* ══ 1 · THE TOOLBAR ══ */}
        <header className="sn-glass-bare relative z-20 flex shrink-0 flex-col gap-1 px-2 py-1.5 md:flex-row md:items-center md:gap-2 md:px-3">
          <div className="flex items-center gap-1">
            <Link
              href={`/dashboard/${eventId}`}
              aria-label="Exit the Event Hub Maker"
              title="Exit"
              className="sn-press inline-flex h-11 w-11 items-center justify-center rounded-full text-ink/70 transition-colors duration-sn-control ease-sn hover:bg-ink/5 hover:text-ink"
            >
              <X aria-hidden className="h-5 w-5" strokeWidth={2} />
            </Link>
            {hasWork ? (
              <IconButton
                label={navOpen ? 'Hide the scenes' : 'Show the scenes'}
                pressed={navOpen}
                onClick={() => setNavOpen((o) => !o)}
                className="hidden lg:inline-flex"
              >
                <PanelLeft aria-hidden className="h-5 w-5" strokeWidth={1.75} />
              </IconButton>
            ) : null}
            {playHref ? (
              <a
                href={playHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Play this stage full screen, as guests meet it"
                title="Play"
                className="sn-press inline-flex h-11 w-11 items-center justify-center rounded-full text-ink/70 transition-colors duration-sn-control ease-sn hover:bg-ink/5 hover:text-ink"
              >
                <Play aria-hidden className="h-5 w-5" strokeWidth={1.75} />
              </a>
            ) : null}
            <ComingNext label="Add a scene" note={MAKER_COMING_NEXT.add} align="start">
              <Plus aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            </ComingNext>
            <p className="ml-1 truncate font-serif text-base text-ink md:hidden">Event Hub Maker</p>
            <span className="ml-auto flex items-center gap-1 md:hidden">
              <IconButton label="About the Event Hub Maker" onClick={() => setTour('again')}>
                <Info aria-hidden className="h-5 w-5" strokeWidth={1.75} />
              </IconButton>
              <IconButton label="Your address, who can view, and more" pressed={moreOpen} onClick={() => setMoreOpen(true)}>
                <MoreHorizontal aria-hidden className="h-5 w-5" strokeWidth={1.75} />
              </IconButton>
            </span>
          </div>

          <MakerBar
            stage={stage}
            liveStage={liveStage}
            selection={selection}
            hasWork={hasWork}
            onPress={pressBar}
          />

          <div className="hidden items-center gap-1 md:flex">
            {applySlot ? <div data-maker-apply-slot="">{applySlot}</div> : null}
            {hasWork && stageRoles.length > 0 ? (
              <ViewAsSwitch roles={stageRoles} value={viewAsRole} onChange={setViewAsRole} />
            ) : null}
            <div role="group" aria-label="Preview on" className="flex items-center rounded-full bg-ink/5 p-0.5">
              <DeviceButton on={device === 'desktop'} label="Desktop" onClick={() => setDevice('desktop')}>
                <Monitor aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </DeviceButton>
              <DeviceButton on={device === 'phone'} label="Phone" onClick={() => setDevice('phone')}>
                <Smartphone aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </DeviceButton>
              <ComingNext label="Both" note={MAKER_COMING_NEXT.both} align="end" small>
                <span className="text-[11px] font-semibold">Both</span>
              </ComingNext>
            </div>
            <ComingNext label="Snap grid" note={MAKER_COMING_NEXT.snap} align="end">
              <span aria-hidden className="text-lg leading-none">⊞</span>
            </ComingNext>
            <IconButton label="About the Event Hub Maker" onClick={() => setTour('again')}>
              <Info aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            </IconButton>
            <IconButton label="Your address, who can view, and more" pressed={moreOpen} onClick={() => setMoreOpen(true)}>
              <MoreHorizontal aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            </IconButton>
          </div>
        </header>

        {/* ══ 2 · 3 · 4 · THE WORK AREA ══ */}
        <div className="relative min-h-0 flex-1">{children}</div>

        {/* ══ ⋯ · THE SHEET ══ Kept mounted (hidden when shut) so the work area
            can portal the address rows into it. */}
        <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)}>
          <div id={MAKER_MORE_ROWS_ID} className="flex flex-col gap-2" />
          {more}
        </MoreSheet>

        {tour ? (
          <MakerTour
            storeShell={storeShell}
            priceLabel={priceLabel}
            record={tour === 'first'}
            completeAction={completeTourAction}
            onClose={() => setTour(null)}
            onStart={() => {
              setTour(null);
              if (hasWork) select({ kind: 'main' });
            }}
          />
        ) : null}
      </div>
    </MakerContext.Provider>
  );
}

/**
 * The bar itself — three groups, two dividers, exported so a test can render
 * it and count what a couple sees.
 */
export function MakerBar({
  stage,
  liveStage,
  selection,
  hasWork,
  onPress,
}: {
  stage: LifecyclePhase;
  liveStage: LifecyclePhase | null;
  selection: MakerSelection;
  hasWork: boolean;
  onPress: (item: MakerBarItem) => void;
}) {
  const groups: MakerBarItem[][] = [];
  for (const item of MAKER_BAR) {
    const last = groups[groups.length - 1];
    if (last && last[0]!.group === item.group) last.push(item);
    else groups.push([item]);
  }

  /*
    🪤 OWNER, ON THE LIVE MAKER (2026-09-25): "cannot see logo anymore even if i
    scroll". The bar was `justify-content: center` on a scroll container — when
    the items are wider than the bar, centring pushes the overflow off BOTH
    edges and the left half can never be scrolled to (Logo was clipped, "Prints
    & Tick…" cut). Centring now comes from `margin-inline: auto` on the first and
    last groups (`ms-auto` / `me-auto`): with room to spare they centre the bar;
    without it they collapse to 0 and every item is reachable by scrolling.
    `the-maker-bar-is-the-final-bar.test.ts` holds the rule.
  */
  const navRef = useRef<HTMLElement>(null);
  const [fade, setFade] = useState<{ l: boolean; r: boolean }>({ l: false, r: false });
  const measure = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setFade({ l: el.scrollLeft > 2, r: el.scrollLeft < max - 2 });
  }, []);
  /* The ACTIVE item is scrolled into view when the Maker opens, whenever it
     changes, and when the window resizes (measured: at 768 and 1024 a resize
     left the active pill past the edge) — on a phone the stage the couple is
     on may sit past the edge. */
  const showActive = useCallback(() => {
    const el = navRef.current;
    const on = el?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (el && on) {
      const left = on.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;
      if (left < el.scrollLeft || left + on.offsetWidth > el.scrollLeft + el.clientWidth) {
        el.scrollTo({ left: Math.max(0, left - el.clientWidth / 2 + on.offsetWidth / 2) });
      }
    }
    measure();
  }, [measure]);
  useEffect(() => {
    window.addEventListener('resize', showActive);
    return () => window.removeEventListener('resize', showActive);
  }, [showActive]);
  useEffect(() => {
    showActive();
  }, [stage, selection, showActive]);
  const mask =
    fade.l || fade.r
      ? `linear-gradient(to right, ${fade.l ? 'transparent' : '#000'} 0, #000 20px, #000 calc(100% - 20px), ${fade.r ? 'transparent' : '#000'} 100%)`
      : undefined;

  return (
    <nav
      ref={navRef}
      aria-label="Event Hub Maker"
      data-maker-bar=""
      onScroll={measure}
      style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
      className="-mx-2 flex min-w-0 items-center gap-0.5 overflow-x-auto scroll-px-4 px-2 [scrollbar-width:none] md:mx-auto"
    >
      {groups.map((group, gi) => (
        <span
          key={group[0]!.group}
          className={`flex shrink-0 items-center gap-0.5 ${gi === 0 ? 'ms-auto' : ''} ${gi === groups.length - 1 ? 'me-auto' : ''}`}
        >
          {gi > 0 ? <i aria-hidden data-maker-divider="" className="mx-1.5 block h-5 w-px bg-ink/15" /> : null}
          {group.map((item) => {
            if (item.kind === 'next' || (item.kind === 'tool' && !hasWork)) {
              return (
                <ComingNext
                  key={item.key}
                  label={item.label}
                  itemKey={item.key}
                  note={item.kind === 'next' ? MAKER_COMING_NEXT[item.key] : 'Only the couple can open this part of the Event Hub Maker.'}
                  align={gi === 0 ? 'start' : 'end'}
                  chip
                >
                  {item.label}
                </ComingNext>
              );
            }
            // ONE highlight: an open tool takes it; otherwise the stage has it.
            const on =
              item.kind === 'stage'
                ? stage === item.key && selection?.kind !== 'tool'
                : selection?.kind === 'tool' && selection.key === item.key;
            return (
              <button
                key={item.key}
                type="button"
                data-maker-bar-item={item.key}
                aria-pressed={on}
                onClick={() => onPress(item)}
                className={`sn-press inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13.5px] font-semibold transition-colors duration-sn-control ease-sn md:px-3.5 ${
                  on ? 'bg-ink text-cream' : 'text-ink/70 hover:bg-ink/5 hover:text-ink'
                }`}
              >
                {item.kind === 'stage' && liveStage === item.key ? (
                  <span aria-label="live today" title="Live today" className="h-1.5 w-1.5 rounded-full bg-terracotta" />
                ) : null}
                {item.label}
              </button>
            );
          })}
        </span>
      ))}
    </nav>
  );
}

/**
 * VIEW AS — compact, in the toolbar (moved from the ⋯ sheet's old stage). It
 * re-points the canvas at the page as that role meets it, through the SAME
 * server-gated door the controller's stage used; a role with no door is listed
 * but cannot be chosen, and says why.
 */
function ViewAsSwitch({
  roles,
  value,
  onChange,
}: {
  roles: ReadonlyArray<{ role: string; name: string; href: string | null }>;
  value: string | null;
  onChange: (role: string | null) => void;
}) {
  return (
    <label className="flex items-center gap-1 rounded-full bg-ink/5 px-2 text-[12px] font-semibold text-ink/70">
      <span className="whitespace-nowrap">View as</span>
      <select
        data-maker-view-as=""
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-9 max-w-[9.5rem] cursor-pointer rounded-full bg-transparent pr-1 text-[12.5px] font-semibold text-ink focus:outline-none"
      >
        <option value="">You · editing</option>
        {roles.map((r) => (
          <option key={r.role} value={r.role} disabled={!r.href}>
            {r.name}
            {r.href ? '' : ' — no preview'}
          </option>
        ))}
      </select>
    </label>
  );
}

function IconButton({
  label,
  pressed,
  onClick,
  className = '',
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`sn-press inline-flex h-11 w-11 items-center justify-center rounded-full text-ink/70 transition-colors duration-sn-control ease-sn hover:bg-ink/5 hover:text-ink ${className}`}
    >
      {children}
    </button>
  );
}

function DeviceButton({ on, label, onClick, children }: { on: boolean; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`Preview on ${label.toLowerCase()}`}
      title={label}
      onClick={onClick}
      className={`sn-press inline-flex h-9 min-w-9 items-center justify-center rounded-full px-2 transition-colors duration-sn-control ease-sn ${
        on ? 'bg-white text-ink shadow-sm' : 'text-ink/60 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * A control whose build is the next one: pressing it says so, in one line, in
 * the same glass bubble the house `(i)` uses (`.sn-tip`). Never a dead button.
 */
export function ComingNext({
  label,
  note,
  align = 'center',
  chip = false,
  small = false,
  itemKey,
  children,
}: {
  /** The bar item this chip is (`data-maker-bar-item`). */
  itemKey?: string;
  label: string;
  note: string;
  align?: 'center' | 'start' | 'end';
  chip?: boolean;
  small?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ top: number; left: number; width: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  /* Placed against the VIEWPORT, not the button's box: the bar scrolls
     sideways on a phone, and an `overflow-x: auto` row clips anything that
     hangs below it — the bubble would open invisibly, a dead button again. */
  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(288, window.innerWidth - 32);
    const anchor = align === 'start' ? r.left : align === 'end' ? r.right - width : r.left + r.width / 2 - width / 2;
    setAt({ top: r.bottom + 8, left: Math.max(16, Math.min(anchor, window.innerWidth - width - 16)), width });
  };
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
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
  return (
    <span ref={ref} className="relative inline-flex shrink-0">
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        aria-label={chip ? undefined : label}
        title={chip ? undefined : label}
        data-maker-bar-item={chip ? (itemKey ?? 'prints') : undefined}
        onClick={() => {
          place();
          setOpen((o) => !o);
        }}
        className={
          chip
            ? 'sn-press inline-flex min-h-10 items-center gap-1 whitespace-nowrap rounded-full px-3 text-[13.5px] font-semibold text-ink/70 transition-colors duration-sn-control ease-sn hover:bg-ink/5 hover:text-ink md:px-3.5'
            : small
              ? 'sn-press inline-flex h-9 items-center justify-center rounded-full px-2 text-ink/60 transition-colors duration-sn-control ease-sn hover:text-ink'
              : 'sn-press inline-flex h-11 w-11 items-center justify-center rounded-full text-ink/70 transition-colors duration-sn-control ease-sn hover:bg-ink/5 hover:text-ink'
        }
      >
        {children}
        {chip ? <span aria-hidden className="text-[10px] text-ink/45">ⓘ</span> : null}
      </button>
      <span
        role="status"
        hidden={!open || !at}
        style={at ? { position: 'fixed', top: at.top, left: at.left, width: at.width } : undefined}
        className="z-50"
      >
        <span className="sn-tip-body sn-glass-bare block">{note}</span>
      </span>
    </span>
  );
}

function MoreSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  /* It says aria-modal, so it manages focus: in, trapped, restored, Esc
     closes (the house `useModalA11y`, `modal-a11y-adoption.test.ts`). */
  const sheetRef = useRef<HTMLElement>(null);
  useModalA11y({ open, onClose, containerRef: sheetRef });
  return (
    <div hidden={!open} className="absolute inset-0 z-40">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-ink/25 backdrop-blur-[2px]"
      />
      <aside
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Your Event Hub"
        className="sn-glass-bare absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-cream p-4 md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[min(560px,92vw)] md:rounded-none md:p-6"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="font-serif text-xl text-ink">Your Event Hub</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="sn-press inline-flex h-11 w-11 items-center justify-center rounded-full text-ink/70 hover:bg-ink/5 hover:text-ink"
          >
            <X aria-hidden className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}
