'use client';

/**
 * THE SUPPLIER SHEET (owner 2026-10-07 · Suppliers PR2; the prototype's
 * `SHEETS.supplier`, acceptance picture `04-supplier-sheet-light.jpg`).
 *
 * Pressing a supplier's card — one of the couple's, or one in "More to
 * compare" — opens this over the page: a sheet from the bottom on a phone, a
 * panel on the right from 1024 px (the shipped `Sheet`).
 *
 * ⚡ THE MINIMUM-REQUEST RULES (owner 2026-10-08). The first build opened the
 * sheet by re-rendering the whole Suppliers page on the server. This one:
 *   · is drawn AT ONCE from what the pressed card already holds — who, where,
 *     their service card, where things stand — with no request at all;
 *   · asks ONE small thing (`load`: their reviews, finished events, published
 *     photos, other categories, whether the couple follows them), says so in
 *     one line while it is out, and says so with Retry when it fails;
 *   · keeps that answer for the visit, so opening the same supplier twice asks
 *     once;
 *   · never re-renders the page. Follow flips here; Ask goes to the chat.
 *
 * A supplier the couple added themselves is not on Setnayan: there is nothing
 * to ask for, nobody to follow and no page to share, so none of the three is
 * drawn and no request is made.
 */
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Check, Heart, MapPin, MessageCircle, RotateCw, Share2, Star } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { ActionButton, useFitRow } from '@/components/action-button';
import { ServiceCardFace } from '@/app/vendor-dashboard/services/_components/service-card-face';
import { saveVendorToPicks } from '@/app/(shell)/explore/actions';
import { followVendor, unfollowVendor } from '@/lib/follow-actions';
import { cardVerbWords } from '@/lib/supplier-card-verbs';
import { formatCount } from '@/lib/format-number';
import { NEW_TO_SETNAYAN_LABEL } from '@/lib/reviews';
import type { BenchServiceCard } from '@/lib/bench-service-card';
import {
  SHEET_FAILED,
  SHEET_LOADING,
  askAboutLabel,
  sheetPhotoRow,
  sheetPhotosHeading,
  sheetSnapshot,
  sheetWorkHeading,
  type SheetFit,
  type SupplierSheetData,
} from '@/lib/supplier-sheet';
import { contactShortlistVendor } from '../_actions/contact-shortlist-vendor';

/** Everything the pressed card already knows — the sheet's first paint. */
export type SupplierSheetTarget = {
  /** The couple's own pick (`event_vendors.vendor_id`) in THIS category, if any. */
  vendorId: string | null;
  /** Their Setnayan profile — null for a supplier the couple added themselves. */
  vendorProfileId: string | null;
  name: string;
  /** The name shown is a placeholder until they reply (hybrid anonymity). */
  nameWithheld: boolean;
  tile: string;
  categoryLabel: string;
  city: string | null;
  rating: number | null;
  reviewCount: number | null;
  verified: boolean;
  card: BenchServiceCard | null;
  /** The cards were read. False ⇒ the sheet says nothing about a price. */
  cardsRead: boolean;
  coverUrl: string | null;
  /** Where things stand with them here — "Asked for a quote"; null for a stranger. */
  stateLine: string | null;
  /** "Why they fit" — the card's own signals (the couple's cards only). */
  fits: SheetFit[];
  /** Their conversation with the couple, when one is open. */
  threadId: string | null;
  booked: boolean;
  /** Other categories this supplier already sits in on the couple's page:
   *  tile → where things stand there. */
  onPage: Readonly<Record<string, string>>;
};

export type SupplierSheetLoad = (vendorProfileId: string, tile: string) => Promise<SupplierSheetData | null>;

/** One answer per supplier per visit — a second look costs nothing. */
const SEEN = new Map<string, SupplierSheetData>();
const seenKey = (t: SupplierSheetTarget) => `${t.vendorProfileId}|${t.tile}`;
/** …and one request in flight per supplier: a second mount joins it. */
const PENDING = new Map<string, Promise<SupplierSheetData | null>>();
function askOnce(key: string, run: () => Promise<SupplierSheetData | null>): Promise<SupplierSheetData | null> {
  let p = PENDING.get(key);
  if (!p) {
    p = run().finally(() => PENDING.delete(key));
    PENDING.set(key, p);
  }
  return p;
}

