'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MAKER_STRIP_PHONE } from '@/lib/maker-phone-room';
import { Check, ChevronDown, ChevronLeft, ChevronRight, List, Palette, Settings2, X } from 'lucide-react';
import { useOneOpen } from '@/lib/one-open';
import type { MakerTool } from './maker-context';

/**
 * 🧰 THE LOWER THIRD — every phone editing tool lives here (owner 2026-10-05,
 * *"we only maximize the height on the lower third. and all tools can only
 * reside on the thumb area/ lower third"*; approved design
 * `prototypes/maker_lower_third_interactive_2026-10-05_fable.html` + frames 6–9
 * of `maker_keynote_chrome_2026-10-05_fable`).
 *
 * Two rows, fixed order, directly under the page (never over it):
 *
 *   1 · WHERE YOU ARE — the menu button ("RSVP ▾") and the part on screen;
 *   2 · THE NAVIGATOR — the pick's PARTS first (the stage's pages, the RSVP's
 *       three screens, Details' items, Settings' rows), then the stage's
 *       SCENES. Each layer draws its own tiles into it (`ltNav`, a portal).
 *
 * The MENU opens as a sheet INSIDE the lower third — never over the page —
 * with exactly two groups: Global settings (Theme · Settings · Details) and
 * Stages (Save the Date · RSVP · Invitation · The Day · Post Event).
 *
 * A TOOL OPEN (a tile's editor, a part tapped on the page — `useMakerTool`):
 * the menu and the navigator fold SIDEWAYS into one 52 px column on the left —
 * the tool's name, ‹ › to step, × to finish — and the tool takes the rest
 * (`MAKER_LT_TOOL`, ≥ 300 px at 375). × (or a tap on the name, or on the empty
 * page) puts the navigator back. 200–280 ms, instant under Reduce Motion.
 *
 * 🔒 NOTHING HERE WRITES. A pick moves the Maker; a tile opens its editor; only
 * what the editor itself saves reaches the draft.
 */

export type LowerThirdPick = string;

export type LowerThirdMenuRow = {
  key: LowerThirdPick;
  label: string;
  /** The stage guests meet today. */
  dot?: boolean;
  icon?: ReactNode;
};

export type LowerThirdTile = {
  key: string;
  label: string;
  /** The small words under the picture ("When yes"). */
  caption?: string;
  on: boolean;
  onPick: () => void;
  icon?: ReactNode;
  /** A switch (the Event Bar): `on` is its state. */
  toggle?: boolean;
  disabled?: boolean;
  note?: string;
};

/** The menu's two groups — the global settings first, then the stages (owner, frame 7). */
export const LOWER_THIRD_GLOBAL_ICON: Record<'theme' | 'settings' | 'details', ReactNode> = {
  theme: <Palette aria-hidden className="h-5 w-5" strokeWidth={1.75} />,
  settings: <Settings2 aria-hidden className="h-5 w-5" strokeWidth={1.75} />,
  details: <List aria-hidden className="h-5 w-5" strokeWidth={1.75} />,
};

