'use client';

import { lazy, Suspense, useId, useRef, useState, useTransition, type PointerEvent as ReactPointerEvent, type ReactElement, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Check, GripVertical, MinusCircle, Play } from 'lucide-react';
import { ActionButton, type ActionTone } from '@/components/action-button';
import { ThumbRow } from '@/components/thumb-row';
import { SortFace } from '@/components/sort-face';
import { useToast } from '@/app/_components/toast/toast-provider';
import { SupplierThumbRow } from '@/app/vendor-dashboard/_components/supplier-thumb-row';
import { Sheet } from '@/app/_components/sheet';
import type { LayoutRow } from '@/lib/supplier-store';
import { storeAction } from '../store-actions';

/**
 * 🛍 THE STORE'S PRESSES (owner 23 Nov 2026; drawing `supplier_store_graphs_badges_2026-11-23` v12).
 *
 *  · `StoreOp`       — ONE button that runs ONE Store op (Get · Add · Buy · Remove) through `storeAction`, then says
 *                      what happened in a small toast — or the plain reason it failed. Success refreshes the screen; a
 *                      `landTo` address takes the shop to where the thing landed (the Shop, the item marked New).
 *  · `StoreThumb`    — the Store's thumb row: search (an icon until tapped) and, on a shelf, Show & sort behind Sliders.
 *                      It narrows the rows IN PLACE by their words — no request.
 *  · `StoreChips`    — the Tools shelf's tag chips (All · For you · each supplier group); they narrow the same rows.
 *  · `ArrangeEdit`   — a Shop row's "Edit": the sheet "Arrange …" (v12 Edit frames) — drag ⋮⋮ to reorder, (−) to take
 *                      one off, Done saves the row in ONE `storeAction` op=layout.
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
  /** A list value is sent as repeated fields, in order (op=layout's `key`). */
  fields: Readonly<Record<string, string | readonly string[]>>;
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
    for (const [k, v] of Object.entries(fields)) {
      if (typeof v === 'string') fd.set(k, v);
      else for (const x of v) fd.append(k, x);
    }
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

/** What narrows the shelf: the search words, the Show pick, the tag chip and the sort — one set, shared by the thumb
 *  row and the chips, so the two never undo each other. */
const view = { words: '', show: 'all', chip: 'all', sort: 'listed', countWord: null as string | null };

function renarrow() {
  narrow(view.words, view.show, view.sort, view.countWord, view.chip);
}

