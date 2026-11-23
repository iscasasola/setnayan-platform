'use client';

import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, BookOpen, CalendarDays, ClipboardList, FileText, Lock, Plus, ReceiptText, Tag, type LucideIcon } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { routes } from '@/lib/routes';
import { formatCount } from '@/lib/format-number';
import type { ScannerChoice } from '@/lib/supplier-scan';
import { onTheDayHref, specializedToolsFor, type SpecializedTool, type SpecializedToolKey } from '@/lib/specialized-tools';
import { toolIcon } from './specialized-tool-icon';
import { isBuiltInWidget, isPaidStoreTool } from '@/lib/supplier-store';
import { ArrangeEdit } from '@/app/vendor-dashboard/shop/store/_components/store-client';
import { BodyPanel } from '../../_components/body-panel';
import { ServiceScannerPick } from './service-scanner-pick';
import { LockExplainer } from '@/app/_components/lock/locked-feature';
import type { OfferMakerStart } from '../../offers/_components/offer-maker';
import { TemplatesOffersContext } from './shop-templates';
import { NewThingTile } from '@/app/_components/collection-card';

// 📦 The Offer Maker is its own chunk, fetched on the first open — never in the Shop tab's first load.
// 🎂 The Cake Maker's options editor — only fetched when its tile opens (none of it is in the Shop's first load).
const CakeMakerPanel = lazy(() => import('./cake-maker-panel').then((m) => ({ default: m.CakeMakerPanel })));
const OfferMaker = lazy(() => import('../../offers/_components/offer-maker').then((m) => ({ default: m.OfferMaker })));

/**
 * 🛠 SHOP › MAKERS — under Badges, above Services.
 *
 * Build 2 §10 #33 (owner 8 Nov: *"should share a single row… expand like pressing an event from clients… keep the navs
 * and just take up the body part"*): the Makers are ONE ROW OF TILES; a tile opens INTO THE BODY through the shared
 * in-body panel (`BodyPanel` — between the top bar and the bottom nav, both stay; 700 ms out of the tile; × shrinks it
 * back into the tile at the exact prior scroll). Pop-ups opened from inside (the Form Maker sheet) sit above it.
 *
 *   Forms Maker → C3's Form Maker, shop-wide (`ShopFormsMaker`: your forms · suggested · ＋ New form). Its reads are the
 *                 server's, drawn only while `?maker=forms` (`shop-forms-body.tsx`) — the Shop tab pays nothing for it.
 *   Specialized tools → (Build 3 Lane E item 13, owner 9 Nov: *"its main page needs to live inside a specialized tool
 *                 carousel under makers"* · *"our scanner will live inside the specialized tools"*) a CAROUSEL of doors
 *                 (`lib/specialized-tools.ts`): Scanner FIRST — one line per service with the SHIPPED
 *                 `ServiceScannerPick` (Off · Once · Ordered → Received · Unlimited · Group session · Roaming), no sixth
 *                 mode, no service the shop does not have — then the tiles the shop's categories suggest, then the rest.
 *                 Every tile OPEN to every shop (approved v3 change: no greyed tiles). Doors to shipped pages only — no
 *                 price, no lock, no "Make your own" (the Tools Maker does not exist yet; a tile with no door is not drawn).
 *   Offer Maker → (Build 6 Lane D, owner 9 Nov *"Offer maker"*; 11 Nov the off-season offer IS its "Event date in a
 *                 season") Shop › Offers RISES FULL SCREEN (`OfferMaker`, the shared RiseScreen — the bars step away). No
 *                 address change on open (its reads come with the open, `loadOfferMaker`); `?maker=offers` opens it on
 *                 arrival, and `&new=season&from=…&to=…` opens a new season offer on those days (Analytics' "Slow months").
 *                 🔒 An unverified shop sees the tile with its 🔒 and a tap shows the shared lock — Problem → Solution →
 *                 Get verified (`LockExplainer`); the server refuses it too (`offers/actions.ts`).
 *   Saved templates → (Card Maker part 4; HYBRID drawing, owner 17 Nov "Keep Templates") the third tile under the Templates
 *                 heading (#8027): ONE place for what a shop saves once and uses on many cards — Show ▾ Quick Forms (the
 *                 Forms Maker's body) · Discounts and Promos (the Offer Maker rises over it) · Payment Strategies (the saved
 *                 pay plans). Server-drawn while `?maker=templates`.
 * 🔒 shop/the-shop-tab-is-v113.test.ts · _components/the-body-panel-keeps-the-navs.test.ts · offers/the-offer-maker-is-the-prototype.test.ts
 */
