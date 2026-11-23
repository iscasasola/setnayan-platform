import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight, Lock, MessageSquare, MinusCircle, Plus, ReceiptText, ShoppingBag } from 'lucide-react';
import { CARD_ORDER } from '@/app/vendor-dashboard/performance/_components/analytics-cards';
import { ToolChip, ToolEmpty, ToolFail, ToolPin, ToolRow, ToolSection } from '@/app/vendor-dashboard/_components/tool-page';
import { TemplateRows } from '@/app/_components/template-rows';
import { ActionButton } from '@/components/action-button';
import { routes } from '@/lib/routes';
import { SPECIALIZED_TOOLS } from '@/lib/specialized-tools';
import {
  GRAPH_GROUPS,
  SHELF_TITLE,
  STORE_GRAPHS,
  followedBadges,
  goalWords,
  graphStatus,
  graphWindowWords,
  groupChipKey,
  isGraphKey,
  isPaidStoreTool,
  storeToolOf,
  storeToolRows,
  toolChipGroups,
  toolFootWords,
  toolIsYours,
  toolShelfGroups,
  toolStatus,
  toolTags,
  yourTools,
  type GraphStatus,
  type StoreShelf,
  type StoreToolRow,
} from '@/lib/supplier-store';
import type { ShelfTile } from '@/lib/shop-badge-shelf';
import { STORE_TOOL_DEMO_LINE } from '@/lib/store-tool-demos';
import type { CardKey } from '@/app/vendor-dashboard/performance/_components/analytics-cards';
import { BadgeArt } from '@/app/vendor-dashboard/shop/_components/shop-badge-row';
import type { StoreData } from './store-data';
import { GraphArt, GraphShelfRow, OnPage, StoreBadgeTile, StoreGraphTile, StoreShelfRow, StoreToolTile, TagChips, ToolArt, ToolShelfRow, php, toolOpenHref } from './store-views';
import { StoreChips, StoreOp, StoreThumb, ToolDemoButton } from './store-client';

/**
 * 🛍 THE STORE'S SCREENS (owner 23 Nov 2026 — drawing `supplier_store_graphs_badges_2026-11-23` v12). Each page reads
 * once (`loadStore`) and hands its facts here; the supplier lab mounts the same screens on fixtures. No reads in this
 * file. 🔒 shop/store/the-store-is-the-drawing.test.ts
 *
 *   StoreFront        F1 — three shelves: Specialized Tools · Graphs · Badges, each with "See all N".
 *   StoreShelfScreen  F6 Tools (tag chips; "For you" · "Yours" · "More tools", each tool with its supplier-type tags) ·
 *                     F12 Graphs ("On your Analytics", ✓ On your page; then the groups with Get) · F15 Badges ("On your
 *                     Shop", any number; "More badges" with Add; Verified ✓ Earned). Order lives on the Shop's Edit.
 *   StoreItemScreen   F9 a tool — its tags, its one-time price from the catalog row (never typed) or its state, "Try it first",
 *                     what it adds, ONE button: Buy · ₱… / Get / Open. F7 a graph — what it shows, an example, Good to
 *                     know, Get · Free. A badge has no item of its own: it opens on the Badges page.
 */

