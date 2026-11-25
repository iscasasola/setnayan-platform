import Link from 'next/link';
import { formatCount } from '@/lib/format-number';
import type { ReactNode } from 'react';
import { BadgeCheck, Check, ChevronRight, Layers, Lock, Plus, QrCode, ShoppingBag, Sparkles } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { formatPhpRounded } from '@/lib/php';
import { routes } from '@/lib/routes';
import { ToolChip, ToolLead, ToolRow } from '@/app/vendor-dashboard/_components/tool-page';
import { toolIcon } from '@/app/vendor-dashboard/shop/_components/specialized-tool-icon';
import { BadgeArt } from '@/app/vendor-dashboard/shop/_components/shop-badge-row';
import {
  STORE_GRAPHS,
  goalWords,
  graphLockedLine,
  graphWindowWords,
  isNewGraph,
  groupChipKey,
  INSTALLED_WORD,
  INSTALL_WORD,
  buyWords,
  toolFootWords,
  toolIsYours,
  qrWords,
  type GraphStatus,
  type StoreToolRow,
  type ToolTag,
} from '@/lib/supplier-store';
import type { ShelfTile } from '@/lib/shop-badge-shelf';
import type { CardKey } from '@/app/vendor-dashboard/performance/_components/analytics-cards';
import type { PromoteQrMode } from '@/lib/supplier-qr-codes';
import { StoreOp } from './store-client';
import { GraphArt } from './graph-art';
import { PAID_WIDGET_NEEDS_PLAN_WORDS, PAID_WIDGET_PLAN_WORDS } from '@/lib/special-tools';

export { GraphArt };

/**
 * 🛍 THE STORE'S ROWS AND TILES (drawing `supplier_store_graphs_badges_2026-11-23` v12, F1 · F2 · F4 · F9) — server-drawn;
 * each press is a `StoreOp` (client) or a door. Tokens only.
 */

const shop = routes.vendorDashboard.shop;

/** Where "Open" takes a tool: the Shop, its panel opened (`?tool=`). */
export function toolOpenHref(key: string): string {
  return `${shop.index()}?tool=${encodeURIComponent(key)}#tools`;
}

export const php = (n: number) => formatPhpRounded(n);

