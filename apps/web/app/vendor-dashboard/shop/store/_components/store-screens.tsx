import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight, BadgeCheck, BookOpen, ChevronRight, Layers, Lock, MessageSquare, MinusCircle, Plus, ReceiptText, ShoppingBag, Sparkles } from 'lucide-react';
import { CARD_ORDER } from '@/app/vendor-dashboard/performance/_components/analytics-cards';
import { ToolChip, ToolEmpty, ToolFail, ToolPin, ToolRow, ToolSection } from '@/app/vendor-dashboard/_components/tool-page';
import { TemplateRows } from '@/app/_components/template-rows';
import { ActionButton } from '@/components/action-button';
import { routes } from '@/lib/routes';
import {
  GRAPH_GROUPS,
  SHELF_LINE,
  SHELF_TITLE,
  WIDGET_SHELF_WORD,
  installedQrs,
  isBuiltInQr,
  isBuiltInWidget,
  isNewGraph,
  isWidgetShelf,
  qrWords,
  shelfItems,
  toolkitItems,
  visibleShelves,
  includedSplitWords,
  hiddenTemplates,
  installedTemplateIds,
  storeTemplateRows,
  templatesGreyed,
  NO_ONLINE_CARD_WORDS,
  type StoreTemplateRow,
  type ToolkitListFacts,
  type ToolkitShelf,
  STORE_GRAPHS,
  followedBadges,
  goalWords,
  graphStatus,
  graphLockedLine,
  graphWindowWords,
  groupChipKey,
  isGraphKey,
  isPaidStoreTool,
  storeToolOf,
  storeToolRows,
  toolRowFor,
  noCardWords,
  cardHiddenWidgets,
  CARDS_UNREAD_WORDS,
  toolChipGroups,
  INSTALLED_WORD,
  INSTALL_WORD,
  buyWords,
  toolAct,
  toolFootWords,
  toolIsInstalled,
  widgetPlaces,
  toolShelfGroups,
  toolStatus,
  toolTags,
  toolkitCountWords,
  toolkitCounts,
  yourTools,
  type GraphStatus,
  type StoreShelf,
  type StoreToolRow,
} from '@/lib/supplier-store';
import type { ShelfTile } from '@/lib/shop-badge-shelf';
import type { CardKey } from '@/app/vendor-dashboard/performance/_components/analytics-cards';
import { MY_QR_WORDS, PROMOTE_QR_MODES, supplierQrHref, type PromoteQrMode } from '@/lib/supplier-qr-codes';
import { BadgeArt } from '@/app/vendor-dashboard/shop/_components/shop-badge-row';
import type { StoreData } from './store-data';
import { GraphArt, GraphShelfRow, HeroPill, OnPage, QrArt, StoreBadgeTile, StoreGraphTile, StoreHeroCard, StoreQrTile, StoreShelfRow, StoreToolTile, TagChips, ToolArt, ToolShelfRow, ToolVideo, php, toolOpenHref, toolShowTags } from './store-views';
import { StoreChips, StoreInstalledSwitch, StoreOp, StoreThumb } from './store-client';
import { WidgetGuideSteps } from './widget-guide';
import { WIDGET_GUIDES } from '@/lib/supplier-store-guides';
import { PAID_WIDGET_NEEDS_PLAN_WORDS, PAID_WIDGET_RESUBSCRIBE_WORDS } from '@/lib/special-tools';
import { toolVideoSrc } from '@/lib/toolkit-videos.server';
import { formatCount } from '@/lib/format-number';
import {
  AV_TEMPLATES,
  PAY_PLAN_TEMPLATES,
  avInside,
  avTemplateOf,
  partDueWords,
  payTemplateOf,
  type TemplateKind,
} from '@/lib/toolkit-templates';
import { planItemsToDrafts } from '@/lib/vendor-pay-plans';
import { TemplateShelfRow, TemplateTile, templateHref } from './template-views';
import { KindWord, PlanBar } from './template-bar';
import { TemplatePlanEditor, TemplateRemove } from './template-client';

/**
 * 🛍 THE STORE'S SCREENS (owner 23 Nov 2026 — drawing `supplier_store_graphs_badges_2026-11-23` v12). Each page reads
 * once (`loadStore`) and hands its facts here; the supplier lab mounts the same screens on fixtures. No reads in this
 * file. 🔒 shop/store/the-store-is-the-drawing.test.ts
 *
 *   StoreFront        v19 frame 1 — chips (All · Widgets · QR designs · Graphs · Badges), the Installed switch, the
 *                     featured cards, then every shelf of the ONE Toolkit list that holds a real item, each with
 *                     "See all N" (the three Forms shelves hold none today, so they are not drawn).
 *   StoreShelfScreen  F6 Tools (tag chips; "For you" · "Yours" · "More tools", each tool with its supplier-type tags) ·
 *                     F12 Graphs ("On your Analytics", ✓ On your page; then the groups with Get) · F15 Badges ("On your
 *                     Shop", any number; "More badges" with Add; Verified ✓ Earned). Order lives on the Shop's Edit.
 *   StoreItemScreen   F9 a tool — its tags, its one-time price from the catalog row (never typed) or its state,
 *                     what it adds, ONE button: Buy · ₱… / Get / Open, then How to use it (`#guide`). F7 a graph — what it shows, Good to
 *                     know, Install (Toolkit v19: one word for the act). A badge has no item of its own: it opens on the Badges page.
 */

/** What the one Toolkit list is built from, on this visit. */
function listFacts(d: StoreData): ToolkitListFacts {
  // 🟢 The dashboard count is what this shop is shown: the card gate's hidden widgets are out (3a2419fd).
  return {
    papicCapture: d.tools.papicCapture === true,
    badges: d.badges ? d.badges.map((t) => t.key) : null,
    hidden: cardHiddenWidgets(d.tools),
    // 🧩 With no online card, a template the shop never installed is not shown (DECISION_LOG 2026-11-23).
    hiddenTemplates: hiddenTemplates(d.tools.cards, installedTemplateIds(d.layout, livePlanIds(d))),
  };
}

/** The ids of the shop's live saved plans; null = the plans read was refused (installed is then unread). */
function livePlanIds(d: StoreData): Set<string> | null {
  return d.plans.status === 'ok' ? new Set(d.plans.plans.map((p) => p.id)) : null;
}

/** One template shelf's rows for this shop (`storeTemplateRows`). */
function templateRows(d: StoreData, of: TemplateKind): StoreTemplateRow[] {
  return storeTemplateRows(of, { layout: d.layout, livePlanIds: livePlanIds(d), cards: d.tools.cards });
}

/** "For your services" first, then the rest — tags only order, they never lock (drawing, Notes). */
function forYouFirst(rows: readonly StoreTemplateRow[]): StoreTemplateRow[] {
  return [...rows.filter((r) => r.forYou), ...rows.filter((r) => !r.forYou)];
}

