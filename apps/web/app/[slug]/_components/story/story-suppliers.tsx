'use client';

/**
 * story-suppliers.tsx — WHO MADE THE DAY (owner rulings 2026-11-13, drawn in
 * `prototypes/approved_2026-11-13/story-suppliers-fable.html` v6 and approved "yes to all").
 *
 *   · `PeopleWhoMadeIt` — the scene: the top 8 by supplier plan (Ultra and Pro lead with their service), then
 *     "See all N" / "+N more · See all N", which opens the full sheet.
 *   · the full sheet, "In this story · N suppliers": a short story lists "Booked on Setnayan" then "Added by the couple";
 *     a long one (over 20) groups by plan with counts (Free folded) under a search field.
 *   · every BOOKED supplier is tappable: Supplier Pro / Ultra raise a rich card first (cover · ★ rating · best work ·
 *     Book · Visit the shop · Back to the story); Supplier Plus, Verified and Free open their shop; a supplier the couple
 *     added (no Setnayan shop) is a plain name.
 *   · `UltraSupplierScene` — every Supplier Ultra's own scene, filled with the album it SHARED to this event.
 *
 * Every link was decided on the server (`toStorySupplierViews`); this file only draws them. The layers are portalled to
 * <body> and use the one shared focus hook (`useModalA11y`), the same frame as the story's open-up layer.
 *
 * 🛍 NOTHING HERE SELLS — no price, no plan to buy for the couple or guest reading it.
 */

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { useHydrated } from '@/lib/use-hydrated';
import { InfoTip } from '@/app/_components/info-tip';
import {
  groupStorySuppliers,
  searchStorySuppliers,
  storySuppliersLead,
  storySuppliersSearchable,
  type StorySupplierView,
} from '@/lib/story-suppliers';
import type { UltraAlbum } from '@/app/[slug]/_components/editorial/data';
import { formatCount } from '@/lib/format-number';

const EYEBROW = 'font-mono text-xs font-semibold uppercase tracking-[0.2em] text-ink/70';
const ULTRA_SCENE_TIP =
  'Every Supplier Ultra on this event gets its own scene, however many there are. The photos and videos are the ones the supplier shared from this event. Other supplier plans are listed in the story, with no scene.';

/* ── the frame every layer shares ────────────────────────────────────────── */

