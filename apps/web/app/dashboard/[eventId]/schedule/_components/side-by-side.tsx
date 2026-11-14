'use client';

/**
 * 🧭 SIDE BY SIDE — View as ▾ › Side by side (event chapters slice 9; the shipped "Suppliers by time", renamed — one
 * view, not a second). Everyone on ONE time axis: times pinned left, column heads pinned on top, the chapter bands
 * shaded behind every column, a backstage block dashed, a clash outlined "Two places at once", "Now" across every
 * column on the day. "By person · By chapter · By role" is one dropdown; By person can show any ONE person alone.
 * Phone ≈ 2.5 columns and swipes sideways; tablet ≈ 5; desktop every column.
 *
 * A view, never a write. The rules are `lib/side-by-side.ts`.
 * 🔒 app/dashboard/[eventId]/schedule/side-by-side-is-one-time-axis.test.ts
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { formatCount } from '@/lib/format-number';
import type { Chapter } from '@/lib/schedule-chapters';
import { lensAllowed, suppliersByTime, type ViewAsInput, type ViewLens } from '@/lib/schedule-view-as';
import { SBS_GROUPINGS, hourMark, sideBySide, type SbsGrouping } from '@/lib/side-by-side';
import { PickMenu } from './day-ui';

const PX_PER_HOUR = 64;
const TIME_COL = 56;
const HEAD = 60;
/** Room above the first hour so its mark is never under the pinned heads. */
const PAD = 10;
const ALL_COLUMNS = 'everyone';

/** How many columns fit: a phone ≈ 2.5, a tablet ≈ 5, a desktop every one (never thinner than 140 px). */
export function columnWidth(screen: number, pane: number, columns: number): number {
  const room = Math.max(0, pane - TIME_COL);
  if (screen < 768) return Math.round(room / 2.5);
  if (screen < 1280) return Math.round(room / 5);
  return Math.max(140, Math.floor(room / Math.max(1, columns)));
}

