import Link from 'next/link';
import type { ReactNode } from 'react';
import { Check, ChevronRight, Lock, Plus, ShoppingBag } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { formatPhpRounded } from '@/lib/php';
import { routes } from '@/lib/routes';
import { ToolChip, ToolLead, ToolRow } from '@/app/vendor-dashboard/_components/tool-page';
import { toolIcon } from '@/app/vendor-dashboard/shop/_components/specialized-tool-icon';
import { BadgeArt } from '@/app/vendor-dashboard/shop/_components/shop-badge-row';
import {
  STORE_GRAPHS,
  goalWords,
  graphWindowWords,
  toolFootWords,
  toolIsYours,
  type GraphStatus,
  type StoreToolRow,
} from '@/lib/supplier-store';
import type { ShelfTile } from '@/lib/shop-badge-shelf';
import type { CardKey } from '@/app/vendor-dashboard/performance/_components/analytics-cards';
import { StoreOp } from './store-client';

/**
 * 🛍 THE STORE'S ROWS AND TILES (drawing `supplier_store_graphs_badges_2026-11-23` v10, F1 · F2 · F4 · F9) — server-drawn;
 * each press is a `StoreOp` (client) or a door. Tokens only.
 */

const shop = routes.vendorDashboard.shop;

/** Where "Open" takes a tool: the Shop, its panel opened (`?tool=`). */
export function toolOpenHref(key: string): string {
  return `${shop.index()}?tool=${encodeURIComponent(key)}#tools`;
}

export const php = (n: number) => formatPhpRounded(n);

/** The small round "Get" / "Open" / price pill at a tile's foot — words only (the whole tile is the door). */
function Pill({ children, tone = 'link' }: { children: ReactNode; tone?: 'link' | 'quiet' | 'done' }) {
  const look =
    tone === 'link'
      ? 'bg-[color-mix(in_srgb,rgb(var(--color-link))_12%,transparent)] text-[rgb(var(--color-link))]'
      : tone === 'done'
        ? 'bg-[color-mix(in_srgb,rgb(var(--color-ok))_14%,transparent)] text-[rgb(var(--color-ok))]'
        : 'bg-[color:var(--surface-soft)] text-[color:var(--m-slate-2)]';
  return <span className={`inline-flex h-7 flex-none items-center gap-1 rounded-full px-3 text-sn-md font-semibold ${look}`}>{children}</span>;
}

/** One Store tile (F1): art · name · line · foot words + pill. The whole tile opens the item. */
export function StoreTile({
  href,
  art,
  title,
  line,
  foot,
  pill,
  data,
  show,
}: {
  href: string;
  art: ReactNode;
  title: string;
  line: string;
  foot: ReactNode;
  pill?: ReactNode;
  data: string;
  show?: string;
}) {
  return (
    <li className="w-[164px] flex-none snap-start" data-store-row="" data-store-name={title} data-store-show={show ?? ''}>
      <Link href={href} className="sn-press sn-frame flex h-full min-h-[176px] flex-col gap-1 p-3" data-store-tile={data}>
        <span className="mb-1">{art}</span>
        <b className="text-sn-lg font-semibold leading-tight text-ink">{title}</b>
        <span className="line-clamp-2 text-sn-md leading-snug text-[color:var(--m-slate-2)]">{line}</span>
        <span className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="min-w-0 text-sn-sm font-semibold leading-tight text-[color:var(--m-slate-2)]">{foot}</span>
          {pill}
        </span>
      </Link>
    </li>
  );
}

export function ToolArt({ toolKey }: { toolKey: StoreToolRow['tool']['key'] }) {
  const Icon = toolIcon(toolKey);
  return (
    <span aria-hidden className="grid h-10 w-10 place-items-center rounded-lg bg-[color-mix(in_srgb,rgb(var(--sn-accent))_12%,transparent)] text-ink">
      <Icon className="h-5 w-5" strokeWidth={1.75} />
    </span>
  );
}