/** The small round "Install" / "✓ Installed" / "Buy ₱…" pill at a tile's foot — words only (the whole tile is the door). */
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
  tags,
  meta,
}: {
  href: string;
  art: ReactNode;
  title: string;
  /** The price meta, under the title on its own full-width line (at most 2 lines), never squeezed beside the button. */
  meta?: ReactNode;
  line: string;
  /** The tool's tag chips under its line (v12). */
  tags?: ReactNode;
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
        {meta ? (
          <span className="line-clamp-2 text-sn-sm font-semibold leading-tight text-[color:var(--m-slate-2)]" data-store-tile-meta="">
            {meta}
          </span>
        ) : null}
        <span className="line-clamp-2 text-sn-md leading-snug text-[color:var(--m-slate-2)]">{line}</span>
        {tags}
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

/** "✓ Installed" / "✓ Earned" — a row's settled state, in the ok green (Toolkit v19: one word, "Installed"). */
export function OnPage({ children = INSTALLED_WORD }: { children?: ReactNode }) {
  return (
    <span className="inline-flex min-h-11 flex-none items-center gap-1 text-sn-base font-semibold text-[rgb(var(--color-ok))]" data-store-on-page="">
      <Check aria-hidden className="h-4 w-4" strokeWidth={2.4} />
      {children}
    </span>
  );
}

/** A tool's supplier-type tags (v12): the first `max`, then "+N". Words only — a tag never locks anything. */
export function TagChips({ tags, max = 2 }: { tags: readonly ToolTag[]; max?: number }) {
  if (tags.length === 0) return null;
  const shown = tags.slice(0, max);
  const rest = tags.length - shown.length;
  return (
    <span className="mt-1 flex flex-wrap gap-1" data-tool-tags={tags.map((t) => t.label).join('|')}>
      {shown.map((t) => (
        <span key={t.label} className="rounded-md bg-[color:var(--surface-soft)] px-2 py-0.5 text-sn-sm font-medium text-[color:var(--m-slate-2)]">
          {t.label}
        </span>
      ))}
      {rest > 0 ? <span className="rounded-md bg-[color:var(--surface-soft)] px-2 py-0.5 text-sn-sm font-medium text-[color:var(--m-slate-2)]">+{rest}</span> : null}
    </span>
  );
}

/**
 * 🎞 A paid widget's clip (owner 4c07edd7): silent, looping, phone size, at the top of its Toolkit page. A preview, not
 * a demo — nothing in it can be pressed. `src` null (not recorded yet) = this renders nothing at all.
 */
export function ToolVideo({ src, title }: { src: string | null; title: string }) {
  if (!src) return null;
  return (
    <div className="sn-frame mb-3 overflow-hidden" data-store-video="">
      <video src={src} autoPlay muted loop playsInline preload="metadata" aria-label={`${title}: how it is set up and where it shows`} className="block max-h-96 w-full object-contain" />
    </div>
  );
}

/** The tool's tile on the Store front (F1). */
export function StoreToolTile({ row }: { row: StoreToolRow }) {
  const s = row.status;
  const a = row.act;
  const pill =
    a.kind === 'installed' ? (
      <Pill tone="done">
        <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.4} />
        {INSTALLED_WORD}
      </Pill>
    ) : a.kind === 'install' ? (
      <Pill>{INSTALL_WORD}</Pill>
    ) : a.kind === 'buy' ? (
      <Pill>{buyWords(a.price, php)}</Pill>
    ) : null;
  /**
   * 📏 A paid widget's price meta sits UNDER THE TITLE, full width, at most 2 lines (re-walk 24 Nov 2026: "One-time ·
   * Plus, Pro or Ultra" was squeezed beside "Buy ₱…" into 4 short lines, at 390 and on a computer). The foot keeps the
   * button alone. 🔒 app/vendor-dashboard/shop/store/the-price-meta-sits-under-the-title.test.ts
   */
  const meta = s.kind === 'buy' ? (s.needsPlan ? `One-time · ${PAID_WIDGET_PLAN_WORDS}` : 'One-time') : null;
  const foot = s.kind === 'free' && s.added ? 'Free' : s.kind === 'owned' ? 'Owned' : s.kind === 'buy' ? null : toolFootWords(s, php);
  return (
    <StoreTile
      href={shop.store.item('tools', row.tool.key)}
      art={<ToolArt toolKey={row.tool.key} />}
      title={row.tool.title}
      meta={meta}
      line={row.tool.line}
      tags={<TagChips tags={row.tags} max={1} />}
      foot={foot}
      pill={pill}
      data={`tool:${row.tool.key}`}
      show={toolShowTags(row)}
    />
  );
}

/** Show & sort tokens for a tool row: yours · free · paid, plus the chips it answers (For you · each tag's group), its
 *  kind (`k-widget`, the front's Widgets chip), its places (`p-chat` …, Your widgets' chips) and `installed` (v19 switch). */
export function toolShowTags(row: StoreToolRow): string {
  const tags = [toolIsYours(row.status) ? 'yours' : 'more', 'k-widget', ...row.tool.shelves.map((p) => `p-${p}`)];
  if (row.installed) tags.push('installed');
  const base = row.status.kind === 'no_card' ? row.status.prior : row.status;
  tags.push(base.kind === 'free' || base.kind === 'verify' ? 'free' : 'paid');
  if (row.forYou) tags.push('foryou');
  for (const t of row.tags) if (t.group) tags.push(groupChipKey(t.group));
  return [...new Set(tags)].join(' ');
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
      foot={status.kind === 'locked' ? graphLockedLine(status.badgeName) : status.kind === 'on' ? 'On your Analytics' : isNewGraph(k) ? 'New · Recommended' : 'Free'}
      pill={
        status.kind === 'locked' ? (
          <Lock aria-label="Locked" className="h-4 w-4 flex-none text-[color:var(--m-slate-2)]" strokeWidth={2} />
        ) : status.kind === 'on' ? (
          <Pill tone="done">
            <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.4} />
            {INSTALLED_WORD}
          </Pill>
        ) : (
          <Pill>{INSTALL_WORD}</Pill>
        )
      }
      data={`graph:${k}`}
      show={status.kind === 'on' ? 'on k-graph installed' : status.kind === 'locked' ? 'locked k-graph' : 'off k-graph'}
    />
  );
}

/** The badge's tile on the Store front (F1): earned only, never sold — ✓ Installed, or Install. */
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
            {INSTALLED_WORD}
          </Pill>
        ) : (
          <Pill>{INSTALL_WORD}</Pill>
        )
      }
      data={`badge:${tile.key}`}
      show={(tile.key === 'verified' ? tile.state === 'earned' : following) ? 'k-badge installed' : 'k-badge'}
    />
  );
}