/** F1 · the Store front: three shelves, each a sideways row with "See all N". */
export function StoreFront({ d }: { d: StoreData }) {
  const tools = storeToolRows(d.tools);
  const yours = d.badges ? followedBadges(d.layout?.badges ?? null, d.badges).keys : [];
  const graphs = [...d.on, ...CARD_ORDER.filter((k) => !d.on.includes(k))];
  return (
    <>
      <ToolPin route="/vendor-dashboard/shop/store" title="Store" sub={<span data-store-sub="">Tools, graphs and badges for your shop.</span>} />
      {d.layout === null ? <ToolFail title="Couldn’t load your Shop’s rows" line="What is yours may show as not yet. Nothing was changed." retryHref={routes.vendorDashboard.shop.store.index()} /> : null}

      <StoreShelfRow title={SHELF_TITLE.tools} count={SPECIALIZED_TOOLS.length} href={routes.vendorDashboard.shop.store.shelf('tools')} data="tools">
        {tools.map((r) => (
          <StoreToolTile key={r.tool.key} row={r} />
        ))}
      </StoreShelfRow>

      <StoreShelfRow title={SHELF_TITLE.graphs} count={CARD_ORDER.length} href={routes.vendorDashboard.shop.store.shelf('graphs')} data="graphs">
        {graphs.map((k) => (
          <StoreGraphTile key={k} k={k} status={graphStatus(k, d.on, d.unlocks, d.badges)} />
        ))}
      </StoreShelfRow>

      {d.badges ? (
        <StoreShelfRow title={SHELF_TITLE.badges} count={d.badges.length} href={routes.vendorDashboard.shop.store.shelf('badges')} data="badges">
          {d.badges.map((t) => (
            <StoreBadgeTile key={t.key} tile={t} following={t.key !== 'verified' && yours.includes(t.key)} />
          ))}
        </StoreShelfRow>
      ) : (
        <ToolFail title="Couldn’t load your badges" retryHref={routes.vendorDashboard.shop.store.index()} data="store-badges" />
      )}
      <p hidden data-store-none="" className="py-6 text-center text-sn-lg text-[color:var(--m-slate-2)]">
        Nothing in the Store matches that.
      </p>
      <StoreThumb name="front" placeholder="Search the Store" />
    </>
  );
}

/** F2 · F4/F5 · F9 — one shelf: Tools · Graphs · Badges. */
export function StoreShelfScreen({ shelf, d }: { shelf: StoreShelf; d: StoreData }) {
  return (
    <>
      <ToolPin route="/vendor-dashboard/shop/store/[shelf]" title={SHELF_TITLE[shelf]} sub={<span data-store-sub="">{subLine(shelf, d)}</span>} />
      {d.layout === null ? <ToolFail title="Couldn’t load your Shop’s rows" line="Nothing was changed. Try again in a moment." retryHref={routes.vendorDashboard.shop.store.shelf(shelf)} /> : null}
      {shelf === 'tools' ? <ToolsShelf d={d} /> : shelf === 'graphs' ? <GraphsShelf d={d} /> : <BadgesShelf d={d} />}
      <p hidden data-store-none="" className="py-6 text-center text-sn-lg text-[color:var(--m-slate-2)]">
        Nothing here matches that.
      </p>
      {shelf === 'tools' ? (
        <StoreThumb
          name="tools"
          placeholder="Search tools"
          countWord="tool"
          shows={[
            { key: 'all', label: 'All' },
            { key: 'yours', label: 'Yours' },
            { key: 'free', label: 'Free' },
            { key: 'paid', label: 'One-time' },
          ]}
        />
      ) : shelf === 'graphs' ? (
        <StoreThumb
          name="graphs"
          placeholder="Search graphs"
          countWord="graph"
          shows={[
            { key: 'all', label: 'All' },
            { key: 'on', label: 'On your Analytics' },
            { key: 'off', label: 'Not added' },
            { key: 'locked', label: 'Opened by a badge' },
          ]}
        />
      ) : (
        <StoreThumb name="badges" placeholder="Search badges" countWord="badge" />
      )}
    </>
  );
}

/** F3 · F7 — one item: a tool (price or state, demo, what it adds, one button) or a graph. */
export function StoreItemScreen({ shelf, itemKey, d }: { shelf: 'tools' | 'graphs'; itemKey: string; d: StoreData }) {
  return shelf === 'tools' ? <ToolItem d={d} toolKey={itemKey} /> : <GraphItem d={d} graphKey={itemKey} />;
}

function subLine(shelf: StoreShelf, d: StoreData): string {
  if (shelf === 'tools') return `${SPECIALIZED_TOOLS.length} tools`;
  if (shelf === 'graphs') return `${CARD_ORDER.length} graphs, all free. ${d.on.length} ${d.on.length === 1 ? 'is' : 'are'} on your Analytics.`;
  return 'Earned, never sold. Pick the badges that show on your Shop.';
}

/** The keys in Your tools now — a Get adds to their end. null = the layout was refused (no Get is offered). */
function yourToolKeys(d: StoreData): string[] | null {
  return d.layout === null ? null : yourTools(d.tools).map((r) => r.tool.key);
}

