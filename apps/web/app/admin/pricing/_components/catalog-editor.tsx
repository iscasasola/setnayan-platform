'use client';

/**
 * /admin/pricing — the price catalog browser (2026-08-26 rebuild).
 *
 * Ports prototypes/admin_pricing_manager_2026-08-26.html's "What we
 * recommend" pane: the sell sheet (what a person can buy today) and the back
 * room (everything retired, measuring itself toward empty). See
 * WHATS_NEXT_Managing_Prices_2026-08-26.md § 6 for the six build decisions
 * this ports faithfully — per-row save, three states, measured "safe to
 * remove", every price field editable, drawn history, margin only when a
 * cost is real.
 *
 * ONE client component owns search / view / scope / which-card-is-open state
 * so none of it is lost when a save's answer redraws the page — every save here
 * revalidates (`revalidateCatalogSurfaces`), and that answer carries the render
 * (no `router.refresh()` after it, which drew the page twice). A full
 * navigation (the old redirect-based save) would have reset all four.
 *
 * Each row is its OWN `<form>` bound to its OWN `useActionState` — this is
 * the structural fix for the description-blanking bug: a field this
 * component doesn't render for a given row is a field that row's action never
 * receives, so there is nothing left for a diff to misread as "cleared".
 */

import { useActionState, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Archive, ChevronDown, Lock, RotateCcw, Save, Search, Trash2, CircleCheck, X } from 'lucide-react';
import {
  CLUSTER_ORDER,
  type PriceCluster,
  clusterForRetail,
  clusterForVendor,
  isCreditLadderRung,
  summariseLadder,
} from '@/lib/admin/pricing-clusters';
import { skuAnchorId } from '@/lib/admin-map/sku-anchor';
import {
  saveRetailRow,
  retireRetailRow,
  reactivateRetailRow,
  removeRetailRowForGood,
  removeAllSafeRetailRows,
  saveBundleRow,
  retireBundleRow,
  reactivateBundleRow,
  saveVendorRow,
  retireVendorRow,
  reactivateVendorRow,
  type RowActionState,
} from '@/app/admin/pricing/actions';
import { INITIAL_ROW_STATE, INITIAL_REMOVE_ALL_STATE } from '@/app/admin/pricing/_components/action-state';
import { formatCount } from '@/lib/format-number';
import { PillButton, PillTrack } from '@/app/_components/pill-track';
import { ActionButton } from '@/components/action-button';
import { Badge } from '@/app/_components/badge';
import { ChosenRow, FormRows } from '@/app/_components/form-row';
import { TEMPLATE_SUBLINE, TemplateEmpty } from '@/app/_components/template-rows';
import { formulaAppliesTo, formulaPrice, type PricingFormulaSettings } from '@/lib/pricing-formula';
import {
  FormulaLine,
  PricingFormulaCard,
  PricingFormulaContext,
  usePricingFormula,
} from '@/app/admin/pricing/_components/pricing-formula-card';

// ─── Shared row shape ──────────────────────────────────────────────────────

export type PricingHistoryEntryProp = { date: string; summary: string; who: string };

export type RetailRowProp = {
  kind: 'retail';
  code: string;
  title: string;
  description: string | null;
  price: number;
  cost: number;
  isActive: boolean;
  onboardingPrice: number | null;
  billingPeriod: string;
  isPaxPriced: boolean;
  paxFloor: number | null;
  paxFloorPrice: number | null;
  paxIncrementSize: number | null;
  paxIncrementPrice: number | null;
  retiredAt: string | null;
  retirementReason: string | null;
  replacedByCode: string | null;
  editedAgo: string;
  removability: {
    safeToRemove: boolean;
    reasons: string[];
    papicConfigPointer: boolean;
  } | null;
  history: PricingHistoryEntryProp[];
  /**
   * 📦 A supplier GIFT BUNDLE (owner 2026-11-14, "buy 10, get 1 free"): which pack it holds and how many — READ from the
   * row's own `bundle_of_service_code` / `bundle_quantity` — and whether its price still equals whole packs at today's
   * list price (`bundleListNote`). Shelved under Bundles. Absent on every other row.
   */
  giftBundle?: { holds: string; note: { ok: boolean; text: string } | null };
};

export type BundleRowProp = {
  kind: 'bundle';
  code: string;
  title: string;
  description: string | null;
  price: number;
  isActive: boolean;
  retiredAt: string | null;
  retirementReason: string | null;
  replacedByCode: string | null;
  editedAgo: string;
  history: PricingHistoryEntryProp[];
};

export type VendorRowProp = {
  kind: 'vendor';
  code: string;
  title: string;
  description: string | null;
  price: number;
  offeringLabel: string;
  /** The raw catalog value — what the row IS, used to shelve it. The label
      beside it is for reading; grouping must not key on a display string. */
  offeringType: string;
  isActive: boolean;
  retiredAt: string | null;
  retirementReason: string | null;
  replacedByCode: string | null;
  editedAgo: string;
  history: PricingHistoryEntryProp[];
};

export type PriceRowProp = RetailRowProp | BundleRowProp | VendorRowProp;

