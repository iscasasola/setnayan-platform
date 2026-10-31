'use client';

/**
 * four-level-map.tsx — "Supplier categories" as the four-level map (🌳 ③b of the taxonomy build; owner
 * 2026-10-26 "Build the taxonomy"; THE CONTRACT is corpus
 * prototypes/admin_taxonomy_four_levels_2026-10-26/interactive-v4.html, PLAN.md § 7.1–7.8, § 9).
 *
 *   desktop  four columns — Groups | Categories | Services | Parts — with connector lines service → part
 *            drawn ONLY in the gap between those two columns. Picking a service shifts the map Finder-
 *            style: Categories | Services | Parts | Cards, with a breadcrumb back. 🔒 NEVER five columns
 *            (owner ruling "no fifth column"; `columnsFor` + `map-shows-at-most-four-columns.test.ts`).
 *   phone    photo tiles one level at a time (All › group › category), a Map toggle that draws the
 *            services ↔ parts lines in a 44-px gutter, and a full-screen drawer.
 *   drawer   one per item; the server renders the shipped panel (Group · Category · Service) or the new
 *            Part / Service-card panel for `?open=…`, and this file frames it.
 *   add      the last row of every list is its "＋ Add …" (tap · type · Enter). "＋ Add a part" opens the
 *            picker: the WHOLE library, tick = link this service (a row in `inspiration_part_services`,
 *            never a copy), untick = unlink, or create a new part at the bottom.
 *   move     drag a category onto a group, a service or a part onto a category (desktop); "Moved to … ·
 *            Undo". Move to ▾ / Order ▾ live in each drawer.
 *
 * Selection is client state (instant); the address follows with `history.replaceState` (`?in=…&at=…`) so
 * a reload stands where it stood. Opening a drawer is a navigation (`?open=…`) because the panel is
 * server-rendered; every write here answers JSON (`four-level-actions.ts`), whose revalidatePath redraws the page.
 *
 * Shipped components and tokens only (PLAN § 9). The genuinely new drawing is the SVG connector layer
 * and drag-onto-a-parent — the two pieces the owner approved as new.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition, type DragEvent, type FormEvent, type ReactNode, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { InfoTip } from '@/app/_components/info-tip';
import { Sheet } from '@/app/_components/sheet';
import { formatCount } from '@/lib/format-number';
import { moveTileToFolder } from '../actions';
import { addTradeAlias } from '../search-word-actions';
import { mapWrite } from '../four-level-actions';
import { CATEGORIES_PATH, categoriesHref, type CategoriesShow } from './back';
import { nearMatches } from './model';
import {
  addPool,
  cardById,
  cardsOf,
  categoriesOf,
  categoryById,
  columnsFor,
  flatHits,
  gapCategories,
  gapParts,
  groupById,
  heldCards,
  hitTarget,
  needsCount,
  partByKey,
  partLinkSummary,
  partsForCategory,
  partsHomedIn,
  partsOfService,
  partsShown,
  pickedService,
  plural,
  resolveSel,
  serviceByKey,
  servicesOf,
  unfiledCategories,
  withDesktopDefaults,
  type FlatHit,
  type MapData,
  type MapPart,
  type MapSel,
} from './four-level-model';
import {
  CardRow,
  CategoryTile,
  ColHead,
  DesktopColumns,
  Dot,
  GroupGlyph,
  GroupTile,
  LEVEL_WORD,
  LevelIcon,
  PartRow,
  PickRow,
  Pill,
  ServiceRow,
  type ColumnSlot,
  type Level,
  type RowHandlers,
} from './map-rows';
import { MapToast } from './map-toast';
import { DrawerSayProvider, useSay } from './drawer-kit';
import { MoreHorizontal } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

type WriteResult = { ok: true; message: string; id?: string; previous?: string } | { ok: false; error: string };

export type FourLevelMapProps = {
  data: MapData;
  /** The address the server read: `in` · `at` · `open`. */
  start: { in: string; at: string; open: string };
  q: string;
  show: string;
  /** The server-rendered panel for `start.open` (or null). */
  drawer: ReactNode;
  /** The counts line the server measured (groups · categories · services · requests · words …). */
  counts: string;
  groupDefaultIcon: Record<string, string>;
  /** Where the map's own addresses point — the page, or `/dev/categories-lab` (the dev lab draws this same map). */
  basePath?: string;
};

const LEVEL_OF: Record<string, Level> = { g: 'group', c: 'category', s: 'service', p: 'part', k: 'card' };

function ctxOf(s: MapSel): string {
  return s.c ? `c:${s.c}` : s.g ? `g:${s.g}` : '';
}

