import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { ChevronRight, Lock, MessageSquare, Plus, ReceiptText, ShoppingBag, X } from 'lucide-react';
import { ToolChip, ToolFail, ToolPage, ToolPin, ToolSection } from '@/app/vendor-dashboard/_components/tool-page';
import { ActionButton } from '@/components/action-button';
import { routes } from '@/lib/routes';
import {
  SHELF_TITLE,
  STORE_GRAPHS,
  graphStatus,
  graphWindowWords,
  isGraphKey,
  isPaidStoreTool,
  isStoreShelf,
  storeToolOf,
  toolFootWords,
  toolIsYours,
  toolStatus,
} from '@/lib/supplier-store';
import { loadStore, type StoreData } from '../../_components/store-data';
import { GraphArt, ToolArt, php, toolOpenHref } from '../../_components/store-views';
import { CakeDemoButton, StoreOp } from '../../_components/store-client';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ shelf: string; item: string }> }) {
  const { shelf, item } = await params;
  const key = decodeURIComponent(item);
  const title = shelf === 'tools' ? storeToolOf(key)?.title : shelf === 'graphs' && isGraphKey(key) ? STORE_GRAPHS[key].title : null;
  return { title: `${title ?? 'Store'} · Store · Supplier` };
}

/**
 * 🛍 ONE STORE ITEM (drawing v10 — F3 Cake Maker · F7 a graph). A tool: what it is, its price (one-time, yours forever —
 * from the catalog row, never typed) or its state (Owned · With your plan · Free trial · Free), "Try it first" where a demo
 * exists, what it adds to the shop, and ONE button: Buy · ₱… / Get / Open. A graph: what it shows, an example, Good to
 * know (Free · Window · Counts), and Get · Free. A badge has no item of its own: it opens on the Badges page.
 */
export default async function StoreItemPage({ params }: { params: Promise<{ shelf: string; item: string }> }) {
  const { shelf, item } = await params;
  if (!isStoreShelf(shelf)) notFound();
  const key = decodeURIComponent(item);
  if (shelf === 'badges') redirect(`${routes.vendorDashboard.shop.badges()}#${encodeURIComponent(key)}`);
  if (shelf === 'tools' && !storeToolOf(key)) notFound();
  if (shelf === 'graphs' && !isGraphKey(key)) notFound();
  const d = await loadStore();
  return (
    <ToolPage name={`store-item-${shelf}`}>
      {shelf === 'tools' ? <ToolItem d={d} toolKey={key} /> : <GraphItem d={d} graphKey={key} />}
    </ToolPage>
  );
}

function Card({ children, data }: { children: ReactNode; data?: string }) {
  return (
    <div className="sn-frame mt-3 p-4" data-store-card={data ?? ''}>
      {children}
    </div>
  );
}

function Line({ icon, title, line }: { icon: ReactNode; title: string; line: string }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span aria-hidden className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-[color:var(--surface-soft)] text-ink">
        {icon}
      </span>
      <span className="min-w-0">
        <b className="block text-sn-lg font-semibold leading-tight text-ink">{title}</b>
        <span className="block text-sn-md leading-snug text-[color:var(--m-slate-2)]">{line}</span>
      </span>
    </li>
  );
}

/** What each paid tool adds — the drawing's three lines for the Cake Maker; the tool's own line for the rest. */
function addsOf(key: string, line: string): { icon: ReactNode; title: string; line: string }[] {
  const tile = { icon: <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />, title: 'A tile in your tools', line };
  if (key === 'cake_tool') {
    return [
      { ...tile, line: 'Set your sizes, flavours and finishes once.' },
      { icon: <MessageSquare aria-hidden className="h-4 w-4" strokeWidth={1.9} />, title: 'A card in your chat', line: 'The couple builds a cake and sends it to you.' },
      { icon: <ReceiptText aria-hidden className="h-4 w-4" strokeWidth={1.9} />, title: 'A line on your quote', line: 'The design becomes a line you can price.' },
    ];
  }
  return [tile];
}

