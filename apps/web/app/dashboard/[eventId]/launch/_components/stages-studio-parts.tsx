'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { ISeg, ISegmented } from '../../website/editor/_components/inspector-kit';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import type { PickOption } from '../../website/editor/_components/pick-menu-types';
import { MAKER_LT_SIZE_KEY, MAKER_LT_TAP_PX, makerLtClampPx, makerLtStoredPx, makerLtTapPx } from '@/lib/maker-lt-size';
import type { StudioTileKey, StudioTileModel } from '@/lib/studio-tiles';
import { MAKER_SIDE_LABEL, type MakerSide } from './maker-bar';
import { StudioHome } from './studio-home';

/**
 * 🧭 THE NEW MAKER'S PARTS — "Stages | Studio" (owner 2026-10-06; plan
 * `EVENT_HUB_MAKER_STAGES_STUDIO_BUILD_PLAN_2026-10-06.md` §3 PR 1; prototype
 * `maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html`). Every piece of
 * chrome only the new Maker draws lives HERE, loaded through `details-lazy.tsx`
 * (the `maker-details` chunk, warmed at idle) — so the shipped Maker's first
 * load carries none of it (`scripts/check-maker-js-budget.mjs`). The shell
 * keeps the state; these only draw it. 🔒 Nothing here writes to the event.
 */

/** Stages | Studio — ONE segmented control in the top nav (sections = one `ISegmented`, INTERACTION_RULES §8). */
export function StudioSideSwitch({ side, onPick }: { side: MakerSide; onPick: (side: MakerSide) => void }) {
  return (
    <ISegmented label="Stages or Studio">
      {(['stages', 'studio'] as const).map((k) => (
        <ISeg key={k} tone="wine" on={side === k} data={k} onClick={() => onPick(k)}>
          {MAKER_SIDE_LABEL[k]}
        </ISeg>
      ))}
    </ISegmented>
  );
}

/** The eleven tools as ONE dropdown (each opening as the one bottom sheet), each with its line and ✓ / Missing. */
export function StudioToolMenu({
  tiles,
  value,
  onOpen,
  dataAttr,
}: {
  tiles: readonly StudioTileModel[];
  value: StudioTileKey;
  onOpen: (key: StudioTileKey) => void;
  dataAttr: string;
}) {
  const options: PickOption[] = tiles.map((t) => ({
    key: t.key,
    label: t.label,
    hint: t.status,
    ...(t.done === true ? { trail: { text: '✓', tone: 'ok' as const, label: 'Ready' } } : t.done === false ? { trail: { text: 'Missing', tone: 'left' as const } } : {}),
  }));
  return (
    <PickMenu
      label="Studio tool"
      dataAttr={dataAttr}
      value={value}
      buttonText={tiles.find((t) => t.key === value)?.short ?? 'Studio'}
      options={options}
      onPick={(k) => onOpen(k as StudioTileKey)}
      className="!min-h-11 shrink-0 ring-1 ring-ink/10"
    />
  );
}

/**
 * A Studio tool FULL SCREEN — its slim row (owner 2026-10-06, DECISION_LOG "'ASK ONE BY ONE' … TAPPING
 * STUDIO AGAIN RETURNS TO THE TILES"): Tool ▾, and ✓ Done where the top nav is hidden (Wedding March,
 * Seat plan). No "‹ Studio" — tapping Studio in the top nav returns to the tiles.
 */
export function StudioToolRow({
  tile,
  tiles,
  onOpen,
  onDone,
}: {
  tile: StudioTileModel;
  tiles: readonly StudioTileModel[];
  onOpen: (key: StudioTileKey) => void;
  onDone: () => void;
}) {
  return (
    <div data-maker-studio-row="" className="absolute inset-x-0 top-0 z-40 flex h-[52px] items-center gap-2 border-b border-ink/10 bg-cream px-2 lg:hidden">
      <StudioToolMenu tiles={tiles} value={tile.key} onOpen={onOpen} dataAttr="data-maker-studio-tool" />
      {tile.immersive ? (
        <button
          type="button"
          data-maker-studio-done=""
          onClick={onDone}
          className="sn-press ml-auto inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-success-600 px-4 text-[13.5px] font-bold text-cream hover:bg-success-700"
        >
          <Check aria-hidden className="h-4 w-4" strokeWidth={2.6} />
          Done
        </button>
      ) : null}
    </div>
  );
}

/** Studio's home over the work area — its tiles, or a read that failed, SAID. */
export function StudioCover({ tiles, onOpen }: { tiles: readonly StudioTileModel[] | null; onOpen: (key: StudioTileKey) => void }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-cream" data-maker-studio-layer="">
      {tiles ? (
        <StudioHome tiles={tiles} onOpen={onOpen} />
      ) : (
        <p role="alert" className="m-auto max-w-sm px-4 text-center text-sm text-terracotta-700">
          Studio could not be loaded just now. Nothing was changed — please reopen this in a moment.
        </p>
      )}
    </div>
  );
}