function Layer({
  open,
  onClose,
  title,
  eyebrow,
  children,
  label,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useModalA11y({ open, onClose, containerRef: ref, initialFocusRef: closeRef });
  // The layer only ever opens on a tap, after hydration — `useHydrated` keeps the first pass identical to the server's.
  const hydrated = useHydrated();
  if (!open || !hydrated) return null;
  return createPortal(
    <div ref={ref} role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-[95] flex flex-col bg-cream text-ink">
      <header className="flex shrink-0 items-center gap-3 border-b border-ink/10 px-4 py-3">
        <div className="min-w-0 flex-1">
          {eyebrow ? <p className={EYEBROW}>{eyebrow}</p> : null}
          <h2 className="truncate font-serif text-2xl leading-tight">{title}</h2>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Back to the story"
          className="sn-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink/70 hover:bg-ink/5 hover:text-ink"
        >
          <X aria-hidden className="h-5 w-5" strokeWidth={2} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">
        <div className="mx-auto w-full max-w-md">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/* ── one supplier's round mark ───────────────────────────────────────────── */

function Mark({ s, size = 'h-10 w-10' }: { s: StorySupplierView; size?: string }) {
  return s.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={s.logoUrl} alt="" aria-hidden className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span aria-hidden className={`${size} inline-flex shrink-0 items-center justify-center rounded-full bg-terracotta-700 font-serif text-sm text-cream`}>
      {s.initials}
    </span>
  );
}

/* ── the rich card (Supplier Pro / Ultra) ────────────────────────────────── */

function SupplierCard({ s, names, onClose }: { s: StorySupplierView | null; names: string; onClose: () => void }) {
  const c = s?.card ?? null;
  return (
    <Layer open={s !== null} onClose={onClose} title={s?.name ?? ''} label={s ? `${s.name} — ${s.planName ?? ''}` : 'Supplier'}>
      {s ? (
        <div className="overflow-hidden rounded-xl bg-white/70 shadow-[0_8px_24px_-16px_rgba(44,42,41,.35)]">
          <div className="relative h-40 bg-ink/5">
            {c?.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.coverUrl} alt={`${s.name} — their work`} className="h-full w-full object-cover" />
            ) : null}
            <span className="absolute -bottom-6 left-4 rounded-full ring-4 ring-cream">
              <Mark s={s} size="h-14 w-14" />
            </span>
          </div>
          <div className="px-4 pb-5 pt-8">
            <p className="text-sm text-ink/75">
              {s.service ? `${s.service} · ` : ''}
              <span className="font-semibold text-terracotta-700">{s.planName}</span>
            </p>
            {c?.rating !== null && c?.rating !== undefined ? (
              <p className="mt-1 text-sm text-ink">
                ★ {c.rating.toFixed(1)} · {formatCount(c.reviews)} {c.reviews === 1 ? 'review' : 'reviews'}
              </p>
            ) : null}
            {c && c.bestWork.length > 0 ? (
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {c.bestWork.map((u) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={u} src={u} alt="" aria-hidden className="aspect-square w-full rounded-md object-cover" />
                ))}
              </div>
            ) : null}
            <p className="mt-3 text-sm text-ink/70">Booked by {names}</p>
            <div className="mt-4 flex flex-col gap-2">
              {s.bookHref ? (
                <a href={s.bookHref} className="sn-press inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-semibold text-cream">
                  Book
                </a>
              ) : null}
              {s.shopHref ? (
                <a href={s.shopHref} className="sn-press inline-flex min-h-11 items-center justify-center rounded-full border border-ink/20 px-5 text-sm font-semibold text-ink">
                  Visit the shop
                </a>
              ) : null}
              <button type="button" onClick={onClose} className="min-h-11 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-ink/70 hover:underline">
                Back to the story
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Layer>
  );
}

/** A supplier, pressable the way its plan says: the card, the shop, or nothing (a plain name). */
function Tap({ s, onCard, className, children }: { s: StorySupplierView; onCard: (s: StorySupplierView) => void; className: string; children: ReactNode }) {
  if (s.tap === 'card') {
    return (
      <button type="button" onClick={() => onCard(s)} className={`${className} sn-press text-left`} aria-haspopup="dialog">
        {children}
      </button>
    );
  }
  if (s.tap === 'shop' && s.shopHref) {
    return (
      <a href={s.shopHref} className={`${className} sn-press`}>
        {children}
      </a>
    );
  }
  return <span className={className}>{children}</span>;
}

/* ── the full sheet ──────────────────────────────────────────────────────── */

function Row({ s, onCard }: { s: StorySupplierView; onCard: (s: StorySupplierView) => void }) {
  return (
    <li className="border-b border-ink/10 last:border-b-0">
      <Tap s={s} onCard={onCard} className="flex min-h-14 w-full items-center gap-3 py-2">
        <Mark s={s} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-serif text-base font-semibold text-ink">{s.name}</span>
          {s.service ? <span className="block truncate text-xs text-ink/70">{s.service}</span> : null}
        </span>
        {s.badge ? (
          <span className="shrink-0 rounded-full border border-terracotta/40 px-2 py-0.5 font-mono text-xs uppercase tracking-[0.12em] text-terracotta-700">
            {s.badge}
          </span>
        ) : null}
        {s.tap !== 'none' ? <span className="shrink-0 text-xs font-semibold text-ink/80">Visit</span> : null}
      </Tap>
    </li>
  );
}

function SupplierSheet({
  open,
  onClose,
  suppliers,
  names,
  dateLine,
  onCard,
}: {
  open: boolean;
  onClose: () => void;
  suppliers: StorySupplierView[];
  names: string;
  dateLine: string | null;
  onCard: (s: StorySupplierView) => void;
}) {
  const [q, setQ] = useState('');
  const total = suppliers.length;
  const searchable = storySuppliersSearchable(total);
  const found = useMemo(() => searchStorySuppliers(suppliers.map((s) => ({ ...s, category: s.service })), q), [suppliers, q]);
  const groups = useMemo(() => groupStorySuppliers(found), [found]);
  const booked = found.filter((s) => s.tier !== null);
  const own = found.filter((s) => s.tier === null);
  const heading = `In this story · ${formatCount(total)} ${total === 1 ? 'supplier' : 'suppliers'}`;
  return (
    <Layer open={open} onClose={onClose} title={names} eyebrow={dateLine ?? undefined} label={heading}>
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-ink/80">{heading}</p>
      {searchable ? (
        <label className="mt-3 block">
          <span className="sr-only">Search {formatCount(total)} suppliers</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${formatCount(total)} suppliers`}
            className="min-h-11 w-full rounded-full border border-ink/15 bg-white px-4 text-base"
          />
        </label>
      ) : null}
      <p className="mt-3 text-sm text-ink/70">Listed by plan: Ultra, Pro, Plus, Verified, Free. Ultra and Pro open a full card. Each Ultra also has its own scene.</p>
      {searchable ? (
        groups.map((g) =>
          g.folded ? (
            <details key={g.key} className="mt-5">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink/80">
                <span>
                  {g.label} · {formatCount(g.items.length)}
                </span>
                <span className="text-terracotta-700">Show</span>
              </summary>
              <ul className="m-0 list-none p-0">
                {g.items.map((s) => (
                  <Row key={s.key} s={s} onCard={onCard} />
                ))}
              </ul>
            </details>
          ) : (
            <section key={g.key} className="mt-5">
              <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink/80">
                {g.label} · {formatCount(g.items.length)}
              </h3>
              <ul className="m-0 list-none p-0">
                {g.items.map((s) => (
                  <Row key={s.key} s={s} onCard={onCard} />
                ))}
              </ul>
              {g.key === 'own' ? <p className="mt-1 text-xs text-ink/60">A supplier without a Setnayan shop is named, with no link.</p> : null}
            </section>
          ),
        )
      ) : (
        <>
          {booked.length ? (
            <section className="mt-5">
              <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink/80">Booked on Setnayan</h3>
              <ul className="m-0 list-none p-0">
                {booked.map((s) => (
                  <Row key={s.key} s={s} onCard={onCard} />
                ))}
              </ul>
            </section>
          ) : null}
          {own.length ? (
            <section className="mt-5">
              <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink/80">Added by the hosts</h3>
              <ul className="m-0 list-none p-0">
                {own.map((s) => (
                  <Row key={s.key} s={s} onCard={onCard} />
                ))}
              </ul>
              <p className="mt-1 text-xs text-ink/60">A supplier without a Setnayan shop is named, with no link.</p>
            </section>
          ) : null}
        </>
      )}
      {searchable && found.length === 0 ? <p className="mt-6 text-sm text-ink/70">No supplier matches “{q}”.</p> : null}
    </Layer>
  );
}

/* ── the scene: the people who made it ───────────────────────────────────── */

export function PeopleWhoMadeIt({
  suppliers,
  names,
  dateLine,
}: {
  /** Already ordered and linked by `toStorySupplierViews`. */
  suppliers: StorySupplierView[];
  names: string;
  dateLine: string | null;
}) {
  const [sheet, setSheet] = useState(false);
  const [card, setCard] = useState<StorySupplierView | null>(null);
  const lead = storySuppliersLead(suppliers);
  if (lead.total === 0) return null;
  const leads = lead.shown.filter((s) => s.tier === 'enterprise' || s.tier === 'pro');
  const rest = lead.shown.filter((s) => !(s.tier === 'enterprise' || s.tier === 'pro'));
  return (
    <div className="py-8 text-center" data-story-suppliers="">
      <p className={EYEBROW}>From your suppliers · {formatCount(lead.total)}</p>
      <h2 className="mt-1 font-serif text-3xl leading-tight text-ink">The people who made it</h2>
      {leads.length ? (
        <ul className="m-0 mt-5 grid list-none grid-cols-2 gap-2 p-0">
          {leads.map((s) => (
            <li key={s.key}>
              <Tap s={s} onCard={setCard} className="flex w-full flex-col items-center gap-1.5 rounded-xl bg-ink/[0.04] px-2 py-3">
                <Mark s={s} size="h-12 w-12" />
                <span className="block w-full truncate font-serif text-sm font-semibold text-ink">{s.name}</span>
                {s.service ? <em className="block w-full truncate text-xs not-italic text-ink/70">{s.service}</em> : null}
              </Tap>
            </li>
          ))}
        </ul>
      ) : null}
      {rest.length ? (
        <ul className="m-0 mt-4 flex list-none flex-wrap justify-center gap-3 p-0">
          {rest.map((s) => (
            <li key={s.key} className="w-[4.5rem]">
              <Tap s={s} onCard={setCard} className="flex w-full flex-col items-center gap-1">
                <Mark s={s} />
                <span className="block w-full truncate text-xs text-ink/80">{s.name}</span>
              </Tap>
            </li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        onClick={() => setSheet(true)}
        aria-haspopup="dialog"
        className="sn-press mt-5 inline-flex min-h-11 items-center rounded-full border border-ink/20 px-5 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink"
      >
        {lead.more > 0 ? `+${formatCount(lead.more)} more · See all ${formatCount(lead.total)}` : `See all ${formatCount(lead.total)} ${lead.total === 1 ? 'supplier' : 'suppliers'}`}
      </button>
      <SupplierSheet
        open={sheet && card === null}
        onClose={() => setSheet(false)}
        suppliers={suppliers}
        names={names}
        dateLine={dateLine}
        onCard={setCard}
      />
      <SupplierCard s={card} names={names} onClose={() => setCard(null)} />
    </div>
  );
}

/* ── one Supplier Ultra's own scene ──────────────────────────────────────── */

export function UltraSupplierScene({
  album,
  supplier,
  index,
  of,
  names,
}: {
  album: UltraAlbum;
  /** The same supplier as the list draws it — its card and links. */
  supplier: StorySupplierView | null;
  index: number;
  of: number;
  names: string;
}) {
  const [open, setOpen] = useState(false);
  const [card, setCard] = useState<StorySupplierView | null>(null);
  const total = album.photos + album.videos;
  const shown = album.items.slice(0, 4);
  const more = Math.max(0, total - 3);
  const service = supplier?.service ?? null;
  return (
    <div className="py-8" data-ultra-scene={album.vendorProfileId}>
      <p className={EYEBROW}>
        From your suppliers{of > 1 ? ` · ${formatCount(index)} of ${formatCount(of)}` : ''}
      </p>
      <div className="mt-2 flex items-center gap-3">
        {supplier ? <Mark s={supplier} size="h-12 w-12" /> : null}
        <div className="min-w-0">
          <h2 className="truncate font-serif text-3xl leading-tight text-ink">{album.name}</h2>
          <p className="text-sm text-ink/75">
            <span className="mr-2 rounded-full bg-terracotta-700 px-2 py-0.5 font-mono text-xs uppercase tracking-[0.12em] text-cream">Supplier Ultra</span>
            {service}
          </p>
        </div>
      </div>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`See all ${formatCount(total)} from ${album.name}`} className="mt-4 grid w-full grid-cols-2 gap-1.5">
        {shown.map((it, i) => (
          <span key={i} className="relative block aspect-square overflow-hidden rounded-md bg-ink/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.stillUrl} alt="" aria-hidden className="h-full w-full object-cover" />
            {it.videoUrl ? <span aria-hidden className="absolute bottom-1.5 left-1.5 rounded-full bg-ink/70 px-1.5 text-xs text-cream">▶</span> : null}
            {i === 3 && more > 0 ? (
              <span className="absolute inset-0 flex items-center justify-center bg-ink/55 font-serif text-2xl text-cream">+{formatCount(more)}</span>
            ) : null}
          </span>
        ))}
      </button>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen(true)} className="sn-press inline-flex min-h-11 items-center rounded-full bg-ink/5 px-4 text-sm font-semibold text-ink">
          See all {formatCount(total)}
        </button>
        {supplier && supplier.tap !== 'none' ? (
          <Tap s={supplier} onCard={setCard} className="inline-flex min-h-11 items-center rounded-full border border-ink/20 px-4 text-sm font-semibold text-ink">
            Visit the shop
          </Tap>
        ) : null}
        <InfoTip label="Supplier Ultra" labelClassName="text-sm text-ink/75" ariaLabel="About this scene" align="end">
          {ULTRA_SCENE_TIP}
        </InfoTip>
      </div>
      <Layer open={open} onClose={() => setOpen(false)} title={album.name} eyebrow="Supplier Ultra · shared album" label={`${album.name} — shared album`}>
        <p className="text-sm text-ink/70">
          {formatCount(album.photos)} {album.photos === 1 ? 'photo' : 'photos'}
          {album.videos > 0 ? ` · ${formatCount(album.videos)} ${album.videos === 1 ? 'video' : 'videos'}` : ''}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {album.items.map((it, i) =>
            it.videoUrl ? (
              <video key={i} src={it.videoUrl} poster={it.stillUrl} controls playsInline preload="none" className="aspect-square w-full rounded-md bg-ink object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={it.stillUrl} alt={`${album.name} — from ${names}’s day`} loading="lazy" className="aspect-square w-full rounded-md object-cover" />
            ),
          )}
        </div>
      </Layer>
      <SupplierCard s={card} names={names} onClose={() => setCard(null)} />
    </div>
  );
}
