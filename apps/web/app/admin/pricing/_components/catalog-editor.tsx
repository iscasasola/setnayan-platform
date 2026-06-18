'use client';

/**
 * /admin/pricing editable rows (owner 2026-06-18 redesign).
 *
 * Client islands that live INSIDE the page's server-action <form>. The inputs
 * post to `saveAllPricing` exactly like plain form fields — these components
 * only add local UI: live margin recompute as you type, and a collapsible
 * ⓘ "What this is for" panel (an editable description) so codes like PANOOD or
 * GUIDED_PACK are self-explanatory without re-cluttering the rows.
 *
 * Field-name contract (consumed by saveAllPricing):
 *   retail.{title,desc,cost,price,active}.<service_code>
 *   bundle.{title,desc,price,active}.<package_code>
 *   vendor.{desc,price,active}.<sku_code>   (title is migration-owned · read-only)
 */

import { useState } from 'react';
import { Info } from 'lucide-react';
import { RETAIL_GRID, TWOCOL_GRID } from './grids';

function marginPct(price: number, cost: number): number | null {
  if (!Number.isFinite(price) || !Number.isFinite(cost) || price <= 0) return null;
  return Math.round(((price - cost) / price) * 100);
}

const labelCls =
  'mb-1 block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55';

function MoneyInput({
  name,
  value,
  onChange,
  min = '0',
  ariaLabel,
}: {
  name: string;
  value: string;
  onChange?: (v: string) => void;
  min?: string;
  ariaLabel: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-ink/45">
        ₱
      </span>
      <input
        name={name}
        type="number"
        step="0.01"
        min={min}
        defaultValue={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        aria-label={ariaLabel}
        className="input-field h-10 w-full pl-6 text-right tabular-nums"
      />
    </div>
  );
}

function InfoPanel({
  open,
  name,
  description,
  label = 'What this is for',
}: {
  open: boolean;
  name: string;
  description: string | null;
  label?: string;
}) {
  if (!open) return null;
  return (
    <div className="mt-2 rounded-xl border border-ink/10 bg-cream/60 p-3">
      <label className="block">
        <span className={labelCls}>{label}</span>
        <textarea
          name={name}
          defaultValue={description ?? ''}
          rows={2}
          placeholder="Describe what this is — shown here for your team."
          className="input-field min-h-[52px] w-full py-2 text-sm leading-relaxed"
        />
      </label>
    </div>
  );
}

function InfoToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="What this is for"
      aria-expanded={open}
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
        open
          ? 'border-terracotta/40 bg-terracotta/10 text-terracotta'
          : 'border-ink/15 text-ink/45 hover:border-ink/30 hover:text-ink/70'
      }`}
    >
      <Info aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
    </button>
  );
}

function ActiveToggle({ name, defaultChecked }: { name: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2 md:justify-center">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-ink/30"
      />
      <span className="text-sm text-ink/70 md:hidden">Active · visible publicly</span>
    </label>
  );
}

type Retail = {
  service_code: string;
  title: string;
  description: string | null;
  retail_price_php: number;
  saas_overhead_cost_php: number;
  is_token_able: boolean;
  is_active: boolean;
  edited: string;
};

export function RetailRowEditor({ row }: { row: Retail }) {
  const [open, setOpen] = useState(false);
  const [cost, setCost] = useState(String(row.saas_overhead_cost_php));
  const [price, setPrice] = useState(String(row.retail_price_php));
  const m = marginPct(Number(price), Number(cost));
  const c = row.service_code;
  return (
    <div className={`gap-3 border-b border-ink/5 px-4 py-3.5 last:border-b-0 max-md:space-y-3 ${RETAIL_GRID} ${row.is_active ? '' : 'bg-ink/3'}`}>
      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <code className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">{c}</code>
          {!row.is_active && (
            <span className="rounded bg-ink/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/55">Inactive</span>
          )}
          {row.is_token_able && (
            <span className="rounded bg-amber-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-amber-900">Token-worthy</span>
          )}
          <InfoToggle open={open} onClick={() => setOpen((v) => !v)} />
        </div>
        <input
          name={`retail.title.${c}`}
          defaultValue={row.title}
          aria-label={`${c} title`}
          className="input-field h-10 w-full"
        />
        <p className="mt-1 text-[11px] text-ink/45">Edited {row.edited}</p>
        <InfoPanel open={open} name={`retail.desc.${c}`} description={row.description} />
      </div>
      <label className="block">
        <span className={`${labelCls} md:hidden`}>Cost / event (₱)</span>
        <MoneyInput name={`retail.cost.${c}`} value={cost} onChange={setCost} ariaLabel={`${c} cost`} />
      </label>
      <label className="block">
        <span className={`${labelCls} md:hidden`}>Retail price (₱)</span>
        <MoneyInput name={`retail.price.${c}`} value={price} onChange={setPrice} ariaLabel={`${c} price`} />
      </label>
      <div className="md:text-right">
        <span className={`${labelCls} inline md:hidden`}>Margin</span>{' '}
        <span className="font-mono text-xs tabular-nums text-ink/70">{m !== null ? `${m}%` : '—'}</span>
      </div>
      <ActiveToggle name={`retail.active.${c}`} defaultChecked={row.is_active} />
    </div>
  );
}

type Bundle = {
  package_code: string;
  title: string;
  description: string | null;
  retail_price_php: number;
  is_active: boolean;
  edited: string;
};

export function BundleRowEditor({ row }: { row: Bundle }) {
  const [open, setOpen] = useState(false);
  const c = row.package_code;
  return (
    <div className={`gap-3 border-b border-ink/5 px-4 py-3.5 last:border-b-0 max-md:space-y-3 ${TWOCOL_GRID} ${row.is_active ? '' : 'bg-ink/3'}`}>
      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <code className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">{c}</code>
          {!row.is_active && (
            <span className="rounded bg-ink/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/55">Inactive</span>
          )}
          <InfoToggle open={open} onClick={() => setOpen((v) => !v)} />
        </div>
        <input
          name={`bundle.title.${c}`}
          defaultValue={row.title}
          aria-label={`${c} title`}
          className="input-field h-10 w-full"
        />
        <p className="mt-1 text-[11px] text-ink/45">Edited {row.edited}</p>
        <InfoPanel open={open} name={`bundle.desc.${c}`} description={row.description} label="What this bundle includes" />
      </div>
      <label className="block">
        <span className={`${labelCls} md:hidden`}>Retail price (₱)</span>
        <MoneyInput name={`bundle.price.${c}`} value={String(row.retail_price_php)} ariaLabel={`${c} price`} />
      </label>
      <ActiveToggle name={`bundle.active.${c}`} defaultChecked={row.is_active} />
    </div>
  );
}

type Vendor = {
  sku_code: string;
  title: string;
  description: string | null;
  price_php: number;
  offering_label: string;
  token_grant_count: number | null;
  is_active: boolean;
  edited: string;
};

export function VendorRowEditor({ row }: { row: Vendor }) {
  const [open, setOpen] = useState(false);
  const c = row.sku_code;
  return (
    <div className={`gap-3 border-b border-ink/5 px-4 py-3.5 last:border-b-0 max-md:space-y-3 ${TWOCOL_GRID} ${row.is_active ? '' : 'bg-ink/3'}`}>
      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <code className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">{c}</code>
          {!row.is_active && (
            <span className="rounded bg-ink/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/55">Inactive</span>
          )}
          <span className="rounded bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/55">{row.offering_label}</span>
          {row.token_grant_count ? (
            <span className="rounded bg-amber-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-amber-900">{row.token_grant_count} tokens</span>
          ) : null}
          <InfoToggle open={open} onClick={() => setOpen((v) => !v)} />
        </div>
        {/* Title is structural (wires the tier gate) — read-only. */}
        <p className="text-sm font-medium text-ink">{row.title}</p>
        <p className="mt-0.5 text-[11px] text-ink/45">Edited {row.edited}</p>
        <InfoPanel open={open} name={`vendor.desc.${c}`} description={row.description} />
      </div>
      <label className="block">
        <span className={`${labelCls} md:hidden`}>Price (₱)</span>
        <MoneyInput name={`vendor.price.${c}`} value={String(row.price_php)} min="0.01" ariaLabel={`${c} price`} />
      </label>
      <ActiveToggle name={`vendor.active.${c}`} defaultChecked={row.is_active} />
    </div>
  );
}
