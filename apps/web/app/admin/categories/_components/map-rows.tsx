/**
 * map-rows.tsx — the rows, tiles and columns of the four-level map, as PURE RENDER (🌳 ③b; corpus
 * prototypes/admin_taxonomy_four_levels_2026-10-26/interactive-v4.html, PLAN.md § 9 element → component).
 *
 * No hooks: every value and every handler arrives as a prop from `four-level-map.tsx`, so the desktop
 * columns can be painted in a test with renderToStaticMarkup — `map-shows-at-most-four-columns.test.ts`
 * holds the owner's "no fifth column" ruling against the real markup.
 *
 * Shipped shapes reused (PLAN § 9): `list-pane.tsx`'s ROW (`min-h-11 rounded-xl px-3`) and ROW_ON
 * (`bg-ink text-cream`); the /explore tile's icon-on-cream; the `›` open button is a second 44-px target
 * inside the row. One icon + one word per level, everywhere: Group = Layers · Category = Folder ·
 * Service = Store · Part = Image · Service card = CreditCard.
 */
import type { DragEvent, ReactNode } from 'react';
import { Circle, CreditCard, Folder, ImageIcon, Layers, Store } from 'lucide-react';
import { getLucideIcon } from '@/lib/nav-icons';
import {
  cardWord,
  cardHeld,
  categoriesOf,
  categoryNeeds,
  groupNeeds,
  partLinkSummary,
  peso,
  plural,
  serviceNeeds,
  servicesOf,
  partsHomedIn,
  type Column,
  type MapCard,
  type MapCategory,
  type MapData,
  type MapGroup,
  type MapPart,
  type MapService,
} from './four-level-model';

export type Level = 'group' | 'category' | 'service' | 'part' | 'card';

const LEVEL_ICON = { group: Layers, category: Folder, service: Store, part: ImageIcon, card: CreditCard } as const;
export const LEVEL_WORD: Record<Level, string> = { group: 'Group', category: 'Category', service: 'Service', part: 'Part', card: 'Service card' };

export function LevelIcon({ level, accent = false, className = 'h-4 w-4' }: { level: Level; accent?: boolean; className?: string }) {
  const C = LEVEL_ICON[level];
  return <C aria-hidden className={`${className} shrink-0 ${accent ? 'text-mulberry' : ''}`} strokeWidth={1.8} />;
}

/** A group's couple-facing icon (admin-set, else the group default the /explore strip uses). */
export function GroupGlyph({ name, fallback, className }: { name: string | null; fallback: string | null; className: string }) {
  const C = getLucideIcon(name) ?? getLucideIcon(fallback) ?? Circle;
  return <C aria-hidden className={className} strokeWidth={1.75} />;
}

/** The amber "needs a look" dot (`text-terracotta-700`, the page's gap tone). */
export function Dot() {
  return <span aria-label="Needs a look" title="Needs a look" className="inline-block h-2 w-2 shrink-0 rounded-full bg-terracotta-700 align-middle" />;
}