/**
 * ▁ THE ONE BOTTOM SHEET — every pop-up of the new Maker on a phone (owner 2026-10-06: every pop-up
 * opens from the bottom; prototype `#pmenu .menu`): the stage ▾, Studio's Tool ▾ and every `PickMenu`
 * inside the Maker (`PickSheetContext`, handed down by the shell while the new Maker is on) — full
 * width at the foot of the screen, a grabber, its name in small capitals, rows that scroll inside it
 * (never past 62% of the screen), the page dimmed behind it, and a tap there closes it. Fixed to the
 * screen, so the shell portals it to <body> (inside a glass panel a `fixed` box is held by the
 * panel's backdrop filter). Phone only; a desktop keeps each list where it opens.
 */
export function MakerSheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  return (
    <div data-maker-sheet="" className="fixed inset-0 z-[95] lg:hidden">
      <button type="button" aria-label="Close" data-maker-sheet-scrim="" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default bg-ink/20" />
      <div
        role="dialog"
        aria-label={label}
        className="absolute inset-x-0 bottom-0 flex max-h-[62dvh] flex-col rounded-t-3xl bg-white px-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-18px_40px_-18px_rgba(30,26,18,.45)] ring-1 ring-ink/10"
      >
        <span aria-hidden className="mx-auto mb-1.5 mt-1 h-1 w-10 shrink-0 rounded-full bg-ink/15" />
        <p className="shrink-0 px-3 pb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink/55">{label}</p>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}

/**
 * ↕ THE GRAB HANDLE — the new Maker's lower third resizes (owner, live iPhone 2026-10-06: *"Also the
 * lower third screen can be resized up to lower half of the screen. Drag the edge to resize"*). Drag
 * its top edge between the default height and half the screen (`makerLtClampPx`); a tap toggles
 * default ↔ half (`makerLtTapPx`); the size is remembered on this device as a share of the screen
 * (a convenience — lost, it opens at the default, `makerLtStoredPx`). Arrow keys step it.
 */
export function LowerThirdGrab({ px, onPx }: { px: number | null; onPx: (px: number | null) => void }) {
  const from = useRef<{ y: number; h: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const self = useRef<HTMLButtonElement>(null);
  /* The size this device remembers, put back once. */
  useEffect(() => {
    try {
      const kept = makerLtStoredPx(window.localStorage.getItem(MAKER_LT_SIZE_KEY), window.innerHeight);
      if (kept !== null) onPx(kept);
    } catch {
      /* private mode / blocked storage: the default height */
    }
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const vh = () => window.innerHeight;
  const now = () => px ?? self.current?.closest('[data-maker-lower-third]')?.getBoundingClientRect().height ?? null;
  const keep = (next: number) => {
    onPx(next);
    try {
      window.localStorage.setItem(MAKER_LT_SIZE_KEY, String(next / vh()));
    } catch {
      /* private mode / blocked storage: the size simply is not remembered */
    }
  };
  return (
    <button
      ref={self}
      type="button"
      aria-label="Resize the tools — drag, or tap for half the screen"
      data-lt-grab=""
      onPointerDown={(e) => {
        const h = now();
        if (h === null) return;
        from.current = { y: e.clientY, h };
        setDragging(true);
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        const f = from.current;
        if (f && Math.abs(e.clientY - f.y) >= MAKER_LT_TAP_PX) onPx(makerLtClampPx(f.h + (f.y - e.clientY), vh()));
      }}
      onPointerUp={(e) => {
        const f = from.current;
        from.current = null;
        setDragging(false);
        if (!f) return;
        keep(Math.abs(e.clientY - f.y) < MAKER_LT_TAP_PX ? makerLtTapPx(px, vh()) : makerLtClampPx(f.h + (f.y - e.clientY), vh()));
      }}
      onPointerCancel={() => {
        from.current = null;
        setDragging(false);
      }}
      onKeyDown={(e) => {
        const h = now();
        if (h === null || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
        e.preventDefault();
        keep(makerLtClampPx(h + (e.key === 'ArrowUp' ? 40 : -40), vh()));
      }}
      onClick={(e) => {
        // A keyboard press (no pointer): default ⇄ half.
        if (e.detail === 0) keep(makerLtTapPx(px, vh()));
      }}
      className="flex h-6 w-full shrink-0 touch-none items-center justify-center"
    >
      <span aria-hidden className={`h-[5px] rounded-full transition-[width,background-color] duration-150 ${dragging ? 'w-14 bg-gild' : 'w-11 bg-ink/20'}`} />
    </button>
  );
}