export function SideBySideView({
  input,
  chapters,
  onLens,
  nowIso = null,
}: {
  input: ViewAsInput;
  chapters: readonly Chapter[];
  onLens: (l: ViewLens) => void;
  nowIso?: string | null;
}) {
  const [grouping, setGrouping] = useState<SbsGrouping>('person');
  const [focus, setFocus] = useState<string>(ALL_COLUMNS);
  const [query, setQuery] = useState('');
  const wrap = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(390);
  const [screen, setScreen] = useState(390);
  // The pane is drawn only once someone is on the axis — measure it then.
  const hasColumns = input.data.moments.length > 0;
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const read = () => {
      setWidth(el.clientWidth || 390);
      setScreen(window.innerWidth || 390);
    };
    read();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(read) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [hasColumns]);

  const tbaGroups = useMemo(() => suppliersByTime(chapters, input.data).tba, [chapters, input.data]);
  const hostIds = useMemo(() => new Set(input.data.suppliers.filter((s) => s.host).map((s) => s.vendor_id)), [input.data.suppliers]);
  const trades = useMemo(() => new Map(input.data.suppliers.filter((s) => s.trade).map((s) => [s.vendor_id, s.trade!])), [input.data.suppliers]);
  const sbs = useMemo(() => sideBySide({ chapters, data: input.data, grouping, hostIds, trades, nowIso }), [chapters, input.data, grouping, hostIds, trades, nowIso]);
  const shown = focus === ALL_COLUMNS ? sbs.columns : sbs.columns.filter((c) => c.key === focus);
  const colW = focus === ALL_COLUMNS ? columnWidth(screen, width, shown.length) : Math.max(140, width - TIME_COL);
  const height = ((sbs.endMs - sbs.startMs) / 3_600_000) * PX_PER_HOUR;
  const y = (t: number) => ((t - sbs.startMs) / 3_600_000) * PX_PER_HOUR;
  const hours = Array.from({ length: Math.round((sbs.endMs - sbs.startMs) / 3_600_000) + 1 }, (_, i) => sbs.startMs + i * 3_600_000);
  const q = query.trim().toLowerCase();
  const people = sbs.columns.map((c) => ({ key: c.key, label: c.name, group: grouping === 'role' ? 'Roles' : 'People' }));
  const peopleShown = q ? people.filter((p) => p.label.toLowerCase().includes(q) || p.key === focus) : people;

  if (input.data.tasks === null) {
    return (
      <p role="alert" data-view-as-unread="" className="text-[13px] font-semibold text-danger-700">
        The tasks couldn’t be read just now, so Side by side may be missing people. Try again in a moment.
      </p>
    );
  }

  return (
    <div data-side-by-side={grouping} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <PickMenu
          label="Group the columns"
          value={grouping}
          options={SBS_GROUPINGS.map((g) => ({ key: g.key, label: g.label }))}
          onPick={(k) => {
            setGrouping(k as SbsGrouping);
            setFocus(ALL_COLUMNS);
          }}
          dataAttr="data-sbs-grouping"
          compact
        />
        {/* 🔎 By person (or role): any ONE column alone, so their whole day reads top to bottom. */}
        <PickMenu
          label="Show one person"
          value={focus}
          buttonText={focus === ALL_COLUMNS ? (grouping === 'role' ? 'Every role' : 'Everyone') : (sbs.columns.find((c) => c.key === focus)?.name ?? 'Everyone')}
          options={[{ key: ALL_COLUMNS, label: grouping === 'role' ? 'Every role' : 'Everyone' }, ...peopleShown]}
          head={
            people.length > 6 ? (
              <li role="none" className="sticky top-0 z-[2] -mx-1.5 -mt-1.5 mb-1 bg-cream/95 p-1.5">
                <div className="relative">
                  <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/70" strokeWidth={2} />
                  <input
                    className="min-h-11 w-full rounded-xl border border-ink/15 bg-cream pl-9 pr-3 text-[14px] text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Find a person"
                    aria-label="Find a person"
                    data-sbs-search=""
                  />
                </div>
              </li>
            ) : undefined
          }
          onPick={(k) => {
            setQuery('');
            setFocus(k);
          }}
          dataAttr="data-sbs-focus"
          compact
        />
        {sbs.clashes > 0 ? (
          <span className="text-[13px] font-semibold text-danger-700" data-sbs-clashes={sbs.clashes}>
            ⚠ {formatCount(sbs.clashes)} in two places at once
          </span>
        ) : null}
      </div>

      {sbs.columns.length === 0 ? (
        <p className="py-3 text-[14px] text-ink/70">Nobody is on a timed chapter yet. Tag a supplier on a moment and their column appears here.</p>
      ) : (
        <div ref={wrap} className="relative -mx-4 max-h-[calc(100dvh-11rem)] overflow-auto overscroll-contain border-y border-ink/10" data-sbs-scroll="">
          <div className="relative" style={{ width: TIME_COL + colW * shown.length, height: HEAD + PAD + height }}>
            {/* Column heads — pinned on top while the day scrolls. */}
            <div className="sticky top-0 z-[4] flex bg-cream" style={{ height: HEAD }}>
              <div className="sticky left-0 z-[5] flex-none bg-cream" style={{ width: TIME_COL }} />
              {shown.map((c, i) => (
                <button
                  key={c.key}
                  type="button"
                  data-sbs-head={c.key}
                  disabled={!(c.key.startsWith('sup:') && lensAllowed(input.pro, { kind: 'supplier', vendorId: c.key.slice(4), crew: null }))}
                  onClick={() => onLens({ kind: 'supplier', vendorId: c.key.slice(4), crew: null })}
                  className="flex min-w-0 flex-none flex-col justify-end border-b border-l border-ink/10 px-2 pb-1.5 text-left disabled:cursor-default"
                  style={{ width: colW }}
                >
                  {c.group && (i === 0 || shown[i - 1]!.group !== c.group) ? (
                    <span className="truncate text-xs uppercase tracking-[0.06em] text-gold-deep">{c.group}</span>
                  ) : null}
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-ink/[0.07] text-xs font-semibold text-ink/75">{c.initials}</span>
                    <span className="truncate text-[13.5px] font-semibold text-ink">{c.name}</span>
                  </span>
                  <span className="truncate text-xs text-ink/70">{c.line}</span>
                </button>
              ))}
            </div>
            {/* The axis: hour marks pinned left; the chapter bands shaded behind every column. */}
            <div className="absolute inset-x-0" style={{ top: HEAD + PAD, height }}>
              {sbs.bands.map((b, i) => (
                <div
                  key={b.id}
                  data-sbs-band={b.id}
                  aria-hidden
                  className={`absolute ${i % 2 === 0 ? 'bg-gold/[0.08]' : 'bg-ink/[0.025]'}`}
                  style={{ top: y(b.startMs), height: Math.max(2, y(b.endMs) - y(b.startMs)), left: TIME_COL, right: 0 }}
                >
                  <span className="sticky left-14 ml-1 block w-max text-xs uppercase tracking-[0.06em] text-gold-deep">{b.label}</span>
                </div>
              ))}
              <div className="sticky left-0 z-[3] h-full bg-cream" style={{ width: TIME_COL }}>
                {hours.map((h) => (
                  <span key={h} className="absolute right-2 -translate-y-1/2 text-xs tabular-nums text-ink/70" style={{ top: y(h) }}>
                    {hourMark(h)}
                  </span>
                ))}
              </div>
              {shown.map((c, ci) => (
                <div key={c.key} data-sbs-column={c.key} className="absolute top-0 h-full border-l border-ink/10" style={{ left: TIME_COL + ci * colW, width: colW }}>
                  {c.blocks.map((b) => (
                    <div
                      key={b.id}
                      data-sbs-block={b.id}
                      data-sbs-backstage={b.backstage ? '' : undefined}
                      data-sbs-clash={b.clash ? '' : undefined}
                      className={`absolute inset-x-1 overflow-hidden rounded-md px-1.5 py-1 text-left ${
                        b.backstage ? 'border border-dashed border-ink/35 bg-cream/70' : 'border border-ink/10 bg-cream shadow-[0_1px_2px_rgba(40,34,24,0.06)]'
                      } ${b.clash ? 'ring-2 ring-danger-600' : ''}`}
                      style={{ top: y(b.startMs) + 1, height: Math.max(22, y(b.endMs) - y(b.startMs) - 2) }}
                    >
                      <span className="block truncate text-xs font-semibold leading-tight text-ink">
                        {b.backstage ? <span className="mr-1 text-xs uppercase tracking-[0.06em] text-gold-deep">Backstage</span> : null}
                        {b.title}
                      </span>
                      <span className="block truncate text-xs leading-tight text-ink/70">
                        <span className="tabular-nums">{b.time}</span> · {b.sub}
                      </span>
                      {b.clash ? <span className="block truncate text-xs font-semibold text-danger-700">Two places at once</span> : null}
                    </div>
                  ))}
                </div>
              ))}
              {/* "Now" across every column on the day. */}
              {sbs.nowMs !== null ? (
                <div data-sbs-now="" aria-hidden className="pointer-events-none absolute z-[2] h-0.5 bg-sn-accent" style={{ top: y(sbs.nowMs), left: 0, right: 0 }}>
                  <span className="absolute -top-2 left-1 rounded bg-sn-accent px-1 text-xs font-bold text-sn-on-accent">Now</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
      {/* ⏰ A Time-TBA chapter is never hidden (owner 2026-11-02, "TEN OWNER YESES" item 4): its suppliers are listed
          "Time TBA" under the axis — it has no time to sit on it. */}
      {tbaGroups.map(({ chapter: c, where, items }) => (
        <section key={c.block_id} data-view-as-stretch="tba" className="pt-1">
          <p className="text-[13px] font-semibold text-ink">
            {c.label} <span className="font-normal text-ink/70">· Time TBA · {where}</span>
          </p>
          <ul>
            {items.map((i) => (
              <li key={i.id} data-view-as-line={i.id} className="flex items-baseline gap-2 py-1 text-[13px] text-ink/70">
                <span className="tabular-nums text-ink/70">{i.time}</span>
                <span className="font-semibold text-ink">{i.who}</span>
                <span className="truncate">{i.title}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {sbs.otherDays.length > 0 ? <p className="text-[12.5px] text-ink/70">On another day: {sbs.otherDays.join(', ')}.</p> : null}
    </div>
  );
}
