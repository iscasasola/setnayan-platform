'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { useOneOpen } from '@/lib/one-open';
import { fontRowClass, groupHeadClass, pickRuns, placePickList, type PickListPlacement } from './pick-menu-place';
import type { PickMenuProps, PickOption } from './pick-menu-types';

/** Notes + types: `pick-menu-types.ts`. */
export type { PickOption, PickMenuProps } from './pick-menu-types';

export function PickMenu({
  label,
  value,
  options,
  onPick,
  dataAttr,
  className = '',
  buttonText,
  picked,
  compact = false,
  stickyGroups = false,
  grid,
}: PickMenuProps) {
  const [open, setOpen] = useState(false);
  useOneOpen(open, setOpen);
  const [at, setAt] = useState<PickListPlacement | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const current = options.find((o) => o.key === value) ?? null;
  const isOn = (key: string) => (picked ? picked.includes(key) : key === value);

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const next = placePickList({
      button: r,
      listHeight: listRef.current?.scrollHeight ?? 0,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    });
    setAt((prev) =>
      prev &&
      prev.top === next.top &&
      prev.left === next.left &&
      prev.minWidth === next.minWidth &&
      prev.maxHeight === next.maxHeight
        ? prev
        : next,
    );
  };

  const focusedOnOpen = useRef(false);
  useLayoutEffect(() => {
    if (!open) {
      focusedOnOpen.current = false;
      return;
    }
    place();
    if (!focusedOnOpen.current && listRef.current) {
      focusedOnOpen.current = true;
      (
        listRef.current.querySelector<HTMLButtonElement>('button[aria-selected="true"]:not([disabled])') ??
        listRef.current.querySelector<HTMLButtonElement>('button:not([disabled])')
      )?.focus();
    }
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!btnRef.current?.contains(e.target as Node) && !listRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    const onMove = () => place();
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open]);

  const move = (dir: 1 | -1) => {
    const items = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(i + dir + items.length) % items.length]?.focus();
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={`${label}: ${buttonText ?? current?.label ?? 'choose'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        {...(dataAttr ? { [dataAttr]: '' } : {})}
        onClick={() => setOpen((o) => !o)}
        className={`sn-press inline-flex min-w-0 max-w-full items-center gap-1.5 whitespace-nowrap rounded-full bg-white/70 font-semibold text-ink transition-colors duration-300 ease-in-out hover:bg-white ${
          compact ? 'min-h-7 px-2 text-xs' : 'min-h-10 px-3 text-[13px]'
        } ${className}`}
      >
        {current?.dot ? <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta" /> : null}
        {current?.icon ? <span aria-hidden className="inline-flex shrink-0">{current.icon}</span> : null}
        <span className="min-w-0 truncate" style={current?.fontFamily ? { fontFamily: current.fontFamily } : undefined}>
          {buttonText ?? current?.label ?? label}
        </span>
        <ChevronDown aria-hidden className={`h-3.5 w-3.5 shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
      </button>
      {open && at
        ? createPortal(
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={label}
              aria-multiselectable={picked ? true : undefined}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  move(1);
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  move(-1);
                }
              }}
              style={{ position: 'fixed', top: at.top, left: at.left, minWidth: at.minWidth, maxHeight: at.maxHeight }}
              data-pick-side={at.side}
              data-pick-grid={grid || undefined}
              className="sn-glass-bare z-[95] overflow-y-auto overscroll-contain rounded-2xl p-1.5 shadow-[0_18px_40px_-18px_rgba(30,26,18,.45)]"
            >
              {pickRuns(options).map((run, ri) =>
                run.group === null ? (
                  run.options.map(renderOption)
                ) : (
                  <li
                    key={`group:${run.group}`}
                    role="group"
                    aria-label={run.group}
                    data-pick-group={run.group}
                    className={ri > 0 ? 'mt-1 border-t border-ink/10 pt-1' : ''}
                  >
                    <p aria-hidden className={groupHeadClass(stickyGroups)}>
                      {run.group}
                    </p>
                    <ul role="none">{run.options.map(renderOption)}</ul>
                  </li>
                ),
              )}
              {picked ? (
                <li role="none" className="mt-1 border-t border-ink/10 pt-1">
                  <button
                    type="button"
                    data-pick-done=""
                    onClick={() => {
                      setOpen(false);
                      btnRef.current?.focus();
                    }}
                    className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-[13px] text-ink/60 hover:bg-ink/5"
                  >
                    <span>Tick as many as apply.</span>
                    <span className="font-semibold text-ink">Done ✓</span>
                  </button>
                </li>
              ) : null}
            </ul>,
            document.body,
          )
        : null}
    </>
  );

  function renderOption(o: PickOption) {
    return (
      <li key={o.key} role="none" className={fontRowClass(o.fontFamily)}>
        <button
          type="button"
          role="option"
          aria-selected={isOn(o.key)}
          disabled={Boolean(o.disabledNote)}
          data-pick-option={o.key}
          onClick={() => {
            if (!picked) setOpen(false);
            onPick(o.key);
          }}
          className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-[14px] transition-colors duration-300 ease-in-out disabled:cursor-default disabled:text-ink/40 ${
            o.hint || o.preview ? 'py-2' : ''
          } ${!picked && o.key === value ? 'bg-ink text-cream' : 'text-ink hover:bg-ink/5'}`}
        >
          {o.dot ? <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta" /> : null}
          {o.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- a generated preview from our own route
            <img src={o.thumb} alt="" aria-hidden width={27} height={36} loading="lazy" className="my-1 h-9 w-[27px] shrink-0 rounded-sm object-cover ring-1 ring-ink/10" />
          ) : null}
          {o.icon ? <span aria-hidden className="inline-flex shrink-0">{o.icon}</span> : null}
          {o.preview ? <span aria-hidden className="shrink-0">{o.preview}</span> : null}
          {o.hint ? (
            <span className="min-w-0">
              <span className="block font-semibold" style={o.fontFamily ? { fontFamily: o.fontFamily } : undefined}>
                {o.label}
              </span>
              <span className="block text-[12px] font-medium leading-snug opacity-75">{o.hint}</span>
            </span>
          ) : (
            <span className="font-semibold" style={o.fontFamily ? { fontFamily: o.fontFamily } : undefined}>
              {o.label}
            </span>
          )}
          {o.dot ? <span className="text-[12px] font-medium opacity-70">· {o.dotNote ?? 'live today'}</span> : null}
          {o.disabledNote ? <span className="text-[12px] font-medium">· {o.disabledNote}</span> : null}
          {o.trail ? (
            <span
              data-pick-trail={o.trail.tone}
              className={`ml-auto shrink-0 pl-3 text-[13px] font-semibold ${
                o.key === value ? 'opacity-80' : o.trail.tone === 'ok' ? 'text-success-700' : o.trail.tone === 'left' ? 'text-terracotta-700' : 'text-ink/50'
              }`}
            >
              <span aria-hidden>{o.trail.text}</span>
              {o.trail.label ? <span className="sr-only">{o.trail.label}</span> : null}
            </span>
          ) : null}
          {picked && picked.includes(o.key) ? (
            <span aria-hidden className="ml-auto shrink-0 pl-3 text-[14px] font-semibold text-success-700">
              ✓
            </span>
          ) : null}
        </button>
      </li>
    );
  }
}
