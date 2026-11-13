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
 *   thumb row     Choose this service (opens the shop's ONE Inquire pop-up with this card picked; caption in ⓘ)
 *
 * 📌 SECTION ROWS PIN. Each section wraps its own head, so under the pinned bar the head of the section you are in pins
 * compact (its name and count), and the next section's head pushes it out — one pinned row at a time. Tapping it glides
 * back to that section's top (reduced motion: a jump, no slide).
 *
 * ⤴ THE COVER MORPH (ruling 5976): while the layer rises, the hero's clip opens out of the tapped card's own cover
 * (`heroClipFrom`) over the same 0.7 s (`RISE_MS`, DECISION_LOG "SIX ANSWERS" (2) — not the prototype's 520 ms); ✕ plays
 * it back into the cover. Reduced motion: the layer crossfades and the clip does not move. The hero PLAYS the card's
 * photos (the face's cover show, #7532) and a swipe turns it.
 *
 * 🃏 THE SHOP'S OWN CARD (ruling 5970 · prototype `hidable()`): when the viewer runs the shop (`owner`), a tap on a
 * photo, the clip, an event line, an inspiration photo or a review hides it ON THIS CARD — greyed, "Hidden on this card", a
 * second tap shows it again; nothing is deleted and it stays everywhere else (`lib/service-card-hides.ts`). 👁 in the bar
 * flips to the Couple view: exactly what couples get, hidden items left out. The card's opens (the same count Shop ›
 * Analytics draws) sit under the face in both views and have no hide. Forms are never hidden here. A hidden REVIEW
 * (owner ruling DECISION_LOG 2026-11-13 "Yes, add reviews") loses its words on this card only; it still counts in the
 * card's number, stays on the shop page and stays with the couple or guest who wrote it.
 *
 * EVENTS, WITHOUT NAMES (ruling 5970 "events shown without names"): the record's own anonymised lines (type · month ·
 * guest band — `service_card_records`, its SQL floor intact), drawn as their own section after Reviews.
 *
 * Not drawn yet: Forms (`vendor_form_service_links`). Nothing here is invented in its place.
 *
 * ⚠ THE SETNAYAN EXCLUSIVE IS NOT HERE, AND MUST NOT BE. `vendor_services.exclusive_perk_text` is "Never shown
 * publicly. Revealed in-thread when the vendor token-pursues" (lib/vendor-services.ts) — a reward for the conversation,
 * not card copy.
 *
 * A DUMB VIEW. Every label, peso figure, discount string and serves line arrives pre-formatted from the server
 * (`toServiceCard`), exactly as it does for the card — so the grown card and the card can never disagree about a price.
 */

import Image from 'next/image';
import { Explain } from '@/app/_components/explain';
import { CalendarDays, Check, Eye, EyeOff, ImageIcon, Info, MessageCircle, Play, Tag, Users, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CardRecordSection } from '@/app/_components/card-record-section';
import { CardReviewsBlock } from '@/app/_components/card-reviews-block';
import { SetnayanGiftLine } from '@/app/_components/setnayan-gift-line';
import { VerifiedBookingMark } from '@/app/_components/service-card-view';
import { useChromeAway } from '@/app/_components/nav/use-chrome-away';
import { ActionButton, actionButtonClass } from '@/components/action-button';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { HERO_CLIP_OPEN, RISE_EASE, RISE_MS, heroClipFrom, riseFromRect } from '@/lib/rise-motion';
import { ServiceFaceCoverShow } from '@/app/_components/service-face-cover-show';
import { coverPhotoList } from '@/lib/service-cover-show';
import { cardItemKeys } from '@/lib/service-card-hides';
import { focusServiceInquiry } from '@/lib/service-inquiry-focus';
import { formatCount } from '@/lib/format-number';
import type { ServiceCard } from './services-gallery';

/**
 * How the grown card's "Choose this service" behaves, decided SERVER-side because only the server knows which composer
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
export const GROWN_SECTION_ORDER = ['included', 'not', 'serves', 'record', 'reviews', 'events', 'photos', 'clip', 'inspiration'] as const;
type SectionKey = (typeof GROWN_SECTION_ORDER)[number];

const reduceMotion = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

const lines = (n: number, one: string, many: string) => `${formatCount(n)} ${n === 1 ? one : many}`;

/**
 * 🃏 The shop's own view of its card (ruling 5970): what it hid on this card and the card's opens. Null for everyone
 * else — a couple's card arrives with the hidden items already dropped on the server (`cardWithoutHidden`), so there
 * is nothing here for it to leave out.
 */
export type GrownCardOwner = {
  /** Keys hidden on THIS card right now (`lib/service-card-hides.ts`). */
  hidden: ReadonlySet<string>;
  /** Keys whose save is in flight — drawn busy, never flipped until the save is confirmed. */
  saving: ReadonlySet<string>;
  /** The last save on this card failed or was refused — said in words; the item stays as it was. */
  saveError: string | null;
  /** Hide (true) or show again (false) one item. */
  onToggle: (key: string, hide: boolean) => void;
  /** Distinct viewer-days opened in the last 12 months; null = the read failed ("Couldn't load", never 0). */
  opens: number | null;
};

/** The supplier's words for each media section (prototype `fcSubs`). */
const SUP_NOTE = {
  events: 'booked on this card · tap one to hide it here',
  photos: 'tap one to hide it here',
  clip: 'tap to hide it here',
  inspiration: 'from this card’s work · tap one to hide it here',
  reviews: 'tap a review to hide it here',
} as const;
const hiddenNote = (n: number, fallback: string) => (n > 0 ? `${formatCount(n)} hidden · tap to show again` : fallback);

export function ServiceDetailsSheet({
  card: c,
  inquireMode,
  onClose,
  shopName = null,
  from = null,
  owner = null,
}: {
  card: ServiceCard;
  inquireMode: ServiceInquireMode;
  onClose: () => void;
  /** "by {shop}" under the card's name. */
  shopName?: string | null;
  /** The tapped card's box — the rise starts there and ✕ falls back into it. Null: it simply appears. */
  from?: HTMLElement | null;
  /** 🃏 Set only when the viewer runs this shop — hide per card, 👁 Couple view, the card's opens. */
  owner?: GrownCardOwner | null;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [pinned, setPinned] = useState(false);
  const [stuck, setStuck] = useState<SectionKey | null>(null);
  const [allPhotos, setAllPhotos] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [coupleView, setCoupleView] = useState(false);
  const [hintOff, setHintOff] = useState(false);
  const [told, setTold] = useState<string | null>(null);
  const toldOnce = useRef(false);
  /** The supplier curating: hidden items stay, greyed, and a tap toggles them. */
  const curating = owner !== null && !coupleView;
  const isHidden = (key: string | null) => key !== null && owner !== null && owner.hidden.has(key);
  /** Left out of the card — for couples, and in the 👁 Couple view. */
  const leftOut = (key: string | null) => !curating && isHidden(key);

  useEffect(() => setHost(document.body), []);
  // The one-time "hidden on this card only" line steps away by itself.
  useEffect(() => {
    if (!told) return;
    const t = setTimeout(() => setTold(null), 3200);
    return () => clearTimeout(t);
  }, [told]);
  useChromeAway(true);

  /** ✕ — the exact reverse of the rise, back into the card it came from; then the page lets go of it. */
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const el = layerRef.current;
    if (el && from && from.isConnected) {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      morphHero(from, true);
    }
    const back = el && from && from.isConnected ? riseFromRect(el, from.getBoundingClientRect(), { reverse: true }) : null;
    if (back) void back.finished.then(onClose, onClose);
    else onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- morphHero reads refs only
  }, [from, onClose]);

  // Mounted only while open, so mount = open. The shared hook handles the focus trap + restore, Esc-to-close and the
  // reference-counted body-scroll lock.
  useModalA11y({ open: true, onClose: close, containerRef: layerRef });

  /**
   * ⤴ THE COVER MORPH — the hero's clip opens out of the tapped card's cover (or, `back`, closes into it) over the same
   * 0.7 s as the rise. Measured BEFORE the rise starts, so the hero's box is its own, untransformed one. Reduced motion:
   * nothing here moves (the layer's own crossfade carries it).
   */
  function morphHero(card: HTMLElement, back: boolean) {
    const el = layerRef.current;
    const hero = heroRef.current;
    const cover = card.querySelector<HTMLElement>('[data-service-face-cover]');
    if (!el || !hero || !cover || reduceMotion() || typeof hero.animate !== 'function') return;
    const clip = heroClipFrom(hero.getBoundingClientRect(), cover.getBoundingClientRect(), card.getBoundingClientRect(), el.getBoundingClientRect());
    hero.animate([{ clipPath: clip }, { clipPath: HERO_CLIP_OPEN }], {
      duration: RISE_MS,
      easing: RISE_EASE,
      direction: back ? 'reverse' : 'normal',
      fill: 'both',
    });
  }

  // ⤴ THE RISE — once, from the tapped card, as soon as the layer is on <body>; the hero morphs out of its cover.
  useLayoutEffect(() => {
    const el = layerRef.current;
    if (!el || !from || !from.isConnected) return;
    morphHero(from, false);
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
  const keys = cardItemKeys(c);
  // Every photo with its hide key; couples (and the 👁 view) get the ones not hidden.
  const photoItems = c.photos.map((url, i) => ({ url, key: keys.photos[i] ?? null })).filter((p) => !leftOut(p.key));
  const photos = photoItems.map((p) => p.url);
  const cover = photos[0] ?? null;
  // 🎞 The hero plays what the card shows (the face's own cover show, #7532) — still when there is one photo.
  const heroShow = coverPhotoList(null, photos);
  const cut = !allPhotos && photoItems.length > PHOTOS_SHOWN;
  const shownPhotos = cut ? photoItems.slice(0, PHOTOS_SHOWN - 1) : photoItems;
  const clipShown = c.videoUrl && !leftOut(keys.clip) ? c.videoUrl : null;
  const looks = (c.inspirationLooks ?? []).map((l, i) => ({ ...l, key: keys.insp[i] ?? null })).filter((l) => !leftOut(l.key));
  const eventLines = (c.record?.ledger ?? []).map((l, i) => ({ ...l, key: keys.events[i] ?? null })).filter((l) => !leftOut(l.key));
  const nHidden = (ks: ReadonlyArray<string | null>) => (curating ? ks.filter((k) => isHidden(k)).length : 0);

  /** 🃏 One hideable item: for the curating supplier a button (tap = hide · tap again = show); for everyone else the item. */
  const hidable = (key: string | null, label: string, className: string, inner: ReactNode) => {
    if (!curating || key === null) return <div className={className}>{inner}</div>;
    const h = isHidden(key);
    const saving = owner?.saving.has(key) ?? false;
    // A tile fills its square (the label sits over its foot); a row keeps the label at its end.
    const tile = className.includes('absolute inset-0');
    return (
      <button
        type="button"
        onClick={() => {
          if (saving) return;
          owner?.onToggle(key, !h);
          if (!h && !toldOnce.current) {
            toldOnce.current = true;
            setTold('Hidden on this card only — still on your shop, Portfolio and other cards.');
          }
        }}
        aria-pressed={h}
        aria-busy={saving || undefined}
        disabled={saving}
        aria-label={`${label} · ${h ? 'hidden on this card · tap to show it' : 'tap to hide it on this card'}`}
        className={`${className} sn-press text-left${tile ? '' : ' relative'}`}
        data-card-hidable=""
        data-hidden={h ? '' : undefined}
        data-saving={saving ? '' : undefined}
      >
        <span className={`${tile ? 'absolute inset-0 block' : 'block min-w-0 flex-1'}${h ? ' opacity-35 grayscale' : ''}${saving ? ' animate-pulse' : ''}`}>{inner}</span>
        {h ? (
          <span
            className={`pointer-events-none flex items-center justify-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-tight text-ink/70 ${
              tile ? 'absolute inset-x-1 bottom-1 bg-[var(--sn-canvas)]/90 text-center' : 'shrink-0'
            }`}
          >
            <EyeOff aria-hidden className="h-3 w-3 shrink-0" strokeWidth={2} />
            Hidden on this card
          </span>
        ) : null}
      </button>
    );
  };
  const couples = c.coupleLooks ?? [];
  const hosts = c.reviews?.hosts ?? null;
  const guests = c.reviews?.guests ?? null;
  // ⭐ The review each group shows, left out in the 👁 Couple view when hidden — its number stays (it still counts).
  const hostGone = hosts !== null && leftOut(keys.reviews.host);
  const guestGone = guests !== null && leftOut(keys.reviews.guest);
  const shownReviews =
    c.reviews && (hostGone || guestGone)
      ? {
          hosts: hostGone && hosts ? { ...hosts, quote: null, by: null, verifiedBooking: false } : hosts,
          guests: guestGone && guests ? { ...guests, newest: null } : guests,
        }
      : c.reviews;
  const servesLine = c.serves ? (
    <p className="mt-2.5 flex items-start gap-1.5 text-[12.5px] leading-snug text-ink/60" data-grown-serves="">
      <Users aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/40" strokeWidth={2} />
      <span>Serves: {c.serves}</span>
    </p>
  ) : null;

  const sections: { key: SectionKey; title: string; note: string; body: ReactNode }[] = [];
  if (inclusions.length > 0) {
    sections.push({
      key: 'included',
      title: 'What’s included',
      note: lines(inclusions.length, 'line', 'lines'),
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
      note: 'billed by the quote',
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
    sections.push({ key: 'serves', title: 'Serves', note: 'who it is for', body: servesLine });
  }
  // The record this card has earned — the SAME compiled object the card renders, from the page's one batched read.
  if (c.record) {
    sections.push({
      key: 'record',
      title: 'The record',
      note: `Booked ${formatCount(c.record.bookedCount)}×`,
      // The ledger is drawn once, as Events (its own section, hideable per line) — not twice.
      body: <CardRecordSection record={{ ...c.record, ledger: [] }} variant="couple" rating={c.recordRating} />,
    });
  }
  if (c.reviews && (hosts || guests)) {
    const n = (hosts?.count ?? 0) + (guests?.count ?? 0);
    const avg = hosts ? hosts.average : (guests?.average ?? 0);
    sections.push({
      key: 'reviews',
      title: 'Reviews',
      note: curating
        ? hiddenNote(nHidden([keys.reviews.host, keys.reviews.guest]), SUP_NOTE.reviews)
        : `${formatCount(n)} · ${avg.toFixed(1)}★`,
      body: (
        <CardReviewsBlock
          reviews={shownReviews ?? c.reviews}
          // 🃏 The shop curating: the one review each group shows is tappable (hide · show again), like a photo.
          item={(which, inner) =>
            curating
              ? hidable(
                  which === 'host' ? keys.reviews.host : keys.reviews.guest,
                  which === 'host' ? 'The hosts’ review' : 'The guest review',
                  'flex w-full items-start gap-2 rounded-xl px-1 py-1',
                  inner,
                )
              : inner
          }
        />
      ),
    });
  }
  // ── EVENTS, without names — the record's anonymised lines (type · month · guest band) ──
  if (eventLines.length > 0) {
    sections.push({
      key: 'events',
      title: 'Events',
      note: curating ? hiddenNote(nHidden(keys.events), SUP_NOTE.events) : 'booked on this card',
      body: (
        <ul className="space-y-1.5" data-grown-events="">
          {eventLines.map((l, i) => (
            <li key={l.key ?? i}>
              {hidable(
                l.key,
                [l.label, l.month].filter(Boolean).join(' · '),
                'flex min-h-11 w-full items-center gap-2.5 rounded-xl px-1 py-1',
                <span className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink/5 text-ink/55">
                    <CalendarDays aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0">
                    <b className="block truncate text-[14px] font-semibold text-ink">{[l.label, l.month].filter(Boolean).join(' · ')}</b>
                    <small className="block truncate text-[12px] text-ink/55">{[l.pax, 'booked on this card'].filter(Boolean).join(' · ')}</small>
                  </span>
                </span>,
              )}
            </li>
          ))}
        </ul>
      ),
    });
  }
  // ── MEDIA, LAST: it runs on ──
  if (photos.length > 0 || couples.length > 0) {
    sections.push({
      key: 'photos',
      title: 'Photos',
      note: curating ? hiddenNote(nHidden(keys.photos), SUP_NOTE.photos) : formatCount(photos.length + couples.length),
      body: (
        <>
          {photos.length > 0 ? (
            <ul className="grid grid-cols-3 gap-1" data-grown-photos="">
              {shownPhotos.map((p, idx) => (
                <li key={p.url} className="relative aspect-square overflow-hidden rounded-lg bg-ink/5">
                  {hidable(
                    p.key,
                    `${c.label} photo ${idx + 1}`,
                    'absolute inset-0',
                    <span className="absolute inset-0 block">
                      <Image src={p.url} alt={`${c.label} photo ${idx + 1}`} fill sizes="(min-width: 640px) 200px, 33vw" className="object-cover" />
                    </span>,
                  )}
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
                    <Image src={photoItems[PHOTOS_SHOWN - 1]!.url} alt="" fill sizes="33vw" className="object-cover opacity-35 grayscale-[.4]" />
                    <b className="absolute inset-0 grid place-items-center text-[20px] font-semibold text-ink">
                      +{formatCount(photoItems.length - (PHOTOS_SHOWN - 1))}
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
  if (clipShown) {
    sections.push({
      key: 'clip',
      title: 'Clip',
      note: curating ? hiddenNote(nHidden([keys.clip]), SUP_NOTE.clip) : 'up to 30 s',
      body: curating ? (
        // The curating supplier's tap hides it on this card; the couple's tap plays it.
        hidable(
          keys.clip,
          'The clip',
          'flex min-h-[60px] w-full items-center gap-2.5 rounded-xl border px-2.5 py-2', // no-card-ok: the curating supplier presses this row (a <button>, via hidable) — the same frame as the couple's play row
          <span className="flex items-center gap-2.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-ink/70 text-white">
              <Play aria-hidden className="h-4 w-4" strokeWidth={2} />
            </span>
            <b className="block truncate text-[14px] font-semibold text-ink">The clip</b>
          </span>,
        )
      ) : playing ? (
        // Plays where it was tapped — the row becomes the player, nothing opens over it.
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={clipShown} controls autoPlay playsInline className="max-h-80 w-full rounded-lg bg-ink/5 object-cover" data-grown-clip="playing" />
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
      note: curating ? hiddenNote(nHidden(keys.insp), SUP_NOTE.inspiration) : formatCount(looks.length),
      body: (
        <ul className="grid grid-cols-3 gap-1" data-grown-inspiration="">
          {looks.map((l) => (
            <li key={l.id} className="relative aspect-square overflow-hidden rounded-lg bg-ink/5">
              {hidable(
                l.key,
                l.part,
                'absolute inset-0',
                // eslint-disable-next-line @next/next/no-img-element -- an approved library photo, already a display URL
                <img src={l.url} alt={l.part} className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />,
              )}
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
          {/* 👁 COUPLE VIEW — the shop's own card only: exactly what couples get, hidden items left out (prototype `fc-couple`). */}
          {owner ? (
            <button
              type="button"
              onClick={() => setCoupleView((v) => !v)}
              aria-pressed={coupleView}
              aria-label="Couple view · show the card without the hidden items"
              className={`${roundBtn}${coupleView ? ' !border-terracotta !bg-terracotta !text-white' : ''}`}
              data-grown-couple-view={coupleView ? 'on' : ''}
            >
              <Eye aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            </button>
          ) : null}
          {/* ⓘ — the house explanation (`<Explain>`): what a couple does NOT need before acting; the card's caption lives here. */}
          <Explain
            title="About this card"
            data="grown-about"
            className={pinned ? 'bg-[var(--m-paper)]' : 'bg-[var(--m-paper)]/90 backdrop-blur-md'}
          >
            The whole card: the price and the best offer, what is included and not, who it serves, its record and reviews,
            the events it was booked for (never names), then every photo, the clip and inspiration. Starting price set by
            the supplier. Final quotes happen in chat.
            {owner ? (
              <>
                {' '}
                Tap a photo, the clip, an event, an inspiration photo or a review to hide it on this card. It greys out
                and says so; tap again to show it. Nothing is deleted, and it stays on your shop, in Portfolio, in
                Inspiration and on every other card. A hidden review still counts in the card’s stars and stays with the
                couple or guest who wrote it. The eye shows the card as couples get it. Forms are never hidden here, and
                the card’s opens always show.
              </>
            ) : null}
          </Explain>
        </div>

        <div ref={scrollRef} onScroll={onScroll} className="relative flex-1 overflow-y-auto overflow-x-hidden pb-24" data-grown-scroll="">
          {/* ── The hero: the card's cover, edge to edge ── */}
          <div ref={heroRef} className="relative h-[38svh] min-h-48 overflow-hidden" style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-deep)' }} data-grown-hero="">
            {heroShow.length >= 2 ? (
              <ServiceFaceCoverShow photos={heroShow} />
            ) : cover ? (
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
            {/* 📈 The card's opens — the shop's own number (Shop › Analytics' "opened"); no hide, in both views. */}
            {owner ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-ink/60" data-grown-opens="">
                <Eye aria-hidden className="h-3.5 w-3.5 shrink-0 text-ink/40" strokeWidth={2} />
                <span>
                  {owner.opens === null
                    ? 'Opens couldn’t load'
                    : `Opened ${lines(owner.opens, 'time', 'times')} in the last 12 months · only your shop sees this`}
                </span>
              </p>
            ) : null}
          </div>
          {owner && !coupleView && !hintOff ? (
            <div className="px-4 pb-2">
              <button
                type="button"
                onClick={() => setHintOff(true)}
                aria-label="Dismiss"
                className="sn-press flex min-h-11 w-full items-center gap-2 rounded-xl bg-ink/[0.04] px-3 text-left text-[12.5px] text-ink/70"
                data-grown-hide-hint=""
              >
                <Info aria-hidden className="h-3.5 w-3.5 shrink-0 text-ink/45" strokeWidth={2} />
                <span className="flex-1">Tap a photo, the clip, an event or an inspiration photo to hide it on this card</span>
                <X aria-hidden className="h-3.5 w-3.5 shrink-0 text-ink/45" strokeWidth={2} />
              </button>
            </div>
          ) : null}
          {/* 🃏 A hide that did not save says so; the item is still as it was (never flipped first). */}
          {owner?.saveError ? (
            <div className="px-4 pb-2">
              <p role="alert" className="flex min-h-11 items-center gap-2 rounded-xl bg-danger-50 px-3 text-[12.5px] text-danger-700" data-grown-hide-error="">
                <Info aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                {owner.saveError}
              </p>
            </div>
          ) : null}
          {/* 🃏 The hides read failed: the hideable items were left out on the server, and this line says why. */}
          {c.hidesUnread ? (
            <div className="px-4 pb-2">
              <p role="status" className="flex min-h-11 items-center gap-2 rounded-xl bg-ink/[0.04] px-3 text-[12.5px] text-ink/70" data-grown-hides-unread="">
                <Info aria-hidden className="h-3.5 w-3.5 shrink-0 text-ink/45" strokeWidth={2} />
                {owner
                  ? 'What you hid on this card couldn’t load, so its photos, clip, events and inspiration are left out for everyone until it does. Reload to try again.'
                  : 'Some of this card’s photos and events couldn’t load right now. Reload to try again.'}
              </p>
            </div>
          ) : null}
          {owner && coupleView ? (
            <div className="px-4 pb-2">
              <p className="flex min-h-11 items-center gap-2 rounded-xl bg-ink/[0.04] px-3 text-[12.5px] text-ink/70" data-grown-couple-note="">
                <Eye aria-hidden className="h-3.5 w-3.5 shrink-0 text-ink/45" strokeWidth={2} />
                Couple view · exactly what couples get, hidden items left out
              </p>
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
                aria-label={`${s.title} · ${s.note} · back to its top`}
              >
                <span id={`grown-h-${s.key}`} className="text-[14px] font-semibold text-ink">
                  {s.title}
                </span>
                <small className="ml-auto min-w-0 truncate text-right text-[12px] text-ink/55">{s.note}</small>
              </button>
              <div className="px-4 pb-3 pt-1">{s.body}</div>
            </section>
          ))}
        </div>

        {told ? (
          <p
            role="status"
            className="absolute inset-x-4 bottom-20 z-[6] rounded-xl bg-raised px-3 py-2 text-[13px] text-ink shadow-lg"
            data-grown-told=""
          >
            {told}
          </p>
        ) : null}
        {/* ── The doorway out, in the thumb row ── */}
        {owner ? (
          // The shop's own card: the couple's real button, marked Preview — it reaches no composer from here.
          <div
            className="absolute inset-x-0 bottom-0 z-[5] flex px-4 pt-6"
            style={{
              paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
              background: 'linear-gradient(to top, var(--sn-canvas) 70%, transparent)',
            }}
            data-grown-thumb="preview"
          >
            <button
              type="button"
              onClick={() => setTold('This is the couple’s button. On your own card it is a preview — it opens no chat.')}
              // The couple's button reads "Choose this service" on this redesign (one Inquire per shop page), so its
              // preview reads the same; the visible "Preview" pill names it, so no aria-label repeats the words.
              className={actionButtonClass('brand', { main: true, extra: 'w-full' })}
              data-grown-inquire-preview=""
            >
              <MessageCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              <span>Choose this service</span>
              <span className="ml-1 rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-medium">Preview</span>
            </button>
          </div>
        ) : inquireMode !== 'none' ? (
          <div
            className="absolute inset-x-0 bottom-0 z-[5] flex px-4 pt-6"
            style={{
              paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
              background: 'linear-gradient(to top, var(--sn-canvas) 70%, transparent)',
            }}
            data-grown-thumb=""
          >
            {inquireMode === 'focus' ? (
              <ActionButton tone="brand" main icon={MessageCircle} label="Choose this service" onClick={onInquire} className="w-full" />
            ) : (
              <a
                href="#get-in-touch"
                // The shop's Inquire pop-up (inquire-sheet.tsx) catches this press and opens with THIS card picked.
                data-inquire-service={c.id}
                onClick={onClose}
                className={actionButtonClass('brand', { main: true, extra: 'w-full' })}
              >
                <MessageCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                <span>Choose this service</span>
              </a>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );

  return host ? createPortal(layer, host) : null;
}