/** The front's chips: All, then one per kind of item that has a shelf showing (a kind with nothing has no chip). */
const KIND_CHIPS: readonly { key: string; label: string; shelves: readonly ToolkitShelf[] }[] = [
  { key: 'k-widget', label: 'Widgets', shelves: ['chat', 'present', 'hub', 'shop_page'] },
  // 🧩 "Forms" reads "Templates" (Toolkit templates drawing): payment plans and availability are not forms.
  { key: 'k-template', label: 'Templates', shelves: ['chat_forms', 'card_forms', 'payment_plans', 'availability'] },
  { key: 'k-qr', label: 'QR designs', shelves: ['qr'] },
  { key: 'k-graph', label: 'Graphs', shelves: ['graphs'] },
  { key: 'k-badge', label: 'Badges', shelves: ['badges'] },
];

/** v19 frame 1 · the Toolkit front. */
export function StoreFront({ d }: { d: StoreData }) {
  const tools = storeToolRows(d.tools);
  const items = toolkitItems(listFacts(d));
  const shelves = visibleShelves(items);
  // 🔢 The live count (owner 5ae3fbb2), from the one Toolkit list, split Included · With a plan (Toolkit templates
  //    drawing frame 0: "71 included · 8 with a plan"). In the dashboard a shop counts only what it is shown.
  const countWords = includedSplitWords(items);
  const paid = tools.filter((r) => isPaidStoreTool(r.tool.key));
  const installedCount = yourTools(d.tools).filter((r) => r.installed).length;
  return (
    <>
      <ToolPin
        route="/vendor-dashboard/shop/store"
        title="Toolkit"
        sub={<span data-store-sub="">{countWords ? <span data-toolkit-count="">{countWords}</span> : 'Widgets, QR designs, graphs and badges for your shop.'}</span>}
      />
      {d.layout === null ? <ToolFail title="Couldn’t load your Shop’s rows" line="What is yours may show as not yet. Nothing was changed." retryHref={routes.vendorDashboard.shop.store.index()} /> : null}
      {d.tools.cards === null ? <ToolFail title={CARDS_UNREAD_WORDS} line="Every widget is shown for now. Nothing was changed." retryHref={routes.vendorDashboard.shop.store.index()} data="store-cards" /> : null}

      <div className="flex items-center gap-2" data-store-front-tools="">
        <div className="min-w-0 flex-1">
          <StoreChips label="Show" chips={[{ key: 'all', label: 'All' }, ...KIND_CHIPS.filter((c) => c.shelves.some((x) => shelves.includes(x))).map(({ key, label }) => ({ key, label }))]} />
        </div>
        <StoreInstalledSwitch label={INSTALLED_WORD} />
      </div>
      <Link href={routes.vendorDashboard.shop.store.shelf('yours')} className="sn-press sn-frame mt-2 flex min-h-12 items-center gap-3 px-4" data-store-yours-door="">
        <b className="flex-1 text-sn-lg font-semibold text-ink">{SHELF_TITLE.yours}</b>
        <span className="text-sn-base text-[color:var(--m-slate-2)]">
          {d.layout === null ? 'Couldn’t load' : `${formatCount(installedCount)} ${INSTALLED_WORD.toLowerCase()}`}
        </span>
        <ChevronRight aria-hidden className="h-4 w-4 text-[color:var(--m-slate-2)]" strokeWidth={2} />
      </Link>

      <StoreHeroes d={d} tools={tools} />

      {/* 🧩 Two shelves (Toolkit templates drawing frame 0; owner "Prices only on plan-only tools"): Included says
          "Free with every shop." once and no tile carries a price; With a plan holds the only priced items. */}
      <h2 className="hc-k2 mt-[18px]" data-store-included="">
        Included
      </h2>
      <p className="text-sn-base text-[color:var(--m-slate-2)]">Free with every shop.</p>
      {shelves.map((sh) => (
        <FrontShelf key={sh} shelf={sh} d={d} tools={tools.filter((r) => !isPaidStoreTool(r.tool.key))} count={shelfItems(items, sh).filter((i) => !(i.kind === 'widget' && isPaidStoreTool(i.key))).length} />
      ))}
      {paid.length > 0 ? (
        <section className="mt-[18px]" data-store-block="" data-store-with-plan="">
          <h2 className="hc-k2">With a plan</h2>
          <p className="text-sn-base text-[color:var(--m-slate-2)]">Plus or higher. Buy once; it works while you stay on a plan.</p>
          <div className="mt-2" data-store-list="">
            <TemplateRows label="With a plan">
              {paid.map((r) => (
                <ToolShelfRow key={r.tool.key} row={r} yours={yourToolKeys(d)} />
              ))}
            </TemplateRows>
          </div>
        </section>
      ) : null}
      {/* A refused badge read lists no badge, so the shelf is not drawn — said, never an empty shelf. */}
      {d.badges ? null : <ToolFail title="Couldn’t load your badges" retryHref={routes.vendorDashboard.shop.store.index()} data="store-badges" />}
      <p hidden data-store-none="" className="py-6 text-center text-sn-lg text-[color:var(--m-slate-2)]">
        Nothing in the Toolkit matches that.
      </p>
      <StoreThumb name="front" placeholder="Search the Toolkit" />
    </>
  );
}

/** The featured cards: a "New · Recommended" graph not yet installed, and a paid widget for the shop's own services. */
function StoreHeroes({ d, tools }: { d: StoreData; tools: readonly StoreToolRow[] }) {
  const graph = CARD_ORDER.find((k) => isNewGraph(k) && graphStatus(k, d.on, d.unlocks, d.badges).kind === 'off') ?? null;
  const widget = tools.find((r) => isPaidStoreTool(r.tool.key) && r.forYou && !r.installed && (r.act.kind === 'buy' || r.act.kind === 'install')) ?? null;
  if (!graph && !widget) return null;
  return (
    <section className="mt-3" data-store-block="" data-store-heroes="">
      <ul className="grid gap-2 sm:grid-cols-2" data-store-list="">
        {graph ? (
          <StoreHeroCard
            eyebrow="New · Recommended"
            title={STORE_GRAPHS[graph].title}
            line={STORE_GRAPHS[graph].asks}
            href={routes.vendorDashboard.shop.store.item('graphs', graph)}
            art={<GraphArt />}
            pill={<HeroPill>{INSTALL_WORD}</HeroPill>}
            show="k-graph"
            data={`graph:${graph}`}
          />
        ) : null}
        {widget ? (
          <StoreHeroCard
            eyebrow="For your services"
            title={widget.tool.title}
            line={widget.tool.line}
            href={routes.vendorDashboard.shop.store.item('tools', widget.tool.key)}
            art={<ToolArt toolKey={widget.tool.key} />}
            pill={<HeroPill>{widget.act.kind === 'buy' ? buyWords(widget.act.price, php) : INSTALL_WORD}</HeroPill>}
            show={toolShowTags(widget)}
            data={`tool:${widget.tool.key}`}
            wide={graph !== null}
          />
        ) : null}
      </ul>
    </section>
  );
}

