'use client';

/**
 * 🃏 SERVICE CARD GROWN — the card a couple taps, grown into the FULL card (Build 5 Lane C; owner-approved prototype
 * `prototypes/shop_discounts_bundle_card_open_2026-11-09/service-card-maker.html` at corpus commit 8391e487 —
 * DECISION_LOG 2026-11-09 "THE SERVICE CARD OPENS INTO THE FULL CARD", 2026-11-10 "FACTS FIRST, MEDIA LAST",
 * "'SERVICE CARD GROWN' IS THE NAME", "SECTION ROWS PIN AS YOU SCROLL", "… PROTOTYPE APPROVED"; HOUSE_TEMPLATES T4 + T8).
 *
 * It EXTENDS the shipped details sheet (slice D's `ServiceDetailsSheet`; same name, same props, same data) — it is no
 * longer a bottom sheet: it RISES FULL SCREEN from the tapped card's own box (`lib/rise-motion.ts`, the one rise; the
 * bars step away, `useChromeAway`) and ✕ falls back into it, the exact reverse. Drawn on <body>, never inside the page.
 *
 *   hero          the card's cover, edge to edge, 38 % of the screen · ✕ left, ⓘ right, round glass on the photo
 *   pinned bar    past the hero the bar turns solid and carries the title on one line
 *   the face      the card's own name · by the shop · price · the best offer · how the price works · the gift line
 *   facts FIRST   What's included (the WHOLE list + crew) · Not included (+ Serves) · The record · Reviews
 *   media LAST    Photos (an even 3-column grid, +N past six) · Clip (a row; tap plays it in place) · Inspiration
 *   thumb row     Inquire about this (its caption lives in ⓘ)
 *
 * 📌 SECTION ROWS PIN. Each section wraps its own head, so under the pinned bar the head of the section you are in pins
 * compact (its name and count), and the next section's head pushes it out — one pinned row at a time. Tapping it glides
 * back to that section's top (reduced motion: a jump, no slide).
 *
 * Not drawn yet (Lane C slice 2 — each needs a read this card does not carry): Forms (`vendor_form_service_links`) ·
 * Events (`event_vendors.service_id`, no names) · Albums · the supplier's view with hide-per-card. Nothing here is
 * invented in their place.
 *
 * ⚠ THE SETNAYAN EXCLUSIVE IS NOT HERE, AND MUST NOT BE. `vendor_services.exclusive_perk_text` is "Never shown
 * publicly. Revealed in-thread when the vendor token-pursues" (lib/vendor-services.ts) — a reward for the conversation,
 * not card copy.
 *
 * A DUMB VIEW. Every label, peso figure, discount string and serves line arrives pre-formatted from the server
 * (`toServiceCard`), exactly as it does for the card — so the grown card and the card can never disagree about a price.
 */

import Image from 'next/image';
import { Check, ImageIcon, Info, MessageCircle, Play, Tag, Users, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CardRecordSection } from '@/app/_components/card-record-section';
import { CardReviewsBlock } from '@/app/_components/card-reviews-block';
import { SetnayanGiftLine } from '@/app/_components/setnayan-gift-line';
import { VerifiedBookingMark } from '@/app/_components/service-card-view';
import { useChromeAway } from '@/app/_components/nav/use-chrome-away';
import { ActionButton, actionButtonClass } from '@/components/action-button';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { riseFromRect } from '@/lib/rise-motion';
import { focusServiceInquiry } from '@/lib/service-inquiry-focus';
import { formatCount } from '@/lib/format-number';
import type { ServiceCard } from './services-gallery';

/**
 * How the grown card's "Inquire about this" behaves, decided SERVER-side because only the server knows which composer
 * (if any) is on the page:
 *
 *   • 'focus'  — the signed-in couple's `InquiryComposer` is mounted. The button points it at THIS service and opens it.
 *   • 'anchor' — only the compose-first `AnonInquiryComposer` is mounted (a visitor without an event yet). It has its own
 *                service picker, so we send them to it rather than pretending to preselect.
 *   • 'none'   — no composer at all (not bookable / no contact route). No CTA, because a button that does nothing is
 *                worse than no button.
 */
export type ServiceInquireMode = 'focus' | 'anchor' | 'none';