type Family = 'Customer' | 'Bundles' | 'Supplier';
/**
 * ⚖ TWO STATES, NOT THREE (owner 2026-08-29 — "remove the old prices").
 *
 * 🔴 "RETIRED 0" COULD NEVER HAVE SAID ANYTHING ELSE. `viewOf` filed a row as
 * retired only when it carried a `retired_at` stamp, and MEASURED AGAINST
 * PRODUCTION: not one row in either catalog has ever been stamped. So all 20
 * switched-off prices landed under "Drafts" — reading as things somebody is
 * still preparing — while the tab that means DEAD sat permanently empty.
 *
 * Off is off. The reason, where there is one, lives on the row's own card.
 */
type ViewState = 'sale' | 'off';

function familyOf(row: PriceRowProp): Family {
  if (row.kind === 'retail') return row.giftBundle ? 'Bundles' : 'Customer';
  if (row.kind === 'bundle') return 'Bundles';
  return 'Supplier';
}

/**
 * Which shelf a row lives on.
 *
 * ⚠ The shipped `familyOf` (Customer / Bundles / Vendor) is KEPT and still backs
 * the scope chips — it answers "whose price is this?", which is a different
 * question from "what is it?". This one groups the list.
 */
function clusterOf(row: PriceRowProp): PriceCluster {
  if (row.kind === 'bundle') return 'Bundles';
  if (row.kind === 'vendor') return clusterForVendor(row.offeringType);
  return clusterForRetail(row.code);
}

function viewOf(row: PriceRowProp): ViewState {
  return row.isActive ? 'sale' : 'off';
}

function pesoShort(n: number): string {
  return n === 0 ? 'Free' : `₱${n.toLocaleString('en-PH')}`;
}

const BILLING_LABEL: Record<string, string> = {
  one_time: 'Once',
  per_day: 'Per day of the event',
  per_year: 'Per year',
  per_28d: 'Every 28 days',
};

function marginPct(price: number, cost: number): number | null {
  if (price <= 0 || cost <= 0) return null;
  return Math.round(((price - cost) / price) * 100);
}

function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} month${mo === 1 ? '' : 's'} ago`;
  return `${Math.floor(d / 365)} year${Math.floor(d / 365) === 1 ? '' : 's'} ago`;
}

// ─── Top-level browser ─────────────────────────────────────────────────────

export function PriceCatalogBrowser({
  rows,
  retailTitlesForReplacement,
  freeCreditsPerEvent,
  formula,
}: {
  rows: PriceRowProp[];
  /** The 2026-11-21 price formula, read from the admin-only `pricing_formula_settings` row; null when the read failed. */
  formula: PricingFormulaSettings | null;
  /** Read from `papic_event_pool_config`; null when the read failed. */
  freeCreditsPerEvent: number | null;
  /** [code, title][] of active retail rows, for the "Replaced by" picker. */
  retailTitlesForReplacement: [string, string][];
}) {
  const [q, setQ] = useState('');
  const [view, setView] = useState<ViewState>('sale');
  const [scope, setScope] = useState<Family | 'all'>('all');
  const [openCode, setOpenCode] = useState<string | null>(null);

  // Deep-link support: `#sku-...` from ⌘K / admin search may point at a row
  // that isn't in the default "On sale" view (e.g. a retired Papic SKU). On
  // mount, find which view+scope the target row actually lives in and jump
  // there before scrolling — otherwise the anchor silently fails to resolve
  // to anything, the exact "link works, page opens, never scrolls" bug
  // sku-anchor.ts's own docblock warns about.
  const jumped = useRef(false);
  useEffect(() => {
    if (jumped.current) return;
    jumped.current = true;
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash.startsWith('sku-')) return;
    const target = rows.find((r) => skuAnchorId(r.code) === hash);
    if (!target) return;
    setView(viewOf(target));
    setScope(familyOf(target));
    setOpenCode(target.code);
    requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({ block: 'center' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const c = { sale: 0, off: 0 };
    for (const r of rows) c[viewOf(r)] += 1;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (viewOf(r) !== view) return false;
      if (scope !== 'all' && familyOf(r) !== scope) return false;
      if (!needle) return true;
      return r.title.toLowerCase().includes(needle) || r.code.toLowerCase().includes(needle);
    });
  }, [rows, view, scope, q]);

  const formulaRows = useMemo(
    () =>
      rows.flatMap((r) =>
        r.kind === 'retail'
          ? [{ code: r.code, title: r.title, price: r.price, cost: r.cost, isActive: r.isActive, isGiftBundle: !!r.giftBundle, billingPeriod: r.billingPeriod }]
          : [],
      ),
    [rows],
  );

  return (
    <PricingFormulaContext.Provider value={formula}>
    <div>
      <PricingFormulaCard rows={formulaRows} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/45"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a price…"
            aria-label="Find a price"
            className="input-field h-9 w-full pl-8 text-sm"
          />
        </div>
      </div>

      <PillTrack role="tablist" aria-label="Price state" className="mb-3 mt-3">
        {(
          [
            ['sale', 'On sale'],
            ['off', 'Switched off'],
          ] as [ViewState, string][]
        ).map(([key, label]) => (
          <PillButton
            key={key}
            on={view === key}
            role="tab"
            onClick={() => {
              setView(key);
              setOpenCode(null);
            }}
            aria-selected={view === key}
            className="px-3"
          >
            {label} <span className={`text-[11px] tabular-nums ${view === key ? 'text-white/80' : 'text-ink/45'}`}>{formatCount(counts[key])}</span>
          </PillButton>
        ))}
      </PillTrack>

      {/* 📐 Admin clean port (owner 19 Nov 2026): the four kind chips are one dropdown — any set of choices is one. */}
      <FormRows data="price-kind">
        <ChosenRow
          data="price-kind"
          name="Kind"
          value={scope}
          options={(['all', 'Customer', 'Bundles', 'Supplier'] as const).map((k) => ({ key: k, label: k === 'all' ? 'All' : k }))}
          onPick={(k) => setScope(k as Family | 'all')}
          dataAttr="data-price-kind"
        />
      </FormRows>

      {view === 'off' && filtered.length === 0 && !q.trim() ? (
        <EmptyState
          title="Nothing is switched off."
          body="A price you take off sale lands here, with what is still holding it in place and how far it is from being gone for good."
        />
      ) : filtered.length === 0 ? (
        <EmptyState title={`Nothing matches "${q}".`} body="Try part of the name, or the product code." />
      ) : view === 'off' ? (
        <RetiredShelves
          rows={filtered}
          freeCreditsPerEvent={freeCreditsPerEvent}
          openCode={openCode}
          setOpenCode={setOpenCode}
          retailTitlesForReplacement={retailTitlesForReplacement}
        />
      ) : (
        <SaleOrDraftShelves
          rows={filtered}
          freeCreditsPerEvent={freeCreditsPerEvent}
          openCode={openCode}
          setOpenCode={setOpenCode}
          retailTitlesForReplacement={retailTitlesForReplacement}
        />
      )}
    </div>
    </PricingFormulaContext.Provider>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="sn-frame sn-frame-flush mt-3 px-4">
      <TemplateEmpty data="price-catalog">
        <b className="font-semibold text-ink">{title}</b> {body}
      </TemplateEmpty>
    </div>
  );
}