type Said = { tone: 'ok' | 'error'; text: string } | null;

export default function SupplierSheet({
  eventId,
  target,
  load,
  onClose,
}: {
  eventId: string;
  target: SupplierSheetTarget;
  /** The sheet's ONE request. Handed in by the bench (the lab hands a stand-in). */
  load: SupplierSheetLoad;
  onClose: () => void;
}) {
  const router = useRouter();
  const onSetnayan = target.vendorProfileId != null;
  const [data, setData] = useState<SupplierSheetData | null>(() => (onSetnayan ? (SEEN.get(seenKey(target)) ?? null) : null));
  const [state, setState] = useState<'idle' | 'loading' | 'failed'>(() => (onSetnayan && !SEEN.has(seenKey(target)) ? 'loading' : 'idle'));
  const [following, setFollowing] = useState<boolean | null>(() => SEEN.get(seenKey(target))?.following ?? null);
  const [said, setSaid] = useState<Said>(null);
  const [busy, start] = useTransition();
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  useFitRow(ctaRef);
  useEffect(() => setPortal(document.body), []);

  const ask = useCallback(() => {
    if (!target.vendorProfileId) return;
    let live = true;
    setState('loading');
    const profileId = target.vendorProfileId;
    askOnce(seenKey(target), () => load(profileId, target.tile))
      .then((res) => {
        if (!live) return;
        if (!res) return setState('failed');
        SEEN.set(seenKey(target), res);
        setData(res);
        setFollowing(res.following);
        setState('idle');
      })
      .catch(() => live && setState('failed'));
    return () => {
      live = false;
    };
  }, [load, target]);

  // On open — and only when this visit has not already asked about them.
  useEffect(() => {
    if (!onSetnayan || SEEN.has(seenKey(target))) return;
    return ask();
  }, [ask, onSetnayan, target]);

  /** Ask for a quote — here, or about another of their categories. A supplier
   *  the couple has never saved is saved first: asking IS how they join the
   *  list (the "More to compare" card does the same). */
  const inquire = (tile: string, vendorId: string | null) => {
    if (!target.vendorProfileId) return;
    setSaid(null);
    start(async () => {
      try {
        let id = vendorId;
        if (!id) {
          const fd = new FormData();
          fd.set('vendor_profile_id', target.vendorProfileId!);
          fd.set('event_id', eventId);
          fd.set('tile', tile);
          const saved = await saveVendorToPicks(fd);
          if (saved.status !== 'ok' && saved.status !== 'already_saved') {
            setSaid({ tone: 'error', text: 'That did not send. Nothing changed.' });
            return;
          }
          id = saved.eventVendorId;
        }
        const res = await contactShortlistVendor({ eventId, vendorId: id });
        if (res.status === 'ok') {
          router.push(`/dashboard/${res.eventId}/messages/${res.threadId}`);
          return;
        }
        setSaid({ tone: 'error', text: res.status === 'error' ? res.message : 'That did not send. Nothing changed.' });
      } catch {
        setSaid({ tone: 'error', text: 'That did not send. Nothing changed.' });
      }
    });
  };

  const toggleFollow = () => {
    if (!target.vendorProfileId || following == null) return;
    const next = !following;
    setFollowing(next); // the press answers at once…
    setSaid(null);
    start(async () => {
      const res = next ? await followVendor(target.vendorProfileId!) : await unfollowVendor(target.vendorProfileId!);
      if (!res.ok) {
        setFollowing(!next); // …and takes it back, in words, if it was refused.
        setSaid({ tone: 'error', text: next ? 'Couldn’t follow them. Nothing changed.' : 'Couldn’t unfollow them. Nothing changed.' });
        return;
      }
      const kept = SEEN.get(seenKey(target));
      if (kept) SEEN.set(seenKey(target), { ...kept, following: next });
    });
  };

  const share = async () => {
    if (!data?.sharePath) return;
    const url = `${window.location.origin}${data.sharePath}`;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: target.name, url });
        return;
      }
    } catch {
      /* closed the share sheet — fall through to the copy */
    }
    try {
      await navigator.clipboard.writeText(url);
      setSaid({ tone: 'ok', text: 'Link copied.' });
    } catch {
      setSaid({ tone: 'error', text: 'Couldn’t copy the link.' });
    }
  };

  if (!portal) return null;
  const chat = cardVerbWords('chat');
  const quote = cardVerbWords('ask');
  const photos = data?.photos ? sheetPhotoRow(data.photos) : null;
  const eyebrow = [target.categoryLabel, target.city].filter(Boolean).join(' · ');
  const k2 = 'font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45';

  return createPortal(
    <Sheet open onClose={onClose} labelledById="supplier-sheet-name" wide rise>
      <div className="space-y-4 px-5 pb-4 pt-5" data-supplier-sheet={target.vendorProfileId ?? 'own'}>
        {/* One height: a <button> is floored at 44 px by globals.css and a link
            is not — the button rule is a 40 px pill, whatever the element. */}
        <style>{'[data-supplier-sheet] .ab{min-height:40px}'}</style>
        <header className="pr-10">
          <p className={k2}>{eyebrow}</p>
          <h2 id="supplier-sheet-name" className="mt-1 font-display text-[22px] leading-tight text-ink">
            {target.name}
          </h2>
          {target.nameWithheld ? <p className="mt-0.5 text-[12px] text-ink/55">Real name shown after they reply</p> : null}
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink/70">
            {target.verified ? (
              <span className="rounded-full bg-success-100 px-2.5 py-1 text-[11px] font-semibold text-success-900">Verified</span>
            ) : null}
            {target.rating != null ? (
              <span className="inline-flex items-center gap-1">
                <Star size={13} strokeWidth={1.75} className="text-terracotta-700" aria-hidden />
                <b className="font-semibold text-ink">{target.rating.toFixed(1)}</b>
                {target.reviewCount != null ? ` · ${formatCount(target.reviewCount)} ${target.reviewCount === 1 ? 'review' : 'reviews'}` : ''}
              </span>
            ) : onSetnayan && typeof target.reviewCount === 'number' ? (
              <span>{NEW_TO_SETNAYAN_LABEL}</span>
            ) : null}
            {target.city ? (
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} strokeWidth={1.75} aria-hidden /> {target.city}
              </span>
            ) : null}
          </p>
        </header>

        <section className="space-y-1.5" data-sheet-section="service-card">
          <p className={k2}>Service card · {target.categoryLabel}</p>
          <ServiceCardFace
            snap={sheetSnapshot(target.card, { categoryLabel: target.categoryLabel, cardsRead: target.cardsRead, selfAdded: !onSetnayan })}
            leafPathLabel={[target.name, onSetnayan ? '' : 'added by you', target.city ?? ''].filter(Boolean).join(' · ')}
            coverUrl={target.card?.coverUrl ?? target.coverUrl}
            footer={null}
          />
          {target.stateLine ? (
            <p className="text-[13px] font-semibold text-[rgb(var(--color-ok))]" data-sheet-state="">
              {target.stateLine}
            </p>
          ) : null}
        </section>

        {onSetnayan ? (
          <section className="space-y-1.5" data-sheet-section="fits">
            <p className={k2}>Proof · why they fit</p>
            {target.fits.length > 0 ? (
              <p className="flex flex-wrap gap-x-3.5 gap-y-1 text-[13.5px]">
                {target.fits.map((f) => (
                  <span key={f.kind} className={f.tone === 'ok' ? 'text-[rgb(var(--color-ok))]' : 'text-[rgb(var(--color-warn))]'}>
                    {f.text}
                  </span>
                ))}
              </p>
            ) : null}
          </section>
        ) : null}

        {/* ── What the ONE request brings. While it is out, one line says so;
            a refusal says so with Retry — never an empty section. */}
        {state === 'loading' ? (
          <p className="text-[13px] text-ink/55" role="status" data-sheet-loading="">
            {SHEET_LOADING}
          </p>
        ) : null}
        {state === 'failed' ? (
          <div className="flex flex-wrap items-center gap-3" role="status" data-sheet-failed="">
            <p className="text-[13px] text-ink/70">{SHEET_FAILED}</p>
            <ActionButton tone="neutral" icon={RotateCw} label="Retry" onClick={() => ask()} />
          </div>
        ) : null}

        {data && data.reviews === null ? (
          <p className="text-[13px] text-ink/55" role="status" data-sheet-section="reviews-failed">
            Couldn’t load their reviews.
          </p>
        ) : null}
        {data?.reviews && data.reviews.length > 0 ? (
          <section data-sheet-section="reviews">
            {data.reviews.map((r) => (
              <div key={r.id} className="border-t border-ink/10 py-2">
                <p className="text-[12px] text-ink/55">
                  <span className="text-terracotta-700" aria-label={`${r.stars} of 5 stars`}>
                    {'★'.repeat(r.stars)}
                  </span>
                  {r.month ? ` · ${r.month}` : ''}
                </p>
                <p className="mt-0.5 text-[14px] leading-snug text-ink">{r.words}</p>
              </div>
            ))}
          </section>
        ) : null}

        {data && data.work.length > 0 ? (
          <section className="space-y-1.5" data-sheet-section="work">
            <p className={k2}>{sheetWorkHeading(data.workTotal)}</p>
            <ul className="space-y-1">
              {data.work.map((w) => (
                <li key={w.id} className="text-[13.5px] text-ink/80">
                  <b className="font-semibold text-ink">{w.kind}</b>
                  {w.month ? ` · ${w.month}` : ''}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {photos && photos.shown.length > 0 ? (
          <section className="space-y-1.5" data-sheet-section="photos">
            <p className={k2}>{sheetPhotosHeading(data!.photos!.length)}</p>
            <div className="grid grid-cols-3 gap-1">
              {photos.shown.map((src, i) => (
                <div key={src} className="relative aspect-square overflow-hidden rounded-[10px] bg-ink/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                  {photos.more > 0 && i === photos.shown.length - 1 ? (
                    <span className="absolute inset-0 grid place-items-center bg-black/35 text-[15px] font-semibold text-white">
                      +{formatCount(photos.more)}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
            <p className="text-[12px] text-ink/55">Their own shots only. No names, no guest details, nothing from a couple’s gallery.</p>
          </section>
        ) : null}

        {data?.others ? (
          <section data-sheet-section="others">
            <p className={k2}>The rest of their portfolio</p>
            {data.others.length === 0 ? (
              <p className="border-t border-ink/10 py-3 text-[14px] text-ink/55">{target.categoryLabel} is all they offer.</p>
            ) : (
              data.others.map((o) => {
                const there = target.onPage[o.tile];
                return (
                  <div key={o.tile} className="grid grid-cols-[1fr_auto] items-center gap-2.5 border-t border-ink/10 py-3 text-[14px]">
                    <span>
                      <b className="font-semibold">{o.label}</b>
                      <br />
                      <span className="text-ink/55">{there ?? 'can be in the same quote'}</span>
                    </span>
                    {there ? (
                      <Check size={18} strokeWidth={2} className="text-[rgb(var(--color-ok))]" aria-label="On your page" />
                    ) : (
                      <ActionButton tone={quote.tone} icon={MessageCircle} label={askAboutLabel(o.label)} disabled={busy} onClick={() => inquire(o.tile, null)} />
                    )}
                  </div>
                );
              })
            )}
          </section>
        ) : null}

        {onSetnayan ? (
          <div className="sticky bottom-0 -mx-5 bg-cream px-5 pb-1 pt-2.5" data-sheet-cta="">
            <div ref={ctaRef} className="flex flex-nowrap items-center gap-2">
              {target.threadId ? (
                <ActionButton tone={chat.tone} icon={MessageCircle} label="Open chat" href={`/dashboard/${eventId}/messages/${target.threadId}`} prefetch={false} />
              ) : target.booked ? null : (
                <ActionButton
                  tone={quote.tone}
                  icon={MessageCircle}
                  label={busy ? 'Asking…' : quote.label}
                  disabled={busy}
                  onClick={() => inquire(target.tile, target.vendorId)}
                />
              )}
              {following != null ? (
                <ActionButton
                  tone="neutral"
                  icon={Heart}
                  label={following ? 'Following' : 'Follow'}
                  aria-pressed={following}
                  disabled={busy}
                  onClick={toggleFollow}
                />
              ) : null}
              {data?.sharePath ? <ActionButton tone="neutral" icon={Share2} label="Share" onClick={() => void share()} /> : null}
            </div>
            {said ? (
              <p className={`mt-1.5 text-[12px] ${said.tone === 'error' ? 'text-[rgb(var(--color-danger))]' : 'text-ink/70'}`} role="status">
                {said.text}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </Sheet>,
    portal,
  );
}