export function MakerLowerThird({
  pick,
  pickLabel,
  where,
  global,
  stages,
  onPick,
  parts,
  tool,
  setNav,
  stepTiles,
  bare = false,
}: {
  pick: LowerThirdPick;
  /** The menu button's words ("RSVP"). */
  pickLabel: string;
  /** The part on screen ("RSVP form"), beside the menu button. */
  where: string;
  global: readonly LowerThirdMenuRow[];
  stages: readonly LowerThirdMenuRow[];
  onPick: (key: LowerThirdPick) => void;
  /** The pick's own tiles the shell draws (a stage's pages, Settings' rows) — before the layer's. */
  parts: readonly LowerThirdTile[];
  /** The tool open (its editor fills the lower third), or null. */
  tool: MakerTool | null;
  /** The navigator's slot — the layer on screen portals its tiles in. */
  setNav: (el: HTMLElement | null) => void;
  /** Show the layer's slot (a stage's scenes, Details' items, the RSVP screens). */
  stepTiles: boolean;
  /**
   * 🪜 The guided flow shows a screen of its own on the page (owner 2026-10-05:
   * its stage picker sat over Theme's navigator — two things at once): only the
   * menu button is drawn, in one short row, and the page takes the rest. The
   * menu still opens to its full height; a step's own sheet (a tool) still folds it.
   */
  bare?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useOneOpen(menuOpen, setMenuOpen);
  const rootRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  /* A tool opening closes the menu (one open at a time); Escape finishes the
     tool — but only the INNERMOST thing open closes: a dropdown or menu open
     inside it (any `aria-haspopup` control still expanded) or a handler that
     already took the key (`defaultPrevented`) keeps the tool open. */
  useEffect(() => {
    if (!tool) return;
    setMenuOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('[aria-haspopup][aria-expanded="true"]')) return;
      e.preventDefault();
      tool.close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tool]);
  /* ♿ Focus moves INTO the tool when it opens (its panel, never a field — a
     phone would raise its keyboard) and back to what opened it when it closes. */
  const toolKey = tool?.key ?? null;
  const opener = useRef<HTMLElement | null>(null);
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    const was = lastKey.current;
    lastKey.current = toolKey;
    // In the commit that shows it: the tool's panel is already on the page (it registered from its own effect).
    if (toolKey) {
      // What opened the first tool (a tile, a part on the page) — kept across ‹ › steps.
      if (!was) opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      // A ‹ › step keeps focus on the stepper, so a keyboard can press › again.
      else if (document.activeElement instanceof HTMLElement && document.activeElement.closest('[data-lt-step]')) return;
      /* ✍ A caret on the PAGE (a part tapped to type in place — its tools open
         with it): focus stays there, or the words would lose their caret and
         the phone its keyboard. */
      if (document.activeElement instanceof HTMLIFrameElement) return;
      const panel = [...document.querySelectorAll<HTMLElement>('[data-phone-chrome="panel"]')].find((el) => el.getClientRects().length > 0);
      if (!panel || panel.contains(document.activeElement)) return;
      if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
      panel.focus({ preventScroll: true });
      return;
    }
    if (!was) return;
    const back = opener.current;
    opener.current = null;
    if (back && back !== document.body && back.isConnected && back.getClientRects().length > 0) back.focus({ preventScroll: true });
    else rootRef.current?.querySelector<HTMLElement>('[data-lt-menu-button]')?.focus({ preventScroll: true });
  }, [toolKey]);
  /* The menu closes on Escape and on a tap outside it. */
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [menuOpen]);

  /* ‹ › — the tool's own steps, else the navigator's tiles: the one after (or
     before) the tile that is on, in ITS group (scene → scene, never into the
     stage's pages). The tiles stay mounted under the column. */
  const stepTile = (dir: -1 | 1) => {
    const tiles = [...(navRef.current?.querySelectorAll<HTMLElement>('[data-lt-tile]') ?? [])];
    const at = stepTileIn(
      tiles.map((t) => ({ group: t.dataset.ltGroup ?? '', on: t.getAttribute('aria-pressed') === 'true', off: t.getAttribute('aria-disabled') === 'true' || (t as HTMLButtonElement).disabled === true })),
      dir,
    );
    if (at !== null) tiles[at]!.click();
  };
  const prev = tool ? (tool.step ? tool.step.prev : () => stepTile(-1)) : null;
  /** Only the menu button, in one short row (the guided flow's own screen; no tool, the menu shut). */
  const short = bare && !tool && !menuOpen;
  const next = tool ? (tool.step ? tool.step.next : () => stepTile(1)) : null;

  const pickRow = (r: LowerThirdMenuRow) => {
    const on = r.key === pick;
    return (
      <li key={r.key}>
        <button
          type="button"
          role="menuitemradio"
          aria-checked={on}
          data-lt-menu-row={r.key}
          onClick={() => {
            setMenuOpen(false);
            onPick(r.key);
          }}
          className={`sn-press flex min-h-11 w-full items-center gap-2 rounded-xl px-2.5 text-left text-[15px] transition-colors duration-sn-control ease-sn ${
            on ? 'bg-mulberry/10 font-semibold text-ink' : 'text-ink hover:bg-ink/5'
          }`}
        >
          {r.icon ? <span className="shrink-0 text-ink/70">{r.icon}</span> : null}
          {r.dot ? <span aria-label="Live today" className="h-1.5 w-1.5 shrink-0 rounded-full bg-gild" /> : null}
          <span className="min-w-0 flex-1 truncate">{r.label}</span>
          {on ? <Check aria-hidden className="h-4 w-4 shrink-0 text-mulberry" strokeWidth={2.4} /> : null}
        </button>
      </li>
    );
  };

  return (
    <section
      ref={rootRef}
      aria-label="Edit"
      data-maker-lower-third=""
      data-lt-tool={tool ? tool.key : undefined}
      data-phone-chrome="bottom"
      data-phone-chrome-name="the lower third"
      data-lt-bare={short ? '' : undefined}
      /* In the shell's flow, under the page — the page ends where it begins. */
      className={`relative z-20 flex ${short ? 'h-auto' : 'h-[calc(var(--maker-lt-h)+env(safe-area-inset-bottom))]'} shrink-0 flex-col overflow-hidden border-t border-ink/10 bg-cream pb-[env(safe-area-inset-bottom)] lg:hidden`}
    >
      <div className="relative flex min-h-0 flex-1 gap-2 p-1 pt-2">
        {/* ══ THE COLUMN A TOOL LEAVES — name · ‹ › · × ══ */}
        <div
          data-lt-column=""
          aria-hidden={tool ? undefined : true}
          className={`flex w-[52px] shrink-0 flex-col items-center gap-1 rounded-2xl bg-ink/[0.05] px-0.5 pb-1 pt-1.5 ring-1 ring-ink/10 transition-[opacity,transform] duration-[240ms] ease-out motion-reduce:transition-none ${
            tool ? 'opacity-100' : 'pointer-events-none absolute left-1 top-2 h-[calc(100%-12px)] -translate-x-3 opacity-0'
          }`}
        >
          {tool ? (
            <>
              <button
                type="button"
                data-lt-column-name=""
                onClick={tool.close}
                aria-label={`${tool.name} — back to the navigator`}
                className="sn-press flex w-full flex-col items-center gap-1 rounded-xl px-0.5 py-1"
              >
                <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-lg bg-white font-serif text-[15px] text-ink ring-1 ring-ink/10">
                  {tool.name.slice(0, 1)}
                </span>
                <span className="line-clamp-2 w-full break-words text-center text-[10.5px] font-semibold leading-tight text-ink">{tool.name}</span>
              </button>
              <span className="flex">
                <button
                  type="button"
                  aria-label="Previous"
                  data-lt-step="prev"
                  disabled={!prev}
                  onClick={() => prev?.()}
                  className="sn-press inline-flex h-11 w-6 items-center justify-center text-ink/70 disabled:text-ink/25"
                >
                  <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  aria-label="Next"
                  data-lt-step="next"
                  disabled={!next}
                  onClick={() => next?.()}
                  className="sn-press inline-flex h-11 w-6 items-center justify-center text-ink/70 disabled:text-ink/25"
                >
                  <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2.2} />
                </button>
              </span>
              <button
                type="button"
                data-lt-close=""
                aria-label={`Close ${tool.name}`}
                onClick={tool.close}
                className="sn-press mt-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink ring-1 ring-ink/10"
              >
                <X aria-hidden className="h-4 w-4" strokeWidth={2.2} />
              </button>
            </>
          ) : null}
        </div>

        {/* ══ 1 · WHERE YOU ARE  ·  2 · THE NAVIGATOR ══ — folds away while a tool is open. */}
        <div
          data-lt-rows=""
          aria-hidden={tool ? true : undefined}
          inert={tool ? true : undefined}
          className={`flex min-w-0 flex-1 flex-col gap-2 transition-[opacity,transform] duration-[240ms] ease-out motion-reduce:transition-none ${
            /* No transform at rest: a transformed box would hold every `fixed` child (a floated (i) note, the scene templates). */
            tool ? 'pointer-events-none -translate-x-6 opacity-0' : 'opacity-100'
          }`}
        >
          <div className="flex h-11 shrink-0 items-center gap-2 px-1" data-lt-where="">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              data-lt-menu-button=""
              onClick={() => setMenuOpen((o) => !o)}
              className={`sn-press inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13.5px] font-semibold ring-1 transition-colors duration-sn-control ease-sn ${
                menuOpen ? 'bg-ink text-cream ring-ink' : 'bg-ink/[0.05] text-ink ring-ink/10'
              }`}
            >
              <List aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
              {/* The guided flow's own screen: the menu by its own name, never an item's. */}
              <span className="max-w-[9rem] truncate">{bare && !tool ? 'Menu' : pickLabel}</span>
              <ChevronDown aria-hidden className={`h-3.5 w-3.5 transition-transform duration-[240ms] motion-reduce:transition-none ${menuOpen ? 'rotate-180' : ''}`} strokeWidth={2.2} />
            </button>
            <p className={`min-w-0 flex-1 truncate pl-1 text-[15px] font-semibold text-ink ${short ? 'invisible' : ''}`} data-lt-where-words="">
              {/* Never the menu's word twice ("Theme ▾ Theme"). */}
              {where === pickLabel ? '' : where}
            </p>
          </div>
          <div
            ref={navRef}
            role="list"
            aria-label="Navigator"
            data-lt-navigator=""
            /* One sideways row that never scrolls down; a closed (i) note takes no room (`MAKER_STRIP_PHONE`). */
            aria-hidden={short || undefined}
            className={`${MAKER_STRIP_PHONE} ${short ? 'hidden' : 'flex'} min-h-0 flex-1 items-stretch gap-2.5 overflow-x-auto overflow-y-hidden px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
          >
            {parts.map((t) => (
              <LowerThirdTileButton key={t.key} tile={t} part />
            ))}
            {parts.length > 0 && stepTiles ? <span aria-hidden className="my-4 w-px shrink-0 bg-ink/15" /> : null}
            {/* The layer on screen draws its own tiles here. */}
            <div ref={setNav} className={stepTiles ? 'contents' : 'hidden'} data-lt-slot="" />
          </div>
        </div>

        {/* ══ THE MENU — a sheet INSIDE the lower third, two groups ══ */}
        <div
          role="menu"
          aria-label="Menu"
          aria-hidden={menuOpen ? undefined : true}
          inert={menuOpen ? undefined : true}
          data-lt-menu=""
          data-menu-id={menuId}
          className={`absolute inset-0 z-10 overflow-y-auto overscroll-contain rounded-t-2xl bg-white px-2 pb-6 pt-2 ring-1 ring-ink/10 transition-transform duration-[260ms] ease-out motion-reduce:transition-none ${
            menuOpen ? 'translate-y-0' : 'translate-y-[104%]'
          }`}
        >
          <button
            type="button"
            aria-label="Close the menu"
            data-lt-menu-close=""
            onClick={() => setMenuOpen(false)}
            className="sn-press absolute right-2 top-1.5 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-ink/5 text-ink/70"
          >
            <X aria-hidden className="h-4 w-4" strokeWidth={2.2} />
          </button>
          <div className="grid grid-cols-[1fr_1.1fr] gap-3 pt-3">
            <div data-lt-menu-group="global">
              <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/55">Global settings</p>
              <ul className="flex flex-col gap-0.5">{global.map(pickRow)}</ul>
            </div>
            <div data-lt-menu-group="stages">
              <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/55">Stages</p>
              <ul className="flex flex-col gap-0.5">{stages.map(pickRow)}</ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** One navigator tile — a part of the pick (gold) or a row of Settings. A layer's own tiles wear the same classes (`LOWER_THIRD_TILE`). */
export function LowerThirdTileButton({ tile, part = false, group = part ? 'parts' : 'tiles' }: { tile: LowerThirdTile; part?: boolean; group?: string }) {
  return (
    <button
      type="button"
      role={tile.toggle ? 'switch' : undefined}
      aria-checked={tile.toggle ? tile.on : undefined}
      aria-pressed={tile.toggle ? undefined : tile.on}
      aria-disabled={tile.disabled || undefined}
      data-lt-tile={tile.key}
      data-lt-group={group}
      title={tile.note}
      onClick={tile.disabled ? undefined : tile.onPick}
      className={`${LOWER_THIRD_TILE} ${part ? LOWER_THIRD_TILE_PART : LOWER_THIRD_TILE_PLAIN} ${tile.on ? LOWER_THIRD_TILE_ON : ''} ${tile.disabled ? 'opacity-50' : ''}`}
    >
      <span className="flex min-h-0 flex-1 items-center justify-center px-1.5 text-center text-[12.5px] font-semibold leading-tight text-ink">
        {tile.icon ? <span className="flex flex-col items-center gap-1.5 text-ink/75">{tile.icon}<span className="text-ink">{tile.label}</span></span> : tile.label}
      </span>
      {tile.toggle || tile.caption || tile.note ? (
        <span className="block w-full truncate border-t border-ink/10 px-1 py-1.5 text-center text-[11.5px] text-ink/65">
          {tile.toggle ? (tile.on ? 'On' : 'Off') : (tile.caption ?? tile.note)}
        </span>
      ) : null}
    </button>
  );
}

/** A navigator tile's shape — every layer's tiles wear it, so the navigator reads as one row. With ONE tone below. */
export const LOWER_THIRD_TILE =
  'sn-press flex h-full w-24 shrink-0 flex-col overflow-hidden rounded-xl ring-1 transition-shadow duration-sn-control ease-sn';
/** A scene or an item: white. */
export const LOWER_THIRD_TILE_PLAIN = 'bg-white ring-ink/10';
/** A PART of the pick (a stage's page, the RSVP's screens, Theme's sections): the gold wash (frame 6). */
export const LOWER_THIRD_TILE_PART = 'bg-gild/10 ring-gild/40';
/** The tile that is on: the Setnayan terracotta ring. */
export const LOWER_THIRD_TILE_ON = 'ring-2 !ring-mulberry';

/**
 * 🧭 A layer's navigator tiles: into the lower third's slot when the Maker hands
 * one (a phone), else where the layer draws them (a desktop's column).
 */
export function IntoLowerThird({ to, children }: { to: HTMLElement | null | undefined; children: ReactNode }) {
  return to ? createPortal(children, to) : <>{children}</>;
}

/**
 * ‹ › over the navigator: the index of the tile one step from the one that is on,
 * within the SAME group (`data-lt-group`), skipping tiles that are off — null at
 * either end, or with nothing on. Pure, so a test holds it.
 */
export function stepTileIn(tiles: ReadonlyArray<{ group: string; on: boolean; off: boolean }>, dir: -1 | 1): number | null {
  /* The tile the tool belongs to: a scene's (or an item's) before the pick's
     part that is on with it (the page on screen stays on while a scene is open). */
  const own = tiles.findIndex((t) => t.on && t.group !== 'parts');
  const at = own >= 0 ? own : tiles.findIndex((t) => t.on);
  if (at < 0) return null;
  for (let i = at + dir; i >= 0 && i < tiles.length; i += dir) {
    if (tiles[i]!.group !== tiles[at]!.group) continue;
    if (!tiles[i]!.off) return i;
  }
  return null;
}