/** One shelf on the front: its tiles in one sideways row, "See all N" to its page. */
function FrontShelf({ shelf, d, tools, count }: { shelf: ToolkitShelf; d: StoreData; tools: readonly StoreToolRow[]; count: number }) {
  if (isWidgetShelf(shelf)) {
    return (
      <StoreShelfRow title={SHELF_TITLE[shelf]} count={count} href={routes.vendorDashboard.shop.store.shelf(shelf)} data={shelf}>
        {tools
          .filter((r) => r.tool.shelves.includes(shelf))
          .map((r) => (
            <StoreToolTile key={r.tool.key} row={r} />
          ))}
      </StoreShelfRow>
    );
  }
  if (shelf === 'payment_plans' || shelf === 'availability') {
    const rows = forYouFirst(templateRows(d, shelf === 'payment_plans' ? 'pay' : 'av'));
    if (rows.length === 0) return null;
    return (
      <StoreShelfRow title={SHELF_TITLE[shelf]} count={count} href={routes.vendorDashboard.shop.store.shelf(shelf)} data={shelf}>
        {rows.map((r) => (
          <TemplateTile key={r.t.key} row={r} />
        ))}
      </StoreShelfRow>
    );
  }
  if (shelf === 'qr') {
    const on = installedQrs(d.layout);
    return (
      <StoreShelfRow title={SHELF_TITLE.qr} count={count} href={routes.vendorDashboard.shop.store.shelf('qr')} data="qr">
        {PROMOTE_QR_MODES.map((k) => (
          <StoreQrTile key={k} k={k} installed={on.includes(k)} builtIn={isBuiltInQr(k)} />
        ))}
      </StoreShelfRow>
    );
  }
  if (shelf === 'graphs') {
    const graphs = [...d.on, ...CARD_ORDER.filter((k) => !d.on.includes(k))];
    return (
      <StoreShelfRow title={SHELF_TITLE.graphs} count={count} href={routes.vendorDashboard.shop.store.shelf('graphs')} data="graphs">
        {graphs.map((k) => (
          <StoreGraphTile key={k} k={k} status={graphStatus(k, d.on, d.unlocks, d.badges)} />
        ))}
      </StoreShelfRow>
    );
  }
  if (shelf === 'badges') {
    if (!d.badges) return <ToolFail title="Couldn’t load your badges" retryHref={routes.vendorDashboard.shop.store.index()} data="store-badges" />;
    const yours = followedBadges(d.layout?.badges ?? null, d.badges).keys;
    return (
      <StoreShelfRow title={SHELF_TITLE.badges} count={count} href={routes.vendorDashboard.shop.store.shelf('badges')} data="badges">
        {d.badges.map((t) => (
          <StoreBadgeTile key={t.key} tile={t} following={t.key !== 'verified' && yours.includes(t.key)} />
        ))}
      </StoreShelfRow>
    );
  }
  // A Forms shelf: never drawn while it holds no item (`visibleShelves`).
  return null;
}