function Shelf({ title, count, tone, note }: { title: string; count: number; tone?: 'danger' | 'hold'; note?: string }) {
  const toneCls = tone === 'danger' ? 'text-danger-700' : tone === 'hold' ? 'text-warn-700' : 'text-[color:var(--m-slate-2)]';
  return (
    <div className="flex items-baseline gap-2 border-b border-[color:var(--sn-divider)] px-1 pb-1.5 pt-4 first:pt-0">
      <h3 className={`text-[11.5px] font-bold uppercase tracking-[0.1em] ${toneCls}`}>{title}</h3>
      <span className="text-[13px] tabular-nums text-[color:var(--m-slate-2)]">{formatCount(count)}</span>
      {note && <span className="ml-auto text-[13px] text-[color:var(--m-slate-2)]">{note}</span>}
    </div>
  );
}

/**
 * The sell sheet, CLUSTERED BY WHAT A THING IS.
 *
 * ⚖ Owner 2026-08-29: *"fix the clustering of the prices since there are only a
 * few and we can organize them neatly."*
 *
 * 🔑 THE OLD LIST WAS NOT LONG — IT WAS INTERLEAVED. It sorted by price
 * ascending across three coarse families, and 17 of the 26 customer rows are one
 * product (the Papic credit ladder) in 17 sizes. Sorted by price those 17 thread
 * straight through the owner's nine actual products, so nine things read as
 * twenty-six. Nothing was stale; it was shuffled.
 */