/** A graph's small picture — a plain bar sketch in the link blue (the Store shows WHAT a graph is, never numbers). */
export function GraphArt({ size = 40, wide = false }: { size?: number; wide?: boolean }) {
  const w = wide ? size * 3 : size;
  const bars = wide ? [0.35, 0.55, 0.45, 0.7, 0.6, 0.85, 0.5, 0.75, 0.95, 0.65, 0.8, 0.9] : [0.4, 0.65, 0.5, 0.9];
  const gap = w / (bars.length * 3);
  const bw = (w - gap * (bars.length + 1)) / bars.length;
  return (
    <svg aria-hidden width={w} height={size} viewBox={`0 0 ${w} ${size}`} className="block text-[rgb(var(--color-link))]">
      <rect width={w} height={size} rx={8} className="fill-[color:var(--surface-soft)]" />
      {bars.map((h, i) => (
        <rect key={i} x={gap + i * (bw + gap)} y={size - 6 - (size - 12) * h} width={bw} height={(size - 12) * h} rx={2} fill="currentColor" opacity={0.85} />
      ))}
    </svg>
  );
}

/** The tool's tile on the Store front (F1). */
export function StoreToolTile({ row }: { row: StoreToolRow }) {
  const s = row.status;
  const pill =
    toolIsYours(s) ? (
      <Pill>Open</Pill>
    ) : s.kind === 'free' ? (
      <Pill>Get</Pill>
    ) : s.kind === 'buy' ? (
      <Pill>{php(s.price)}</Pill>
    ) : null;
  const foot = toolIsYours(s) ? (s.kind === 'trial' ? toolFootWords(s, php) : s.kind === 'free' ? 'Free' : s.kind === 'owned' ? 'Owned' : 'With your plan') : s.kind === 'buy' ? 'One-time' : toolFootWords(s, php);
  return (
    <StoreTile
      href={shop.store.item('tools', row.tool.key)}
      art={<ToolArt toolKey={row.tool.key} />}
      title={row.tool.title}
      line={row.tool.line}
      foot={foot}
      pill={pill}
      data={`tool:${row.tool.key}`}
      show={toolShowTags(row)}
    />
  );
}

/** Show & sort tags for a tool row: yours · free · paid. */
export function toolShowTags(row: StoreToolRow): string {
  const tags = [toolIsYours(row.status) ? 'yours' : 'more'];
  tags.push(row.status.kind === 'free' ? 'free' : 'paid');
  return tags.join(' ');
}

/** The graph's tile on the Store front (F1). */
export function StoreGraphTile({ k, status }: { k: CardKey; status: GraphStatus }) {
  const g = STORE_GRAPHS[k];
  return (
    <StoreTile
      href={shop.store.item('graphs', k)}
      art={<GraphArt />}
      title={g.title}
      line={g.counts}
      foot={status.kind === 'locked' ? `Opens with ${status.badgeName} · Bronze` : status.kind === 'on' ? 'On your Analytics' : 'Free'}
      pill={status.kind === 'locked' ? <Lock aria-label="Locked" className="h-4 w-4 flex-none text-[color:var(--m-slate-2)]" strokeWidth={2} /> : status.kind === 'on' ? <Pill>Open</Pill> : <Pill>Get</Pill>}
      data={`graph:${k}`}
      show={status.kind === 'on' ? 'on' : status.kind === 'locked' ? 'locked' : 'off'}
    />
  );
}

/** The badge's tile on the Store front (F1): earned only, never sold — Track / ✓ Tracking. */
export function StoreBadgeTile({ tile, following }: { tile: ShelfTile; following: boolean }) {
  return (
    <StoreTile
      href={tile.key === 'verified' ? shop.badges() : `${shop.badges()}#${tile.key}`}
      art={<BadgeArt tile={tile} size={44} />}
      title={tile.title}
      line={tile.key === 'verified' ? 'Your papers, approved by Setnayan.' : (goalWords(tile) ?? tile.sub)}
      foot="Earned only"
      pill={
        tile.key === 'verified' ? (
          tile.state === 'earned' ? (
            <Pill tone="done">
              <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.4} />
              Earned
            </Pill>
          ) : null
        ) : following ? (
          <Pill tone="done">
            <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.4} />
            Tracking
          </Pill>
        ) : (
          <Pill>Track</Pill>
        )
      }
      data={`badge:${tile.key}`}
    />
  );
}

