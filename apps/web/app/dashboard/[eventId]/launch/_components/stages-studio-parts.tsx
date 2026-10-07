'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { MAKER_UNHELD_WRITE_EVENT, makerSavesInFlight } from '@/lib/maker-refresh';
import { STUDIO_DONE_BUTTON, STUDIO_HEAD_ROW, STUDIO_SAVED_PILL, STUDIO_TOOL_PILL } from '@/lib/studio-skin';
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
  className = '!min-h-11 shrink-0 ring-1 ring-ink/10',
}: {
  tiles: readonly StudioTileModel[];
  value: StudioTileKey;
  onOpen: (key: StudioTileKey) => void;
  dataAttr: string;
  /** The pill's look — the Tool row's is the prototype's `.ddp` (`STUDIO_TOOL_PILL`). */
  className?: string;
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
      className={className}
    />
  );
}

/**
 * ✓ SAVED — the Tool row's right-hand pill (prototype `.fright.saved`). Every Studio
 * write already says it is under way (`makerSave` / the shell's form posts fire
 * `MAKER_UNHELD_WRITE_EVENT`); this only DRAWS that: "Saving…" while one is in
 * flight, "✓ Saved" once none is. It writes nothing and claims nothing it did not
 * hear — a screen that never wrote shows "✓ Saved" because nothing is pending.
 */
export function StudioSaved() {
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let timer: number | null = null;
    const settle = () => {
      if (makerSavesInFlight() > 0) {
        timer = window.setTimeout(settle, 400);
        return;
      }
      timer = null;
      setSaving(false);
    };
    const onWrite = () => {
      setSaving(true);
      if (timer === null) timer = window.setTimeout(settle, 400);
    };
    window.addEventListener(MAKER_UNHELD_WRITE_EVENT, onWrite);
    return () => {
      window.removeEventListener(MAKER_UNHELD_WRITE_EVENT, onWrite);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, []);
  return (
    <span data-studio-saved={saving ? 'saving' : 'saved'} aria-live="polite" className={`${STUDIO_SAVED_PILL} ${saving ? 'text-ink/50' : 'text-success-700'}`}>
      {saving ? (
        'Saving…'
      ) : (
        <>
          <Check aria-hidden className="h-4 w-4" strokeWidth={2.2} />
          Saved
        </>
      )}
    </span>
  );
}

/**
 * A Studio tool FULL SCREEN — its slim row (prototype `.fhead`; owner 2026-10-06, DECISION_LOG
 * "'ASK ONE BY ONE' … TAPPING STUDIO AGAIN RETURNS TO THE TILES"): Tool ▾ across the row, then
 * ✓ Saved — or ✓ Done where the top nav is hidden (Wedding March, Seat plan). No "‹ Studio" —
 * tapping Studio in the top nav returns to the tiles.
 *
 * `[data-studio-row-end]` is the row's right end: a tool with a control of its own there (the
 * Mood Board's ✨ Auto and its own Saved, prototype `.autob`) portals it in, and the row's own
 * Saved steps aside for it (`studioFullScreenCss`).
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
    <div data-maker-studio-row="" className={STUDIO_HEAD_ROW}>
      <StudioToolMenu tiles={tiles} value={tile.key} onOpen={onOpen} dataAttr="data-maker-studio-tool" className={STUDIO_TOOL_PILL} />
      {tile.immersive ? (
        <button type="button" data-maker-studio-done="" onClick={onDone} className={STUDIO_DONE_BUTTON}>
          <Check aria-hidden className="h-[15px] w-[15px]" strokeWidth={2.6} />
          Done
        </button>
      ) : (
        <div data-studio-row-end="" className="flex shrink-0 items-center gap-1.5">
          <span data-studio-row-saved="" className="contents">
            <StudioSaved />
          </span>
        </div>
      )}
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

/**
 * 🎯 THE STYLE BAR'S JUMP, AND THE WAY BACK (owner 2026-10-07: *"opens to the exact place where to edit it"* · *"if we
 * did a jump, we need a way to apply and return to where we were editing"*). Mounted by the shell only while a Studio
 * tool is open FROM a part (`from`): the field is brought into view and focused once the editor has drawn it, and
 * "✓ Done · back to <part>" sits in the thumb's reach, just above the editor. Lazy: it exists only after a jump.
 */
export function StudioBackToPart({
  from,
  side,
  at,
  full,
  onBack,
}: {
  from: { label: string; focus: string | null };
  side: MakerSide;
  /** The Studio tool on screen — the field is looked for again when it changes. */
  at: unknown;
  /** The tool is drawn full screen (the button shows only then). */
  full: boolean;
  onBack: () => void;
}) {
  const focusSel = from.focus;
  useEffect(() => {
    if (!focusSel || side !== 'studio') return;
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      const el = document.querySelector<HTMLElement>(`[data-maker-shell] :is(${focusSel})`);
      /* A field inside a folded row (Studio › Info's "Event name · …") asks that row to open first. */
      if (el && el.offsetParent === null) el.closest('[data-studio-event-name]')?.setAttribute('data-focus-pending', '');
      if (el && el.offsetParent !== null) {
        window.clearInterval(id);
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.focus({ preventScroll: true });
      } else if (n > 40) window.clearInterval(id);
    }, 100);
    return () => window.clearInterval(id);
  }, [focusSel, side, at]);
  const [hasFoot, setHasFoot] = useState(false);
  useEffect(() => {
    const look = () => setHasFoot(Boolean(document.querySelector('[data-maker-shell] :is([data-studio-day], [data-moment-order-cards])')));
    look();
    const id = window.setInterval(look, 500);
    return () => window.clearInterval(id);
  }, [from, at]);
  if (!full) return null;
  return (
    <button
      type="button"
      data-maker-studio-back=""
      onClick={onBack}
      /* Above an editor's own pinned foot (the Schedule's / Love Story's "Add a moment", ~64 px). */
      style={{ bottom: `calc(var(--maker-lt-h) + env(safe-area-inset-bottom) + ${hasFoot ? 76 : 8}px)` }}
      className="sn-press absolute left-1/2 z-[45] inline-flex h-11 -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-success-600 px-5 text-[14px] font-bold text-cream shadow-[0_10px_24px_-12px_rgba(0,0,0,.5)] hover:bg-success-700 lg:hidden"
    >
      <Check aria-hidden className="h-4 w-4" strokeWidth={2.6} />
      Done · back to {from.label}
    </button>
  );
}
