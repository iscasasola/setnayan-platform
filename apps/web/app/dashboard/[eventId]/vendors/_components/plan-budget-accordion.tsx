'use client';

/**
 * PlanBudgetAccordion — the couple-side Vendors tab.
 *
 * The five surfaces from Vendors_Plan_Budget_Tab_Spec_2026-05-31.md §2:
 *   1. Top bar (sticky) — Chosen · Range · meter vs target.
 *   2. Landing overview "Your Budget & Plan" — estimate · chosen · range ·
 *      what to lock next · scroll cue.
 *   3. Category accordion (10 taxonomy folders) — sticky headers, tap to
 *      expand child rails.
 *   4. Per-category vendor rails — horizontal cards + an Add card.
 *   5. Bottom recap "Look how far you've come".
 *
 * Clean Editorial palette (§9): bg-cream / text-ink / text-terracotta (gold
 * accent) / bg-mulberry (the single CTA color). Type: font-serif (Cormorant)
 * display · font-sans (Manrope) body · font-mono (DM Mono) figures.
 *
 * STAGE NOTE: this build lands surfaces 1-5 with real data + real
 * interactions wired to the existing server actions — tap a card → detail
 * route, × → deleteVendor (tap-to-confirm), Lock → updateVendorStatus
 * (status=contracted). The long-press finalize gesture + curve-zoom coverflow
 * + compare drawer are the next interaction-polish pass (spec §4); the Lock
 * button is the accessible Stage-now equivalent of long-press. Distance /
 * star reviews / verified badges light up once the page fetch joins
 * vendor_profiles for picked marketplace vendors — until then the card shows
 * only what's real (photo→initials, name, price, status), never fabricated.
 *
 * The page returns this component directly; the dashboard layout provides the
 * tab chrome + outer <main>, so this renders its own <div> container (not a
 * nested <main>). The sticky top bar pins at top-0 of the scroll container.
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  Plus,
  Check,
  Clock,
  Eye,
  Sparkles,
  ArrowDown,
} from 'lucide-react';

import { formatPhp } from '@/lib/vendors';
import { deleteVendor, updateVendorStatus } from '../actions';
import {
  formatPesoCompact,
  formatPesoPrecise,
  type PlanBudgetModel,
  type AccordionFolder,
  type AccordionChild,
  type AccordionPick,
  type DueItem,
  type RecapStats,
} from '@/lib/vendors-plan-budget';

const LOCKED = new Set(['contracted', 'deposit_paid', 'delivered', 'complete']);

function isLocked(pick: AccordionPick): boolean {
  return pick.raw_status !== null && LOCKED.has(pick.raw_status);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// ── Root ────────────────────────────────────────────────────────────────
export function PlanBudgetAccordion({
  model,
  eventId,
}: {
  model: PlanBudgetModel;
  eventId: string;
}) {
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const hasAnyPick = model.recap.shortlisted > 0;

  return (
    <div>
      <TopBar model={model} />
      <div className="mx-auto max-w-3xl px-4 pb-28 pt-5 sm:px-6">
        <Overview model={model} eventId={eventId} />

        <div className="mt-8 space-y-2.5">
          {model.folders.map((folder) => (
            <FolderSection
              key={folder.folder}
              folder={folder}
              eventId={eventId}
              open={openFolder === folder.folder}
              onToggle={() =>
                setOpenFolder((cur) =>
                  cur === folder.folder ? null : folder.folder,
                )
              }
            />
          ))}
        </div>

        {hasAnyPick && <Recap recap={model.recap} />}
      </div>
    </div>
  );
}

// ── Surface 1 · Top bar ───────────────────────────────────────────────────
function TopBar({ model }: { model: PlanBudgetModel }) {
  const hasRange = model.rangeHiCentavos > 0;
  const statusWord =
    model.budgetStatus === 'over'
      ? 'over target'
      : model.budgetStatus === 'near'
        ? 'close to target'
        : model.budgetStatus === 'within'
          ? 'on track'
          : null;
  const statusTone =
    model.budgetStatus === 'over'
      ? 'text-mulberry'
      : model.budgetStatus === 'near'
        ? 'text-terracotta-700'
        : 'text-ink/55';

  return (
    <div className="sticky top-0 z-20 border-b border-ink/10 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
            Chosen
          </p>
          <p className="font-mono text-lg font-semibold leading-tight text-ink">
            {formatPesoCompact(model.chosenCentavos)}
          </p>
        </div>

        {hasRange && (
          <div className="min-w-0 text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
              Plan range
            </p>
            <p className="font-mono text-sm font-medium leading-tight text-ink/70">
              {formatPesoCompact(model.rangeLoCentavos)}–
              {formatPesoCompact(model.rangeHiCentavos)}
            </p>
          </div>
        )}
      </div>

      {model.targetCentavos !== null && (
        <div className="mx-auto max-w-3xl px-4 pb-2.5 sm:px-6">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
            <div
              className={`h-full rounded-full transition-all ${
                model.budgetStatus === 'over' ? 'bg-mulberry' : 'bg-terracotta'
              }`}
              style={{ width: `${Math.round(model.meterFill * 100)}%` }}
            />
          </div>
          <p className="mt-1 flex items-center justify-between font-mono text-[10px] text-ink/45">
            <span>of {formatPesoCompact(model.targetCentavos)} target</span>
            {statusWord && <span className={statusTone}>{statusWord}</span>}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Surface 2 · Landing overview ──────────────────────────────────────────
function Overview({
  model,
  eventId,
}: {
  model: PlanBudgetModel;
  eventId: string;
}) {
  return (
    <section className="rounded-2xl border border-ink/10 bg-cream p-5 shadow-sm sm:p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
        Your budget &amp; plan
      </p>
      <h1 className="mt-1 font-serif text-2xl italic text-ink sm:text-3xl">
        Where your day stands
      </h1>

      <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
        <Stat
          label="Estimate"
          value={
            model.targetCentavos !== null
              ? formatPesoPrecise(model.targetCentavos)
              : 'Not set'
          }
        />
        <Stat label="Chosen" value={formatPesoPrecise(model.chosenCentavos)} />
        <Stat
          label="Could land"
          value={
            model.rangeHiCentavos > 0
              ? `${formatPesoCompact(model.rangeLoCentavos)}–${formatPesoCompact(
                  model.rangeHiCentavos,
                )}`
              : '—'
          }
        />
      </dl>

      <WhatToLockNext model={model} eventId={eventId} />

      <p className="mt-5 flex items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/40">
        Your categories below
        <ArrowDown className="h-3 w-3" strokeWidth={2} aria-hidden />
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function WhatToLockNext({
  model,
  eventId,
}: {
  model: PlanBudgetModel;
  eventId: string;
}) {
  if (model.dueList.length === 0 && !model.upNext) {
    return (
      <div className="mt-5 rounded-xl border border-ink/10 bg-terracotta/5 px-4 py-3">
        <p className="text-sm text-ink/70">
          Nothing&rsquo;s urgent right now — you&rsquo;re ahead of the clock.
        </p>
      </div>
    );
  }

  const items: DueItem[] = model.dueList.length > 0 ? model.dueList : [];
  return (
    <div className="mt-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
        {model.dueList.length > 0 ? 'What to lock next' : 'Next up'}
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.map((d) => (
          <DueRow key={d.groupId} item={d} eventId={eventId} />
        ))}
        {model.dueList.length === 0 && model.upNext && (
          <DueRow item={model.upNext} eventId={eventId} calm />
        )}
      </ul>
    </div>
  );
}

function DueRow({
  item,
  eventId,
  calm = false,
}: {
  item: DueItem;
  eventId: string;
  calm?: boolean;
}) {
  const overdue = item.daysLeft < 0;
  const soon = item.daysLeft >= 0 && item.daysLeft <= 20;
  const chip = calm
    ? 'Coming up'
    : overdue
      ? `${Math.abs(item.daysLeft)}d overdue`
      : soon
        ? `${item.daysLeft}d left`
        : `${item.daysLeft}d`;
  const tone = overdue
    ? 'bg-mulberry/10 text-mulberry'
    : soon
      ? 'bg-terracotta/12 text-terracotta-700'
      : 'bg-ink/5 text-ink/55';
  return (
    <li>
      <Link
        href={`/dashboard/${eventId}/vendors#group-${item.groupId}`}
        className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-cream px-4 py-2.5 transition-colors hover:border-terracotta/40"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-ink">
            {item.label}
          </span>
          {item.maxEyeing > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] text-ink/45">
              <Eye className="h-3 w-3" strokeWidth={2} aria-hidden />
              {item.maxEyeing}
            </span>
          )}
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] ${tone}`}
        >
          {chip}
        </span>
      </Link>
    </li>
  );
}

// ── Surface 3 · Folder section ────────────────────────────────────────────
function FolderSection({
  folder,
  eventId,
  open,
  onToggle,
}: {
  folder: AccordionFolder;
  eventId: string;
  open: boolean;
  onToggle: () => void;
}) {
  const hasLocked = folder.lockedTotal > 0;
  return (
    <section
      id={`folder-${folder.folder}`}
      className="overflow-hidden rounded-2xl border border-ink/10 bg-cream"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-terracotta/4 sm:px-5"
      >
        <span className="min-w-0">
          <span className="font-serif text-lg text-ink">{folder.label}</span>
          <span className="mt-0.5 block font-mono text-[11px] text-ink/45">
            {hasLocked
              ? `${formatPesoCompact(folder.lockedTotal)} locked`
              : folder.pickCount > 0
                ? `${folder.pickCount} on your shortlist`
                : 'Not started'}
          </span>
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-ink/40 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          strokeWidth={2}
          aria-hidden
        />
      </button>

      {open && (
        <div className="border-t border-ink/10 bg-terracotta/3 px-2 py-3 sm:px-3">
          {folder.children.length === 0 ? (
            <p className="px-3 py-4 text-sm text-ink/55">
              Nothing here yet for your wedding.
            </p>
          ) : (
            <div className="space-y-4">
              {folder.children.map((child) => (
                <ChildRail
                  key={child.groupId}
                  child={child}
                  eventId={eventId}
                  folderSlug={folder.slug}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ── Surface 4 · Child rail ────────────────────────────────────────────────
function ChildRail({
  child,
  eventId,
  folderSlug,
}: {
  child: AccordionChild;
  eventId: string;
  folderSlug: string;
}) {
  return (
    <div id={`group-${child.groupId}`} className="px-1">
      <div className="mb-2 flex items-center justify-between gap-2 px-2">
        <h3 className="text-sm font-semibold text-ink">{child.label}</h3>
        <DeadlineChip daysLeft={child.daysLeft} state={child.state} />
      </div>

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pl-2 pr-2">
        {child.picks.map((pick) => (
          <VendorCardAtom
            key={pick.vendor_id}
            pick={pick}
            eventId={eventId}
            hardSingle={child.hardSingle}
          />
        ))}
        <AddCard
          eventId={eventId}
          folderSlug={folderSlug}
          groupId={child.groupId}
        />
      </div>
    </div>
  );
}

function DeadlineChip({
  daysLeft,
  state,
}: {
  daysLeft: number | null;
  state: AccordionChild['state'];
}) {
  if (state === 'finalized') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/12 px-2 py-0.5 font-mono text-[10px] text-terracotta-700">
        <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
        Locked
      </span>
    );
  }
  if (daysLeft === null) return null;
  const overdue = daysLeft < 0;
  const soon = daysLeft >= 0 && daysLeft <= 20;
  const tone = overdue
    ? 'bg-mulberry/10 text-mulberry'
    : soon
      ? 'bg-terracotta/12 text-terracotta-700'
      : 'bg-ink/5 text-ink/50';
  const label = overdue
    ? `${Math.abs(daysLeft)}d overdue`
    : soon
      ? `${daysLeft}d left`
      : `${daysLeft}d`;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] ${tone}`}
    >
      <Clock className="h-3 w-3" strokeWidth={2} aria-hidden />
      {label}
    </span>
  );
}

// ── The §3 vendor card atom ───────────────────────────────────────────────
function VendorCardAtom({
  pick,
  eventId,
  hardSingle,
}: {
  pick: AccordionPick;
  eventId: string;
  hardSingle: boolean;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const locked = isLocked(pick);
  const displayName =
    pick.marketplace_business_name ?? pick.vendor_name ?? 'Vendor';
  const photo =
    pick.service_primary_photo_url ??
    pick.manual_vendor_photo_url ??
    pick.marketplace_logo_url ??
    null;
  const price =
    pick.rolled_cost_php !== null ? formatPhp(pick.rolled_cost_php) : null;

  return (
    <div className="relative w-[160px] shrink-0 snap-start">
      <Link
        href={`/dashboard/${eventId}/vendors/${pick.vendor_id}`}
        className={`block overflow-hidden rounded-xl border bg-cream transition-shadow hover:shadow-md ${
          locked ? 'border-terracotta/60' : 'border-ink/12'
        }`}
      >
        {/* Photo */}
        <div className="relative aspect-[4/3] w-full bg-ink/5">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="font-serif text-2xl italic text-ink/30">
                {initials(displayName)}
              </span>
            </div>
          )}
          {locked && (
            <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-terracotta px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-cream">
              <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
              Chosen
            </span>
          )}
        </div>

        {/* Body */}
        <div className="p-2.5">
          <p className="truncate text-[13px] font-semibold leading-tight text-ink">
            {displayName}
          </p>
          {pick.marketplace_city && (
            <p className="mt-0.5 truncate font-mono text-[10px] text-ink/45">
              {pick.marketplace_city}
            </p>
          )}
          <p className="mt-1.5 font-mono text-[12px] text-ink/70">
            {price ?? 'Price on inquiry'}
          </p>
          {pick.eyeing > 0 && (
            <p className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] text-mulberry">
              <Eye className="h-3 w-3" strokeWidth={2} aria-hidden />
              {pick.eyeing} also eyeing
            </p>
          )}
        </div>
      </Link>

      {/* Corner × — tap-to-confirm remove. Hidden once chosen (spec §3). */}
      {!locked && (
        <RemoveControl
          eventId={eventId}
          vendorId={pick.vendor_id}
          confirm={confirmRemove}
          setConfirm={setConfirmRemove}
        />
      )}

      {/* Lock (finalize) — the accessible Stage-now equivalent of long-press.
          Single-pick groups collapse to the chosen card after lock via the
          server revalidate; the gesture + collapse animation is §4 polish. */}
      {!locked && (
        <form action={updateVendorStatus} className="mt-1.5">
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="vendor_id" value={pick.vendor_id} />
          <input type="hidden" name="status" value="contracted" />
          <button
            type="submit"
            className="w-full rounded-lg bg-mulberry px-2 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-cream transition-colors hover:bg-mulberry-600"
          >
            {hardSingle ? 'Lock this one' : 'Lock'}
          </button>
        </form>
      )}
    </div>
  );
}