function ToolGroup({ label, rows, yours, data }: { label: string; rows: readonly StoreToolRow[]; yours: readonly string[] | null; data: string }) {
  if (rows.length === 0) return null;
  return (
    <ToolSection label={label} count={rows.length} data={data}>
      <div data-store-block="">
        <div data-store-list="">
          <TemplateRows label={label}>
            {rows.map((r) => (
              <ToolShelfRow key={r.tool.key} row={r} yours={yours} />
            ))}
          </TemplateRows>
        </div>
      </div>
    </ToolSection>
  );
}

function ToolsShelf({ d }: { d: StoreData }) {
  const rows = storeToolRows(d.tools);
  const { forYou, yours, more } = toolShelfGroups(rows);
  const keys = yourToolKeys(d);
  const groups = toolChipGroups((t) => rows.find((r) => r.tool.key === t.key)?.tags ?? []);
  return (
    <>
      <StoreChips chips={[{ key: 'all', label: 'All' }, { key: 'foryou', label: 'For you' }, ...groups.map((g) => ({ key: groupChipKey(g), label: g }))]} />
      <ToolGroup label="For you" rows={forYou} yours={keys} data="store-foryou" />
      <ToolGroup label="Yours" rows={yours} yours={keys} data="store-yours" />
      <ToolGroup label="More tools" rows={more} yours={keys} data="store-more" />
    </>
  );
}

type GraphItemState = { k: CardKey; status: GraphStatus };

function GraphBlock({ label, items, d, data }: { label: string; items: readonly GraphItemState[]; d: StoreData; data: string }) {
  if (items.length === 0) return null;
  return (
    <ToolSection label={label} data={data}>
      <div data-store-block="">
        <div data-store-list="">
          <TemplateRows label={label}>
            {items.map(({ k, status }) => (
              <GraphShelfRow key={k} k={k} status={status} on={d.on} layoutRead={d.layout !== null} />
            ))}
          </TemplateRows>
        </div>
      </div>
    </ToolSection>
  );
}

function GraphsShelf({ d }: { d: StoreData }) {
  const all = CARD_ORDER.map((k) => ({ k, status: graphStatus(k, d.on, d.unlocks, d.badges) }));
  const off = all.filter((x) => x.status.kind === 'off');
  const shut = all.filter((x) => x.status.kind === 'locked');
  return (
    <>
      {d.on.length > 0 ? (
        <GraphBlock label="On your Analytics" items={d.on.map((k) => ({ k, status: { kind: 'on' } }))} d={d} data="store-on" />
      ) : (
        <ToolSection label="On your Analytics" data="store-on">
          <ToolEmpty>No graphs on your Analytics. Get one below.</ToolEmpty>
        </ToolSection>
      )}
      {GRAPH_GROUPS.map((g) => (
        <GraphBlock key={g} label={g} items={off.filter((x) => STORE_GRAPHS[x.k].group === g)} d={d} data={`store-group-${g}`} />
      ))}
      <GraphBlock label="Opened by a badge" items={shut} d={d} data="store-group-badge" />
    </>
  );
}