/** A shelf on the Store front: its name, "See all N", and its tiles in one sideways row. */
export function StoreShelfRow({ title, count, href, children, data }: { title: string; count: number; href: string; children: ReactNode; data: string }) {
  return (
    <section className="mt-[18px]" data-store-block="" data-store-shelf={data}>
      <h2 className="hc-k2 mb-2 min-h-9 justify-between">
        <span>{title}</span>
        <Link href={href} className="sn-press inline-flex min-h-11 items-center gap-0.5 text-sn-base font-semibold normal-case text-[rgb(var(--color-link))]" data-store-see-all={data}>
          See all {count}
          <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
        </Link>
      </h2>
      <ul className="sn-glide-x -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]" data-store-list="">
        {children}
      </ul>
    </section>
  );
}

/** A tool row on the Tools shelf (F2): icon · name · line + foot · its one press. */
export function ToolShelfRow({ row, picksRead }: { row: StoreToolRow; picksRead: boolean }) {
  const s = row.status;
  const k = row.tool.key;
  const item = shop.store.item('tools', k);
  let right: ReactNode;
  if (toolIsYours(s)) {
    right = <ActionButton tone="info" icon={<ChevronRight aria-hidden strokeWidth={2} />} label="Open" href={toolOpenHref(k)} />;
  } else if (s.kind === 'free') {
    right = picksRead ? (
      <StoreOp op="tool_add" fields={{ tool: k }} tone="info" icon={<Plus aria-hidden strokeWidth={2} />} label="Get" landTo={`${shop.index()}?added=${encodeURIComponent(`tool:${k}`)}#tools`} />
    ) : (
      <ToolChip tone="wait">Couldn’t load</ToolChip>
    );
  } else if (s.kind === 'buy') {
    right = <ActionButton tone="brand" icon={<ShoppingBag aria-hidden strokeWidth={1.8} />} label={php(s.price)} href={item} />;
  } else if (s.kind === 'pending') {
    right = <ToolChip tone="wait">In review</ToolChip>;
  } else if (s.kind === 'no_price') {
    right = <ToolChip tone="quiet">Price not set yet</ToolChip>;
  } else {
    right = <ToolChip tone="wait">Couldn’t load</ToolChip>;
  }
  const foot = s.kind === 'trial' ? <span className="font-semibold text-[rgb(var(--color-ok))]">{toolFootWords(s, php)}</span> : s.kind === 'buy' ? null : toolFootWords(s, php);
  return (
      <ToolRow
        attrs={{ 'data-store-row': '', 'data-store-name': row.tool.title, 'data-store-show': toolShowTags(row), 'data-store-tool': k }}
        lead={<ToolArt toolKey={k} />}
        title={
          <Link href={item} className="hover:underline">
            {row.tool.title}
          </Link>
        }
        lines={[s.kind === 'buy' ? `${row.tool.line} · one-time` : row.tool.line, foot]}
        right={right}
      />
  );
}

/** A graph row on the Graphs shelf (F4): its picture · name · question · Get, or the badge that opens it. */
export function GraphShelfRow({ k, status, picksRead }: { k: CardKey; status: GraphStatus; picksRead: boolean }) {
  const g = STORE_GRAPHS[k];
  const right =
    status.kind === 'locked' ? (
      <Lock aria-label="Locked" className="h-4 w-4 text-[color:var(--m-slate-2)]" strokeWidth={2} />
    ) : !picksRead ? (
      <ToolChip tone="wait">Couldn’t load</ToolChip>
    ) : (
      <StoreOp op="graph_add" fields={{ graph: k }} tone="info" icon={<Plus aria-hidden strokeWidth={2} />} label="Get" />
    );
  return (
      <ToolRow
        attrs={{ 'data-store-row': '', 'data-store-name': g.title, 'data-store-show': status.kind === 'locked' ? 'locked' : 'off', 'data-store-graph': k }}
        lead={<GraphArt />}
        title={
          <Link href={shop.store.item('graphs', k)} className="hover:underline">
            {g.title}
          </Link>
        }
        lines={[
          g.asks,
          status.kind === 'locked' ? (
            <span>
              Opens with <b className="font-semibold text-ink">{status.badgeName} · Bronze</b>
              {status.toGo ? ` · ${status.toGo}` : ''}
            </span>
          ) : (
            graphWindowWords(k)
          ),
        ]}
        right={right}
      />
  );
}

export { ToolLead };