export function Pill({ children, gap = false }: { children: ReactNode; gap?: boolean }) {
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${gap ? 'border border-terracotta-700 text-terracotta-700' : 'bg-ink/10'}`}
    >
      {children}
    </span>
  );
}

const ROW = 'relative flex w-full min-h-11 items-center gap-2 rounded-xl px-2 text-[13.5px] transition-colors';
const ROW_ON = 'bg-ink text-cream';
const ROW_HL = 'bg-mulberry/10 ring-1 ring-inset ring-mulberry';
const OPEN = 'grid min-h-11 w-11 shrink-0 place-items-center rounded-lg text-base';

export type RowHandlers = {
  /** First tap selects; a second tap on the selected item opens its drawer. */
  onTap: (id: string) => void;
  onOpen: (id: string) => void;
  onHover?: (id: string) => void;
  /** Desktop only — `null` turns drag off (the phone, the server render). */
  drag?: {
    start: (e: DragEvent, id: string) => void;
    over: (e: DragEvent, id: string) => void;
    leave: (e: DragEvent) => void;
    drop: (e: DragEvent, id: string) => void;
  } | null;
};

function dragProps(h: RowHandlers, id: string, draggable: boolean, droppable: boolean) {
  if (!h.drag) return {};
  return {
    ...(draggable ? { draggable: true, onDragStart: (e: DragEvent) => h.drag!.start(e, id) } : {}),
    ...(droppable
      ? { onDragOver: (e: DragEvent) => h.drag!.over(e, id), onDragLeave: (e: DragEvent) => h.drag!.leave(e), onDrop: (e: DragEvent) => h.drag!.drop(e, id) }
      : {}),
  };
}

/** Group / category tile — the /explore tile's icon on cream, the label, a count line, ›. */
export function GroupTile({ d, g, on, defaultIcon, h }: { d: MapData; g: MapGroup; on: boolean; defaultIcon: string | null; h: RowHandlers }) {
  const cats = categoriesOf(d, g.id);
  return (
    <button
      type="button"
      data-id={`g:${g.id}`}
      data-row="group"
      onClick={() => h.onTap(`g:${g.id}`)}
      {...dragProps(h, `g:${g.id}`, false, true)}
      className={`flex min-h-14 w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left ${on ? ROW_ON : 'text-ink hover:bg-ink/5'}`}
    >
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-lg ${on ? 'bg-cream/15' : 'bg-ink/5'}`}>
        <GroupGlyph name={g.iconName} fallback={defaultIcon} className={`h-5 w-5 ${on ? 'text-cream' : 'text-mulberry'}`} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-semibold">
          <span className="min-w-0 [overflow-wrap:anywhere]">{g.label}</span>
          {groupNeeds(d, g) ? <Dot /> : null}
        </span>
        <span className="block text-[11.5px] opacity-75">
          {g.hidden ? 'Hidden · ' : ''}
          {plural(cats.length, 'category', 'categories')}
        </span>
      </span>
      <span aria-hidden className="shrink-0 opacity-60">›</span>
    </button>
  );
}