function SaleOrDraftShelves(props: ShelfListProps) {
  return (
    <div className="sn-frame sn-frame-flush mt-3 overflow-hidden">
      {CLUSTER_ORDER.map((cluster) => {
        const group = props.rows.filter((r) => clusterOf(r) === cluster);
        if (group.length === 0) return null;

        // The credit ladder collapses to ONE line. Every rung is still here,
        // still searchable and still openable — it just stops taking 17 of the
        // list's slots for a product that is edited on its own tab anyway.
        const rungs = group.filter((r) => r.kind === 'retail' && isCreditLadderRung(r.code));
        const rest = group.filter((r) => !(r.kind === 'retail' && isCreditLadderRung(r.code)));
        const ladder = summariseLadder(rungs.map((r) => ({ pricePhp: r.price })));

        return (
          <div key={cluster} className="px-4">
            <Shelf title={cluster} count={group.length} />
            {ladder && (
              <CreditLadderRow
                summary={ladder}
                rungs={rungs}
                {...props}
              />
            )}
            {rest.map((r) => (
              <RowCard key={r.code} row={r} {...props} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

/*
  ── THE FREE-CREDITS CELL MOVED TO THE PAPIC TAB, 2026-08-29 ────────────────
  Owner: *"free credits should be here. with the rest of papic services and the
  thank you video."* He is right that it belongs beside the ladder: it is not a
  product, and the whole Papic picture — the free allowance, the ladder, the
  Thank You video and the camera rates — now sits in one place instead of split
  across two tabs. It lives in `_components/papic-rest-editor.tsx`.
*/
function CreditLadderRow({
  summary,
  rungs,
  ...props
}: ShelfListProps & {
  summary: NonNullable<ReturnType<typeof summariseLadder>>;
  rungs: PriceRowProp[];
}) {
  const [open, setOpen] = useState(false);
  // A search that matches a rung must OPEN the ladder — otherwise the rung is
  // filtered in, invisible, and the box looks broken.
  const forcedOpen = open || rungs.some((r) => r.code === props.openCode);

  return (
    <div className="border-b border-ink/5 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={forcedOpen}
        className="flex w-full items-start gap-3 py-3 text-left"
      >
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-mulberry-600" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-snug text-ink">
            Papic credits — the top-up ladder
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] text-ink/50">PAPIC_GUEST_*</span>
            <Badge tone="quiet">One product · {summary.rungs} sizes</Badge>
          </span>
          <span className="mt-1 block text-[13px] text-ink/60">
            Every size tops up the event&apos;s shared pot. Edited as a ladder on its
            own tab; opened here so nothing is hidden.
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-mono text-base font-bold tabular-nums text-ink">
            {pesoShort(summary.lowestPhp)} – {pesoShort(summary.highestPhp)}
          </span>
          <span className="block text-[11px] text-ink/50">{summary.rungs} rungs</span>
        </span>
      </button>
      {forcedOpen && (
        <div className="border-t border-ink/5 bg-ink/[0.015] pl-4">
          {rungs.map((r) => (
            <RowCard key={r.code} row={r} {...props} />
          ))}
        </div>
      )}
    </div>
  );
}

type ShelfListProps = {
  rows: PriceRowProp[];
  /**
   * `papic_event_pool_config.free_grant_points`, READ FROM THE DATABASE.
   * Null when it could not be read — the cell then says so rather than printing
   * a confident 50 that might not be what the product is actually giving away.
   */
  freeCreditsPerEvent: number | null;
  openCode: string | null;
  setOpenCode: (c: string | null) => void;
  retailTitlesForReplacement: [string, string][];
};

function RetiredShelves(props: ShelfListProps) {
  const safe = props.rows.filter(
    (r): r is RetailRowProp => r.kind === 'retail' && !!r.removability?.safeToRemove,
  );
  const held = props.rows.filter(
    (r): r is RetailRowProp => r.kind === 'retail' && !r.removability?.safeToRemove,
  );
  const unchecked = props.rows.filter((r) => r.kind !== 'retail');

  return (
    <div className="sn-frame sn-frame-flush mt-3 overflow-hidden">
      {safe.length > 0 && (
        <div className="px-4">
          <Shelf title="Safe to remove" count={safe.length} tone="danger" note="never sold · nothing points at them" />
          <RemoveAllBar count={safe.length} />
          {safe.map((r) => (
            <RowCard key={r.code} row={r} {...props} />
          ))}
        </div>
      )}
      {held.length > 0 && (
        <div className="px-4">
          <Shelf title="Still wired" count={held.length} tone="hold" note="each one names what is holding it" />
          {held.map((r) => (
            <RowCard key={r.code} row={r} {...props} />
          ))}
        </div>
      )}
      {unchecked.length > 0 && (
        <div className="px-4">
          <Shelf
            title="Not checked yet"
            count={unchecked.length}
            note="bundles + supplier prices — same check, not yet run"
          />
          {unchecked.map((r) => (
            <RowCard key={r.code} row={r} {...props} />
          ))}
        </div>
      )}
    </div>
  );
}

function RemoveAllBar({ count }: { count: number }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<
    { ok: boolean; message: string | null; removed: number },
    FormData
  >(
    async (_prev, _formData) => {
      return removeAllSafeRetailRows();
    },
    INITIAL_REMOVE_ALL_STATE,
  );

  if (state.message && !confirming) {
    return <p className="border-b border-ink/5 py-2 text-xs text-ink/60">{state.message}</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5 border-b border-ink/5 py-2.5">
      {!confirming ? (
        <ActionButton
          tone="danger"
          icon={<Trash2 aria-hidden strokeWidth={1.9} />}
          label={`Remove all ${formatCount(count)} for good`}
          onClick={() => setConfirming(true)}
        />
      ) : (
        <form action={formAction} className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs text-ink/70">
            None of these has ever been sold and nothing points at them. This cannot be undone.
          </span>
          <ActionButton tone="neutral" quiet icon={<X aria-hidden strokeWidth={1.9} />} label="Cancel" onClick={() => setConfirming(false)} />
          <ActionButton
            tone="danger"
            main
            type="submit"
            disabled={pending}
            icon={<Trash2 aria-hidden strokeWidth={1.9} />}
            label={pending ? 'Removing…' : `Remove all ${formatCount(count)}`}
          />
        </form>
      )}
      <span className="text-[11px] text-ink/45">This is the broom — it is your press, on your day.</span>
    </div>
  );
}

// ─── One row: resting summary + expandable card ────────────────────────────

function RowCard(props: {
  row: PriceRowProp;
  openCode: string | null;
  setOpenCode: (c: string | null) => void;
  retailTitlesForReplacement: [string, string][];
}) {
  const { row } = props;
  const open = props.openCode === row.code;
  const view = viewOf(row);

  const removability = row.kind === 'retail' ? row.removability : null;
  let dotCls = 'bg-mulberry-600';
  let tag: ReactNode = null;
  /*
    🔴 THIS BRANCH USED TO BE UNREACHABLE IN PRODUCTION, AND THAT IS WHY THE
    STATES WERE MERGED. It keyed on the old 'ret' state, which `viewOf` only
    returned for a row carrying a `retired_at` stamp — and MEASURED: not one row
    in either catalog has ever been stamped. So every switched-off price fell to
    the 'draft' arm below, got a grey dot, and was never told whether anything
    still held it in place. The removability work existed and nobody could see it.
  */
  if (view === 'off') {
    if (row.kind !== 'retail') {
      dotCls = 'bg-ink/25';
      tag = <Tag>Not checked yet</Tag>;
    } else if (removability?.safeToRemove) {
      dotCls = 'bg-danger-600';
      tag = <Tag tone="neg">Safe to remove</Tag>;
    } else {
      dotCls = 'bg-warn-500';
      tag = <Tag tone="gold">Still wired</Tag>;
    }
  }

  return (
    <div
      id={skuAnchorId(row.code)}
      className="scroll-mt-24 border-b border-ink/5 py-3 last:border-b-0"
    >
      {/*
        🔴 THE ROW WAS ALWAYS CLICKABLE AND NOTHING SAID SO. Owner 2026-08-29,
        on the live screen: *"why can't i edit the prices?"* — every price on
        this tab opens its editor on click, and the row carried NO affordance
        whatsoever: no chevron, no hover state, and a `<button>` takes the
        default cursor unless told otherwise, so not even a pointer.

        🔑 A CONTROL NOBODY CAN SEE IS A CONTROL NOBODY HAS. He edited the Papic
        ladder and the family discount happily the same morning — those tabs draw
        visible input boxes. This one drew a list that looked like a report.
      */}
      <button
        type="button"
        onClick={() => props.setOpenCode(open ? null : row.code)}
        aria-expanded={open}
        title={open ? 'Close' : 'Edit this price'}
        className="group flex w-full cursor-pointer items-start gap-3 rounded-lg px-1 py-1 text-left transition hover:bg-ink/[0.04]"
      >
        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotCls}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-snug text-ink">{row.title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {/* ✂ F-A-14 (admin walk 13 Nov 2026): the SKU code is not drawn — the title names the product. */}
            {tag}
            {row.replacedByCode && <Tag>Replaced by {row.replacedByCode}</Tag>}
          </span>
          {row.kind === 'retail' && view === 'sale' && (
            <span className={`mt-1 block text-[13px] ${row.description ? 'text-ink/60' : 'italic text-danger-700'}`}>
              {row.description || 'No note — the last save blanked it.'}
            </span>
          )}
          {row.kind === 'retail' && row.giftBundle && (
            <span className="mt-1 block text-[13px] text-ink/70" data-admin-gift-bundle="">
              Gift bundle · suppliers · holds {row.giftBundle.holds} (from the catalogue)
              {row.giftBundle.note ? (
                <span className={row.giftBundle.note.ok ? 'text-ink/60' : 'font-semibold text-danger-700'}>
                  {' '}· {row.giftBundle.note.text}
                </span>
              ) : null}
            </span>
          )}
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-mono text-base font-bold tabular-nums text-ink">{pesoShort(row.price)}</span>
          <span className="block text-[11px] text-ink/50">
            {row.kind === 'vendor' ? row.offeringLabel : row.kind === 'retail' ? BILLING_LABEL[row.billingPeriod] ?? 'Once' : 'One-off'}
          </span>
          {row.kind === 'retail' && row.onboardingPrice != null && (
            <span className="block text-[10.5px] text-gold-text">₱{row.onboardingPrice.toLocaleString('en-PH')} to sign up</span>
          )}
          {row.kind === 'retail' && formulaAppliesTo({ isGiftBundle: !!row.giftBundle, billingPeriod: row.billingPeriod }) && (
            <FormulaLine cost={row.cost} price={row.price} />
          )}
          <span className="mt-0.5 flex items-center justify-end gap-1 text-[10.5px] font-semibold text-ink/0 transition group-hover:text-mulberry-600">
            {open ? 'Close' : 'Edit'}
          </span>
        </span>
        <ChevronDown
          aria-hidden
          className={`mt-1.5 h-4 w-4 shrink-0 text-ink/35 transition group-hover:text-ink/70 ${
            open ? 'rotate-180' : ''
          }`}
          strokeWidth={2}
        />
      </button>

      {open && (
        <div className="mt-3 overflow-hidden rounded-[var(--sn-frame-radius)] bg-[rgb(var(--sn-page-bg))]">
          <CardBody {...props} row={row} />
        </div>
      )}
    </div>
  );
}

function Tag({ children, tone }: { children: ReactNode; tone?: 'gold' | 'neg' }) {
  return <Badge tone={tone === 'gold' ? 'wait' : tone === 'neg' ? 'no' : 'quiet'}>{children}</Badge>;
}

// ─── The open card ──────────────────────────────────────────────────────────

function CardBody(props: {
  row: PriceRowProp;
  retailTitlesForReplacement: [string, string][];
}) {
  const { row } = props;
  const view = viewOf(row);

  return (
    <div>
      {view === 'off' && row.kind === 'retail' && row.removability && (
        <HeldByPanel removability={row.removability} />
      )}
      <SaveSection row={row} />
      <HistorySection history={row.history} />
      <CardFooter row={row} retailTitlesForReplacement={props.retailTitlesForReplacement} />
    </div>
  );
}

function HeldByPanel({
  removability,
}: {
  removability: { safeToRemove: boolean; reasons: string[]; papicConfigPointer: boolean };
}) {
  if (removability.safeToRemove) {
    return (
      <div className="border-b border-ink/10 p-4">
        <div className="rounded-lg border border-danger-200 bg-danger-50/60 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-danger-800">
            <CircleCheck className="h-4 w-4" aria-hidden /> Nothing depends on this.
          </p>
          <p className="mt-1 text-[13px] text-ink/65">
            Never sold, and nothing points at it. You can remove it for good.
            {removability.papicConfigPointer &&
              ' (Old Papic camera/credit settings still name this code, but nothing has ever used them — removing it clears those too.)'}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="border-b border-ink/10 p-4">
      <div className="rounded-lg border border-warn-200 bg-warn-50/60 p-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-warn-800">
          <Lock className="h-4 w-4" aria-hidden /> Still held in place by:
        </p>
        <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[13px] text-ink/70">
          {removability.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="mt-1.5 text-[12.5px] text-ink/55">It stays retired and off the price page.</p>
        <p className="text-[12.5px] text-ink/55">
          When nothing here needs it any more, <b>Remove for good</b> will appear on its own.
        </p>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-[12.5px] font-medium text-ink">{children}</span>;
}

function MoneyField({
  name,
  defaultValue,
  placeholder,
  onChange,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-ink/45">₱</span>
      <input
        name={name}
        type="number"
        step="0.01"
        min="0"
        defaultValue={defaultValue}
        placeholder={placeholder}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="input-field h-9 w-full pl-6 text-sm tabular-nums"
      />
    </div>
  );
}

function SaveSection({ row }: { row: PriceRowProp }) {
  const action = row.kind === 'retail' ? saveRetailRow : row.kind === 'bundle' ? saveBundleRow : saveVendorRow;
  const [state, formAction] = useActionState<RowActionState, FormData>(
    async (prev, fd) => {
      return action(prev, fd);
    },
    INITIAL_ROW_STATE,
  );
  const [cost, setCost] = useState(row.kind === 'retail' ? String(row.cost) : '');
  const [price, setPrice] = useState(String(row.price));
  const [paxOn, setPaxOn] = useState(row.kind === 'retail' ? row.isPaxPriced : false);
  const [billing, setBilling] = useState<string>(row.kind === 'retail' ? row.billingPeriod : 'one_time');
  const margin = row.kind === 'retail' ? marginPct(Number(price), Number(cost)) : null;
  // 🧮 The 2026-11-21 formula, from the cost AS TYPED in this card. "Use formula price" only fills the Price box —
  // the admin still presses "Save this price", so it goes through the same audited save as a typed price.
  const formulaSettings = usePricingFormula();
  const formulaFor =
    row.kind === 'retail' && formulaSettings && formulaAppliesTo({ isGiftBundle: !!row.giftBundle, billingPeriod: row.billingPeriod })
      ? formulaPrice(Number(cost), formulaSettings)
      : null;
  const [priceBoxKey, setPriceBoxKey] = useState(0);

  return (
    <form action={formAction} id={`form-save-${row.code}`}>
      <input type="hidden" name={row.kind === 'retail' ? 'service_code' : row.kind === 'bundle' ? 'package_code' : 'sku_code'} value={row.code} />

      <div className="border-b border-ink/10 p-4">
        <h4 className="mb-2.5 text-[11.5px] font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)]">What it is</h4>
        {/* Row 22 (2026-10-01): supplier plans are renamed here too — the
            name used to be fixed in code, and nothing keys on it. */}
        <div className="mb-3">
          <FieldLabel>{row.kind === 'vendor' ? 'Name suppliers see' : 'Name customers see'}</FieldLabel>
          <input name="title" required defaultValue={row.title} className="input-field h-9 w-full text-sm" />
        </div>
        <div>
          <FieldLabel>What this is for</FieldLabel>
          <textarea
            name="desc"
            defaultValue={row.description ?? ''}
            rows={2}
            placeholder="Say it the way you'd say it to a customer."
            className="input-field min-h-[52px] w-full py-2 text-sm leading-relaxed"
          />
          <span className="mt-1 block text-[11px] text-ink/45">
            Always in this form while the card is open — it can no longer be saved away by accident.
          </span>
        </div>
      </div>

      <div className="border-b border-ink/10 p-4">
        <h4 className="mb-2.5 text-[11.5px] font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)]">
          What it costs {row.kind === 'vendor' ? 'a supplier' : 'them'}
        </h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>Price</FieldLabel>
            <MoneyField key={priceBoxKey} name="price" defaultValue={price} onChange={setPrice} />
          </div>
          {row.kind === 'retail' && (
            <div>
              <FieldLabel>Sign-up price</FieldLabel>
              <MoneyField
                name="onboarding_price"
                defaultValue={row.onboardingPrice != null ? String(row.onboardingPrice) : ''}
                placeholder="leave blank if there isn't one"
              />
              <span className="mt-1 block text-[11px] text-ink/45">
                Charged when bought during event sign-up. Most prices have none.
              </span>
            </div>
          )}
        </div>
        {row.kind === 'retail' && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <FormRows data="price-billing">
                <ChosenRow
                  data="price-billing"
                  name="Charged"
                  value={billing}
                  options={[
                    { key: 'one_time', label: 'Once' },
                    { key: 'per_day', label: 'Per day of the event' },
                    { key: 'per_year', label: 'Per year' },
                    { key: 'per_28d', label: 'Every 28 days' },
                  ]}
                  onPick={setBilling}
                  dataAttr="data-price-billing"
                />
              </FormRows>
              <input type="hidden" name="billing_period" value={billing} />
            </div>
            <div>
              <FieldLabel>Priced per head?</FieldLabel>
              <label className="flex h-9 items-center gap-2 text-sm text-ink/70">
                <input
                  type="checkbox"
                  name="is_pax_priced"
                  defaultChecked={row.isPaxPriced}
                  onChange={(e) => setPaxOn(e.target.checked)}
                  className="h-4 w-4 rounded border-ink/30"
                />
                Scales with guest count
              </label>
            </div>
          </div>
        )}
        {row.kind === 'retail' && paxOn && (
          <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg border border-ink/10 bg-ink/[0.02] p-3 sm:grid-cols-4">
            <div>
              <FieldLabel>Floor (guests)</FieldLabel>
              <input
                name="pax_floor"
                type="number"
                min="1"
                defaultValue={row.paxFloor ?? ''}
                className="input-field h-9 w-full text-sm"
              />
            </div>
            <div>
              <FieldLabel>Floor price</FieldLabel>
              <MoneyField name="pax_floor_price" defaultValue={row.paxFloorPrice != null ? String(row.paxFloorPrice) : ''} />
            </div>
            <div>
              <FieldLabel>Step size</FieldLabel>
              <input
                name="pax_increment_size"
                type="number"
                min="1"
                defaultValue={row.paxIncrementSize ?? ''}
                className="input-field h-9 w-full text-sm"
              />
            </div>
            <div>
              <FieldLabel>Step price</FieldLabel>
              <MoneyField
                name="pax_increment_price"
                defaultValue={row.paxIncrementPrice != null ? String(row.paxIncrementPrice) : ''}
              />
            </div>
          </div>
        )}
      </div>

      {row.kind === 'retail' && (
        <div className="border-b border-ink/10 p-4">
          <h4 className="mb-2.5 text-[11.5px] font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)]">
            What it costs us
          </h4>
          <div className="max-w-[230px]">
            <FieldLabel>Base cost (what it costs us)</FieldLabel>
            <MoneyField name="cost" defaultValue={cost} placeholder="blank" onChange={setCost} />
          </div>
          <p className="mt-2 text-[13px] text-ink/60">
            {margin !== null ? (
              <>
                Margin <b className="tabular-nums text-ink">{margin}%</b>
              </>
            ) : (
              "No cost recorded — no margin shown."
            )}
          </p>
          {formulaFor != null && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ink/60" data-formula-use="">
              <span className="tabular-nums">
                Formula price <b className="text-ink">₱{formulaFor.toLocaleString('en-PH')}</b>
              </span>
              {String(formulaFor) === price && String(row.price) !== price && (
                <span className="text-[12px] text-ink/55">In the Price box — press Save this price to send it.</span>
              )}
              {String(formulaFor) !== price && (
                <button
                  type="button"
                  onClick={() => {
                    setPrice(String(formulaFor));
                    setPriceBoxKey((k) => k + 1);
                  }}
                  className="rounded-md border border-ink/20 px-3 py-1 text-xs font-medium text-ink/70 transition hover:bg-ink/5"
                >
                  Use formula price
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 p-4">
        <ActionButton tone="brand" main type="submit" icon={<Save aria-hidden strokeWidth={1.9} />} label="Save this price" />
        {state.message && (
          <span className={`text-xs ${state.ok ? 'text-success-800' : 'text-danger-700'}`}>{state.message}</span>
        )}
      </div>
    </form>
  );
}

function HistorySection({ history }: { history: PricingHistoryEntryProp[] }) {
  return (
    <div className="border-b border-ink/10 p-4">
      <h4 className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)]">History</h4>
      {history.length === 0 ? (
        <p className="text-[13px] text-ink/55">No changes recorded from this screen yet.</p>
      ) : (
        <ul className="space-y-1">
          {history.map((h, i) => (
            <li key={i} className="flex items-baseline gap-2.5 border-b border-ink/5 py-1 text-[12.5px] last:border-b-0">
              <span className="min-w-[84px] text-[12px] tabular-nums text-ink/50">
                {new Date(h.date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <span className="tabular-nums">{h.summary}</span>
              <span className="ml-auto text-[11.5px] text-ink/50">{h.who}</span>
            </li>
          ))}
        </ul>
      )}
      <p className={`mt-2 ${TEMPLATE_SUBLINE}`}>Recorded on every save made from this screen since 1 July 2026.</p>
      <p className={TEMPLATE_SUBLINE}>
        A price changed by a code release (not from here) won&apos;t show up — this history is partial, not complete.
      </p>
    </div>
  );
}

function CardFooter({
  row,
  retailTitlesForReplacement,
}: {
  row: PriceRowProp;
  retailTitlesForReplacement: [string, string][];
}) {
  const view = viewOf(row);
  const [retiring, setRetiring] = useState(false);
  const [replacedBy, setReplacedBy] = useState('');

  const retireAction = row.kind === 'retail' ? retireRetailRow : row.kind === 'bundle' ? retireBundleRow : retireVendorRow;
  const reactivateAction =
    row.kind === 'retail' ? reactivateRetailRow : row.kind === 'bundle' ? reactivateBundleRow : reactivateVendorRow;
  const codeField = row.kind === 'retail' ? 'service_code' : row.kind === 'bundle' ? 'package_code' : 'sku_code';

  const [retireState, retireFormAction] = useActionState<RowActionState, FormData>(
    async (prev, fd) => {
      const r = await retireAction(prev, fd);
      if (r.ok) setRetiring(false);
      return r;
    },
    INITIAL_ROW_STATE,
  );
  const [reactivateState, reactivateFormAction] = useActionState<RowActionState, FormData>(
    async (prev, fd) => {
      return reactivateAction(prev, fd);
    },
    INITIAL_ROW_STATE,
  );
  const [removeState, removeFormAction] = useActionState<RowActionState, FormData>(
    async (prev, fd) => {
      return removeRetailRowForGood(prev, fd);
    },
    INITIAL_ROW_STATE,
  );
  const [removing, setRemoving] = useState(false);

  /*
    🚨 "REMOVE FOR GOOD" HAS NEVER BEEN OFFERABLE ON ANY ROW IN PRODUCTION.
    It required `view === 'ret'`, which required a `retired_at` stamp, and
    nothing has ever written one — so the condition was false for all 20
    switched-off prices, always. The 35 rows deleted on 2026-08-28 went by
    migration because the button on this screen could not appear.
    🔑 A control gated on a state nothing produces is a gate with no handle.
  */
  const canOfferRemove = row.kind === 'retail' && view === 'off' && row.removability?.safeToRemove;

  return (
    <div className="p-4">
      {view === 'sale' && !retiring && (
        <ActionButton tone="neutral" icon={<Archive aria-hidden strokeWidth={1.9} />} label="Retire this price" onClick={() => setRetiring(true)} />
      )}
      {view === 'sale' && retiring && (
        <form action={retireFormAction} className="space-y-2.5">
          <input type="hidden" name={codeField} value={row.code} />
          <p className="text-[13px] text-ink/70">It comes off the public price page right away.</p>
          <p className="text-[13px] text-ink/70">
            Anything already sold or wired keeps working, and you can put it back on sale any time.
          </p>
          <div>
            <FieldLabel>
              Why retire it? <span className="font-normal text-ink/50">(optional)</span>
            </FieldLabel>
            <input name="reason" placeholder="e.g. replaced by the new credit ladder" className="input-field h-9 w-full text-sm" />
          </div>
          {row.kind === 'retail' && (
            <div>
              <FormRows data="price-replaced-by">
                <ChosenRow
                  data="price-replaced-by"
                  name="Replaced by (optional)"
                  value={replacedBy || 'nothing'}
                  options={[
                    { key: 'nothing', label: '— nothing —' },
                    ...retailTitlesForReplacement
                      .filter(([code]) => code !== row.code)
                      .map(([code, title]) => ({ key: code, label: title })),
                  ]}
                  onPick={(k) => setReplacedBy(k === 'nothing' ? '' : k)}
                  dataAttr="data-price-replaced-by"
                />
              </FormRows>
              <input type="hidden" name="replaced_by" value={replacedBy} />
            </div>
          )}
          <div className="flex items-center gap-2">
            <ActionButton tone="warn" main type="submit" icon={<Archive aria-hidden strokeWidth={1.9} />} label="Retire it" />
            <ActionButton tone="neutral" quiet icon={<X aria-hidden strokeWidth={1.9} />} label="Keep selling" onClick={() => setRetiring(false)} />
            {retireState.message && !retireState.ok && (
              <span className="text-xs text-danger-700">{retireState.message}</span>
            )}
          </div>
        </form>
      )}

      {view !== 'sale' && (
        <form action={reactivateFormAction} className="inline-flex items-center gap-2">
          <input type="hidden" name={codeField} value={row.code} />
          <ActionButton tone="ok" type="submit" icon={<RotateCcw aria-hidden strokeWidth={1.9} />} label="Put back on sale" />
          {reactivateState.message && (
            <span className={`text-xs ${reactivateState.ok ? 'text-success-800' : 'text-danger-700'}`}>{reactivateState.message}</span>
          )}
        </form>
      )}

      {canOfferRemove && (
        <div className="mt-2.5">
          {!removing ? (
            <ActionButton tone="danger" icon={<Trash2 aria-hidden strokeWidth={1.9} />} label="Remove for good" onClick={() => setRemoving(true)} />
          ) : (
            <form action={removeFormAction} className="space-y-2">
              <input type="hidden" name="service_code" value={row.code} />
              <p className="text-[13px] text-ink/70">
                Never sold, and nothing depends on it. It disappears completely — <b>no record kept, no undo</b>.
              </p>
              <div className="flex items-center gap-2">
                <ActionButton tone="danger" main type="submit" icon={<Trash2 aria-hidden strokeWidth={1.9} />} label="Remove for good" />
                <ActionButton tone="neutral" quiet icon={<X aria-hidden strokeWidth={1.9} />} label="Keep it retired" onClick={() => setRemoving(false)} />
                {removeState.message && !removeState.ok && (
                  <span className="text-xs text-danger-700">{removeState.message}</span>
                )}
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