function ToolItem({ d, toolKey }: { d: StoreData; toolKey: string }) {
  const tool = storeToolOf(toolKey)!;
  const s = toolStatus(tool.key, d.tools);
  const paid = isPaidStoreTool(tool.key);
  const yours = toolIsYours(s);
  const head =
    s.kind === 'buy' ? (
      <>
        <b className="block text-sn-3xl font-bold leading-tight text-ink" data-store-price="">
          {php(s.price)} <span className="text-sn-lg font-semibold text-[color:var(--m-slate-2)]">one-time</span>
        </b>
        <span className="mt-1 block text-sn-base text-[color:var(--m-slate-2)]">Yours forever. No renewal.</span>
      </>
    ) : (
      <b className={`block text-sn-xl font-semibold ${s.kind === 'trial' ? 'text-[rgb(var(--color-ok))]' : s.kind === 'unread' ? 'text-[rgb(var(--color-warn))]' : 'text-ink'}`} data-store-state={s.kind}>
        {s.kind === 'free' ? (s.added ? 'Free · in your tools' : 'Free forever') : toolFootWords(s, php)}
      </b>
    );
  const button = yours ? (
    <ActionButton tone="brand" main icon={<ChevronRight aria-hidden strokeWidth={2} />} label={`Open ${tool.title}`} href={toolOpenHref(tool.key)} className="w-full" />
  ) : s.kind === 'free' ? (
    <StoreOp
      op="tool_add"
      fields={{ tool: tool.key }}
      tone="brand"
      main
      icon={<Plus aria-hidden strokeWidth={2} />}
      label="Get · Free"
      landTo={`${routes.vendorDashboard.shop.index()}?added=${encodeURIComponent(`tool:${tool.key}`)}#tools`}
    />
  ) : s.kind === 'buy' ? (
    <StoreOp op="buy" fields={{ tool: tool.key }} tone="brand" main icon={<ShoppingBag aria-hidden strokeWidth={1.8} />} label={`Buy · ${php(s.price)}`} />
  ) : s.kind === 'pending' ? (
    <ToolChip tone="wait">Payment in review</ToolChip>
  ) : s.kind === 'no_price' ? (
    <ToolChip tone="quiet">Price not set yet</ToolChip>
  ) : (
    <ToolFail title="Couldn’t load this tool" line="You have not been charged." retryHref={routes.vendorDashboard.shop.store.item('tools', tool.key)} />
  );
  return (
    <>
      <ToolPin route="/vendor-dashboard/shop/store/[shelf]/[item]" title={tool.title} sub={tool.line} />
      <BackToShelf shelf="tools" />
      <Card data="tool-head">
        <div className="flex items-start gap-3">
          <ToolArt toolKey={tool.key} />
          <div className="min-w-0">{head}</div>
        </div>
      </Card>
      {tool.key === 'cake_tool' ? (
        <ToolSection label="Try it first" data="store-try">
          <Card>
            <p className="mb-3 text-sn-base text-[color:var(--m-slate-2)]">A demo · what couples see in your chat</p>
            <CakeDemoButton />
          </Card>
        </ToolSection>
      ) : null}
      <ToolSection label="What it adds to your shop" data="store-adds">
        <ul className="sn-frame px-4 py-1">
          {addsOf(tool.key, tool.line).map((a) => (
            <Line key={a.title} {...a} />
          ))}
          {!paid ? <Line icon={<Plus aria-hidden className="h-4 w-4" strokeWidth={2} />} title="Free forever" line="Every free tool is yours to keep." /> : null}
        </ul>
      </ToolSection>
      <div className="mt-5 flex [&>*]:w-full" data-store-buy="">
        {button}
      </div>
    </>
  );
}

function GraphItem({ d, graphKey }: { d: StoreData; graphKey: string }) {
  if (!isGraphKey(graphKey)) return null;
  const g = STORE_GRAPHS[graphKey];
  const status = graphStatus(graphKey, d.on, d.unlocks, d.badges);
  const button =
    status.kind === 'locked' ? (
      <p className="flex items-center gap-2 text-sn-base text-[color:var(--m-slate-2)]" data-store-locked="">
        <Lock aria-hidden className="h-4 w-4" strokeWidth={2} />
        Opens with <b className="font-semibold text-ink">{status.badgeName} · Bronze</b>
        {status.toGo ? ` · ${status.toGo}` : ''}
      </p>
    ) : d.picks === null ? (
      <ToolChip tone="wait">Couldn’t load</ToolChip>
    ) : status.kind === 'on' ? (
      <StoreOp op="graph_remove" fields={{ graph: graphKey }} tone="neutral" icon={<X aria-hidden strokeWidth={2} />} label="Take it off your Analytics" />
    ) : (
      <StoreOp
        op="graph_add"
        fields={{ graph: graphKey }}
        tone="brand"
        main
        icon={<Plus aria-hidden strokeWidth={2} />}
        label="Get · Free"
        landTo={`${routes.vendorDashboard.shop.index()}?added=${encodeURIComponent(`graph:${graphKey}`)}#analytics`}
      />
    );
  return (
    <>
      <ToolPin route="/vendor-dashboard/shop/store/[shelf]/[item]" title={g.title} sub={g.asks} />
      <BackToShelf shelf="graphs" />
      <ToolSection label="What it shows" data="store-shows">
        <Card>
          <p className="text-sn-lg leading-snug text-ink">{g.asks}</p>
          <p className="mt-1 text-sn-base text-[color:var(--m-slate-2)]">{g.counts}.</p>
        </Card>
      </ToolSection>
      <ToolSection label="Try it first" data="store-try">
        <Card>
          <span className="mb-2 inline-block">
            <ToolChip tone="quiet">Example</ToolChip>
          </span>
          <GraphArt size={72} wide />
        </Card>
      </ToolSection>
      <ToolSection label="Good to know" data="store-know">
        <dl className="sn-frame grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 p-4 text-sn-base">
          <dt className="font-semibold text-ink">Free</dt>
          <dd className="text-[color:var(--m-slate-2)]">Every graph is.</dd>
          <dt className="font-semibold text-ink">Window</dt>
          <dd className="text-[color:var(--m-slate-2)]">{graphWindowWords(graphKey)}</dd>
          <dt className="font-semibold text-ink">Counts</dt>
          <dd className="text-[color:var(--m-slate-2)]">{g.counts}</dd>
        </dl>
      </ToolSection>
      <div className="mt-5 flex [&>*]:w-full" data-store-get="">
        {button}
      </div>
    </>
  );
}

/** The shelf this item sits on — the drawing's "‹ Specialized Tools" / "‹ Graphs" under the pinned row. */
function BackToShelf({ shelf }: { shelf: 'tools' | 'graphs' }) {
  return (
    <Link href={routes.vendorDashboard.shop.store.shelf(shelf)} className="sn-press inline-flex min-h-11 items-center text-sn-base font-semibold text-[rgb(var(--color-link))]" data-store-shelf-back={shelf}>
      All {SHELF_TITLE[shelf]}
      <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
    </Link>
  );
}