export function CategoryTile({ d, c, on, defaultIcon, h }: { d: MapData; c: MapCategory; on: boolean; defaultIcon: string | null; h: RowHandlers }) {
  const n = servicesOf(d, c.id).length;
  const parts = partsHomedIn(d, c.id).length;
  const g = d.groups.find((x) => x.id === c.groupId);
  return (
    <button
      type="button"
      data-id={`c:${c.id}`}
      data-row="category"
      onClick={() => h.onTap(`c:${c.id}`)}
      {...dragProps(h, `c:${c.id}`, true, true)}
      className={`flex min-h-14 w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left ${on ? ROW_ON : 'text-ink hover:bg-ink/5'}`}
    >
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-lg ${on ? 'bg-cream/15' : 'bg-ink/5'}`}>
        <GroupGlyph name={c.iconName ?? g?.iconName ?? null} fallback={defaultIcon} className={`h-5 w-5 ${on ? 'text-cream' : 'text-mulberry'}`} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-semibold">
          <span className="min-w-0 [overflow-wrap:anywhere]">{c.label}</span>
          {categoryNeeds(d, c) ? <Dot /> : null}
        </span>
        <span className="flex flex-wrap items-center gap-1 text-[11.5px] opacity-75">
          {c.hidden ? <Pill>Hidden</Pill> : null}
          {n === 0 ? <Pill gap>no service</Pill> : <span>{plural(n, 'service')}</span>}
          {parts ? <span>· {plural(parts, 'part')}</span> : null}
        </span>
      </span>
      <span aria-hidden className="shrink-0 opacity-60">›</span>
    </button>
  );
}

export function ServiceRow({
  d,
  s,
  on,
  hl,
  dim,
  isNew,
  path,
  h,
}: {
  d: MapData;
  s: MapService;
  on: boolean;
  hl?: boolean;
  dim?: boolean;
  isNew?: boolean;
  path?: string;
  h: RowHandlers;
}) {
  const id = `s:${s.key}`;
  return (
    <div
      data-id={id}
      data-row="service"
      onMouseEnter={() => h.onHover?.(id)}
      onMouseLeave={() => h.onHover?.('')}
      {...dragProps(h, id, true, false)}
      className={`${ROW} ${on ? ROW_ON : hl ? `${ROW_HL} text-ink` : 'text-ink hover:bg-ink/5'} ${dim ? 'opacity-45' : ''} ${isNew ? 'ring-1 ring-inset ring-mulberry' : ''}`}
    >
      {h.drag ? <span aria-hidden className="w-3 shrink-0 cursor-grab text-center text-xs tracking-[-2px] opacity-55">⋮⋮</span> : null}
      <button type="button" onClick={() => h.onTap(id)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left">
        <LevelIcon level="service" accent={!on} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex flex-wrap items-center gap-1.5 [overflow-wrap:anywhere]">
            {s.label}
            {s.hidden ? <Pill>Hidden from suppliers</Pill> : null}
            {serviceNeeds(d, s) ? <Dot /> : null}
          </span>
          {path ? <span className="text-xs opacity-70">{path}</span> : null}
        </span>
        <span className="shrink-0 text-[11.5px] opacity-80">{plural(s.cards, 'card')}</span>
      </button>
      <button type="button" aria-label={`Open ${s.label}`} onClick={() => h.onOpen(id)} className={`${OPEN} ${on ? '' : 'text-ink/55 hover:bg-ink/5'}`}>
        ›
      </button>
    </div>
  );
}

/** Two neutral thumbnails until photos (PLAN § 9: the couple's board part block). */
function Thumbs({ size = 'h-7 w-7' }: { size?: string }) {
  return (
    <span aria-hidden className="flex shrink-0 gap-[3px]">
      <i className={`${size} block rounded-md bg-ink/10`} />
      <i className={`${size} block rounded-md border border-dashed border-ink/15`} />
    </span>
  );
}

export function PartRow({
  d,
  p,
  on,
  hl,
  dim,
  isNew,
  foreign,
  path,
  h,
}: {
  d: MapData;
  p: MapPart;
  on: boolean;
  hl?: boolean;
  dim?: boolean;
  isNew?: boolean;
  /** Listed under a category that is not its home — the row says where home is. */
  foreign?: boolean;
  path?: string;
  h: RowHandlers;
}) {
  const id = `p:${p.key}`;
  const link = partLinkSummary(d, p);
  const home = d.categories.find((c) => c.id === p.home);
  return (
    <div
      data-id={id}
      data-row="part"
      onMouseEnter={() => h.onHover?.(id)}
      onMouseLeave={() => h.onHover?.('')}
      {...dragProps(h, id, true, false)}
      className={`${ROW} ${on ? ROW_ON : hl ? `${ROW_HL} text-ink` : 'text-ink hover:bg-ink/5'} ${dim ? 'opacity-45' : ''} ${isNew ? 'ring-1 ring-inset ring-mulberry' : ''}`}
    >
      {h.drag ? <span aria-hidden className="w-3 shrink-0 cursor-grab text-center text-xs tracking-[-2px] opacity-55">⋮⋮</span> : null}
      <button type="button" onClick={() => h.onTap(id)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left">
        <Thumbs />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex flex-wrap items-center gap-1.5 [overflow-wrap:anywhere]">
            <LevelIcon level="part" accent={!on} />
            {p.label}
            {p.hidden ? <Pill>Hidden</Pill> : null}
            {link.gap ? <Dot /> : null}
          </span>
          <span className="text-xs opacity-70">
            {foreign && home ? `home ${home.label} · ` : ''}
            {link.gap ? <span className="text-terracotta-700">{link.text}</span> : link.text}
            {path ? ` · ${path}` : ''}
          </span>
        </span>
      </button>
      <button type="button" aria-label={`Open ${p.label}`} onClick={() => h.onOpen(id)} className={`${OPEN} ${on ? '' : 'text-ink/55 hover:bg-ink/5'}`}>
        ›
      </button>
    </div>
  );
}

/** A service card — photo · title · from ₱ · the shop · Live / Held (PLAN § 7.8). */
export function CardRow({ cd, on, onOpen }: { cd: MapCard; on: boolean; onOpen: (id: string) => void }) {
  const word = cardWord(cd);
  return (
    <button
      type="button"
      data-id={`k:${cd.id}`}
      data-row="card"
      onClick={() => onOpen(`k:${cd.id}`)}
      className={`flex min-h-12 w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left ${on ? ROW_ON : 'text-ink hover:bg-ink/5'}`}
    >
      {cd.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- the shop's own card photo, public bucket
        <img src={cd.photoUrl} alt="" aria-hidden className="h-9 w-9 shrink-0 rounded-lg object-cover" />
      ) : (
        <i aria-hidden className="block h-9 w-9 shrink-0 rounded-lg bg-ink/10" />
      )}
      <span className="min-w-0 flex-1">
        <b className="block text-[13.5px] font-medium [overflow-wrap:anywhere]">{cd.title}</b>
        <small className="block text-xs opacity-70 [overflow-wrap:anywhere]">
          from {peso(cd.price)} · {cd.shopName}
        </small>
      </span>
      <span className={`flex shrink-0 items-center gap-1 text-[11.5px] ${word === 'Live' && !on ? 'text-success-700' : 'opacity-80'}`}>
        {cardHeld(cd) ? <Dot /> : null}
        {word}
      </span>
    </button>
  );
}

/** A column head: icon · title (an `InfoTip` label, so the detail is behind ⓘ) · a short count. */
export function ColHead({ level, title, sub }: { level: Level; title: ReactNode; sub: string }) {
  return (
    <div className="flex min-h-11 shrink-0 items-center gap-2 border-b border-ink/10 px-3 text-[13px] font-semibold text-ink">
      <LevelIcon level={level} accent />
      <span className="shrink-0 whitespace-nowrap">{title}</span>
      <small className="ml-auto min-w-0 text-right text-xs font-normal leading-tight text-ink/70">{sub}</small>
    </div>
  );
}

/** "＋ Add a part" — opens the picker (pick from the whole library), never a typed row (v4). */
export function PickRow({ label, onPick }: { label: string; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      data-add="part"
      className="mb-0.5 mt-1 flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-dashed border-ink/15 px-2.5 text-left text-[13.5px] text-ink hover:bg-ink/5"
    >
      <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border-[1.5px] border-mulberry text-base text-mulberry">
        ＋
      </span>
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{label}</span>
      <span aria-hidden className="text-ink/55">›</span>
    </button>
  );
}

/** What each desktop column draws. The map passes its own add rows, heads and bodies in. */
export type ColumnSlot = { head: ReactNode; body: ReactNode };

/**
 * The desktop map: the columns `columnsFor()` decided, in order, with the connector gap between Services
 * and Parts. 🔒 Never more than four `data-col` elements — `columns` comes from `columnsFor`, and the
 * test renders every selection through here.
 */
export function DesktopColumns({
  columns,
  slots,
  wire,
}: {
  columns: readonly Column[];
  slots: Record<Column, ColumnSlot | null>;
  /** The SVG layer for the Services → Parts lines (the only new drawing on the page). */
  wire: ReactNode;
}) {
  const shifted = columns[0] === 'categories';
  return (
    <div
      data-map-columns=""
      data-shifted={shifted ? '' : undefined}
      className={`grid items-stretch gap-x-3.5 ${
        shifted
          ? 'grid-cols-[236px_minmax(0,1fr)_64px_minmax(0,1fr)_minmax(250px,330px)]'
          : 'grid-cols-[212px_236px_minmax(0,1fr)_64px_minmax(0,1.2fr)]'
      }`}
    >
      {columns.map((col) => {
        const slot = slots[col];
        const nodes: ReactNode[] = [
          <section
            key={col}
            data-col={col}
            aria-label={col}
            className={`flex min-h-[420px] min-w-0 flex-col rounded-2xl bg-ink/[0.03] ${
              col === 'services' || col === 'parts' ? 'self-stretch' : 'max-h-[calc(100vh-150px)] self-start'
            }`}
          >
            {slot?.head}
            <div data-col-body={col} className="flex-1 overflow-auto p-1.5">
              {slot?.body}
            </div>
          </section>,
        ];
        if (col === 'services') {
          nodes.push(
            <div key="wire" data-wire="" className="relative min-h-[420px] self-stretch">
              {wire}
            </div>,
          );
        }
        return nodes;
      })}
    </div>
  );
}