export function FourLevelMap({ data, start, q, show, drawer, counts, groupDefaultIcon, basePath = CATEGORIES_PATH }: FourLevelMapProps) {
  const router = useRouter();
  const [, startT] = useTransition();
  const [sel, setSel] = useState<MapSel>(() => resolveSel(data, start));
  const [phoneView, setPhoneView] = useState<'groups' | 'cats' | 'cat'>(() => {
    const s = resolveSel(data, start);
    return s.c ? 'cat' : s.g ? 'cats' : 'groups';
  });
  const [mapOn, setMapOn] = useState(false);
  const [hover, setHover] = useState('');
  const [justAdded, setJustAdded] = useState('');
  const [drawerItem, setDrawerItem] = useState(start.open);
  const [picker, setPicker] = useState<{ cid: string; svc: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; undo?: () => void } | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The server opened or closed a drawer (a redirect after a save, Back, a chip) — follow it.
  useEffect(() => {
    setDrawerItem(start.open);
    if (start.open) setSel((s) => ({ ...resolveSel(data, { in: ctxOf(s), open: start.open }) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the server's `open` changes
  }, [start.open]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = () => setIsDesktop(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const desk = useMemo(() => withDesktopDefaults(data, sel), [data, sel]);
  const flat = q.trim().length > 0 || ['needs', 'parts', 'nosvc-cat', 'nosvc-part', 'hidden'].includes(show);

  // ── address + toast ──────────────────────────────────────────────────────────
  const hrefFor = (over: { in?: string; at?: string; open?: string; keepFilters?: boolean }) =>
    basePath + categoriesHref({
      q: over.keepFilters === false ? '' : q,
      show: (over.keepFilters === false ? '' : show) as CategoriesShow | '',
      in: over.in,
      at: over.at,
      open: over.open,
    }).slice(CATEGORIES_PATH.length);

  function stand(next: MapSel) {
    setSel(next);
    try {
      window.history.replaceState(window.history.state, '', hrefFor({ in: ctxOf(next), at: next.sel }));
    } catch {
      /* the address is a convenience; the map works without it */
    }
  }

  function say(msg: string, undo?: () => void) {
    setToast({ msg, undo });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), undo ? 5000 : 2200);
  }


  // ── navigation ───────────────────────────────────────────────────────────────
  function pickGroup(id: string) {
    const first = categoriesOf(data, id)[0]?.id ?? '';
    stand({ g: id, c: first, sel: `g:${id}` });
    setPhoneView('cats');
  }
  function pickCategory(id: string) {
    const c = categoryById(data, id);
    stand({ g: c?.groupId ?? sel.g, c: id, sel: `c:${id}` });
    setPhoneView('cat');
    setMapOn(false);
  }
  function openDrawer(id: string) {
    setDrawerItem(id);
    const base = id.startsWith('g:') || id.startsWith('c:') ? resolveSel(data, { open: id }) : { ...desk, sel: id };
    setSel(base);
    startT(() => router.push(hrefFor({ in: ctxOf(base), open: id }), { scroll: false }));
  }
  function closeDrawer() {
    const was = drawerItem || sel.sel;
    setDrawerItem('');
    setPicker(null);
    if (start.open) startT(() => router.push(hrefFor({ in: ctxOf(sel), at: was }), { scroll: false }));
  }
  function tap(id: string) {
    if (id.startsWith('g:')) return pickGroup(id.slice(2));
    if (id.startsWith('c:')) return pickCategory(id.slice(2));
    if (sel.sel === id) return openDrawer(id);
    stand({ ...desk, sel: id });
  }
  function jump(h: FlatHit) {
    const t = hitTarget(data, h);
    const next = resolveSel(data, { in: t.in, open: t.open });
    setSel(next);
    setPhoneView(next.c ? 'cat' : 'cats');
    setDrawerItem(t.open);
    startT(() => router.push(hrefFor({ in: t.in, open: t.open, keepFilters: false }), { scroll: false }));
  }

  // ── adds ─────────────────────────────────────────────────────────────────────
  async function addGroup(label: string): Promise<string | null> {
    const res = (await mapWrite({ op: 'addGroup', label })) as WriteResult;
    if (!res.ok) return res.error;
    setJustAdded(`g:${res.id}`);
    stand({ g: res.id!, c: '', sel: `g:${res.id}` });
    setPhoneView('cats');
    say('Added — it is the last group');
    return null;
  }
  async function addCategory(groupId: string, label: string): Promise<string | null> {
    const res = (await mapWrite({ op: 'addCategory', groupId, label })) as WriteResult;
    if (!res.ok) return res.error;
    setJustAdded(`c:${res.id}`);
    stand({ g: groupId, c: res.id!, sel: `c:${res.id}` });
    setPhoneView('cat');
    say(`Added — it is the last category in ${groupById(data, groupId)?.label ?? 'this group'}`);
    return null;
  }
  async function addService(categoryId: string, label: string): Promise<string | null> {
    const res = (await mapWrite({ op: 'addService', categoryId, label })) as WriteResult;
    if (!res.ok) return res.error;
    setJustAdded(`s:${res.id}`);
    stand({ ...desk, c: categoryId, sel: `s:${res.id}` });
    say('Added — it landed where you typed it');
    return null;
  }

  // ── moves (drag onto a parent · Undo) ────────────────────────────────────────
  async function moveCategory(catId: string, groupId: string) {
    const from = categoryById(data, catId)?.groupId ?? '';
    if (!from || from === groupId) return;
    const res = (await moveTileToFolder(catId, groupId)) as WriteResult;
    if (!res.ok) return say(res.error);
    stand({ g: groupId, c: catId, sel: `c:${catId}` });
    say(`Moved to ${groupById(data, groupId)?.label ?? groupId}`, async () => {
      const back = (await moveTileToFolder(catId, from)) as WriteResult;
      stand({ g: from, c: catId, sel: `c:${catId}` });
      say(back.ok ? 'Undone' : back.error);
    });
  }
  async function moveService(key: string, catId: string) {
    const res = (await mapWrite({ op: 'moveService', key, categoryId: catId })) as WriteResult;
    if (!res.ok) return say(res.error);
    const from = res.previous ?? '';
    const c = categoryById(data, catId);
    stand({ g: c?.groupId ?? desk.g, c: catId, sel: `s:${key}` });
    say(`Moved to ${c?.label ?? catId}`, from ? async () => {
      const back = (await mapWrite({ op: 'moveService', key, categoryId: from })) as WriteResult;
      const fc = categoryById(data, from);
      stand({ g: fc?.groupId ?? desk.g, c: from, sel: `s:${key}` });
      say(back.ok ? 'Undone' : back.error);
    } : undefined);
  }
  async function movePart(key: string, catId: string) {
    const res = (await mapWrite({ op: 'movePart', slotKey: key, categoryId: catId })) as WriteResult;
    if (!res.ok) return say(res.error);
    const from = res.previous ?? '';
    const c = categoryById(data, catId);
    stand({ g: c?.groupId ?? desk.g, c: catId, sel: `p:${key}` });
    say(`Moved to ${c?.label ?? catId}`, from ? async () => {
      const back = (await mapWrite({ op: 'movePart', slotKey: key, categoryId: from })) as WriteResult;
      const fc = categoryById(data, from);
      stand({ g: fc?.groupId ?? desk.g, c: from, sel: `p:${key}` });
      say(back.ok ? 'Undone' : back.error);
    } : undefined);
  }

  const dragging = useRef<string | null>(null);
  const DROP = ['ring-2', 'ring-inset', 'ring-mulberry', 'bg-mulberry/10'];
  const canDrop = (from: string, to: string) =>
    (from.startsWith('c:') && to.startsWith('g:')) || ((from.startsWith('s:') || from.startsWith('p:')) && to.startsWith('c:'));
  const handlers: RowHandlers = {
    onTap: tap,
    onOpen: openDrawer,
    onHover: setHover,
    drag: isDesktop
      ? {
          start: (e: DragEvent, id: string) => {
            dragging.current = id;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', id);
          },
          over: (e: DragEvent, id: string) => {
            if (!dragging.current || !canDrop(dragging.current, id)) return;
            e.preventDefault();
            (e.currentTarget as HTMLElement).classList.add(...DROP);
          },
          leave: (e: DragEvent) => (e.currentTarget as HTMLElement).classList.remove(...DROP),
          drop: (e: DragEvent, id: string) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).classList.remove(...DROP);
            const from = dragging.current;
            dragging.current = null;
            if (!from || !canDrop(from, id)) return;
            if (from.startsWith('c:')) void moveCategory(from.slice(2), id.slice(2));
            else if (from.startsWith('s:')) void moveService(from.slice(2), id.slice(2));
            else void movePart(from.slice(2), id.slice(2));
          },
        }
      : null,
  };

  // ── the chain lit by the focus (hover, else selection) ───────────────────────
  const focus = (() => {
    const f = hover || desk.sel;
    if (f.startsWith('k:')) {
      const cd = data.cards.find((x) => `k:${x.id}` === f);
      return cd ? `s:${cd.service}` : '';
    }
    return f;
  })();
  const linked = useMemo(() => {
    const out = new Set<string>();
    if (focus.startsWith('s:')) for (const p of partsOfService(data, focus.slice(2))) out.add(`p:${p.key}`);
    if (focus.startsWith('p:')) for (const k of partByKey(data, focus.slice(2))?.services ?? []) out.add(`s:${k}`);
    return out;
  }, [data, focus]);
  const rowState = (id: string) => {
    const kind = focus.slice(0, 1);
    const active = kind === 's' || kind === 'p';
    return {
      hl: linked.has(id),
      dim: active && id !== focus && !linked.has(id) && id.slice(0, 1) !== kind,
    };
  };

  // ── connector lines (the only new drawing) ───────────────────────────────────
  const deskRef = useRef<HTMLDivElement>(null);
  const deskSvg = useRef<SVGSVGElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const phoneSvg = useRef<SVGSVGElement>(null);

  function drawLines(root: HTMLElement | null, svg: SVGSVGElement | null, sBodySel: string, pBodySel: string, wireSel: string) {
    if (!root || !svg) return;
    const wire = root.querySelector<HTMLElement>(wireSel);
    if (!wire || wire.offsetParent === null) return;
    const box = wire.getBoundingClientRect();
    const W = box.width;
    const sBody = root.querySelector<HTMLElement>(sBodySel);
    const pBody = root.querySelector<HTMLElement>(pBodySel);
    if (!sBody || !pBody) return;
    const sr = sBody.getBoundingClientRect();
    const pr = pBody.getBoundingClientRect();
    const inside = (r: DOMRect, col: DOMRect) => r.top + r.height / 2 >= col.top && r.top + r.height / 2 <= col.bottom;
    let d = '';
    for (const row of pBody.querySelectorAll<HTMLElement>('[data-row="part"]')) {
      const key = row.dataset.id?.slice(2) ?? '';
      const part = partByKey(data, key);
      if (!part) continue;
      const pb = row.getBoundingClientRect();
      if (!inside(pb, pr)) continue;
      const y1 = pb.top + pb.height / 2 - box.top;
      for (const sk of part.services) {
        const srow = sBody.querySelector<HTMLElement>(`[data-id="s:${CSS.escape(sk)}"]`);
        if (!srow) continue;
        const sb = srow.getBoundingClientRect();
        if (!inside(sb, sr)) continue;
        const y0 = sb.top + sb.height / 2 - box.top;
        d += `<path data-s="${sk}" data-p="${key}" d="M0,${y0.toFixed(1)} C${(W * 0.45).toFixed(1)},${y0.toFixed(1)} ${(W * 0.55).toFixed(1)},${y1.toFixed(1)} ${W.toFixed(1)},${y1.toFixed(1)}"/>`;
      }
    }
    svg.innerHTML = d;
    svg.setAttribute('viewBox', `0 0 ${W} ${box.height}`);
    paintLines(svg);
  }
  function paintLines(svg: SVGSVGElement | null) {
    if (!svg) return;
    const kind = focus.slice(0, 1);
    const key = focus.slice(2);
    for (const p of svg.querySelectorAll<SVGPathElement>('path')) {
      const on = kind === 's' ? p.dataset.s === key : kind === 'p' ? p.dataset.p === key : false;
      const dim = (kind === 's' || kind === 'p') && !on;
      p.setAttribute(
        'style',
        `fill:none;stroke:${on ? 'rgb(var(--color-mulberry))' : 'rgb(var(--color-ink) / 0.16)'};stroke-width:${on ? 2.5 : 1.5};stroke-opacity:${dim ? 0.35 : 1};transition:stroke .12s,stroke-width .12s`,
      );
    }
  }
  const drawAll = () => {
    drawLines(deskRef.current, deskSvg.current, '[data-col-body="services"]', '[data-col-body="parts"]', '[data-wire]');
    drawLines(phoneRef.current, phoneSvg.current, '[data-map-col="services"]', '[data-map-col="parts"]', '[data-map-wire]');
  };
  useLayoutEffect(drawAll);
  useEffect(() => {
    paintLines(deskSvg.current);
    paintLines(phoneSvg.current);
  });
  useEffect(() => {
    const roots = [deskRef.current, phoneRef.current].filter(Boolean) as HTMLElement[];
    const bodies = roots.flatMap((r) => [...r.querySelectorAll<HTMLElement>('[data-col-body], [data-map-col]')]);
    for (const b of bodies) b.addEventListener('scroll', drawAll, { passive: true });
    const ro = new ResizeObserver(() => drawAll());
    for (const r of roots) ro.observe(r);
    window.addEventListener('resize', drawAll);
    return () => {
      for (const b of bodies) b.removeEventListener('scroll', drawAll);
      ro.disconnect();
      window.removeEventListener('resize', drawAll);
    };
  });

  // ── the columns ──────────────────────────────────────────────────────────────
  const cols = columnsFor(data, desk);
  const g = groupById(data, desk.g);
  const c = categoryById(data, desk.c);
  const sv = pickedService(data, desk);
  const shown = partsShown(data, desk);

  const tip = (label: string, text: string) => (
    <InfoTip label={label} align="start">
      {text}
    </InfoTip>
  );

  const slots: Record<string, ColumnSlot | null> = {
    groups: {
      head: <ColHead level="group" title={tip('Groups', 'The parent. Tiles show the icon couples see on the /explore strip. Drag a category onto a group to move it there.')} sub={plural(data.groups.length, 'group')} />,
      body: (
        <>
          {data.groups.map((x) => (
            <GroupTile key={x.id} d={data} g={x} on={desk.g === x.id} defaultIcon={groupDefaultIcon[x.id] ?? null} h={handlers} />
          ))}
          <AddRow kind="group" placeholder="Add a group" data={data} onAdd={addGroup} />
        </>
      ),
    },
    categories: {
      head: <ColHead level="category" title={tip('Categories', 'The child — and the heading couples see on their Inspiration board. Drag a category tile onto another group to move it.')} sub={g ? `in ${g.label}` : '—'} />,
      body: g ? (
        <>
          {categoriesOf(data, g.id).map((x) => (
            <CategoryTile key={x.id} d={data} c={x} on={desk.c === x.id} defaultIcon={groupDefaultIcon[x.groupId] ?? null} h={handlers} />
          ))}
          {categoriesOf(data, g.id).length === 0 ? <p className="px-2.5 py-3 text-xs text-ink/70">No category yet.</p> : null}
          <AddRow kind="category" placeholder="Add a category" data={data} onAdd={(l) => addCategory(g.id, l)} />
        </>
      ) : (
        <p className="px-2.5 py-3 text-xs text-ink/70">Pick a group.</p>
      ),
    },
    services: {
      head: (
        <ColHead
          level="service"
          title={tip('Services', 'What a shop picks as its service (vendor_services.category). Its cards live inside it. Drag a service onto another category to move it. Order ▾ in a service’s drawer orders it on this page; couples and shops still see services A–Z.')}
          sub={c ? `${plural(servicesOf(data, c.id).length, 'service')} · what suppliers pick` : '—'}
        />
      ),
      body: c ? (
        <>
          {servicesOf(data, c.id).map((s) => {
            const st = rowState(`s:${s.key}`);
            return (
              <ServiceRow
                key={s.key}
                d={data}
                s={s}
                on={desk.sel === `s:${s.key}` || (desk.sel.startsWith('k:') && sv?.key === s.key)}
                hl={st.hl}
                dim={st.dim}
                isNew={justAdded === `s:${s.key}`}
                h={handlers}
              />
            );
          })}
          {servicesOf(data, c.id).length === 0 ? (
            <p className="px-2.5 py-3 text-xs text-terracotta-700">No service yet — no shop can file here until one exists.</p>
          ) : null}
          <AddRow
            kind="service"
            placeholder="Add a service"
            data={data}
            onAdd={(l) => addService(c.id, l)}
            asWord={{ q, show }}
          />
        </>
      ) : (
        <p className="px-2.5 py-3 text-xs text-ink/70">Pick a category.</p>
      ),
    },
    parts: {
      head: (
        <ColHead
          level="part"
          title={tip(
            sv ? `Parts for ${sv.label}` : 'Parts',
            sv
              ? `Only the parts linked to ${sv.label}. Pick another service, or the category, to widen.`
              : 'Every part linked to one of this category’s services, home parts first. Pick a service to narrow. Drag a part onto another category to move its home.',
          )}
          sub={c ? `${plural(shown.list.length, 'part')} · what couples see` : '—'}
        />
      ),
      body: !data.partsRead ? (
        <p role="alert" className="px-2.5 py-3 text-sm text-ink">Couldn’t load the parts — refresh to try again.</p>
      ) : c ? (
        <>
          {shown.list.map((p) => {
            const st = rowState(`p:${p.key}`);
            return (
              <PartRow
                key={p.key}
                d={data}
                p={p}
                on={desk.sel === `p:${p.key}`}
                hl={st.hl}
                dim={st.dim}
                isNew={justAdded === `p:${p.key}`}
                foreign={p.home !== c.id}
                h={handlers}
              />
            );
          })}
          {shown.list.length === 0 ? (
            <p className="px-2.5 py-3 text-xs text-ink/70">{sv ? 'No part links this service yet.' : 'No part is headed here yet.'}</p>
          ) : null}
          <PickRow label={sv ? `Add a part to ${sv.label}` : 'Add a part'} onPick={() => setPicker({ cid: c.id, svc: sv?.key ?? '' })} />
        </>
      ) : (
        <p className="px-2.5 py-3 text-xs text-ink/70">Pick a category.</p>
      ),
    },
    cards: sv
      ? {
          head: (
            <ColHead
              level="card"
              title={tip(
                `Cards for ${sv.label}`,
                'One row per service card a shop published under this service (vendor_services.category). Live = on and the shop is public; Held = turned off, or the shop is not public yet. Tap a card for its facts. Cards are not edited on this page.',
              )}
              sub={data.cardsRead ? plural(cardsOf(data, [sv.key]).length, 'card') : '—'}
            />
          ),
          body: !data.cardsRead ? (
            <p role="alert" className="px-2.5 py-3 text-sm text-ink">Couldn’t load the service cards — refresh to try again.</p>
          ) : cardsOf(data, [sv.key]).length === 0 ? (
            <p className="px-2.5 py-3 text-xs text-ink/70">No service card yet.</p>
          ) : (
            cardsOf(data, [sv.key]).map((cd) => <CardRow key={cd.id} cd={cd} on={desk.sel === `k:${cd.id}` || drawerItem === `k:${cd.id}`} onOpen={openDrawer} />)
          ),
        }
      : null,
  };

  const needs = needsCount(data);
  const drawerOpen = Boolean(drawerItem) || Boolean(picker);
  const drawerLevel: Level = picker ? 'part' : LEVEL_OF[drawerItem.slice(0, 1)] ?? 'category';
  /* ‹ names the level the drawer goes back to — the category it stands in, else its group, else the whole map. */
  const backLabel =
    (sel.c ? categoryById(data, sel.c)?.label : undefined) ?? (sel.g ? groupById(data, sel.g)?.label : undefined) ?? 'Categories';

  return (
    <div data-four-level-map="">
      {/* ── the counts line + Needs a look ─────────────────────────────────── */}
      <p className="mb-2 text-xs text-ink/70 [overflow-wrap:anywhere]" data-counts="">
        {counts}
        {counts ? ' · ' : ''}
        {plural(data.parts.length, 'part')} · {plural(data.cards.filter((x) => x.active && x.shopPublic).length, 'live card')}{' '}
        <a
          href={hrefFor({ keepFilters: false }) + (show === 'needs' ? '' : `${hrefFor({ keepFilters: false }).includes('?') ? '&' : '?'}show=needs`)}
          className={`ml-1 inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 align-middle text-xs font-semibold ${
            show === 'needs' ? 'border-ink bg-ink text-cream' : 'border-ink/15 text-ink'
          }`}
          aria-pressed={show === 'needs'}
          data-needs=""
        >
          <Dot /> Needs a look · {needs}
          <span className="hidden font-normal opacity-70 sm:inline">
            ({gapCategories(data).length} without a service · {gapParts(data).length} parts without a service · {heldCards(data).length} held cards
            {unfiledCategories(data).length ? ` · ${unfiledCategories(data).length} filed under Other` : ''})
          </span>
        </a>
      </p>

      <KeyStrip />

      {flat ? (
        <FlatList data={data} q={q} show={show} onJump={jump} />
      ) : (
        <>
          {/* ── desktop ───────────────────────────────────────────────────────── */}
          <div className="hidden lg:block" ref={deskRef}>
            {sv && g && c ? (
              <nav aria-label="Where you are" className="mb-2 flex min-h-11 flex-wrap items-center gap-1 text-[13px]" data-crumb="">
                <button type="button" aria-label="Back to groups" onClick={() => stand({ ...desk, sel: `c:${c.id}` })} className="inline-flex min-h-10 items-center rounded-full border border-ink/15 px-3 text-ink/70 hover:bg-ink/5">
                  ‹
                </button>
                <button type="button" onClick={() => stand({ ...desk, sel: `c:${c.id}` })} className="inline-flex min-h-10 items-center gap-1 rounded-full border border-ink/15 px-3 text-ink/70 hover:bg-ink/5">
                  <LevelIcon level="group" /> All
                </button>
                <span className="text-ink/55">›</span>
                <button type="button" onClick={() => stand({ ...desk, sel: `c:${c.id}` })} className="inline-flex min-h-10 items-center gap-1 rounded-full border border-ink/15 px-3 text-ink/70 hover:bg-ink/5">
                  <GroupGlyph name={g.iconName} fallback={groupDefaultIcon[g.id] ?? null} className="h-4 w-4" /> {g.label}
                </button>
                <span className="text-ink/55">›</span>
                <span className="inline-flex items-center gap-1.5 px-1 font-semibold text-ink">
                  <LevelIcon level="category" accent /> {c.label}
                </span>
                <span className="text-ink/55">›</span>
                <span className="inline-flex items-center gap-1.5 px-1 font-semibold text-ink">
                  <LevelIcon level="service" accent /> {sv.label}
                </span>
              </nav>
            ) : null}
            <DesktopColumns
              columns={cols}
              slots={slots as Record<'groups' | 'categories' | 'services' | 'parts' | 'cards', ColumnSlot | null>}
              wire={<svg ref={deskSvg} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" />}
            />
          </div>

          {/* ── phone / tablet ────────────────────────────────────────────────── */}
          <div className="lg:hidden" ref={phoneRef}>
            <PhoneMap
              data={data}
              view={phoneView}
              sel={sel}
              mapOn={mapOn}
              setMapOn={setMapOn}
              groupDefaultIcon={groupDefaultIcon}
              handlers={handlers}
              rowState={rowState}
              justAdded={justAdded}
              svgRef={phoneSvg}
              q={q}
              show={show}
              onBack={(to) => {
                if (to === 'all') {
                  setPhoneView('groups');
                  stand({ g: '', c: '', sel: '' });
                } else {
                  setPhoneView('cats');
                  stand({ g: to, c: '', sel: `g:${to}` });
                }
              }}
              onOpen={openDrawer}
              onPicker={(cid, svc) => setPicker({ cid, svc })}
              addGroup={addGroup}
              addCategory={addCategory}
              addService={addService}
            />
          </div>
        </>
      )}

      {/* ── drawer · picker ─────────────────────────────────────────────────── */}
      <MapDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        level={picker ? 'Pick parts' : LEVEL_WORD[drawerLevel]}
        name={picker ? (categoryById(data, picker.cid)?.label ?? '') : nameOfItem(data, drawerItem)}
        more={picker || !drawerItem ? null : <DrawerMore data={data} item={drawerItem} />}
        back={{ label: backLabel, onBack: closeDrawer }}
        ownsHistory={Boolean(drawerItem)}
      >
        {picker ? (
          <PartPicker
            data={data}
            cid={picker.cid}
            svc={picker.svc}
            onSaid={say}
            onCreated={(key) => {
              setJustAdded(`p:${key}`);
              setPicker(null);
              stand({ ...desk, c: picker.cid, sel: `p:${key}` });
            }}
          />
        ) : drawerItem && drawerItem === start.open && drawer ? (
          drawer
        ) : drawerItem && drawerItem === start.open ? (
          <p className="py-10 text-center text-sm text-ink/70">That one no longer exists.</p>
        ) : (
          <p className="py-10 text-center text-sm text-ink/70" role="status">
            Opening…
          </p>
        )}
      </MapDrawer>

      <MapToast
        toast={toast}
        onUndo={() => {
          const u = toast?.undo;
          setToast(null);
          u?.();
        }}
      />
    </div>
  );
}

// ── the add row: tap · type · Enter (near matches inline) ──────────────────────

function AddRow({
  kind,
  placeholder,
  data,
  onAdd,
  asWord,
  card = false,
}: {
  kind: 'group' | 'category' | 'service';
  placeholder: string;
  data: MapData;
  onAdd: (label: string) => Promise<string | null>;
  /** A service row offers "add as a search word instead" on the closest service we already have. */
  asWord?: { q: string; show: string };
  /** The phone's dashed add CARD instead of a row. */
  card?: boolean;
}) {
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const pool = useMemo(() => addPool(data, kind), [data, kind]);
  const near = useMemo(() => (name.trim().length >= 2 ? nearMatches(name, pool) : []), [name, pool]);
  const top = near[0];

  function submit(e: FormEvent) {
    e.preventDefault();
    const label = name.trim();
    if (label.length < 2) return;
    start(async () => {
      const problem = await onAdd(label);
      setErr(problem);
      if (!problem) setName('');
    });
  }

  return (
    <div className={card ? 'col-span-2' : ''}>
      <form
        onSubmit={submit}
        data-add={kind}
        className={
          card
            ? 'flex min-h-11 items-center gap-2.5 rounded-2xl border border-dashed border-ink/15 px-3 py-2.5 focus-within:border-solid focus-within:bg-raised' // no-card-ok: the add row is a text input (a pressable control) — the approved last-row "＋ Add" shape
            : 'mb-0.5 mt-1 flex min-h-11 items-center gap-2.5 rounded-xl border border-dashed border-ink/15 px-2.5 text-[13.5px] text-ink/70 focus-within:border-solid focus-within:bg-raised focus-within:text-ink' // no-card-ok: the add row is a text input (a pressable control)
        }
      >
        <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border-[1.5px] border-mulberry text-base text-mulberry">
          ＋
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label={placeholder}
          placeholder={placeholder}
          maxLength={80}
          className="min-h-10 min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink/70"
        />
        {name.trim().length > 0 ? (
          <button type="submit" disabled={pending} className="inline-flex min-h-8 shrink-0 items-center rounded-full bg-ink px-3 text-xs font-semibold text-cream disabled:opacity-50">
            {pending ? 'Adding…' : 'Add'}
          </button>
        ) : null}
      </form>
      {near.length > 0 ? (
        <div className="mb-1.5 mt-0.5 rounded-xl bg-warn-50 px-2.5 py-2 text-[12.5px] text-ink" data-near-matches="">
          <b>Close to what we have:</b> {near.map((n) => `${n.label}${n.where ? ` (${n.where})` : ''}`).join(' · ')}
          {kind === 'service' ? ' — a second name for one trade splits its shops.' : ''}
          {kind === 'service' && top && asWord ? (
            <form action={addTradeAlias} className="mt-1.5">
              <input type="hidden" name="_list" value="categories" />
              <input type="hidden" name="_open" value={`s:${top.key}`} />
              <input type="hidden" name="_q" value="" />
              <input type="hidden" name="_show" value="" />
              <input type="hidden" name="canonical_service" value={top.key} />
              <input type="hidden" name="phrase" value={name.trim()} />
              <button type="submit" className="inline-flex min-h-11 items-center rounded-full border border-ink/20 px-3 text-xs font-semibold text-ink">
                Add “{name.trim()}” as a search word on {top.label} instead
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
      {err ? (
        <p role="alert" className="mb-1 px-1 text-xs text-danger-700">
          ⚠ {err}
        </p>
      ) : null}
    </div>
  );
}

// ── flat results (search · Show ▾) ─────────────────────────────────────────────

function FlatList({ data, q, show, onJump }: { data: MapData; q: string; show: string; onJump: (h: FlatHit) => void }) {
  const hits = flatHits(data, q, show);
  return (
    <div className="max-w-3xl" data-flat="">
      <p className="px-2.5 py-1.5 text-xs text-ink/70">
        {hits.length === 0
          ? q.trim()
            ? `Nothing matches “${q.trim()}”.`
            : 'Nothing here — all clear.'
          : `${plural(hits.length, 'item')}${q.trim() ? ` for “${q.trim()}”` : ''} — tap one to jump there`}
      </p>
      {hits.map((h) => (
        <button
          key={`${h.kind}:${h.id}`}
          type="button"
          onClick={() => onJump(h)}
          data-hit={h.kind}
          className="flex min-h-12 w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-ink hover:bg-ink/5"
        >
          <LevelIcon level={h.kind} accent />
          <span className="min-w-0 flex-1">
            <b className="block text-[13.5px] font-semibold [overflow-wrap:anywhere]">{h.label}</b>
            <small className="block text-xs text-ink/70 [overflow-wrap:anywhere]">
              {LEVEL_WORD[h.kind]} · {h.path}
              {h.note ? ` · ${h.note}` : ''}
            </small>
          </span>
          <span aria-hidden className="text-ink/55">
            ›
          </span>
        </button>
      ))}
    </div>
  );
}

// ── the visual key (collapsed by default — details belong behind a press) ─────

function KeyStrip() {
  return (
    <details className="group mb-2.5 border-y border-ink/10" data-key-strip="">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-[13px] font-semibold text-ink">
        Three things that are never confused
        <span aria-hidden className="text-xs text-ink/55 transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="grid gap-3 px-3 pb-3 sm:grid-cols-3">
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink/55">
            <LevelIcon level="service" accent /> Service — what a shop picks
          </p>
          <p className="text-xs text-ink/70">A slim row: shop icon · name · “N cards”. Suppliers choose this in their shop.</p>
        </div>
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink/55">
            <LevelIcon level="card" accent /> Service card — a shop’s listing
          </p>
          <p className="text-xs text-ink/70">Photo · title · from ₱ · the shop · Live / Held. It only ever appears inside a service.</p>
        </div>
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink/55">
            <LevelIcon level="part" accent /> Part — what couples see
          </p>
          <p className="text-xs text-ink/70">A photo tile with the picture icon, listed once under its home category.</p>
        </div>
      </div>
    </details>
  );
}

// ── phone: tiles one level at a time · Map ─────────────────────────────────────

function PartTile({ d, p, on, hl, foreignHome, onTap }: { d: MapData; p: MapPart; on: boolean; hl: boolean; foreignHome: boolean; onTap: () => void }) {
  const link = partLinkSummary(d, p);
  const home = categoryById(d, p.home);
  return (
    <button
      type="button"
      data-id={`p:${p.key}`}
      data-row="part-tile"
      onClick={onTap}
      className={`flex flex-col overflow-hidden rounded-2xl border border-ink/15 bg-raised text-left text-ink ${on || hl ? 'outline outline-2 outline-mulberry' : ''} ${hl ? 'bg-mulberry/10' : ''}`} // no-card-ok: a part tile is a <button> (it selects / opens the part)
    >
      <span aria-hidden className="grid h-24 grid-cols-[2fr_1fr_1fr] gap-0.5">
        <i className="block bg-ink/10" />
        <i className="block border border-dashed border-ink/15" />
        <i className="block border border-dashed border-ink/15" />
      </span>
      <span className="flex min-h-9 items-center gap-1.5 px-2 pt-1.5 text-[13px] font-semibold">
        <LevelIcon level="part" accent />
        <span className="min-w-0 [overflow-wrap:anywhere]">{p.label}</span>
        {p.hidden ? <Pill>Hidden</Pill> : null}
        {link.gap ? <Dot /> : null}
      </span>
      <span className="px-2 pb-2 text-[11.5px] text-ink/70">
        {foreignHome && home ? `home ${home.label} · ` : ''}
        {link.text}
      </span>
    </button>
  );
}

function PhoneTile({ id, label, sub, on, glyph, onTap }: { id: string; label: string; sub: string; on: boolean; glyph: ReactNode; onTap: () => void }) {
  return (
    <button
      type="button"
      data-id={id}
      onClick={onTap}
      className={`flex min-h-11 flex-col overflow-hidden rounded-2xl border border-ink/15 bg-raised text-left text-ink ${on ? 'outline outline-2 outline-mulberry' : ''}`}
    >
      <span aria-hidden className="grid h-24 place-items-center bg-ink/5 text-mulberry">
        {glyph}
      </span>
      <span className="flex min-h-11 flex-col items-start gap-0.5 px-2.5 pb-2.5 pt-2 text-[13.5px] font-semibold">
        <span className="min-w-0 leading-tight [overflow-wrap:anywhere]">{label}</span>
        <small className="text-[11.5px] font-normal text-ink/70">{sub}</small>
      </span>
    </button>
  );
}

function PhoneMap({
  data,
  view,
  sel,
  mapOn,
  setMapOn,
  groupDefaultIcon,
  handlers,
  rowState,
  justAdded,
  svgRef,
  q,
  show,
  onBack,
  onOpen,
  onPicker,
  addGroup,
  addCategory,
  addService,
}: {
  data: MapData;
  view: 'groups' | 'cats' | 'cat';
  sel: MapSel;
  mapOn: boolean;
  setMapOn: (v: boolean) => void;
  groupDefaultIcon: Record<string, string>;
  handlers: RowHandlers;
  rowState: (id: string) => { hl: boolean; dim: boolean };
  justAdded: string;
  svgRef: RefObject<SVGSVGElement | null>;
  q: string;
  show: string;
  onBack: (to: string) => void;
  onOpen: (id: string) => void;
  onPicker: (cid: string, svc: string) => void;
  addGroup: (label: string) => Promise<string | null>;
  addCategory: (groupId: string, label: string) => Promise<string | null>;
  addService: (categoryId: string, label: string) => Promise<string | null>;
}) {
  const g = groupById(data, sel.g);
  const c = categoryById(data, sel.c);
  const crumbs = (
    <nav aria-label="Where you are" className="mb-1 flex min-h-11 flex-wrap items-center gap-1 text-[13px]" data-crumb="">
      {view !== 'groups' ? (
        <button type="button" aria-label="Back" onClick={() => onBack(view === 'cat' && c ? c.groupId : 'all')} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-lg text-ink/70">
          ←
        </button>
      ) : null}
      <button type="button" onClick={() => onBack('all')} className={`inline-flex min-h-11 items-center gap-1 rounded-full px-2 ${view === 'groups' ? 'font-semibold text-ink' : 'text-ink/70'}`}>
        <LevelIcon level="group" accent={view !== 'groups'} /> All
      </button>
      {view === 'cats' && g ? (
        <>
          <span className="text-ink/55">›</span>
          <span className="inline-flex items-center gap-1.5 px-1 font-semibold text-ink">
            <GroupGlyph name={g.iconName} fallback={groupDefaultIcon[g.id] ?? null} className="h-4 w-4 text-mulberry" /> {g.label}
          </span>
        </>
      ) : null}
      {view === 'cat' && c ? (
        <>
          <span className="text-ink/55">›</span>
          <button type="button" onClick={() => onBack(c.groupId)} className="inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-ink/70">
            {groupById(data, c.groupId)?.label}
          </button>
          <span className="text-ink/55">›</span>
          <span className="inline-flex items-center gap-1.5 px-1 font-semibold text-ink">
            <LevelIcon level="category" accent /> {c.label}
          </span>
        </>
      ) : null}
    </nav>
  );

  if (view === 'groups' || (!g && view === 'cats')) {
    return (
      <div data-phone="groups">
        {crumbs}
        <div className="grid grid-cols-2 gap-2.5">
          {data.groups.map((x) => (
            <PhoneTile
              key={x.id}
              id={`g:${x.id}`}
              label={x.label}
              sub={plural(categoriesOf(data, x.id).length, 'category', 'categories')}
              on={false}
              glyph={<GroupGlyph name={x.iconName} fallback={groupDefaultIcon[x.id] ?? null} className="h-8 w-8" />}
              onTap={() => handlers.onTap(`g:${x.id}`)}
            />
          ))}
          <AddRow kind="group" placeholder="Add a group" data={data} onAdd={addGroup} card />
        </div>
      </div>
    );
  }

  if (view === 'cats' && g) {
    return (
      <div data-phone="categories">
        {crumbs}
        <div className="mb-1 flex min-h-11 items-center justify-between gap-2">
          <h2 className="flex min-w-0 items-center gap-2 text-[17px] font-semibold text-ink [overflow-wrap:anywhere]">
            <GroupGlyph name={g.iconName} fallback={groupDefaultIcon[g.id] ?? null} className="h-5 w-5 text-mulberry" /> {g.label}
          </h2>
          <button type="button" onClick={() => onOpen(`g:${g.id}`)} className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-ink/15 px-3 text-[13px] font-semibold text-ink">
            Details ›
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {categoriesOf(data, g.id).map((x) => (
            <PhoneTile
              key={x.id}
              id={`c:${x.id}`}
              label={x.label}
              sub={servicesOf(data, x.id).length ? plural(servicesOf(data, x.id).length, 'service') : 'no service'}
              on={false}
              glyph={<GroupGlyph name={x.iconName ?? g.iconName} fallback={groupDefaultIcon[g.id] ?? null} className="h-8 w-8" />}
              onTap={() => handlers.onTap(`c:${x.id}`)}
            />
          ))}
          <AddRow kind="category" placeholder="Add a category" data={data} onAdd={(l) => addCategory(g.id, l)} card />
        </div>
      </div>
    );
  }

  if (!c) return <div data-phone="none">{crumbs}</div>;
  const svcs = servicesOf(data, c.id);
  const shown = partsShown(data, sel);
  const parts = partsForCategory(data, c.id);
  const svPicked = pickedService(data, sel);
  return (
    <div data-phone="category">
      {crumbs}
      <div className="mb-1 flex min-h-11 items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-2 text-[17px] font-semibold text-ink [overflow-wrap:anywhere]">
          <LevelIcon level="category" accent className="h-5 w-5" /> {c.label}
        </h2>
        <span className="flex shrink-0 gap-1.5">
          <button
            type="button"
            aria-pressed={mapOn}
            onClick={() => setMapOn(!mapOn)}
            className={`inline-flex min-h-11 items-center rounded-full border px-3 text-[13px] font-semibold ${mapOn ? 'border-ink bg-ink text-cream' : 'border-ink/15 text-ink'}`}
          >
            Map
          </button>
          <button type="button" onClick={() => onOpen(`c:${c.id}`)} className="inline-flex min-h-11 items-center rounded-full border border-ink/15 px-3 text-[13px] font-semibold text-ink">
            Details ›
          </button>
        </span>
      </div>
      {mapOn ? (
        <>
          <div className="relative grid grid-cols-[1fr_44px_1fr] items-start gap-x-1" data-phone-map="">
            <div data-map-col="services" className="min-w-0">
              <p className="flex items-center gap-1.5 px-1 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/55">
                <LevelIcon level="service" /> Services
              </p>
              {svcs.map((s) => {
                const st = rowState(`s:${s.key}`);
                return (
                  <button
                    key={s.key}
                    type="button"
                    data-id={`s:${s.key}`}
                    onClick={() => handlers.onTap(`s:${s.key}`)}
                    className={`flex min-h-11 w-full items-center gap-1.5 rounded-xl px-1.5 text-left text-[12.5px] [overflow-wrap:anywhere] ${sel.sel === `s:${s.key}` ? 'bg-ink text-cream' : st.hl ? 'bg-mulberry/10 ring-1 ring-inset ring-mulberry' : 'text-ink'} ${st.dim ? 'opacity-45' : ''}`}
                  >
                    <LevelIcon level="service" accent={sel.sel !== `s:${s.key}`} />
                    <span className="min-w-0 flex-1">{s.label}</span>
                  </button>
                );
              })}
              {svcs.length ? null : <p className="px-1.5 text-xs text-ink/70">none</p>}
            </div>
            <div data-map-wire="" className="relative self-stretch">
              <svg ref={svgRef} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" />
            </div>
            <div data-map-col="parts" className="min-w-0">
              <p className="flex items-center gap-1.5 px-1 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/55">
                <LevelIcon level="part" /> Parts
              </p>
              {parts.map((p) => {
                const st = rowState(`p:${p.key}`);
                return (
                  <button
                    key={p.key}
                    type="button"
                    data-id={`p:${p.key}`}
                    data-row="part"
                    onClick={() => handlers.onTap(`p:${p.key}`)}
                    className={`flex min-h-11 w-full items-center gap-1.5 rounded-xl px-1.5 text-left text-[12.5px] [overflow-wrap:anywhere] ${sel.sel === `p:${p.key}` ? 'bg-ink text-cream' : st.hl ? 'bg-mulberry/10 ring-1 ring-inset ring-mulberry' : 'text-ink'} ${st.dim ? 'opacity-45' : ''}`}
                  >
                    <i aria-hidden className="block h-6 w-6 shrink-0 rounded-md bg-ink/10" />
                    <span className="min-w-0 flex-1">{p.label}</span>
                  </button>
                );
              })}
              {parts.length ? null : <p className="px-1.5 text-xs text-ink/70">none</p>}
            </div>
          </div>
          <p className="px-1 py-2 text-xs text-ink/70">Tap a service to light its parts; tap a part to light its services. Tap again to open.</p>
        </>
      ) : (
        <>
          <section className="mt-3.5" data-block="services">
            <div className="mb-1.5 flex min-h-10 items-center justify-between gap-2 border-b border-ink/10">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <LevelIcon level="service" /> Services <small className="font-normal text-ink/70">— what suppliers pick</small>
              </h3>
              <small className="text-xs text-ink/70">{plural(svcs.length, 'service')}</small>
            </div>
            {svcs.map((s) => (
              <ServiceRow key={s.key} d={data} s={s} on={sel.sel === `s:${s.key}`} isNew={justAdded === `s:${s.key}`} h={{ ...handlers, drag: null }} />
            ))}
            {svcs.length ? null : <p className="px-2.5 py-3 text-xs text-terracotta-700">No service yet — no shop can file here until one exists.</p>}
            <AddRow kind="service" placeholder="Add a service" data={data} onAdd={(l) => addService(c.id, l)} asWord={{ q, show }} />
          </section>
          <section className="mt-3.5" data-block="parts">
            <div className="mb-1.5 flex min-h-10 items-center justify-between gap-2 border-b border-ink/10">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <LevelIcon level="part" /> {shown.service ? `Parts for ${shown.service.label}` : 'Parts'} <small className="font-normal text-ink/70">— what couples see</small>
              </h3>
              <small className="text-xs text-ink/70">{plural(shown.list.length, 'part')}</small>
            </div>
            {!data.partsRead ? (
              <p role="alert" className="px-2.5 py-3 text-sm text-ink">Couldn’t load the parts — refresh to try again.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {shown.list.map((p) => (
                  <PartTile
                    key={p.key}
                    d={data}
                    p={p}
                    on={sel.sel === `p:${p.key}`}
                    hl={rowState(`p:${p.key}`).hl}
                    foreignHome={p.home !== c.id}
                    onTap={() => handlers.onTap(`p:${p.key}`)}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => onPicker(c.id, shown.service?.key ?? '')}
                  data-add="part"
                  className="flex flex-col overflow-hidden rounded-2xl border border-dashed border-ink/15 text-left text-ink/70"
                >
                  <span aria-hidden className="grid h-24 place-items-center border-b border-dashed border-ink/15">
                    <span className="grid h-8 w-8 place-items-center rounded-lg border-[1.5px] border-mulberry text-lg text-mulberry">＋</span>
                  </span>
                  <span className="flex min-h-11 flex-col items-start gap-0.5 px-2.5 pb-2.5 pt-2 text-[13.5px] font-semibold">
                    <span className="[overflow-wrap:anywhere]">{shown.service ? `Add a part to ${shown.service.label}` : 'Add a part'}</span>
                    <small className="text-[11.5px] font-normal">pick from the library</small>
                  </span>
                </button>
              </div>
            )}
          </section>
          {svPicked ? (
            <section className="mt-3.5" data-block="cards">
              <div className="mb-1.5 flex min-h-10 items-center justify-between gap-2 border-b border-ink/10">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <LevelIcon level="card" /> Cards for {svPicked.label}
                </h3>
                <small className="text-xs text-ink/70">{data.cardsRead ? plural(cardsOf(data, [svPicked.key]).length, 'card') : '—'}</small>
              </div>
              {!data.cardsRead ? (
                <p role="alert" className="px-2.5 py-3 text-sm text-ink">Couldn’t load the service cards — refresh to try again.</p>
              ) : cardsOf(data, [svPicked.key]).length === 0 ? (
                <p className="px-2.5 py-3 text-xs text-ink/70">No service card yet.</p>
              ) : (
                <>
                  {cardsOf(data, [svPicked.key])
                    .slice(0, 3)
                    .map((cd) => (
                      <CardRow key={cd.id} cd={cd} on={false} onOpen={onOpen} />
                    ))}
                  {cardsOf(data, [svPicked.key]).length > 3 ? (
                    <button
                      type="button"
                      onClick={() => onOpen(`s:${svPicked.key}`)}
                      className="mt-1 flex min-h-11 w-full items-center justify-center rounded-xl border border-dashed border-ink/15 text-[13px] font-semibold text-ink"
                    >
                      See all {cardsOf(data, [svPicked.key]).length}
                    </button>
                  ) : null}
                </>
              )}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

// ── the drawer frame (server panel, or the picker) ─────────────────────────────

/**
 * 🔝 THE DRAWER IS THE SHARED SHEET (owner, live phone 2026-10-29: *"when i tapped the massage chair. it opened the pop up
 * for massage chair category. and i cannot go back"*). It was its own `fixed inset-0 z-50` box drawn INSIDE the page —
 * and the page (`<main class="sn-vt-page">`) is a stacking context, so on a phone the admin shell's top bar painted over
 * its ✕ row and the bottom bar over its foot: no way out. Now it is `Sheet` (drawn on <body>, over every bar), with a
 * ‹ in its pinned header that goes back to the map standing on the level it was opened from (`closeDrawer`, which
 * already writes `?in=…&at=…`). The phone's Back: a drawer opened by a tap owns its own history entry (`?open=`), so Back
 * pops that and the map follows the address; the parts picker has no address, so the sheet takes one for it.
 * 📌 THE APPROVED FRAME (owner 2026-10-29, "Approve panels" — prototype `carry-2026-10-29/admin-categories-proto`): the
 * sheet's PINNED ROW — ‹ · the level word over the item's name (wraps) · ⋯ rare actions — and, on a phone, the whole
 * screen. Its toast (`DrawerSayProvider`) is drawn on <body> too, so "Saved — … · Undo" is never under the sheet.
 * Room under the last fold (32vh) so an open fold can always sit at the top.
 */
function MapDrawer({
  open,
  onClose,
  level,
  name,
  more,
  back,
  ownsHistory,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** The level word over the name — "Category", "Service card", "Pick parts". */
  level: string;
  /** The item's name — wraps, never cut. */
  name: string;
  /** The ⋯ of rare actions (Copy key · Delete … · Open the shop). */
  more: ReactNode;
  back: { label: string; onBack: () => void };
  /** The drawer has an address of its own (`?open=`) — Back already steps out of it. */
  ownsHistory: boolean;
  children: ReactNode;
}) {
  return (
    <DrawerSayProvider>
      <Sheet
        open={open}
        onClose={onClose}
        labelledById="map-drawer-label"
        wide
        full
        backCloses={!ownsHistory}
        back={back}
        pinned={{ level, name, more }}
      >
        <div data-map-drawer="" className="px-4 pb-6 [&::after]:block [&::after]:h-[32vh] [&::after]:content-['']">
          {children}
        </div>
      </Sheet>
    </DrawerSayProvider>
  );
}

/** The drawer item's name, for the pinned row. */
function nameOfItem(data: MapData, item: string): string {
  const id = item.slice(2);
  if (item.startsWith('g:')) return groupById(data, id)?.label ?? '';
  if (item.startsWith('c:')) return categoryById(data, id)?.label ?? '';
  if (item.startsWith('s:')) return serviceByKey(data, id)?.label ?? '';
  if (item.startsWith('p:')) return partByKey(data, id)?.label ?? '';
  if (item.startsWith('k:')) return cardById(data, id)?.title ?? '';
  return '';
}

/**
 * ⋯ — the drawer's RARE actions (prototype's ⋯): Copy key · Delete category… / Combine into another service… (opens
 * the red fold at the foot and brings it into view — the act itself stays there, behind its confirm) · Open the shop.
 * One PickMenu, like every set of choices.
 */
function DrawerMore({ data, item }: { data: MapData; item: string }) {
  const router = useRouter();
  const say = useSay();
  const id = item.slice(2);
  const card = item.startsWith('k:') ? cardById(data, id) : null;
  const options = [
    ...(card ? [] : [{ key: 'copy', label: `Copy key ${id}` }]),
    ...(item.startsWith('c:') ? [{ key: 'danger', label: 'Delete category…' }] : []),
    ...(item.startsWith('s:') ? [{ key: 'danger', label: 'Combine into another service…' }] : []),
    ...(card ? [{ key: 'shop', label: 'Open the shop' }] : []),
  ];
  return (
    <PickMenu
      label="More actions"
      value=""
      options={options}
      trigger={<MoreHorizontal aria-hidden className="h-[22px] w-[22px]" strokeWidth={1.75} />}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-ink/5"
      onPick={(key) => {
        if (key === 'copy') {
          void navigator.clipboard?.writeText(id).then(
            () => say?.({ text: 'Key copied', tone: 'ok' }),
            () => say?.({ text: 'Couldn’t copy — the key is in the ⓘ under the name', tone: 'bad' }),
          );
        } else if (key === 'danger') {
          // The red fold carries `anchor="drawer-danger"`: the address opens it and brings it into view.
          try {
            window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#drawer-danger`);
            window.dispatchEvent(new HashChangeEvent('hashchange'));
            window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
          } catch {
            /* the fold is still at the foot of the panel */
          }
        } else if (key === 'shop' && card) {
          router.push(`/admin/vendors/${card.shopId}`);
        }
      }}
    />
  );
}

// ── "＋ Add a part" — pick from the WHOLE library; tick = link, never a copy ───

function PartPicker({
  data,
  cid,
  svc,
  onSaid,
  onCreated,
}: {
  data: MapData;
  cid: string;
  svc: string;
  onSaid: (msg: string) => void;
  onCreated: (key: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const [pending, start] = useTransition();
  const c = categoryById(data, cid);
  const service = svc ? serviceByKey(data, svc) : null;
  // A tick links THIS service — or, with no service picked, every service of the category (PLAN § 7.1 v4).
  const targets = service ? [service.key] : servicesOf(data, cid).map((s) => s.key);
  useEffect(() => setOptimistic({}), [data]);
  const linkedNow = (p: MapPart) =>
    optimistic[p.key] ?? (targets.length > 0 && targets.every((k) => p.services.includes(k)));
  const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const needle = fold(query.trim());

  const blocks: Array<{ catId: string; label: string; parts: MapPart[] }> = [];
  for (const g of data.groups) {
    for (const cc of categoriesOf(data, g.id)) {
      const ps = partsHomedIn(data, cc.id).filter((p) => !needle || fold(p.label).includes(needle) || fold(cc.label).includes(needle));
      if (ps.length) blocks.push({ catId: cc.id, label: cc.label, parts: ps });
    }
  }
  const count = data.parts.filter(linkedNow).length;

  function toggle(p: MapPart) {
    if (targets.length === 0) return onSaid('This category has no service yet — add one first.');
    const on = !linkedNow(p);
    setOptimistic((o) => ({ ...o, [p.key]: on }));
    start(async () => {
      const res = (await mapWrite({ op: 'link', slotKey: p.key, services: targets, on })) as WriteResult;
      if (!res.ok) {
        setOptimistic((o) => ({ ...o, [p.key]: !on }));
        onSaid(res.error);
        return;
      }
      onSaid(on ? `Linked ${p.label}${service ? ` to ${service.label}` : ''}` : `Unlinked ${p.label}`);
    });
  }

  function create(e: FormEvent) {
    e.preventDefault();
    const label = name.trim();
    if (label.length < 2) return;
    start(async () => {
      const res = (await mapWrite({ op: 'addPart', categoryId: cid, label, services: targets })) as WriteResult;
      if (!res.ok) return onSaid(res.error);
      setName('');
      onSaid(res.message);
      onCreated(res.id!);
    });
  }

  return (
    <div data-part-picker="">
      <header className="pb-3">
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink/70">
          <LevelIcon level="category" /> {c?.label}
          {service ? (
            <>
              {' '}› <LevelIcon level="service" /> {service.label}
            </>
          ) : null}
        </p>
        <h2 id="part-picker-title" className="text-xl font-semibold text-ink [overflow-wrap:anywhere]">
          {service ? `Parts for ${service.label}` : `Parts for ${c?.label ?? ''}’s services`}
        </h2>
        <p className="text-xs text-ink/70">
          <InfoTip label={`${formatCount(count)} linked · tick to link, untick to unlink`} align="start">
            {service
              ? `A tick links ${service.label} to that part (one row in inspiration_part_services). The part keeps its home; it now also shows when a couple or a shop looks at ${service.label}. A part is never copied.`
              : `No service is picked, so a tick links ALL of ${c?.label ?? 'this category'}’s services to the part; untick removes them all. Pick one service in the Services column to link just that one.`}
          </InfoTip>
        </p>
      </header>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Find a part"
        aria-label="Find a part"
        className="mb-2 min-h-11 w-full rounded-full border border-ink/15 bg-raised px-4 text-sm text-ink placeholder:text-ink/70"
      />
      <div className={pending ? 'opacity-70' : undefined}>
        {blocks.length === 0 ? <p className="px-2 py-3 text-sm text-ink/70">No part matches.</p> : null}
        {blocks.map((b) => (
          <div key={b.catId}>
            <p className="sticky top-0 z-[1] bg-cream px-3 pb-1 pt-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/55">
              {b.label}
              {b.catId === cid ? ' · home' : ''}
            </p>
            {b.parts.map((p) => {
              const on = linkedNow(p);
              return (
                <button
                  key={p.key}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(p)}
                  className="flex min-h-11 w-full items-center justify-between gap-2.5 rounded-xl px-3 py-1.5 text-left text-sm text-ink hover:bg-ink/5"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span aria-hidden className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md border text-[11px] text-white ${on ? 'border-mulberry bg-mulberry' : 'border-ink/15'}`}>
                      {on ? '✓' : ''}
                    </span>
                    <i aria-hidden className="block h-[26px] w-[26px] shrink-0 rounded-md bg-ink/10" />
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      {p.label} {p.hidden ? <Pill>Hidden</Pill> : null}
                    </span>
                  </span>
                  <small className="shrink-0 text-xs text-ink/55">{plural(p.services.length, 'service')}</small>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <form onSubmit={create} className="mt-3 flex min-h-11 items-center gap-2.5 rounded-xl border border-dashed border-ink/15 px-2.5 focus-within:border-solid focus-within:bg-raised" data-create-part=""> {/* no-card-ok: a text input */}
        <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border-[1.5px] border-mulberry text-base text-mulberry">
          ＋
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Create a new part"
          placeholder={`Create a new part${service ? ` for ${service.label}` : ''}`}
          maxLength={60}
          className="min-h-10 min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink/70"
        />
        {name.trim() ? (
          <button type="submit" disabled={pending} className="inline-flex min-h-8 shrink-0 items-center rounded-full bg-ink px-3 text-xs font-semibold text-cream disabled:opacity-50">
            Create
          </button>
        ) : null}
      </form>
      <p className="mt-1.5 text-xs text-ink/70">
        A new part is born with home <b className="text-ink">{c?.label}</b> and linked to{' '}
        {service ? <b className="text-ink">{service.label}</b> : `all of ${c?.label ?? 'its'}’s services`}.
      </p>
    </div>
  );
}