/** A QR design's mark (Toolkit v19). */
export function QrArt() {
  return (
    <span aria-hidden className="grid h-10 w-10 place-items-center rounded-lg bg-[color-mix(in_srgb,rgb(var(--sn-accent))_12%,transparent)] text-ink">
      <QrCode className="h-5 w-5" strokeWidth={1.75} />
    </span>
  );
}

/** A QR design's tile on the Toolkit front (v19): its words are the QR rows' own; My page reads Built in. */
export function StoreQrTile({ k, installed, builtIn }: { k: PromoteQrMode; installed: boolean; builtIn: boolean }) {
  const w = qrWords(k);
  return (
    <StoreTile
      href={shop.store.item('qr', k)}
      art={<QrArt />}
      title={w.name}
      line={w.line}
      foot={builtIn ? 'Built in' : 'Free'}
      pill={
        installed ? (
          <Pill tone="done">
            <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.4} />
            {INSTALLED_WORD}
          </Pill>
        ) : (
          <Pill>{INSTALL_WORD}</Pill>
        )
      }
      data={`qr:${k}`}
      show={installed ? 'k-qr installed' : 'k-qr'}
    />
  );
}

/**
 * ⭐ A FEATURED CARD at the Toolkit's top (v19 frame 1: one on a phone, two on a desktop) — a real item only: a graph
 * not yet installed that reads "New · Recommended", or a paid widget suggested for the shop's own services. None = none.
 */
export function StoreHeroCard({ eyebrow, title, line, href, art, pill, show, data, wide }: {
  eyebrow: string;
  title: string;
  line: string;
  href: string;
  art: ReactNode;
  pill: ReactNode;
  show: string;
  data: string;
  /** The second card shows from the desktop width up. */
  wide?: boolean;
}) {
  return (
    <li className={wide ? 'hidden sm:block' : ''} data-store-row="" data-store-name={title} data-store-show={show}>
      <Link href={href} className="sn-press sn-frame flex h-full flex-col gap-2 p-4" data-store-hero={data}>
        <span className="text-sn-sm font-semibold uppercase tracking-wide text-[rgb(var(--color-link))]">{eyebrow}</span>
        <span className="flex items-start gap-3">
          {art}
          <span className="min-w-0 flex-1">
            <b className="block text-sn-xl font-semibold leading-tight text-ink">{title}</b>
            <span className="block text-sn-md leading-snug text-[color:var(--m-slate-2)]">{line}</span>
          </span>
        </span>
        <span className="flex justify-end">{pill}</span>
      </Link>
    </li>
  );
}

/** The featured card's pill: Install, or Buy with the catalog price. */
export function HeroPill({ children }: { children: ReactNode }) {
  return <Pill>{children}</Pill>;
}

/** A shelf on the Store front: its name, "See all N", and its tiles in one sideways row. */
export function StoreShelfRow({ title, count, href, children, data }: { title: string; count: number; href: string; children: ReactNode; data: string }) {
  return (
    <section className="mt-[18px]" data-store-block="" data-store-shelf={data}>
      <h2 className="hc-k2 mb-2 min-h-9 justify-between">
        <span>{title}</span>
        <Link href={href} className="sn-press inline-flex min-h-11 items-center gap-0.5 text-sn-base font-semibold normal-case text-[rgb(var(--color-link))]" data-store-see-all={data}>
          See all {formatCount(count)}
          <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
        </Link>
      </h2>
      <ul className="sn-glide-x -mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]" data-store-list="">
        {children}
      </ul>
    </section>
  );
}

/** A tool row on the Tools shelf (F2): icon · name · line + foot · its tags · its one press. `yours` = the keys in
 *  Your tools now (a Get adds to the end of them); null = the layout could not be read. */