function RemoveControl({
  eventId,
  vendorId,
  confirm,
  setConfirm,
}: {
  eventId: string;
  vendorId: string;
  confirm: boolean;
  setConfirm: (v: boolean) => void;
}) {
  if (!confirm) {
    return (
      <button
        type="button"
        onClick={() => setConfirm(true)}
        aria-label="Remove from shortlist"
        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-cream/90 text-ink/50 shadow-sm backdrop-blur transition-colors hover:text-mulberry"
      >
        <span className="text-sm leading-none">×</span>
      </button>
    );
  }
  return (
    <form
      action={deleteVendor}
      className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-cream/95 px-1 py-0.5 shadow-sm backdrop-blur"
    >
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="vendor_id" value={vendorId} />
      <button
        type="submit"
        className="rounded-full bg-mulberry px-2 py-0.5 font-mono text-[9px] font-semibold uppercase text-cream"
      >
        Remove
      </button>
      <button
        type="button"
        onClick={() => setConfirm(false)}
        aria-label="Keep"
        className="px-1 font-mono text-[10px] text-ink/50"
      >
        Keep
      </button>
    </form>
  );
}

function AddCard({
  folderSlug,
  groupId,
}: {
  eventId: string;
  folderSlug: string;
  groupId: string;
}) {
  // Discovery jump into the marketplace, scoped to this folder (Stage 1c
  // bridge). The full-height in-app search screen (spec §4) is a later pass.
  return (
    <Link
      href={`/vendors?folder=${folderSlug}&from=plan&group=${groupId}`}
      className="flex w-[160px] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-terracotta/50 bg-terracotta/4 p-4 text-center transition-colors hover:border-terracotta hover:bg-terracotta/8"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-terracotta/12 text-terracotta">
        <Plus className="h-5 w-5" strokeWidth={2} aria-hidden />
      </span>
      <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-terracotta-700">
        Find more
      </span>
    </Link>
  );
}

// ── Surface 5 · Recap ─────────────────────────────────────────────────────
function Recap({ recap }: { recap: RecapStats }) {
  return (
    <section className="mt-10 rounded-2xl border border-ink/10 bg-terracotta/5 p-5 text-center sm:p-6">
      <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
        <Sparkles className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        Look how far you&rsquo;ve come
      </p>
      <p className="mt-2 font-serif text-2xl italic text-ink">
        ~{recap.hoursSaved} hours saved so far
      </p>
      <p className="mt-1 text-sm text-ink/55">
        out of thousands of suppliers in the market — you narrowed it down.
      </p>
      <dl className="mt-5 grid grid-cols-3 gap-3">
        <RecapStat label="Searched" value={recap.searched} />
        <RecapStat label="Shortlisted" value={recap.shortlisted} />
        <RecapStat label="Finalized" value={recap.finalized} />
      </dl>
    </section>
  );
}

function RecapStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-cream px-2 py-3">
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-lg font-semibold text-ink">{value}</dd>
    </div>
  );
}