/** The pinned bar's height — the section heads pin right under it. */
export const GROWN_BAR_PX = 56;
/** Photos past this many fold into a "+N" sixth tile (the prototype's even grid, no gaps). */
const PHOTOS_SHOWN = 6;

/** The sections, in the approved order: facts first, media last (DECISION_LOG 2026-11-10 "FACTS FIRST, MEDIA LAST"). */
export const GROWN_SECTION_ORDER = ['included', 'not', 'serves', 'record', 'reviews', 'photos', 'clip', 'inspiration'] as const;
type SectionKey = (typeof GROWN_SECTION_ORDER)[number];

const reduceMotion = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

const lines = (n: number, one: string, many: string) => `${formatCount(n)} ${n === 1 ? one : many}`;

export function ServiceDetailsSheet({
  card: c,
  inquireMode,
  onClose,
  shopName = null,
  from = null,
}: {
  card: ServiceCard;
  inquireMode: ServiceInquireMode;
  onClose: () => void;
  /** "by {shop}" under the card's name. */
  shopName?: string | null;
  /** The tapped card's box — the rise starts there and ✕ falls back into it. Null: it simply appears. */
  from?: HTMLElement | null;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [pinned, setPinned] = useState(false);
  const [stuck, setStuck] = useState<SectionKey | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [allPhotos, setAllPhotos] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => setHost(document.body), []);
  useChromeAway(true);

  /** ✕ — the exact reverse of the rise, back into the card it came from; then the page lets go of it. */
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const el = layerRef.current;
    const back = el && from && from.isConnected ? riseFromRect(el, from.getBoundingClientRect(), { reverse: true }) : null;
    if (back) void back.finished.then(onClose, onClose);
    else onClose();
  }, [from, onClose]);

  // Mounted only while open, so mount = open. The shared hook handles the focus trap + restore, Esc-to-close and the
  // reference-counted body-scroll lock.
  useModalA11y({ open: true, onClose: close, containerRef: layerRef });

  // ⤴ THE RISE — once, from the tapped card, as soon as the layer is on <body>.
  useLayoutEffect(() => {
    const el = layerRef.current;
    if (!el || !from || !from.isConnected) return;
    riseFromRect(el, from.getBoundingClientRect());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the rise plays once, when the portal first lands
  }, [host]);

  const onScroll = () => {
    const sc = scrollRef.current;
    if (!sc) return;
    const hero = heroRef.current;
    setPinned(sc.scrollTop > (hero ? hero.offsetHeight : 0) - GROWN_BAR_PX);
    const line = sc.getBoundingClientRect().top + GROWN_BAR_PX;
    let cur: SectionKey | null = null;
    sc.querySelectorAll<HTMLElement>('[data-grown-head]').forEach((h) => {
      if (Math.abs(h.getBoundingClientRect().top - line) < 1) cur = h.dataset.grownHead as SectionKey;
    });
    setStuck(sc.scrollTop > 0 ? cur : null);
  };

  /** A tap on a section's head glides back to that section's top, under the pinned bar. */
  const glide = (key: SectionKey) => {
    const sc = scrollRef.current;
    const sec = sc?.querySelector<HTMLElement>(`[data-grown-sec="${key}"]`);
    if (!sc || !sec) return;
    const y = sc.scrollTop + sec.getBoundingClientRect().top - sc.getBoundingClientRect().top - GROWN_BAR_PX;
    sc.scrollTo({ top: Math.max(0, y), behavior: reduceMotion() ? 'auto' : 'smooth' });
  };

  function onInquire() {
    // Close FIRST: the composer opens its own dialog, and two `useModalA11y` layers stacked over one another would
    // leave the couple peeling Escapes.
    onClose();
    focusServiceInquiry(c.id);
  }

  // ── what this card holds — the FULL inclusion list when the server sent it, else the card's trimmed lines ──
  const inclusions = c.inclusionsFull && c.inclusionsFull.length > 0 ? c.inclusionsFull : c.inclusions;
  const cover = c.photos[0] ?? null;
  const photos = c.photos;
  const cut = !allPhotos && photos.length > PHOTOS_SHOWN;
  const shownPhotos = cut ? photos.slice(0, PHOTOS_SHOWN - 1) : photos;
  const looks = c.inspirationLooks ?? [];
  const couples = c.coupleLooks ?? [];
  const hosts = c.reviews?.hosts ?? null;
  const guests = c.reviews?.guests ?? null;
  const servesLine = c.serves ? (
    <p className="mt-2.5 flex items-start gap-1.5 text-[12.5px] leading-snug text-ink/60" data-grown-serves="">
      <Users aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/40" strokeWidth={2} />
      <span>Serves: {c.serves}</span>
    </p>
  ) : null;

  const sections: { key: SectionKey; title: string; count: string; body: ReactNode }[] = [];
  if (inclusions.length > 0) {
    sections.push({
      key: 'included',
      title: 'What’s included',
      count: lines(inclusions.length, 'line', 'lines'),
      body: (
        <>
          <ul className="space-y-0.5">
            {inclusions.map((line) => (
              <li key={line} className="flex items-start gap-2 py-0.5 text-[14px] leading-snug text-ink/75">
                <Check aria-hidden className="mt-1 h-3.5 w-3.5 shrink-0 text-mulberry" strokeWidth={2.25} />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          {c.meta ? <p className="mt-1.5 text-[13px] text-ink/60">{c.meta}</p> : null}
          {c.notIncluded.length === 0 ? servesLine : null}
        </>
      ),
    });
  }
  if (c.notIncluded.length > 0) {
    sections.push({
      key: 'not',
      title: 'Not included',
      count: 'billed by the quote',
      body: (
        <>
          <ul className="flex flex-wrap gap-1.5">
            {c.notIncluded.map((line) => (
              <li
                key={line}
                className="inline-flex min-h-7 items-center gap-1 rounded-full bg-ink/5 px-2.5 text-[12.5px] text-ink/65"
              >
                <Info aria-hidden className="h-3 w-3 shrink-0 text-ink/40" strokeWidth={2} />
                {line}
              </li>
            ))}
          </ul>
          {servesLine}
        </>
      ),
    });
  }
  if (inclusions.length === 0 && c.notIncluded.length === 0 && servesLine) {
    sections.push({ key: 'serves', title: 'Serves', count: 'who it is for', body: servesLine });
  }
  // The record this card has earned — the SAME compiled object the card renders, from the page's one batched read.
  if (c.record) {
    sections.push({
      key: 'record',
      title: 'The record',
      count: `Booked ${formatCount(c.record.bookedCount)}×`,
      body: <CardRecordSection record={c.record} variant="couple" rating={c.recordRating} />,
    });
  }
  if (c.reviews && (hosts || guests)) {
    const n = (hosts?.count ?? 0) + (guests?.count ?? 0);
    const avg = hosts ? hosts.average : (guests?.average ?? 0);
    sections.push({
      key: 'reviews',
      title: 'Reviews',
      count: `${formatCount(n)} · ${avg.toFixed(1)}★`,
      body: <CardReviewsBlock reviews={c.reviews} />,
    });
  }
  // ── MEDIA, LAST: it runs on ──
  if (photos.length > 0 || couples.length > 0) {
    sections.push({
      key: 'photos',
      title: 'Photos',
      count: formatCount(photos.length + couples.length),
      body: (
        <>
          {photos.length > 0 ? (
            <ul className="grid grid-cols-3 gap-1" data-grown-photos="">
              {shownPhotos.map((url, idx) => (
                <li key={url} className="relative aspect-square overflow-hidden rounded-lg bg-ink/5">
                  <Image src={url} alt={`${c.label} photo ${idx + 1}`} fill sizes="(min-width: 640px) 200px, 33vw" className="object-cover" />
                </li>
              ))}
              {cut ? (
                <li className="relative aspect-square overflow-hidden rounded-lg bg-ink/5">
                  <button
                    type="button"
                    onClick={() => setAllPhotos(true)}
                    aria-label={`Show all ${formatCount(photos.length)} photos`}
                    className="absolute inset-0"
                    data-grown-photos-more=""
                  >
                    <Image src={photos[PHOTOS_SHOWN - 1]!} alt="" fill sizes="33vw" className="object-cover opacity-35 grayscale-[.4]" />
                    <b className="absolute inset-0 grid place-items-center text-[20px] font-semibold text-ink">
                      +{formatCount(photos.length - (PHOTOS_SHOWN - 1))}
                    </b>
                  </button>
                </li>
              ) : null}
            </ul>
          ) : null}
          {/* 📸 FROM COUPLES — couples' own photos of this card's work, approved by the shop, with their credit line. */}
          {couples.length > 0 ? (
            <div className={photos.length > 0 ? 'mt-3' : ''} data-grown-couple-looks="">
              <p className="text-[12.5px] font-medium text-ink/60">From couples</p>
              <ul className="mt-1.5 grid grid-cols-3 gap-1">
                {couples.map((look) => (
                  <li key={look.id} className="min-w-0">
                    <div className="relative aspect-square overflow-hidden rounded-lg bg-ink/5">
                      {/* eslint-disable-next-line @next/next/no-img-element -- a couple's own photo, already a public URL */}
                      <img src={look.url} alt={`${c.label} — shared by ${look.credit}`} className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
                      {look.verifiedBooking === true ? <VerifiedBookingMark /> : null}
                    </div>
                    <p className="mt-1 truncate text-[12px] leading-tight text-ink/60" title={look.credit}>
                      {look.credit}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ),
    });
  }
  if (c.videoUrl) {
    sections.push({
      key: 'clip',
      title: 'Clip',
      count: 'up to 30 s',
      body: playing ? (
        // Plays where it was tapped — the row becomes the player, nothing opens over it.
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={c.videoUrl} controls autoPlay playsInline className="max-h-80 w-full rounded-lg bg-ink/5 object-cover" data-grown-clip="playing" />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="sn-press flex min-h-[60px] w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left"
          style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
          data-grown-clip=""
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-ink/70 text-white">
            <Play aria-hidden className="h-4 w-4" strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block truncate text-[14px] font-semibold text-ink">The clip</b>
            <small className="block truncate text-[12px] text-ink/55">tap to play · one clip, up to 30 s</small>
          </span>
        </button>
      ),
    });
  }
  if (looks.length > 0) {
    sections.push({
      key: 'inspiration',
      title: 'Inspiration',
      count: formatCount(looks.length),
      body: (
        <ul className="grid grid-cols-3 gap-1" data-grown-inspiration="">
          {looks.map((l) => (
            <li key={l.id} className="relative aspect-square overflow-hidden rounded-lg bg-ink/5">
              {/* eslint-disable-next-line @next/next/no-img-element -- an approved library photo, already a display URL */}
              <img src={l.url} alt={l.part} className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
            </li>
          ))}
        </ul>
      ),
    });
  }

  const roundBtn = `sn-press inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta ${
    pinned ? 'border-ink/10 bg-[var(--m-paper)] text-ink' : 'border-white/30 bg-[rgba(20,18,14,.38)] text-white backdrop-blur-md'
  }`;

  const layer = (
    <div
      ref={layerRef}
      className="fixed inset-0 z-50 flex h-[100dvh] flex-col focus:outline-none"
      style={{ background: 'var(--sn-canvas)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="service-details-title"
      data-service-card-grown=""
    >
      <div className="relative mx-auto flex h-full w-full max-w-xl flex-col">
        {/* ── The bar over the hero: ✕ · (the title, once pinned) · ⓘ ── */}
        <div
          className="absolute inset-x-0 top-0 z-[4] flex items-center gap-2 px-4 transition-[background-color,box-shadow] duration-200"
          style={{
            height: GROWN_BAR_PX,
            background: pinned ? 'var(--sn-canvas)' : 'transparent',
            boxShadow: pinned ? '0 1px 0 var(--m-line)' : 'none',
          }}
          data-grown-bar={pinned ? 'pinned' : ''}
        >
          <button type="button" onClick={close} aria-label="Close" className={roundBtn}>
            <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <b
            className={`min-w-0 flex-1 truncate text-[16px] font-semibold text-ink transition-opacity duration-200 ${pinned ? 'opacity-100' : 'opacity-0'}`}
            aria-hidden={!pinned}
          >
            {c.label}
          </b>
          <button
            type="button"
            onClick={() => setAboutOpen((v) => !v)}
            aria-expanded={aboutOpen}
            aria-controls="grown-about"
            aria-label="About this card"
            className={roundBtn}
          >
            <Info aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <div ref={scrollRef} onScroll={onScroll} className="relative flex-1 overflow-y-auto overflow-x-hidden pb-24" data-grown-scroll="">
          {/* ── The hero: the card's cover, edge to edge ── */}
          <div ref={heroRef} className="relative h-[38svh] min-h-48 overflow-hidden" style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-deep)' }} data-grown-hero="">
            {cover ? (
              <Image src={cover} alt={`${c.label} cover`} fill priority sizes="(min-width: 640px) 576px, 100vw" className="object-cover" />
            ) : (
              <span className="absolute inset-0 grid place-items-center">
                <ImageIcon aria-hidden className="h-7 w-7" strokeWidth={1.5} />
              </span>
            )}
          </div>

          {/* ── The face, grown: the card's own name · shop · price · offer · how the price works ── */}
          <div className="px-4 pb-2 pt-3" data-grown-face="">
            <h2 id="service-details-title" className="text-[16px] font-semibold leading-snug text-ink">
              {c.label}
            </h2>
            {shopName ? <p className="mt-0.5 text-[12.5px] text-ink/55">by {shopName}</p> : null}
            <p className="mt-1 text-[14px] font-semibold" style={{ color: 'var(--m-orange-2)' }}>
              {c.priceLabel}
            </p>
            {c.discountLabel ? (
              <p className="mt-1 flex items-center gap-1.5 text-[12.5px] font-medium text-terracotta-700">
                <Tag aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                <span>{c.discountLabel}</span>
              </p>
            ) : null}
            {c.priceDetail ? <p className="mt-1 text-[12px] leading-snug text-ink/55">{c.priceDetail}</p> : null}
            {c.givesSetnayanGift ? <SetnayanGiftLine className="mt-1.5 flex items-start gap-1.5 text-[12px] font-medium text-terracotta-700" /> : null}
          </div>

          {/* ⓘ — what a couple does NOT need before acting (the card's caption moved here). */}
          {aboutOpen ? (
            <div id="grown-about" className="mx-4 mb-2 rounded-xl px-3 py-2.5 text-[13px] leading-snug text-ink/70" style={{ background: 'var(--m-paper-2)' }} data-grown-about="">
              <p>The whole card: the price and the best offer, what is included and not, who it serves, its record and reviews, then every photo, the clip and inspiration.</p>
              <p className="mt-1.5">Starting price set by the supplier. Final quotes happen in chat.</p>
            </div>
          ) : null}

          {sections.map((s) => (
            <section key={s.key} data-grown-sec={s.key} aria-labelledby={`grown-h-${s.key}`}>
              {/* 📌 The head pins under the bar while you are in this section; the next one pushes it out. */}
              <button
                type="button"
                onClick={() => glide(s.key)}
                className="sticky z-[3] flex min-h-11 w-full items-center gap-2.5 border-t px-4 pb-1.5 pt-3 text-left"
                style={{
                  top: GROWN_BAR_PX,
                  borderColor: 'var(--m-line)',
                  background: 'var(--sn-canvas)',
                  boxShadow: stuck === s.key ? '0 1px 0 var(--m-line)' : 'none',
                }}
                data-grown-head={s.key}
                data-stuck={stuck === s.key ? '' : undefined}
                aria-label={`${s.title} · ${s.count} · back to its top`}
              >
                <span id={`grown-h-${s.key}`} className="text-[14px] font-semibold text-ink">
                  {s.title}
                </span>
                <small className="ml-auto min-w-0 truncate text-right text-[12px] text-ink/55">{s.count}</small>
              </button>
              <div className="px-4 pb-3 pt-1">{s.body}</div>
            </section>
          ))}
        </div>

        {/* ── The doorway out, in the thumb row ── */}
        {inquireMode !== 'none' ? (
          <div
            className="absolute inset-x-0 bottom-0 z-[5] flex px-4 pt-6"
            style={{
              paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
              background: 'linear-gradient(to top, var(--sn-canvas) 70%, transparent)',
            }}
            data-grown-thumb=""
          >
            {inquireMode === 'focus' ? (
              <ActionButton tone="brand" main icon={MessageCircle} label="Inquire about this" onClick={onInquire} className="w-full" />
            ) : (
              <a
                href="#get-in-touch"
                // The shop's Inquire pop-up (inquire-sheet.tsx) catches this press and opens with THIS card picked.
                data-inquire-service={c.id}
                onClick={onClose}
                className={actionButtonClass('brand', { main: true, extra: 'w-full' })}
              >
                <MessageCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                <span>Inquire about this</span>
              </a>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );

  return host ? createPortal(layer, host) : null;
}