export function ToolShelfRow({ row, yours }: { row: StoreToolRow; yours: readonly string[] | null }) {
  const s = row.status;
  const a = row.act;
  const k = row.tool.key;
  const item = shop.store.item('tools', k);
  let right: ReactNode;
  if (a.kind === 'installed') {
    right = <OnPage />;
  } else if (a.kind === 'resubscribe') {
    // 🧰 Owned on Free or Verified (owner a02673ac): kept, locked, the plans door — never a second Buy.
    right = <ActionButton tone="info" icon={<Sparkles aria-hidden strokeWidth={1.8} />} label="See plans" href={routes.vendorDashboard.subscription()} />;
  } else if (a.kind === 'no_card') {
    // 🟢 No online service card serves it (3a2419fd): kept and greyed — the door turns a card on, never a Buy.
    right = <ActionButton tone="info" icon={<Layers aria-hidden strokeWidth={1.8} />} label="Your services" href={routes.vendorDashboard.services()} />;
  } else if (a.kind === 'install') {
    // Free, or owned and taken off the page: Install puts it back on Your widgets — never a second charge.
    right = yours ? (
      <StoreOp
        op="layout"
        fields={{ row: 'tools', intent: 'add', key: [...yours, k] }}
        tone="info"
        icon={<Plus aria-hidden strokeWidth={2} />}
        label={INSTALL_WORD}
        landTo={`${shop.index()}?added=${encodeURIComponent(`tool:${k}`)}#tools`}
      />
    ) : (
      <ToolChip tone="wait">Couldn’t load</ToolChip>
    );
  } else if (a.kind === 'verify') {
    right = <ActionButton tone="info" icon={<BadgeCheck aria-hidden strokeWidth={1.8} />} label="Get Verified" href={routes.vendorDashboard.verify()} />;
  } else if (a.kind === 'buy') {
    right = <ActionButton tone="brand" icon={<ShoppingBag aria-hidden strokeWidth={1.8} />} label={buyWords(a.price, php)} href={item} />;
  } else if (a.kind === 'pending') {
    right = <ToolChip tone="wait">In review</ToolChip>;
  } else if (a.kind === 'no_price') {
    right = <ToolChip tone="quiet">Price not set yet</ToolChip>;
  } else {
    right = <ToolChip tone="wait">Couldn’t load</ToolChip>;
  }
  const foot = s.kind === 'buy' ? (s.needsPlan ? PAID_WIDGET_NEEDS_PLAN_WORDS : null) : a.kind === 'installed' && a.builtIn ? 'Built in' : toolFootWords(s, php);
  return (
      <ToolRow
        attrs={{ 'data-store-row': '', 'data-store-name': row.tool.title, 'data-store-show': toolShowTags(row), 'data-store-tool': k }}
        lead={<ToolArt toolKey={k} />}
        title={
          <Link href={item} className="hover:underline">
            {row.tool.title}
          </Link>
        }
        lines={[s.kind === 'buy' ? `${row.tool.line} · one-time` : row.tool.line, foot, <TagChips key="tags" tags={row.tags} />]}
        right={right}
      />
  );
}

/** A graph row on the Graphs shelf (F12): its picture · name · question · ✓ Installed / Install, or the badge that opens
 *  it. `on` = the graphs on the Analytics now (a Get adds to their end); `layoutRead` false = the layout was refused. */
export function GraphShelfRow({ k, status, on, layoutRead }: { k: CardKey; status: GraphStatus; on: readonly CardKey[]; layoutRead: boolean }) {
  const g = STORE_GRAPHS[k];
  const right =
    status.kind === 'locked' ? (
      <Lock aria-label="Locked" className="h-4 w-4 text-[color:var(--m-slate-2)]" strokeWidth={2} />
    ) : status.kind === 'on' ? (
      <OnPage />
    ) : !layoutRead ? (
      <ToolChip tone="wait">Couldn’t load</ToolChip>
    ) : (
      <StoreOp op="layout" fields={{ row: 'graphs', intent: 'add', key: [...on, k] }} tone="info" icon={<Plus aria-hidden strokeWidth={2} />} label={INSTALL_WORD} />
    );
  return (
      <ToolRow
        attrs={{ 'data-store-row': '', 'data-store-name': g.title, 'data-store-show': status.kind, 'data-store-graph': k }}
        lead={<GraphArt />}
        title={
          <Link href={shop.store.item('graphs', k)} className="hover:underline">
            {g.title}
          </Link>
        }
        lines={[
          status.kind === 'on' ? null : g.asks,
          status.kind === 'locked' ? (
            <span data-store-locked-line="">
              {graphLockedLine(status.badgeName)}
              {status.toGo ? ` · ${status.toGo}` : ''}
            </span>
          ) : status.kind === 'off' && isNewGraph(k) ? (
            <span data-store-new="">New · Recommended</span>
          ) : (
            graphWindowWords(k)
          ),
        ]}
        right={right}
      />
  );
}

export { ToolLead };