export type ScannerLine = { coverageId: number; label: string; choice: ScannerChoice };

type MakerKey = 'forms' | 'offers' | 'templates';

/** 🧰 One tool in Your tools (Store drawing v10 F0). */
export type MyTool = { key: SpecializedToolKey };

/** The four Templates tiles (drawing v10 F0): Chat forms · Card forms · Offer maker · Payment plan. `tpl` = the
 *  Templates panel's starting kind. */
type TemplateTile = { id: 'chat_forms' | 'card_forms' | 'offers' | 'plans'; k: MakerKey; tpl?: 'forms' | 'plans'; title: string; sub: string; icon: LucideIcon; head: string };

/** The Offer Maker tile's facts — read with the Shop's own row. `running`/`total` null = unread ("Couldn't load"). */
export type OfferTileFacts = { verified: boolean; running: number | null; total: number | null; papers: string };

/** One booked day the per-event tools run on (the same days the Hub picks from — `collapseToPickerDays`). */
export type BookedDay = { eventId: string; eventName: string; bookedDate: string };

export function ShopMakers({
  scanners,
  formsBody,
  templatesBody = null,
  formsOn = true,
  formsSaved,
  categories = [],
  services = [],
  booked = null,
  offers = null,
  mine,
  addToolHref,
  plansSaved,
}: {
  /** One line per service; null = the scanner settings could not be read (said so, never "Off"). */
  scanners: ScannerLine[] | null;
  /** The Forms Maker's body, server-drawn while `?maker=forms`; null while closed (or still on its way). */
  formsBody: ReactNode | null;
  /** 🗂 The Saved templates body, server-drawn while `?maker=templates`; null while closed (or still on its way). Absent
   *  (the lab rows that predate it) = no Saved templates tile. */
  templatesBody?: ReactNode | null | false;
  /** The lab draws the row without the Forms tile's server body; the app always has the Forms Maker. */
  formsOn?: boolean;
  /** 📋 How many live forms the shop has saved — said on the tile ("3 saved" · "None yet"). null = unread ("Couldn't
   *  load", never "None yet"); absent = not measured here (the lab), the tile keeps its shipped line. */
  formsSaved?: number | null;
  /** The shop's service labels (the one taxonomy) — they decide which tools are SUGGESTED first, never which are open. */
  categories?: readonly string[];
  /** `vendor_profiles.services` — the music rule for the Song bank. */
  services?: readonly string[];
  /** Booked days today and ahead — where the per-event tools run. null = unread (said so, never "none"). */
  booked?: readonly BookedDay[] | null;
  /** 🏷 The Offer Maker tile (Build 6 Lane D). null = not drawn (the lab rows that predate it). */
  offers?: OfferTileFacts | null;
  /** 🧰 Your tools (Store drawing v10): the free tools the shop added and the paid ones it holds, in order
   *  (`yourTools`, lib/supplier-store.ts). Absent (the lab) = Scanner and the tools suggested for its services. */
  mine?: readonly MyTool[];
  /** The dashed "Add a tool" row — into the Store's Tools shelf. Absent = no row. */
  addToolHref?: string;
  /** 💳 How many payment plans the shop saved — the Payment plan tile's "2 saved". null = unread; absent = not read. */
  plansSaved?: number | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const inUrl = params.get('maker');
  const [open, setOpen] = useState<MakerKey | null>(
    inUrl === 'forms' ? 'forms' : inUrl === 'templates' && templatesBody !== false ? 'templates' : inUrl === 'offers' && offers?.verified ? 'offers' : null,
  );
  // Which Templates tile opened the panel (its rise starts there); on arrival, the address's kind.
  const [from, setFrom] = useState<TemplateTile['id']>(inUrl === 'templates' && params.get('tpl') === 'plans' ? 'plans' : inUrl === 'templates' ? 'card_forms' : 'chat_forms');
  const [lockOpen, setLockOpen] = useState(false);
  // 🗂 Saved templates › Discounts and Promos raises the shipped Offer Maker OVER the templates panel (× returns to it).
  const [offersOver, setOffersOver] = useState(false);
  const tiles = useRef<Partial<Record<TemplateTile['id'], HTMLButtonElement | null>>>({});
  const toolTiles = useRef<Partial<Record<SpecializedToolKey, HTMLButtonElement | null>>>({});
  const root = useRef<HTMLDivElement>(null);
  // 🌙 "Run an offer for [month]" (Analytics) lands here with the season's days: a NEW season offer opens on them.
  // 🃏 "Run an offer on [card]" lands with the card: a NEW offer opens with that card picked.
  const offerStart: OfferMakerStart =
    inUrl !== 'offers'
      ? null
      : params.get('new') === 'season'
        ? { who: 'season', part: 'pct', seasonFrom: params.get('from') ?? undefined, seasonTo: params.get('to') ?? undefined }
        : params.get('new') === 'card' && params.get('card')
          ? { part: 'pct', card: params.get('card')! }
          : null;
  const frame = useRef<HTMLElement | null>(null);
  useEffect(() => {
    frame.current = (root.current?.closest('[data-shop-tab],[data-shop-tab-lab]') as HTMLElement | null) ?? null;
  }, []);
  const tools = specializedToolsFor(categories, services);
  // 🧰 YOUR TOOLS: the shop's own, in its order; the lab (no `mine`) shows Scanner and the suggested ones.
  const myTools: MyTool[] = (
    mine ?? tools.filter(({ tool: t, suggested }) => t.key === 'scanner' || suggested).map(({ tool: t }) => ({ key: t.key }))
  ).filter((m) => tools.some(({ tool: t }) => t.key === m.key));
  // "Install" in the Toolkit lands here with `?added=tool:<key>` — that row wears New; `?tool=<key>` (Open) opens its panel.
  const addedTool = /^tool:(.+)$/.exec(params.get('added') ?? '')?.[1] ?? null;
  const askedTool = params.get('tool');
  // 🧰 Which tool's panel is open — none until a row is tapped, or the address's own tool (the Store's Open).
  const [tool, setTool] = useState<SpecializedToolKey | null>(() => (askedTool && myTools.some((m) => m.key === askedTool) ? (askedTool as SpecializedToolKey) : null));

  // Only the Forms Maker writes the address — its body is the server's (`?maker=forms`), so a reload lands on it too. The
  // Scanner's lines are already on the page: it opens with NO request (an address change would re-draw the whole Shop
  // on the server for nothing). Closing clears the address only if it carries a maker. The page never scrolls for it.
  const go = (k: MakerKey | null, tpl?: 'forms' | 'plans') => {
    setOpen(k);
    const writes = k === 'forms' || k === 'templates';
    if (!writes && !params.get('maker')) return;
    const q = new URLSearchParams(params.toString());
    if (writes) {
      q.set('maker', k);
      if (k === 'templates' && tpl) q.set('tpl', tpl);
      else q.delete('tpl');
    } else {
      q.delete('maker');
      for (const x of ['new', 'from', 'to', 'card', 'tpl']) q.delete(x);
    }
    const qs = q.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  // 📋 TEMPLATES — four tiles (drawing v10): Chat forms (the Forms Maker) · Card forms (Templates › Quick Forms) · Offer
  // maker · Payment plan (Templates › Payment Strategies). Each opens what it opened before.
  const hasTemplates = templatesBody !== false && templatesBody !== undefined;
  const list: TemplateTile[] = [
    ...(formsOn ? [{ id: 'chat_forms' as const, k: 'forms' as const, title: 'Chat forms', sub: formsSub(formsSaved), icon: ClipboardList, head: 'Sent to couples as a chat card' }] : []),
    ...(hasTemplates ? [{ id: 'card_forms' as const, k: 'templates' as const, tpl: 'forms' as const, title: 'Card forms', sub: 'Used on any card', icon: FileText, head: 'Saved once, used on any card' }] : []),
    ...(offers ? [{ id: 'offers' as const, k: 'offers' as const, title: 'Offer maker', sub: offersSub(offers), icon: Tag, head: 'Couples get the single best offer' }] : []),
    ...(hasTemplates ? [{ id: 'plans' as const, k: 'templates' as const, tpl: 'plans' as const, title: 'Payment plans', sub: savedSub(plansSaved), icon: ReceiptText, head: 'Saved once, used on any card' }] : []),
  ];
  const picked = tool ? (tools.find((t) => t.tool.key === tool)?.tool ?? null) : null;
  const PickedIcon = picked ? toolIcon(picked.key) : null;
  const cur = open ? (list.find((t) => t.id === from && t.k === open) ?? list.find((t) => t.k === open)) : undefined;

  return (
    <div ref={root} data-shop-makers-and-tools="">
      {/* 🧰 YOUR TOOLS (Store drawing `supplier_store_graphs_badges_2026-11-23` v10, F0 — owner 23 Nov 2026): the tools
          this shop uses, in its order — the free ones it added and the paid ones it holds (bought · with its plan). A row opens that tool into the body; "Add a tool" opens the Store's Tools shelf. */}
      <section aria-labelledby="shop-tools-h" data-specialized-tools="" data-your-tools="" id="tools" className="scroll-mt-24">
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-5">
          <span className="flex items-center gap-2">
            <h2 id="shop-tools-h" className="home-k2 !my-0">
              Your widgets
            </h2>
            <span className="rounded-full bg-[color:var(--surface-soft)] px-2 py-0.5 text-sn-sm font-semibold text-[color:var(--m-slate-2)]" aria-label={`${myTools.length} ${myTools.length === 1 ? 'widget' : 'widgets'}`} data-your-tools-count="">
              {formatCount(myTools.length)}
            </span>
          </span>
          {addToolHref ? (
            <ArrangeEdit
              row="tools"
              items={myTools.flatMap(({ key }) => {
                const t = tools.find((x) => x.tool.key === key)?.tool;
                if (!t) return [];
                const Icon = toolIcon(t.key);
                return [
                  {
                    key: t.key,
                    title: t.title,
                    sub: t.line,
                    paid: isPaidStoreTool(t.key),
                    builtIn: isBuiltInWidget(t.key),
                    art: (
                      <span className="grid h-11 w-11 place-items-center rounded-xl bg-[color:var(--surface-soft)] text-ink">
                        <Icon className="h-5 w-5" strokeWidth={1.75} />
                      </span>
                    ),
                  },
                ];
              })}
            />
          ) : null}
        </div>
        <ul className="sn-glide-x flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-tool-list="">
          {myTools.map(({ key }) => {
            const t = tools.find((x) => x.tool.key === key)!.tool;
            const Icon = toolIcon(t.key);
            const isNew = addedTool === t.key;
            return (
              <li key={t.key} className="w-[150px] flex-none snap-start" data-tool-row={t.key} data-tool-new={isNew ? '' : undefined}>
                <button
                  ref={(el) => {
                    toolTiles.current[t.key] = el;
                  }}
                  type="button"
                  onClick={() => setTool(t.key)}
                  aria-expanded={t.key === picked?.key}
                  aria-haspopup="dialog"
                  className="sn-press sn-frame flex h-full min-h-[128px] w-full flex-col items-start gap-1 p-3 text-left"
                  data-tool-tile={t.key}
                >
                  <span aria-hidden className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[color:var(--surface-soft)] text-ink">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <span className="mt-1 flex min-w-0 flex-col">
                    <b className="flex flex-wrap items-center gap-1.5 text-sn-lg font-semibold leading-tight text-ink">
                      {t.title}
                      {isNew ? <span className="rounded-full bg-[rgb(var(--color-link))] px-1.5 py-px text-sn-2xs font-bold text-[color:var(--m-paper)]">New</span> : null}
                    </b>
                    <span className="mt-0.5 line-clamp-2 text-sn-md leading-snug text-[color:var(--m-slate-2)]">{t.line}</span>
                  </span>
                </button>
              </li>
            );
          })}
          {addToolHref ? (
            <li className="w-[150px] flex-none snap-start">
              <NewThingTile layout="ghost" href={addToolHref} label="Add a widget" className="flex h-full min-h-[128px] flex-col items-start gap-2 p-3 text-sn-lg font-semibold text-ink" data-tool-add="">
                <span aria-hidden className="grid h-10 w-10 flex-none place-items-center rounded-full bg-[color:var(--surface-soft)] text-[color:var(--m-slate-2)]">
                  <Plus className="h-5 w-5" strokeWidth={2} />
                </span>
                Add a widget
              </NewThingTile>
            </li>
          ) : null}
        </ul>
      </section>

      {/* 📋 TEMPLATES — what a shop makes once and sends to couples (owner 19 Nov 2026; four tiles in the Store drawing). */}
      {list.length > 0 ? (
        <section aria-labelledby="shop-makers-h" data-shop-makers="" id="makers" className="scroll-mt-24">
          <div className="flex items-baseline justify-between gap-3 px-4 pb-2 pt-5">
            <h2 id="shop-makers-h" className="home-k2 !my-0">
              Templates
            </h2>
          </div>
          <ul className="sn-glide-x flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-maker-row="">
            {list.map((t) => (
              <li key={t.id} className="w-[150px] flex-none snap-start">
              <button
                ref={(el) => {
                  tiles.current[t.id] = el;
                }}
                type="button"
                onClick={() => {
                  setFrom(t.id);
                  if (t.k === 'offers' && offers && !offers.verified) setLockOpen(true);
                  else go(t.k, t.tpl);
                }}
                aria-expanded={open === t.k && from === t.id}
                aria-haspopup="dialog" // the Maker opens the in-body panel OVER the page (BodyPanel) — a popup surface, not an in-place fold
                className="sn-press sn-frame flex h-full min-h-[112px] w-full flex-col items-start gap-2 p-3 text-left"
                data-maker={t.k}
                data-template-tile={t.id}
              >
                <span aria-hidden className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[color:var(--surface-soft)] text-ink">
                  <t.icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </span>
                <span className="flex min-w-0 flex-col">
                  <b className="inline-flex items-center gap-1 text-sn-base font-semibold leading-tight text-ink">
                    {t.title}
                    {t.k === 'offers' && offers && !offers.verified ? <Lock aria-label="Locked" className="h-3.5 w-3.5 flex-none text-ink/70" strokeWidth={2} /> : null}
                  </b>
                  <small className="text-sn-sm leading-tight text-[color:var(--m-slate-2)]">{t.sub}</small>
                </span>
              </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(open === 'offers' || offersOver) && offers?.verified ? (
        <Suspense fallback={null}>
          <OfferMaker onClose={() => (offersOver ? setOffersOver(false) : go(null))} start={offersOver ? null : offerStart} />
        </Suspense>
      ) : null}
      {lockOpen && offers ? (
        <LockExplainer lock="offerMaker" need={{ kind: 'verify', progress: offers.papers }} preview={<OfferLockPreview />} onClose={() => setLockOpen(false)} />
      ) : null}

      {cur && cur.k !== 'offers' ? (
        <BodyPanel
          origin={tiles.current[cur.id] ?? null}
          frame={frame.current}
          title={cur.title}
          sub={cur.head}
          lead={
            <span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl bg-[color-mix(in_srgb,rgb(var(--sn-accent))_12%,transparent)] text-ink/75">
              <cur.icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
          }
          onClose={() => go(null)}
          data={`maker-${cur.k}`}
        >
          {cur.k === 'templates' ? (
            <TemplatesOffersContext.Provider
              value={offers ? { facts: offers, open: () => setOffersOver(true), locked: () => setLockOpen(true) } : null}
            >
              {templatesBody || (
                <p role="status" className="py-4 text-[13.5px] text-ink/70" data-shop-templates-loading="">
                  Opening your templates…
                </p>
              )}
            </TemplatesOffersContext.Provider>
          ) : (
            (formsBody ?? (
              <p role="status" className="py-4 text-[13.5px] text-ink/70" data-shop-forms-loading="">
                Opening your forms…
              </p>
            ))
          )}
        </BodyPanel>
      ) : null}

      {picked && PickedIcon ? (
        <BodyPanel
          origin={toolTiles.current[picked.key] ?? null}
          frame={frame.current}
          title={picked.title}
          sub={picked.door.kind === 'cake_tool' ? 'Set once for your shop' : picked.line}
          lead={
            <span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl bg-[color-mix(in_srgb,rgb(var(--sn-accent))_12%,transparent)] text-ink/75">
              <PickedIcon className="h-5 w-5" strokeWidth={1.75} />
            </span>
          }
          onClose={() => setTool(null)}
          data={`tool-${picked.key}`}
        >
          <ToolBody tool={picked} scanners={scanners} booked={booked} />
          {/* 📘 Every widget's guide, one door for all (owner 23 Nov, "guides only"): its Store page's How to use it. */}
          <div className="mt-4 grid">
            <ActionButton tone="neutral" icon={BookOpen} label="How to use it" href={`${routes.vendorDashboard.shop.store.item('tools', picked.key)}#guide`} data-tool-guide={picked.key} />
          </div>
        </BodyPanel>
      ) : null}
    </div>
  );
}

/** "2 saved" · "None yet" · "Couldn't load" (unread) · "Saved once" (not read here — the lab). */
function savedSub(n: number | null | undefined): string {
  if (n === undefined) return 'Saved once';
  if (n === null) return 'Couldn’t load';
  return n === 0 ? 'None yet' : `${formatCount(n)} saved`;
}

/** The Offer Maker tile's line: "2 running" · "None yet" · "Couldn't load" — or the lock's word. */
function offersSub(o: OfferTileFacts): string {
  if (!o.verified) return 'Get verified';
  if (o.running === null || o.total === null) return 'Couldn’t load';
  if (o.total === 0) return 'None yet';
  return `${formatCount(o.running)} of ${formatCount(o.total)} running`;
}

/** The lock's view-only preview: an offer row as it will read (the prototype's sample — words only, no money typed). */
function OfferLockPreview() {
  return (
    <div className="flex items-start gap-3" data-offer-lock-preview="">
      <span aria-hidden className="grid h-12 w-[60px] flex-none place-items-center rounded-xl text-xs font-bold uppercase" style={{ background: 'var(--m-sage)', color: 'var(--m-ink)' }}>
        % off
      </span>
      <span className="min-w-0">
        <b className="block text-[14.5px] font-semibold text-ink">Off-season offer</b>
        <small className="block text-[12.5px] text-ink/70">Events in your slow months · All cards · until switched off</small>
      </span>
    </div>
  );
}

/** Under the carousel: what the picked tile opens — the Scanner lines, its one page, or its booked events. */
function ToolBody({ tool, scanners, booked }: { tool: SpecializedTool; scanners: ScannerLine[] | null; booked: readonly BookedDay[] | null }) {
  if (tool.door.kind === 'scanner') {
    return (
      <div data-scanner-sheet="">
        <p className="pb-2 text-[13px] text-ink/70">Set once per service — every event booked for it starts with it. How each scan counts:</p>
        {scanners === null ? (
          <p role="status" className="py-3 text-[13.5px] text-ink/70">
            Couldn&rsquo;t load your scanners just now. Close and open this again.
          </p>
        ) : scanners.length === 0 ? (
          <p className="py-3 text-[13.5px] text-ink/70">Add a service first — each service has its own scanner.</p>
        ) : (
          <ul className="divide-y divide-ink/10">
            {scanners.map((s) => (
              <li key={s.coverageId} className="py-1" data-scanner-line={s.coverageId}>
                {/* The service this scanner belongs to — the shipped pick sat under its service row; here it says so. */}
                <p className="pt-2 text-[15px] font-medium text-ink">{s.label}</p>
                <ServiceScannerPick coverageId={s.coverageId} serviceLabel={s.label} initial={s.choice} />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  if (tool.door.kind === 'cake_tool') {
    return (
      <Suspense
        fallback={
          <p role="status" className="py-4 text-[13.5px] text-ink/70" data-cake-maker-loading="">
            Opening your Cake Maker…
          </p>
        }
      >
        <CakeMakerPanel />
      </Suspense>
    );
  }
  if (tool.door.kind === 'page') {
    return (
      <div className="space-y-3" data-tool-body={tool.key}>
        <p className="text-[13.5px] text-ink/70">{tool.line}.</p>
        {/* Design template rule 3: the shared pill button, not a hand-made one (full width, as the old one sat). */}
        <ActionButton
          tone="brand"
          icon={ArrowUpRight}
          label={`Open ${tool.title}`}
          href={tool.door.href}
          className="w-full !h-11"
          data-tool-open={tool.key}
        />
      </div>
    );
  }
  return (
    <div className="space-y-2" data-tool-body={tool.key}>
      <p className="text-[13.5px] text-ink/70">{tool.line} — it opens on the day of each booked event, from that event&rsquo;s screen.</p>
      {booked === null ? (
        <p role="status" className="py-2 text-[13.5px] text-ink/70">
          Couldn&rsquo;t load your booked events just now.
        </p>
      ) : booked.length === 0 ? (
        <p className="flex items-start gap-2 py-2 text-[13.5px] text-ink/70" data-tool-no-events="">
          <CalendarDays aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink/70" strokeWidth={1.9} />
          Runs on your booked events · it shows up here once a couple books you.
        </p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {booked.map((b) => (
            <li key={`${b.eventId}:${b.bookedDate}`}>
              <Link href={onTheDayHref(b.eventId)} className="sn-press flex min-h-14 items-center gap-3 py-2" data-tool-event={b.eventId}>
                <CalendarDays aria-hidden className="h-4 w-4 shrink-0 text-ink/70" strokeWidth={1.9} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-ink">{b.eventName}</span>
                  <span className="block text-[12.5px] text-ink/70">{b.bookedDate}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The Forms Maker tile's line: how many forms the shop has saved, honestly (an unread count is never "None yet"). */
export function formsSub(saved: number | null | undefined): string {
  if (saved === undefined) return 'Sent as a chat card';
  if (saved === null) return 'Couldn’t load';
  return saved === 0 ? 'None yet' : `${formatCount(saved)} saved`;
}