/** Narrow every `[data-store-row]` under `[data-store-list]` by its words and its `data-store-show` tags. */
function narrow(words: string, show: string, sort: string, countWord: string | null, chip = 'all') {
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
      const hit = (!needle || (r.textContent ?? '').toLowerCase().includes(needle)) && (show === 'all' || tags.includes(show)) && (chip === 'all' || tags.includes(chip));
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
                Object.assign(view, { words: v, show, sort, countWord: countWord ?? null });
                renarrow();
              },
              'data-store-find': name,
            },
            onClear: () => {
              setWords('');
              Object.assign(view, { words: '', show, sort, countWord: countWord ?? null });
              renarrow();
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
                      Object.assign(view, { words, show: nextShow, sort: nextSort, countWord: countWord ?? null });
                      renarrow();
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

/** The Tools shelf's tag chips (v12 F6): All · For you · each supplier group. One pick at a time; it narrows in place. */
export function StoreChips({ chips }: { chips: readonly Show[] }) {
  const [on, setOn] = useState('all');
  return (
    <div role="group" aria-label="Show tools for" className="sn-glide-x -mx-4 mb-1 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-store-chips="">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          aria-pressed={on === c.key}
          onClick={() => {
            setOn(c.key);
            view.chip = c.key;
            renarrow();
          }}
          className={`sn-press inline-flex min-h-11 flex-none items-center rounded-full px-3.5 text-sn-base font-semibold ${
            on === c.key ? 'bg-[color-mix(in_srgb,rgb(var(--color-link))_14%,transparent)] text-[rgb(var(--color-link))]' : 'bg-[color:var(--surface-soft)] text-[color:var(--m-slate-2)]'
          }`}
          data-store-chip={c.key}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

export type ArrangeItem = { key: string; title: string; sub: string; art: ReactNode; paid?: boolean };

const ARRANGE_TITLE: Readonly<Record<LayoutRow, string>> = { graphs: 'Arrange Analytics', badges: 'Arrange Badges', tools: 'Arrange your tools' };

/**
 * A Shop row's "Edit" (v12 Edit frames · owner via the controller 23 Nov: add, remove, reorder). The link opens the
 * sheet "Arrange …": each item with its grip ⋮⋮ (drag with a finger or mouse; arrows on a keyboard), its picture, name and
 * line, and (−) to take it off the page. Done saves the row once (`storeAction` op=layout); nothing is saved before.
 * A paid tool taken off stays owned (the tools sheet says so). A save that fails keeps the sheet open and says why.
 */
export function ArrangeEdit({ row, items }: { row: LayoutRow; items: readonly ArrangeItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState<ArrangeItem[]>(() => [...items]);
  const [off, setOff] = useState<string[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const listRef = useRef<HTMLUListElement>(null);

  const begin = () => {
    setOrder([...items]);
    setOff([]);
    setOpen(true);
  };

  const done = () => {
    if (order.map((i) => i.key).join() === items.map((i) => i.key).join()) {
      setOpen(false);
      return;
    }
    const fd = new FormData();
    fd.set('op', 'layout');
    fd.set('row', row);
    fd.set('intent', order.length < items.length ? 'remove' : 'order');
    for (const i of order) fd.append('key', i.key);
    for (const k of off) fd.append('off', k);
    start(async () => {
      const res = await storeAction({ status: 'idle' }, fd);
      if (res.status === 'error') {
        toast.error(res.message);
        return;
      }
      if (res.status === 'ok') toast.success(res.message);
      setOpen(false);
      router.refresh();
    });
  };

  const move = (from: number, to: number, list: ArrangeItem[]): ArrangeItem[] => {
    const next = [...list];
    const [g] = next.splice(from, 1);
    next.splice(to, 0, g!);
    return next;
  };

  const onGrip = (e: ReactPointerEvent<HTMLButtonElement>, key: string) => {
    e.preventDefault();
    const grip = e.currentTarget;
    grip.setPointerCapture(e.pointerId);
    setDragging(key);
    let current = order;
    const onMove = (ev: PointerEvent) => {
      const rows = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-arrange-row]') ?? [])];
      const at = rows.findIndex((el) => {
        const r = el.getBoundingClientRect();
        return ev.clientY < r.top + r.height / 2;
      });
      const from = current.findIndex((g) => g.key === key);
      const to = at === -1 ? current.length - 1 : at > from ? at - 1 : at;
      if (from === -1 || to === from) return;
      current = move(from, to, current);
      setOrder(current);
    };
    const up = () => {
      grip.removeEventListener('pointermove', onMove);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', up);
      setDragging(null);
    };
    grip.addEventListener('pointermove', onMove);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', up);
  };

  const nudge = (key: string, by: -1 | 1) => {
    const from = order.findIndex((g) => g.key === key);
    const to = from + by;
    if (from === -1 || to < 0 || to >= order.length) return;
    setOrder(move(from, to, order));
  };

  return (
    <>
      <button type="button" onClick={begin} className="sn-press inline-flex min-h-11 items-center text-sn-base font-semibold text-[rgb(var(--color-link))]" data-arrange-edit={row}>
        Edit
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        labelledById={titleId}
        foot={
          <div className="px-4 pb-4 pt-2 [&>*]:w-full">
            {row === 'tools' ? <p className="pb-3 text-sn-base text-[color:var(--m-slate-2)]">A tool you remove stays yours in the Store.</p> : null}
            <ActionButton tone="brand" main icon={<Check aria-hidden strokeWidth={2.2} />} label="Done" waiting={busy} disabled={busy} onClick={done} tour={`arrange-done-${row}`} />
          </div>
        }
      >
        <h2 id={titleId} className="px-4 pb-1 pt-2 text-sn-xl font-semibold text-ink">
          {ARRANGE_TITLE[row]}
        </h2>
        <ul ref={listRef} aria-label={ARRANGE_TITLE[row]} aria-busy={busy} className="px-4" data-arrange={row}>
          {order.map((g) => (
            <li key={g.key} data-arrange-row={g.key} className={`flex min-h-[60px] items-center gap-3 py-1.5 ${dragging === g.key ? 'opacity-60' : ''}`}>
              <button
                type="button"
                aria-label={`Move ${g.title}`}
                className="grid h-11 w-6 flex-none cursor-grab touch-none place-items-center text-[color:var(--m-slate-2)]"
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
              <span aria-hidden className="flex-none">
                {g.art}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <b className="text-sn-lg font-semibold leading-tight text-ink">{g.title}</b>
                <span className="mt-0.5 text-sn-md leading-snug text-[color:var(--m-slate-2)]">{g.sub}</span>
              </span>
              <ActionButton
                tone="neutral"
                iconOnly
                quiet
                icon={<MinusCircle aria-hidden strokeWidth={1.8} />}
                label={`Take ${g.title} off your Shop`}
                disabled={busy}
                onClick={() => {
                  setOrder(order.filter((x) => x.key !== g.key));
                  if (g.paid) setOff([...off, g.key]);
                }}
                tour={`arrange-remove-${g.key}`}
              />
            </li>
          ))}
        </ul>
        {order.length === 0 ? <p className="px-4 py-3 text-sn-base text-[color:var(--m-slate-2)]">Nothing on this row. Add one from the Store.</p> : null}
      </Sheet>
    </>
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