function BadgesShelf({ d }: { d: StoreData }) {
  if (!d.badges) return <ToolFail title="Couldn’t load your badges" retryHref={routes.vendorDashboard.shop.store.shelf('badges')} />;
  const tiles = d.badges;
  const followed = followedBadges(d.layout?.badges ?? null, tiles);
  const on = followed.keys.map((k) => tiles.find((t) => t.key === k)!).filter(Boolean);
  const more = tiles.filter((t) => t.key !== 'verified' && !followed.keys.includes(t.key as never));
  const verified = tiles.find((t) => t.key === 'verified');
  const canWrite = d.layout !== null;
  const lineOf = (t: ShelfTile) => [goalWords(t), t.tierName ? `${t.tierName} now` : 'not earned yet'].filter(Boolean).join(' · ') || t.sub;
  return (
    <>
      <ToolSection label="On your Shop" count={on.length} data="store-badges-on">
        <div data-store-block="">
          <div data-store-list="">
            {on.length > 0 ? (
              <TemplateRows label="On your Shop">
                {on.map((t) => (
                  <ToolRow
                    key={t.key}
                    attrs={{ 'data-store-row': '', 'data-store-name': t.title, 'data-store-badge': t.key }}
                    lead={<BadgeArt tile={t} size={44} />}
                    title={t.title}
                    lines={[lineOf(t)]}
                    right={<OnPage />}
                  />
                ))}
              </TemplateRows>
            ) : (
              <ToolEmpty>No badges on your Shop. Add one below.</ToolEmpty>
            )}
          </div>
        </div>
      </ToolSection>
      <ToolSection label="More badges" count={more.length + (verified ? 1 : 0)} data="store-badges-more">
        <div data-store-block="">
          <div data-store-list="">
            <TemplateRows label="More badges">
              {more.map((t) => (
                <ToolRow
                  key={t.key}
                  attrs={{ 'data-store-row': '', 'data-store-name': t.title, 'data-store-badge': t.key }}
                  lead={<BadgeArt tile={t} size={44} />}
                  title={t.title}
                  lines={[lineOf(t)]}
                  right={
                    canWrite ? (
                      <StoreOp op="layout" fields={{ row: 'badges', intent: 'add', key: [...followed.keys, t.key] }} tone="info" icon={<Plus aria-hidden strokeWidth={2} />} label="Add" />
                    ) : (
                      <ToolChip tone="wait">Couldn’t load</ToolChip>
                    )
                  }
                />
              ))}
              {verified ? (
                <ToolRow
                  attrs={{ 'data-store-row': '', 'data-store-name': verified.title, 'data-store-badge': 'verified' }}
                  lead={<BadgeArt tile={verified} size={44} />}
                  title={verified.title}
                  lines={[verified.state === 'earned' ? 'Earned. Your papers were approved.' : verified.state === 'unread' ? verified.sub : 'Send your papers to earn it.']}
                  right={verified.state === 'earned' ? <OnPage>Earned</OnPage> : null}
                />
              ) : null}
            </TemplateRows>
          </div>
        </div>
      </ToolSection>
      <div className="mt-4">
        <ActionButton tone="neutral" icon={<ChevronRight aria-hidden strokeWidth={2} />} label="Every badge and its steps" href={routes.vendorDashboard.shop.badges()} />
      </div>
    </>
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
  const keys = yourToolKeys(d);
  const tags = toolTags(tool, d.tools.hubOverrides);
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
  ) : s.kind === 'free' && keys === null ? (
    <ToolChip tone="wait">Couldn’t load</ToolChip>
  ) : s.kind === 'free' ? (
    <StoreOp
      op="layout"
      fields={{ row: 'tools', intent: 'add', key: [...(keys ?? []), tool.key] }}
      tone="brand"
      main
      icon={<Plus aria-hidden strokeWidth={2} />}
      label="Get · Free"
      landTo={`${routes.vendorDashboard.shop.index()}?added=${encodeURIComponent(`tool:${tool.key}`)}#tools`}
    />
  ) : s.kind === 'buy' ? (
    // 🍎 Buying is web-only: the iPhone app's shell hides the press (Apple's rules — `lib/store-shell.ts`).
    <span className="contents" data-web-only="">
      <StoreOp op="buy" fields={{ tool: tool.key }} tone="brand" main icon={<ShoppingBag aria-hidden strokeWidth={1.8} />} label={`Buy · ${php(s.price)}`} />
    </span>
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
      <div data-store-item-tags="">
        <TagChips tags={tags} max={6} />
      </div>
      <Card data="tool-head">
        <div className="flex items-start gap-3">
          <ToolArt toolKey={tool.key} />
          <div className="min-w-0">{head}</div>
        </div>
      </Card>
      {isPaidStoreTool(tool.key) ? (
        <ToolSection label="Try it first" data="store-try">
          <Card>
            <p className="mb-3 text-sn-base text-[color:var(--m-slate-2)]">{STORE_TOOL_DEMO_LINE[tool.key]}</p>
            <ToolDemoButton tool={tool.key} shopName={d.shopName} services={d.tools.services} />
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
    ) : d.layout === null ? (
      <ToolChip tone="wait">Couldn’t load</ToolChip>
    ) : status.kind === 'on' ? (
      <StoreOp
        op="layout"
        fields={{ row: 'graphs', intent: 'remove', key: d.on.filter((k) => k !== graphKey) }}
        tone="neutral"
        icon={<MinusCircle aria-hidden strokeWidth={1.8} />}
        label="Take it off your Analytics"
      />
    ) : (
      <StoreOp
        op="layout"
        fields={{ row: 'graphs', intent: 'add', key: [...d.on, graphKey] }}
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