/** One shelf's page: every widget (`tools`), a widget shelf, the QR designs, Your widgets, Graphs or Badges. */
export function StoreShelfScreen({ shelf, d }: { shelf: StoreShelf; d: StoreData }) {
  return (
    <>
      <ToolPin route="/vendor-dashboard/shop/store/[shelf]" title={SHELF_TITLE[shelf]} sub={<span data-store-sub="">{subLine(shelf, d)}</span>} />
      {d.layout === null ? <ToolFail title="Couldn’t load your Shop’s rows" line="Nothing was changed. Try again in a moment." retryHref={routes.vendorDashboard.shop.store.shelf(shelf)} /> : null}
      {shelf === 'tools' ? (
        <ToolsShelf d={d} />
      ) : isWidgetShelf(shelf) ? (
        <WidgetShelfList d={d} shelf={shelf} />
      ) : shelf === 'payment_plans' || shelf === 'availability' ? (
        <TemplateShelf d={d} of={shelf === 'payment_plans' ? 'pay' : 'av'} />
      ) : shelf === 'qr' ? (
        <QrShelf d={d} />
      ) : shelf === 'yours' ? (
        <YourWidgets d={d} />
      ) : shelf === 'graphs' ? (
        <GraphsShelf d={d} />
      ) : (
        <BadgesShelf d={d} />
      )}
      <p hidden data-store-none="" className="py-6 text-center text-sn-lg text-[color:var(--m-slate-2)]">
        Nothing here matches that.
      </p>
      {shelf === 'tools' ? (
        <StoreThumb
          name="tools"
          placeholder="Search widgets"
          countWord="widget"
          shows={[
            { key: 'all', label: 'All' },
            { key: 'yours', label: 'Yours' },
            { key: 'free', label: 'Free' },
            { key: 'paid', label: 'One-time' },
          ]}
        />
      ) : isWidgetShelf(shelf) || shelf === 'yours' ? (
        <StoreThumb name={shelf} placeholder="Search widgets" countWord="widget" />
      ) : shelf === 'payment_plans' || shelf === 'availability' ? (
        <StoreThumb name={shelf} placeholder={shelf === 'payment_plans' ? 'Search payment plans' : 'Search availability'} countWord="template" />
      ) : shelf === 'qr' ? (
        <StoreThumb name="qr" placeholder="Search QR designs" countWord="QR design" />
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

/** One item: a widget (price or state, the strip, what it adds, one button), a graph, or a QR design. */
export function StoreItemScreen({ shelf, itemKey, d }: { shelf: 'tools' | 'graphs' | 'qr' | 'payment_plans' | 'availability'; itemKey: string; d: StoreData }) {
  if (shelf === 'payment_plans' || shelf === 'availability') return <TemplateItem d={d} of={shelf === 'payment_plans' ? 'pay' : 'av'} templateKey={itemKey} />;
  if (shelf === 'qr') return <QrItem d={d} qrKey={itemKey as PromoteQrMode} />;
  return shelf === 'tools' ? <ToolItem d={d} toolKey={itemKey} /> : <GraphItem d={d} graphKey={itemKey} />;
}

function subLine(shelf: StoreShelf, d: StoreData): string {
  if (shelf === 'tools') return `${storeToolRows(d.tools).length} widgets`;
  if (shelf === 'yours') return d.layout === null ? 'Couldn’t load which are installed.' : `${yourTools(d.tools).filter((r) => r.installed).length} installed`;
  if (shelf === 'graphs') return `${CARD_ORDER.length} graphs, all free. ${d.on.length} ${d.on.length === 1 ? 'is' : 'are'} on your Analytics.`;
  if (shelf === 'badges') return 'Earned, never sold. Pick the badges that show on your Shop.';
  if (shelf === 'payment_plans') return 'Ready-made ways to split a payment. Change any part.';
  if (shelf === 'availability') return 'Ready-made ways your cards book. Change any of it.';
  return SHELF_LINE[shelf];
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
      <ToolGroup label="More widgets" rows={more} yours={keys} data="store-more" />
    </>
  );
}

/** A widget shelf (Chat · Present · Event Hub · Shop page): its widgets as a list, each with its one press. */
function WidgetShelfList({ d, shelf }: { d: StoreData; shelf: ToolkitShelf }) {
  const rows = storeToolRows(d.tools).filter((r) => (r.tool.shelves as readonly string[]).includes(shelf));
  return <ToolGroup label={SHELF_TITLE[shelf]} rows={rows} yours={yourToolKeys(d)} data={`store-${shelf}`} />;
}

/** The QR designs (v19): the four codes Promote draws. My page is built in; the rest Install / ✓ Installed. */
function QrShelf({ d }: { d: StoreData }) {
  const on = installedQrs(d.layout);
  return (
    <ToolSection label="Your QR codes" count={PROMOTE_QR_MODES.length} data="store-qr">
      <div data-store-block="">
        <div data-store-list="">
          <TemplateRows label="Your QR codes">
            {PROMOTE_QR_MODES.map((k) => {
              const w = qrWords(k);
              const installed = on.includes(k);
              return (
                <ToolRow
                  key={k}
                  attrs={{ 'data-store-row': '', 'data-store-name': w.name, 'data-store-show': installed ? 'k-qr installed' : 'k-qr', 'data-store-qr': k }}
                  lead={<QrArt />}
                  title={
                    <Link href={routes.vendorDashboard.shop.store.item('qr', k)} className="hover:underline">
                      {w.name}
                    </Link>
                  }
                  lines={[w.line, isBuiltInQr(k) ? 'Built in' : 'Free']}
                  right={
                    installed ? (
                      <OnPage />
                    ) : d.layout === null ? (
                      <ToolChip tone="wait">Couldn’t load</ToolChip>
                    ) : (
                      <StoreOp op="layout" fields={{ row: 'qrs', intent: 'add', key: [...on, k] }} tone="info" icon={<Plus aria-hidden strokeWidth={2} />} label={INSTALL_WORD} />
                    )
                  }
                />
              );
            })}
          </TemplateRows>
        </div>
      </div>
    </ToolSection>
  );
}

/**
 * 🧩 YOUR WIDGETS (v19, the manager — "like an extensions page"): every widget the shop has installed, as a card —
 * where it is used, then Open · How to use it · Remove (a built-in has no Remove). Chips by place: All · Chat · Present ·
 * Event Hub · Shop page (a place no installed widget uses has no chip).
 */
function YourWidgets({ d }: { d: StoreData }) {
  if (d.layout === null) return <ToolFail title="Couldn’t load your widgets" line="Nothing was changed." retryHref={routes.vendorDashboard.shop.store.shelf('yours')} />;
  const rows = yourTools(d.tools).filter((r) => r.installed);
  const keys = rows.map((r) => r.tool.key);
  const places = (['chat', 'present', 'hub', 'shop_page'] as const).filter((p) => rows.some((r) => r.tool.shelves.includes(p)));
  if (rows.length === 0) {
    return (
      <ToolSection label={SHELF_TITLE.yours} data="store-yours-list">
        <ToolEmpty>No widgets installed yet. Install one from the Toolkit.</ToolEmpty>
      </ToolSection>
    );
  }
  return (
    <>
      <StoreChips label="Show widgets used in" chips={[{ key: 'all', label: 'All' }, ...places.map((p) => ({ key: `p-${p}`, label: WIDGET_SHELF_WORD[p] }))]} />
      <div data-store-block="">
        <ul className="mt-2 grid gap-2 lg:grid-cols-3" data-store-list="" data-store-yours-list="">
          {rows.map((r) => {
            const k = r.tool.key;
            const paid = isPaidStoreTool(k);
            return (
              <li key={k} className={`sn-frame flex flex-col gap-2 p-4${r.act.kind === 'no_card' ? ' opacity-60' : ''}`} data-store-row="" data-store-name={r.tool.title} data-store-show={toolShowTags(r)} data-store-yours={k} data-store-no-card={r.act.kind === 'no_card' ? '' : undefined}>
                <span className="flex items-start gap-3">
                  <ToolArt toolKey={k} />
                  <span className="min-w-0 flex-1">
                    <b className="block text-sn-lg font-semibold leading-tight text-ink">{r.tool.title}</b>
                    <span className="block text-sn-md leading-snug text-[color:var(--m-slate-2)]">{r.tool.line}</span>
                    <span className="mt-1 block text-sn-sm font-semibold text-[color:var(--m-slate-2)]" data-store-yours-places="">
                      {r.tool.shelves.map((p) => WIDGET_SHELF_WORD[p]).join(' · ')}
                      {r.act.kind === 'resubscribe' ? ` · ${PAID_WIDGET_RESUBSCRIBE_WORDS}` : r.act.kind === 'no_card' ? ` · ${noCardWords(r.act.category)}` : ''}
                    </span>
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {r.act.kind === 'no_card' ? (
                    // 🟢 No online card serves it (3a2419fd): the door turns a card on, in place of Open.
                    <ActionButton tone="info" icon={<Layers aria-hidden strokeWidth={1.8} />} label="Your services" href={routes.vendorDashboard.services()} />
                  ) : (
                    <ActionButton tone="info" icon={<ArrowUpRight aria-hidden strokeWidth={2} />} label="Open" href={toolOpenHref(k)} />
                  )}
                  <ActionButton tone="neutral" quiet icon={<BookOpen aria-hidden strokeWidth={1.8} />} label="How to use it" href={`${routes.vendorDashboard.shop.store.item('tools', k)}#guide`} />
                  {isBuiltInWidget(k) ? (
                    <ToolChip tone="quiet">Built in</ToolChip>
                  ) : (
                    <StoreOp
                      op="layout"
                      fields={{ row: 'tools', intent: 'remove', key: keys.filter((x) => x !== k), off: paid ? [k] : [] }}
                      tone="neutral"
                      quiet
                      icon={<MinusCircle aria-hidden strokeWidth={1.8} />}
                      label="Remove"
                    />
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
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
        <GraphBlock label={INSTALLED_WORD} items={d.on.map((k) => ({ k, status: { kind: 'on' } }))} d={d} data="store-on" />
      ) : (
        <ToolSection label={INSTALLED_WORD} data="store-on">
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
      <ToolSection label={INSTALLED_WORD} count={on.length} data="store-badges-on">
        <div data-store-block="">
          <div data-store-list="">
            {on.length > 0 ? (
              <TemplateRows label={INSTALLED_WORD}>
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
              <ToolEmpty>No badges on your Shop. Install one below.</ToolEmpty>
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
                      <StoreOp op="layout" fields={{ row: 'badges', intent: 'add', key: [...followed.keys, t.key] }} tone="info" icon={<Plus aria-hidden strokeWidth={2} />} label={INSTALL_WORD} />
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
  const tile = { icon: <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />, title: 'A tile in Your widgets', line };
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
  // 🟢 The card gate's row (3a2419fd): a widget no online card serves reads "Turn on a <category> card to use it".
  const row = toolRowFor(tool.key, d.tools);
  const s = row ? row.status : toolStatus(tool.key, d.tools);
  const installed = row ? row.installed : toolIsInstalled(tool.key, s, d.tools);
  const a = row ? row.act : toolAct(tool.key, s, installed);
  const paid = isPaidStoreTool(tool.key);
  const keys = yourToolKeys(d);
  const tags = row ? row.tags : toolTags(tool, d.tools.hubOverrides);
  const head =
    s.kind === 'buy' ? (
      <>
        <b className="block text-sn-3xl font-bold leading-tight text-ink" data-store-price="">
          {php(s.price)} <span className="text-sn-lg font-semibold text-[color:var(--m-slate-2)]">one-time</span>
        </b>
        <span className="mt-1 block text-sn-base text-[color:var(--m-slate-2)]">Yours forever. No renewal.</span>
        {/* 🧰 Before payment (owner a02673ac): a bought widget works only on a paid plan — said on every price. */}
        <span className="mt-1 block text-sn-base font-semibold text-ink" data-store-needs-plan="">
          {PAID_WIDGET_NEEDS_PLAN_WORDS}.
        </span>
      </>
    ) : (
      <b className={`block text-sn-xl font-semibold ${s.kind === 'unread' ? 'text-[rgb(var(--color-warn))]' : 'text-ink'}`} data-store-state={a.kind}>
        {a.kind === 'installed' ? (a.builtIn ? 'Built in · always on your shop' : paid ? 'Owned · paid once' : 'Free') : a.kind === 'install' ? (a.owned ? 'Owned · paid once' : 'Free') : toolFootWords(s, php)}
      </b>
    );
  // 🧩 Toolkit v19: one word for the act — Install · Buy ₱… · ✓ Installed (with Remove, never on a built-in).
  const button =
    a.kind === 'installed' ? (
      <span className="flex flex-wrap items-center gap-3" data-store-installed="">
        <OnPage />
        {a.builtIn ? null : keys === null ? (
          <ToolChip tone="wait">Couldn’t load</ToolChip>
        ) : (
          <StoreOp
            op="layout"
            fields={{ row: 'tools', intent: 'remove', key: keys.filter((k) => k !== tool.key), off: paid ? [tool.key] : [] }}
            tone="neutral"
            icon={<MinusCircle aria-hidden strokeWidth={1.8} />}
            label="Remove"
          />
        )}
      </span>
    ) : a.kind === 'no_card' ? (
      // 🟢 No online card serves it: kept (installed stays installed, bought stays owned) — the door turns a card on.
      <span className="flex flex-wrap items-center gap-3" data-store-no-card="">
        <ActionButton tone="brand" main icon={<Layers aria-hidden strokeWidth={1.8} />} label="Your services" href={routes.vendorDashboard.services()} />
        {a.installed && keys !== null ? (
          <StoreOp
            op="layout"
            fields={{ row: 'tools', intent: 'remove', key: keys.filter((k) => k !== tool.key), off: paid ? [tool.key] : [] }}
            tone="neutral"
            icon={<MinusCircle aria-hidden strokeWidth={1.8} />}
            label="Remove"
          />
        ) : null}
      </span>
    ) : a.kind === 'install' && keys === null ? (
      <ToolChip tone="wait">Couldn’t load</ToolChip>
    ) : a.kind === 'install' ? (
      // Free, or owned and taken off the page (Install again is free).
      <StoreOp
        op="layout"
        fields={{ row: 'tools', intent: 'add', key: [...(keys ?? []), tool.key] }}
        tone="brand"
        main
        icon={<Plus aria-hidden strokeWidth={2} />}
        label={INSTALL_WORD}
        landTo={`${routes.vendorDashboard.shop.index()}?added=${encodeURIComponent(`tool:${tool.key}`)}#tools`}
      />
    ) : a.kind === 'verify' ? (
      <ActionButton tone="brand" main icon={<BadgeCheck aria-hidden strokeWidth={1.8} />} label="Get Verified" href={routes.vendorDashboard.verify()} className="w-full" />
    ) : a.kind === 'resubscribe' || (a.kind === 'buy' && a.needsPlan) ? (
      // 🧰 Owner a02673ac: owned on Free or Verified → the plans door, never a second Buy; not owned on Free or Verified →
      // the price and the notice show above, and the button is the plans door. Web-only like every plan door.
      <span className="contents" data-web-only="">
        <ActionButton tone="brand" main icon={<Sparkles aria-hidden strokeWidth={1.8} />} label="See plans" href={routes.vendorDashboard.subscription()} className="w-full" />
      </span>
    ) : a.kind === 'buy' ? (
      // 🍎 Buying is web-only: the iPhone app's shell hides the press (Apple's rules — `lib/store-shell.ts`).
      <span className="contents" data-web-only="">
        <StoreOp op="buy" fields={{ tool: tool.key }} tone="brand" main icon={<ShoppingBag aria-hidden strokeWidth={1.8} />} label={buyWords(a.price, php)} />
      </span>
    ) : a.kind === 'pending' ? (
      <ToolChip tone="wait">Payment in review</ToolChip>
    ) : a.kind === 'no_price' ? (
      <ToolChip tone="quiet">Price not set yet</ToolChip>
    ) : (
      <ToolFail title="Couldn’t load this widget" line="You have not been charged." retryHref={routes.vendorDashboard.shop.store.item('tools', tool.key)} />
    );
  return (
    <>
      <ToolPin route="/vendor-dashboard/shop/store/[shelf]/[item]" title={tool.title} sub={<ItemSub line={tool.line} d={d} />} />
      <BackToShelf shelf="tools" />
      {/* 🎞 The widget's clip at the top (owner 4c07edd7): set-up, then where it shows. Nothing while it is not recorded. */}
      {paid ? <ToolVideo src={toolVideoSrc(tool.key)} title={tool.title} /> : null}
      <div data-store-item-tags="">
        <TagChips tags={tags} max={6} />
      </div>
      <Card data="tool-head">
        <div className="flex items-start gap-3">
          <ToolArt toolKey={tool.key} />
          <div className="min-w-0">{head}</div>
        </div>
      </Card>
      <div className="mt-4 flex [&>*]:w-full" data-store-buy="">
        {button}
      </div>
      <ItemStrip cells={[{ k: 'Price', v: priceWord(s) }, { k: 'Works in', v: tool.shelves.map((p) => WIDGET_SHELF_WORD[p]).join(' · ') }, { k: 'For', v: forWord(tags) }]} />
      <ToolSection label="What it adds to your shop" data="store-adds">
        <ul className="sn-frame px-4 py-1">
          {addsOf(tool.key, tool.line).map((x) => (
            <Line key={x.title} {...x} />
          ))}
          {!paid ? <Line icon={<Plus aria-hidden className="h-4 w-4" strokeWidth={2} />} title="Free forever" line="Every free widget is yours to keep." /> : null}
        </ul>
      </ToolSection>
      {/* 📍 Where it works (v19): each place with an Open to its home, in every state. */}
      <ToolSection label="Where it works" data="store-where">
        <ul className="sn-frame px-4 py-1">
          {widgetPlaces(tool).map((p) => (
            <li key={p.key} className="flex items-center gap-3 py-2.5" data-store-place={p.key}>
              <span className="min-w-0 flex-1">
                <b className="block text-sn-lg font-semibold leading-tight text-ink">{p.place}</b>
                <span className="block text-sn-md leading-snug text-[color:var(--m-slate-2)]">{p.line}</span>
              </span>
              <Link href={p.href} className="sn-press inline-flex min-h-11 flex-none items-center gap-0.5 text-sn-base font-semibold text-[rgb(var(--color-link))]" data-store-place-open={p.key}>
                Open
                <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
              </Link>
            </li>
          ))}
        </ul>
      </ToolSection>
      {/* 📘 How to use it — the widget's guide (owner 23 Nov, "guides only"). `#guide` is its address: the tool's panel
          in Your tools opens it here. */}
      <div id="guide" className="scroll-mt-20">
        <ToolSection label="How to use it" data="store-guide">
          <WidgetGuideSteps guide={WIDGET_GUIDES[tool.key]} />
        </ToolSection>
      </div>
      <ToolSection label="Information" data="store-info">
        <InfoTable
          rows={[
            { k: 'Price', v: s.kind === 'buy' ? `${php(s.price)} one-time` : priceWord(s) },
            { k: 'Renewal', v: paid ? 'None — paid once' : 'None — free' },
            { k: 'Suggested for', v: tags.length ? tags.map((t) => t.label).join(', ') : forWord(tags) },
            ...(statusWord(a) ? [{ k: 'Status', v: statusWord(a)! }] : []),
          ]}
        />
      </ToolSection>
    </>
  );
}

/** The strip under an item's button (v19): three short facts side by side. */
function ItemStrip({ cells }: { cells: readonly { k: string; v: string }[] }) {
  return (
    <dl className="sn-frame mt-4 grid grid-cols-3 divide-x divide-[color:var(--sn-hair)] py-3 text-center" data-store-strip="">
      {cells.map((c) => (
        <div key={c.k} className="min-w-0 px-2">
          <dt className="text-sn-sm font-semibold uppercase tracking-wide text-[color:var(--m-slate-2)]">{c.k}</dt>
          <dd className="mt-0.5 truncate text-sn-base font-semibold text-ink">{c.v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** An item's Information table (v19). */
function InfoTable({ rows }: { rows: readonly { k: string; v: string }[] }) {
  return (
    <dl className="sn-frame grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 p-4 text-sn-base" data-store-info="">
      {rows.map((r) => (
        <div key={r.k} className="contents">
          <dt className="font-semibold text-ink">{r.k}</dt>
          <dd className="text-[color:var(--m-slate-2)]">{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The price in one or two words — the catalog's (never typed), or the state; a failed read says so, never ₱0. */
function priceWord(s: ReturnType<typeof toolStatus>): string {
  if (s.kind === 'no_card') return priceWord(s.prior);
  if (s.kind === 'buy') return php(s.price);
  if (s.kind === 'owned' || s.kind === 'resubscribe') return 'Owned';
  if (s.kind === 'free' || s.kind === 'verify') return 'Free';
  if (s.kind === 'pending') return 'In review';
  if (s.kind === 'no_price') return 'Not set yet';
  return 'Couldn’t load';
}

/** Who it suits: the first tag (and how many more), or — a widget with no tag — any shop (tags suggest, never gate). */
function forWord(tags: readonly { label: string }[]): string {
  const [first] = tags;
  if (!first) return 'Any shop';
  return tags.length === 1 ? first.label : `${first.label} +${tags.length - 1}`;
}

/** The Status row: said only for an item the shop holds — installed, owned and taken off, or locked off-plan. */
function statusWord(a: ReturnType<typeof toolAct>): string | null {
  if (a.kind === 'installed') return a.builtIn ? 'Built in · always installed' : INSTALLED_WORD;
  if (a.kind === 'install' && a.owned) return 'Owned · taken off your page. Install again is free.';
  if (a.kind === 'resubscribe') return PAID_WIDGET_RESUBSCRIBE_WORDS;
  if (a.kind === 'no_card') return noCardWords(a.category);
  return null;
}

/** A QR design's page (v19): what it opens, Install or ✓ Installed with Remove (My page is built in), Where it works. */
function QrItem({ d, qrKey }: { d: StoreData; qrKey: PromoteQrMode }) {
  const w = MY_QR_WORDS[qrKey];
  const on = installedQrs(d.layout);
  const installed = on.includes(qrKey);
  const builtIn = isBuiltInQr(qrKey);
  const button =
    d.layout === null ? (
      <ToolChip tone="wait">Couldn’t load</ToolChip>
    ) : installed ? (
      <span className="flex flex-wrap items-center gap-3" data-store-installed="">
        <OnPage />
        {builtIn ? null : (
          <StoreOp op="layout" fields={{ row: 'qrs', intent: 'remove', key: on.filter((k) => k !== qrKey) }} tone="neutral" icon={<MinusCircle aria-hidden strokeWidth={1.8} />} label="Remove" />
        )}
      </span>
    ) : (
      <StoreOp op="layout" fields={{ row: 'qrs', intent: 'add', key: [...on, qrKey] }} tone="brand" main icon={<Plus aria-hidden strokeWidth={2} />} label={INSTALL_WORD} landTo={supplierQrHref(qrKey)} />
    );
  return (
    <>
      <ToolPin route="/vendor-dashboard/shop/store/[shelf]/[item]" title={w.name} sub={<ItemSub line={w.line} d={d} />} />
      <BackToShelf shelf="qr" />
      <Card data="qr-head">
        <div className="flex items-start gap-3">
          <QrArt />
          <b className="block text-sn-xl font-semibold text-ink" data-store-state={installed ? 'installed' : 'install'}>
            {builtIn ? 'Built in · always on your shop' : 'Free'}
          </b>
        </div>
      </Card>
      <div className="mt-4 flex [&>*]:w-full" data-store-buy="">
        {button}
      </div>
      <ItemStrip cells={[{ k: 'Price', v: 'Free' }, { k: 'Works in', v: 'My QRs' }, { k: 'For', v: 'Any shop' }]} />
      <ToolSection label="What it does" data="store-shows">
        <Card>
          <p className="text-sn-lg leading-snug text-ink">{w.sheetLine}</p>
        </Card>
      </ToolSection>
      <ToolSection label="Where it works" data="store-where">
        <ul className="sn-frame px-4 py-1">
          <li className="flex items-center gap-3 py-2.5" data-store-place="my-qrs">
            <span className="min-w-0 flex-1">
              <b className="block text-sn-lg font-semibold leading-tight text-ink">My QRs</b>
              <span className="block text-sn-md leading-snug text-[color:var(--m-slate-2)]">Shop › My QRs, with your other codes — print it or share it</span>
            </span>
            <Link href={supplierQrHref(qrKey)} className="sn-press inline-flex min-h-11 flex-none items-center gap-0.5 text-sn-base font-semibold text-[rgb(var(--color-link))]" data-store-place-open="my-qrs">
              Open
              <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
            </Link>
          </li>
        </ul>
      </ToolSection>
      <ToolSection label="Information" data="store-info">
        <InfoTable rows={[{ k: 'Price', v: 'Free' }, { k: 'Renewal', v: 'None — free' }, { k: 'Status', v: d.layout === null ? 'Couldn’t load' : builtIn ? 'Built in · always installed' : installed ? INSTALLED_WORD : 'Not on your My QRs' }]} />
      </ToolSection>
    </>
  );
}

/** An item page's masthead line: what it is, then the Toolkit's live count (owner 5ae3fbb2; a failed read drops it). */
function ItemSub({ line, d }: { line: string; d: StoreData }) {
  const count = toolkitCountWords(toolkitCounts(listFacts(d)));
  return (
    <span data-store-sub="">
      {line}
      {count ? (
        <span className="block" data-toolkit-count="">
          {count}
        </span>
      ) : null}
    </span>
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
        {graphLockedLine(status.badgeName)}
        {status.toGo ? ` · ${status.toGo}` : ''}
      </p>
    ) : d.layout === null ? (
      <ToolChip tone="wait">Couldn’t load</ToolChip>
    ) : status.kind === 'on' ? (
      <span className="flex flex-wrap items-center gap-3" data-store-installed="">
        <OnPage />
        <StoreOp
          op="layout"
          fields={{ row: 'graphs', intent: 'remove', key: d.on.filter((k) => k !== graphKey) }}
          tone="neutral"
          icon={<MinusCircle aria-hidden strokeWidth={1.8} />}
          label="Remove"
        />
      </span>
    ) : (
      <StoreOp
        op="layout"
        fields={{ row: 'graphs', intent: 'add', key: [...d.on, graphKey] }}
        tone="brand"
        main
        icon={<Plus aria-hidden strokeWidth={2} />}
        label={INSTALL_WORD}
        landTo={`${routes.vendorDashboard.shop.index()}?added=${encodeURIComponent(`graph:${graphKey}`)}#analytics`}
      />
    );
  return (
    <>
      <ToolPin route="/vendor-dashboard/shop/store/[shelf]/[item]" title={g.title} sub={<ItemSub line={g.asks} d={d} />} />
      <BackToShelf shelf="graphs" />
      <ToolSection label="What it shows" data="store-shows">
        <Card>
          <p className="text-sn-lg leading-snug text-ink">{g.asks}</p>
          <p className="mt-1 text-sn-base text-[color:var(--m-slate-2)]">{g.counts}.</p>
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
function BackToShelf({ shelf }: { shelf: 'tools' | 'graphs' | 'qr' | 'payment_plans' | 'availability' }) {
  return (
    <Link href={routes.vendorDashboard.shop.store.shelf(shelf)} className="sn-press inline-flex min-h-11 items-center text-sn-base font-semibold text-[rgb(var(--color-link))]" data-store-shelf-back={shelf}>
      All {SHELF_TITLE[shelf]}
      <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
    </Link>
  );
}

// ── 🧩 TEMPLATES (Toolkit templates drawing, specs 24dcf90c: frames 1 · 1b · 2 · 3) ─────────────────────────────

/** Shop › Payment plans — the shop's saved plans (Payment Strategies), opened on the Shop. */
const SAVED_PLANS_HREF = `${routes.vendorDashboard.shop.index()}?maker=templates&tpl=plans`;

/** A template shelf (frames 1 · 1b · 3): "For your services" first, then More; Get / ✓ Installed on each. */
function TemplateShelf({ d, of }: { d: StoreData; of: TemplateKind }) {
  const rows = templateRows(d, of);
  const forYou = rows.filter((r) => r.forYou);
  const more = rows.filter((r) => !r.forYou);
  const group = (label: string, list: readonly StoreTemplateRow[], data: string) =>
    list.length === 0 ? null : (
      <ToolSection label={label} count={list.length} data={data}>
        <div data-store-block="">
          <div data-store-list="">
            <TemplateRows label={label}>
              {list.map((r) => (
                <TemplateShelfRow key={r.t.key} row={r} />
              ))}
            </TemplateRows>
          </div>
        </div>
      </ToolSection>
    );
  return (
    <>
      {d.plans.status === 'unread' && of === 'pay' ? (
        <ToolFail title="Couldn’t read your saved payment plans" line="Which ones are installed may show as not yet. Nothing was changed." retryHref={routes.vendorDashboard.shop.store.shelf('payment_plans')} data="store-plans" />
      ) : null}
      {templatesGreyed(d.tools.cards) ? (
        <ToolFail title="None of your service cards is online" line={`${NO_ONLINE_CARD_WORDS} Nothing you installed is lost.`} retryHref={routes.vendorDashboard.services()} data="store-templates-offline" />
      ) : null}
      {group('For your services', forYou, 'templates-for-you')}
      {group(forYou.length > 0 ? 'More' : SHELF_TITLE[of === 'pay' ? 'payment_plans' : 'availability'], more, 'templates-more')}
    </>
  );
}

/** One template's page (frame 2 · frame 3): what it is, Install (or ✓ Installed + Remove), the plan editor once
 *  installed, What is inside, Where it works and How to use it. Free: no price cell (owner, prices only on plan-only items). */
function TemplateItem({ d, of, templateKey }: { d: StoreData; of: TemplateKind; templateKey: string }) {
  const shelf = of === 'pay' ? 'payment_plans' : 'availability';
  const row = templateRows(d, of).find((r) => r.t.key === templateKey) ?? null;
  const pay = of === 'pay' ? payTemplateOf(templateKey) : null;
  const av = of === 'av' ? avTemplateOf(templateKey) : null;
  const t = pay ?? av;
  if (!t) return null;
  const installed = row?.installed ?? false;
  const planId = d.layout?.templates.pay[templateKey] ?? null;
  const plan = pay && planId && d.plans.status === 'ok' ? (d.plans.plans.find((p) => p.id === planId) ?? null) : null;
  const cardCount = plan?.cardCount ?? 0;
  const firstFor = t.forCategories[0] ?? 'Any service';
  const forWords = t.forCategories.length > 1 ? `${firstFor} +${formatCount(t.forCategories.length - 1)} more` : firstFor;
  // The plan as the shop now has it (it may have changed parts since Install), else the template's own parts.
  const savedParts = plan
    ? (planItemsToDrafts(plan.items) ?? []).map((x) => ({ label: x.label, pct: x.percent ?? 0, anchor: x.due_anchor ?? ('before_event' as const), days: x.due_offset_days ?? 0 }))
    : null;
  const parts = savedParts ?? pay?.parts ?? [];
  const button =
    row === null ? (
      <ToolChip tone="quiet">{NO_ONLINE_CARD_WORDS}</ToolChip>
    ) : row.installed === null ? (
      <ToolChip tone="wait">Couldn’t load</ToolChip>
    ) : installed ? (
      <span className="flex flex-wrap items-center gap-3" data-store-installed="">
        <OnPage />
        <TemplateRemove of={of} templateKey={templateKey} name={t.name} cardCount={cardCount} />
        {pay ? (
          <span className="text-sn-base text-[color:var(--m-slate-2)]" data-template-cards={cardCount}>
            {cardCount > 0 ? `Used on ${formatCount(cardCount)} service ${cardCount === 1 ? 'card' : 'cards'}` : 'Not on a card yet'}
          </span>
        ) : null}
      </span>
    ) : row.greyed ? (
      <ActionButton tone="info" icon={<Layers aria-hidden strokeWidth={1.8} />} label="Your services" href={routes.vendorDashboard.services()} />
    ) : (
      <StoreOp op="template" fields={{ of, key: templateKey, act: 'install' }} tone="brand" main icon={<Plus aria-hidden strokeWidth={2} />} label={INSTALL_WORD} />
    );
  return (
    <>
      <ToolPin
        route="/vendor-dashboard/shop/store/[shelf]/[item]"
        title={t.name}
        sub={<ItemSub line={pay ? pay.line : `${av ? avInside(av)[0]?.value : ''} · how a card books`} d={d} />}
      />
      <BackToShelf shelf={shelf} />
      <Card data="template-head">
        <p className="text-sn-base">
          <KindWord of={of} />
        </p>
        {pay ? (
          <div className="mt-2">
            <PlanBar parts={parts} />
          </div>
        ) : null}
        <b className="mt-2 block text-sn-xl font-semibold text-ink" data-store-state={installed ? 'installed' : 'install'}>
          {installed ? 'Installed · yours to change' : 'Install · yours to change'}
        </b>
      </Card>
      <div className="mt-4 flex [&>*]:w-full" data-store-buy="">
        {button}
      </div>
      {pay ? (
        <ItemStrip
          cells={[
            { k: 'Parts', v: `${formatCount(parts.length)} · change any` },
            { k: 'First part', v: parts[0] ? `${formatCount(parts[0].pct)}% ${partDueWords(parts[0]).toLowerCase()}` : '—' },
            { k: 'For', v: forWords },
          ]}
        />
      ) : av ? (
        <ItemStrip cells={[{ k: 'Style', v: `${avInside(av)[0]?.value ?? ''}` }, { k: 'Where', v: 'Card maker' }, { k: 'For', v: forWords }]} />
      ) : null}
      {pay && installed && plan ? <TemplatePlanEditor key={plan.id + plan.name} templateKey={templateKey} name={plan.name} parts={parts} /> : null}
      <ToolSection label="What is inside" data="template-inside">
        <ul className="sn-frame px-4 py-1" data-template-inside="">
          {pay
            ? parts.map((x, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <b className="block text-sn-lg font-semibold leading-tight text-ink">{x.label}</b>
                    <span className="block text-sn-md text-[color:var(--m-slate-2)]">{partDueWords(x)}</span>
                  </span>
                  <b className="text-sn-lg font-semibold tabular-nums text-ink">{formatCount(x.pct)}%</b>
                </li>
              ))
            : av
              ? avInside(av).map((x) => (
                  <li key={x.name} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <b className="block text-sn-lg font-semibold leading-tight text-ink">{x.name}</b>
                      {x.line ? <span className="block text-sn-md text-[color:var(--m-slate-2)]">{x.line}</span> : null}
                    </span>
                    <b className="text-sn-lg font-semibold tabular-nums text-ink">{x.value}</b>
                  </li>
                ))
              : null}
        </ul>
      </ToolSection>
      <ToolSection label="Where it works" data="store-where">
        <ul className="sn-frame px-4 py-1">
          {(pay
            ? [
                { k: 'saved', title: 'Shop › Payment plans', line: installed ? 'In your saved plans' : 'It joins your saved plans, ready to use', href: SAVED_PLANS_HREF },
                { k: 'cards', title: 'Every service card', line: 'Pick it under Pay plan on any card', href: routes.vendorDashboard.services() },
              ]
            : [{ k: 'cards', title: 'Service cards › Availability', line: 'Pick it on any card, or on a new one', href: routes.vendorDashboard.services() }]
          ).map((w) => (
            <li key={w.k} className="flex items-center gap-3 py-2.5" data-store-place={w.k}>
              <span className="min-w-0 flex-1">
                <b className="block text-sn-lg font-semibold leading-tight text-ink">{w.title}</b>
                <span className="block text-sn-md leading-snug text-[color:var(--m-slate-2)]">{w.line}</span>
              </span>
              <Link href={w.href} className="sn-press inline-flex min-h-11 flex-none items-center gap-0.5 text-sn-base font-semibold text-[rgb(var(--color-link))]" data-store-place-open={w.k}>
                Open
                <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
              </Link>
            </li>
          ))}
        </ul>
      </ToolSection>
      <ToolSection label="How to use it" data="template-guide">
        <ol className="sn-frame space-y-3 p-4" data-template-guide="">
          {(pay
            ? [
                ['Tap Install', 'The plan opens in your payment plan maker, filled in.'],
                ['Change it, or keep it', 'Move any percent or due day. The parts must add up to 100%.'],
                ['Use it on a card', 'On a service card, pick it under Pay plan. Couples see each part in pesos, worked out from the card’s price.'],
              ]
            : [
                ['Tap Install', 'It joins your templates in the card maker.'],
                ['Open a service card', 'Under Availability, tap the template.'],
                ['Add your number', 'Type how many you can do. Save the card.'],
              ]
          ).map(([title, line], i) => (
            <li key={title} className="flex gap-3">
              <b className="w-5 flex-none text-sn-lg font-semibold tabular-nums text-[rgb(var(--color-link))]">{formatCount(i + 1)}</b>
              <span className="min-w-0">
                <b className="block text-sn-lg font-semibold leading-tight text-ink">{title}</b>
                <span className="block text-sn-md leading-snug text-[color:var(--m-slate-2)]">{line}</span>
              </span>
            </li>
          ))}
        </ol>
      </ToolSection>
    </>
  );
}

