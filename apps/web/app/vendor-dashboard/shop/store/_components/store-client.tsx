'use client';

import { lazy, Suspense, useRef, useState, useTransition, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { GripVertical, Play, X } from 'lucide-react';
import { ActionButton, type ActionTone } from '@/components/action-button';
import { ThumbRow } from '@/components/thumb-row';
import { SortFace } from '@/components/sort-face';
import { useToast } from '@/app/_components/toast/toast-provider';
import { SupplierThumbRow } from '@/app/vendor-dashboard/_components/supplier-thumb-row';
import { storeAction } from '../store-actions';

/**
 * 🛍 THE STORE'S PRESSES (owner 23 Nov 2026; drawing `supplier_store_graphs_badges_2026-11-23` v10).
 *
 *  · `StoreOp`       — ONE button that runs ONE Store op (Get · Follow · Buy · Remove) through `storeAction`, then says
 *                      what happened in a small toast — or the plain reason it failed. Success refreshes the screen; a
 *                      `landTo` address takes the shop to where the thing landed (the Shop, the item marked New).
 *  · `StoreThumb`    — the Store's thumb row: search (an icon until tapped) and, on a shelf, Show & sort behind Sliders.
 *                      It narrows the rows IN PLACE by their words — no request.
 *  · `GraphArrange`  — "On your Analytics · drag to arrange": hold the grip, drag, let go → saved. ✕ takes one off.
 */

export function StoreOp({
  op,
  fields,
  label,
  icon,
  tone,
  main = false,
  quiet = false,
  landTo,
  data,
}: {
  op: string;
  fields: Readonly<Record<string, string>>;
  label: string;
  icon: ReactElement;
  tone: ActionTone;
  main?: boolean;
  quiet?: boolean;
  /** Where a success goes (with `added=` so the Shop can mark it New). Absent = stay and refresh. */
  landTo?: string;
  data?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, start] = useTransition();
  const run = () => {
    const fd = new FormData();
    fd.set('op', op);
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    start(async () => {
      const res = await storeAction({ status: 'idle' }, fd);
      if (res.status === 'error') {
        toast.error(res.message);
        return;
      }
      if (res.status === 'ok') toast.success(res.message);
      if (landTo) router.push(landTo);
      else router.refresh();
    });
  };
  return (
    <ActionButton
      tone={tone}
      main={main}
      quiet={quiet}
      icon={icon}
      label={label}
      waiting={busy}
      disabled={busy}
      onClick={run}
      className="flex-none"
      tour={data}
    />
  );
}

type Show = { key: string; label: string };

/** Narrow every `[data-store-row]` under `[data-store-list]` by its words and its `data-store-show` tags. */
function narrow(words: string, show: string, sort: string, countWord: string | null) {
  const needle = words.trim().toLowerCase();
  let shown = 0;
  for (const list of document.querySelectorAll<HTMLElement>('[data-store-list]')) {
    const rows = [...list.querySelectorAll<HTMLElement>('[data-store-row]')];
    const names = rows.map((r) => r.dataset.storeName ?? '').sort();
    // Sort · Name: CSS order inside the rows' own list, so no node moves.
    const box = rows[0]?.parentElement;
    if (box && sort === 'name') {
      box.style.display = 'flex';
      box.style.flexDirection = box.tagName === 'UL' && box.closest('[data-store-shelf]') ? 'row' : 'column';
    }
    let hits = 0;
    for (const r of rows) {
      const tags = (r.dataset.storeShow ?? '').split(' ');
      const hit = (!needle || (r.textContent ?? '').toLowerCase().includes(needle)) && (show === 'all' || tags.includes(show));
      r.style.display = hit ? '' : 'none';
      r.style.order = sort === 'name' ? String(names.indexOf(r.dataset.storeName ?? '')) : '';
      if (hit) hits += 1;
    }
    const block = list.closest<HTMLElement>('[data-store-block]');
    if (block) block.style.display = hits > 0 ? '' : 'none';
    shown += hits;
  }
  const sub = document.querySelector<HTMLElement>('[data-store-sub]');
  if (sub) {
    sub.dataset.storeSubRest ??= sub.textContent ?? '';
    sub.textContent =
      needle && countWord ? `${shown} ${shown === 1 ? countWord : `${countWord}s`} match “${words.trim()}”.` : (sub.dataset.storeSubRest ?? '');
  }
  const none = document.querySelector<HTMLElement>('[data-store-none]');
  if (none) none.hidden = shown > 0;
}

export function StoreThumb({
  name,
  placeholder,
  shows,
  countWord,
}: {
  name: string;
  placeholder: string;
  /** The Show choices (All first). Absent = search only. */
  shows?: readonly Show[];
  /** "tool" → "2 tools match “song”." */
  countWord?: string;
}) {
  const [words, setWords] = useState('');
  const [show, setShow] = useState('all');
  const [sort, setSort] = useState('listed');
  return (
    <SupplierThumbRow
      name={`store-${name}`}
      label="Store actions"
      row={
        <ThumbRow
          name={`store-${name}`}
          field={{
            placeholder,
            input: {
              onInput: (e) => {
                const v = e.currentTarget.value;
                setWords(v);
                narrow(v, show, sort, countWord ?? null);
              },
              'data-store-find': name,
            },
            onClear: () => {
              setWords('');
              narrow('', show, sort, countWord ?? null);
            },
          }}
          right={
            shows
              ? [
                  {
                    menu: [
                      ...shows.map((s) => ({ key: `show:${s.key}`, label: s.label, group: 'Show' })),
                      { key: 'sort:listed', label: 'Suggested', group: 'Sort' },
                      { key: 'sort:name', label: 'Name', group: 'Sort' },
                    ],
                    label: 'Show and sort',
                    value: `show:${show}`,
                    onPick: (k: string) => {
                      const [kind, v] = k.split(':') as ['show' | 'sort', string];
                      const nextShow = kind === 'show' ? v : show;
                      const nextSort = kind === 'sort' ? v : sort;
                      setShow(nextShow);
                      setSort(nextSort);
                      narrow(words, nextShow, nextSort, countWord ?? null);
                    },
                    mark: 'data-store-show-sort',
                    face: <SortFace on={show !== 'all' || sort !== 'listed'} />,
                  },
                ]
              : undefined
          }
        />
      }
    />
  );
}

export type ArrangeGraph = { key: string; title: string; window: string };

/**
 * "On your Analytics · drag to arrange" — the shop's graphs in its order. The grip drags (pointer: finger or mouse);
 * letting go saves the new order through `storeAction` op=graphs. ✕ takes a graph off. A save that fails puts the
 * order back and says why.
 */
export function GraphArrange({ graphs }: { graphs: readonly ArrangeGraph[] }) {
  const router = useRouter();
  const toast = useToast();
  const [order, setOrder] = useState<ArrangeGraph[]>(() => [...graphs]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const listRef = useRef<HTMLUListElement>(null);
  const before = useRef<ArrangeGraph[]>(order);

  const save = (next: ArrangeGraph[], op: 'graphs' | 'graph_remove', key?: string) => {
    const fd = new FormData();
    fd.set('op', op);
    if (op === 'graphs') for (const g of next) fd.append('graph', g.key);
    else if (key) fd.set('graph', key);
    start(async () => {
      const res = await storeAction({ status: 'idle' }, fd);
      if (res.status === 'error') {
        toast.error(res.message);
        setOrder(before.current);
        return;
      }
      before.current = next;
      if (op === 'graph_remove' && res.status === 'ok') toast.success(res.message);
      router.refresh();
    });
  };

  const onGrip = (e: ReactPointerEvent<HTMLButtonElement>, key: string) => {
    e.preventDefault();
    const grip = e.currentTarget;
    grip.setPointerCapture(e.pointerId);
    before.current = order;
    setDragging(key);
    let current = order;
    const move = (ev: PointerEvent) => {
      const items = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-arrange-row]') ?? [])];
      const at = items.findIndex((el) => {
        const r = el.getBoundingClientRect();
        return ev.clientY < r.top + r.height / 2;
      });
      const to = at === -1 ? current.length - 1 : at;
      const from = current.findIndex((g) => g.key === key);
      if (from === -1 || to === from || (at !== -1 && to === from + 1)) return;
      const next = [...current];
      const [g] = next.splice(from, 1);
      next.splice(to > from ? to - 1 : to, 0, g!);
      current = next;
      setOrder(next);
    };
    const up = () => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', up);
      setDragging(null);
      if (current.map((g) => g.key).join() !== before.current.map((g) => g.key).join()) save(current, 'graphs');
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', up);
  };

  /** Keyboard: the grip's arrows move a graph one place. */
  const nudge = (key: string, by: -1 | 1) => {
    const from = order.findIndex((g) => g.key === key);
    const to = from + by;
    if (from === -1 || to < 0 || to >= order.length) return;
    const next = [...order];
    const [g] = next.splice(from, 1);
    next.splice(to, 0, g!);
    before.current = order;
    setOrder(next);
    save(next, 'graphs');
  };

  return (
    <ul ref={listRef} aria-label="On your Analytics" aria-busy={busy} className="sn-frame sn-frame-flush px-4" data-graph-arrange="">
      {order.map((g) => (
        <li
          key={g.key}
          data-arrange-row={g.key}
          data-store-row=""
          data-store-name={g.title}
          data-store-show="on"
          className={`flex min-h-14 items-center gap-3 py-2 ${dragging === g.key ? 'opacity-60' : ''}`}
        >
          <button
            type="button"
            aria-label={`Move ${g.title}`}
            className="grid h-11 w-8 flex-none cursor-grab touch-none place-items-center text-[color:var(--m-slate-2)]"
            onPointerDown={(e) => onGrip(e, g.key)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                nudge(g.key, -1);
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                nudge(g.key, 1);
              }
            }}
            data-arrange-grip=""
          >
            <GripVertical aria-hidden className="h-5 w-5" strokeWidth={1.8} />
          </button>
          <span className="flex min-w-0 flex-1 flex-col">
            <b className="text-sn-lg font-semibold leading-tight text-ink">{g.title}</b>
            <span className="mt-0.5 text-sn-md text-[color:var(--m-slate-2)]">{g.window}</span>
          </span>
          <ActionButton
            tone="neutral"
            iconOnly
            quiet
            icon={<X aria-hidden strokeWidth={1.8} />}
            label={`Take ${g.title} off your Analytics`}
            disabled={busy}
            onClick={() => {
              const next = order.filter((x) => x.key !== g.key);
              before.current = order;
              setOrder(next);
              save(next, 'graph_remove', g.key);
            }}
          />
        </li>
      ))}
    </ul>
  );
}

const CakeDesigner = lazy(() => import('@/app/_components/cake-maker/cake-designer').then((m) => ({ default: m.CakeDesigner })));

/** "Try it first" — the Cake Maker as couples meet it in your chat: the shipped designer's demo (sample options,
 *  nothing saved or sent). Fetched only on the press. */
export function CakeDemoButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ActionButton tone="info" icon={<Play aria-hidden strokeWidth={1.9} />} label="Open the demo" onClick={() => setOpen(true)} />
      {open ? (
        <Suspense fallback={null}>
          <CakeDesigner threadId="" demo onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  );
}
