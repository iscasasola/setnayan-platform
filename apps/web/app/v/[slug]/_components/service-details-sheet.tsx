'use client';

/**
 * ServiceDetailsSheet — the per-service DETAILS screen slice D handed over
 * unbuilt (`changelog.d/marketplace-d-card.md`: "Handed over, explicitly NOT
 * built here … the per-service Details screen, the booked count, and the
 * adaptive card").
 *
 * Two of those three land here, and neither needed new data:
 *
 *   • THE DETAILS SCREEN is the SAME `ServiceCard` the gallery already
 *     serializes, rendered without the card's space compromises — every
 *     showcase photo at a readable size instead of a 64px strip, the clip, the
 *     WHOLE inclusion list instead of three plus a "+N more" tail, the
 *     not-included flags, the serves line, the price and its basis detail, and
 *     the best-discount badge.
 *   • THE BOOKED COUNT is `card.record.bookedCount`, already fetched for the
 *     card by the page's ONE batched `fetchServiceCardRecords` call. This sheet
 *     mounts the SAME `CardRecordSection` the card mounts, so there is no second
 *     query and no second formatting of the same numbers. With
 *     `NEXT_PUBLIC_CARD_RECORD_ENABLED` off, or on a card nobody has booked,
 *     `record` is null and the block simply is not there.
 *
 * The third — the ADAPTIVE CARD — stays unbuilt, and deliberately: it needs
 * service-level completed-event data, and `vendor_completed_events` still has
 * no `service_id`. Nothing here presents vendor-level history as service-level.
 *
 * ⚠ THE SETNAYAN EXCLUSIVE IS NOT HERE, AND MUST NOT BE. `vendor_services.
 * exclusive_perk_text` is documented "Never shown publicly. Revealed in-thread
 * when the vendor token-pursues" (lib/vendor-services.ts), and the only thing
 * that renders it is `revealExclusivePerks` posting a "Setnayan Exclusive
 * unlocked 🎁" system message AFTER the vendor answers (lib/chat-actions.ts).
 * It is a reward for the conversation, not card copy — printing it on a public
 * sheet would spend the vendor's incentive before they earn it.
 *
 * A DUMB VIEW. Every label, peso figure, discount string and serves line
 * arrives pre-formatted from the server (`toServiceCard` in the page), exactly
 * as it does for the card — so the sheet and the card can never disagree about
 * a price.
 *
 * Chrome mirrors the page family's shared `RequirementsModal`: bottom sheet on
 * mobile, centered dialog on sm+, focus/Esc/scroll-lock from the one shared
 * `useModalA11y` hook rather than hand-rolled.
 */

import Image from 'next/image';
import { BadgePercent, Check, Info, MessageCircle, Users, X } from 'lucide-react';
import { useRef } from 'react';
import { CardRecordSection } from '@/app/_components/card-record-section';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { focusServiceInquiry } from '@/lib/service-inquiry-focus';
import type { ServiceCard } from './services-gallery';

/**
 * How the sheet's "Inquire about this" behaves, decided SERVER-side because
 * only the server knows which composer (if any) is on the page:
 *
 *   • 'focus'  — the signed-in couple's `InquiryComposer` is mounted. The
 *                button points it at THIS service and opens it.
 *   • 'anchor' — only the compose-first `AnonInquiryComposer` is mounted (a
 *                visitor without an event yet). It has its own service picker,
 *                so we send them to it rather than pretending to preselect.
 *   • 'none'   — no composer at all (not bookable / no contact route). No CTA,
 *                because a button that does nothing is worse than no button.
 */
export type ServiceInquireMode = 'focus' | 'anchor' | 'none';

export function ServiceDetailsSheet({
  card: c,
  inquireMode,
  onClose,
}: {
  card: ServiceCard;
  inquireMode: ServiceInquireMode;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Mounted only while open, so mount = open. The shared hook handles the focus
  // trap + restore, Esc-to-close and the reference-counted body-scroll lock.
  useModalA11y({ open: true, onClose, containerRef: dialogRef });

  // The FULL inclusion list when the server sent it (the key is absent unless
  // the flag is on); otherwise fall back to the card's trimmed three, so the
  // sheet degrades to "what the card already said" rather than to an empty
  // section.
  const inclusions =
    c.inclusionsFull && c.inclusionsFull.length > 0 ? c.inclusionsFull : c.inclusions;

  function onInquire() {
    // Close FIRST: the composer opens its own dialog, and two `useModalA11y`
    // layers stacked over one another would leave the couple peeling Escapes.
    onClose();
    focusServiceInquiry(c.id);
  }

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-end justify-center focus:outline-none sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="service-details-title"
    >
      {/* Translucent backdrop — click closes */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />

      <div className="relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl border border-ink/10 bg-cream shadow-[0_-30px_80px_-40px_rgba(26,26,26,0.4)] sm:max-h-[85vh] sm:w-full sm:max-w-lg sm:rounded-2xl sm:shadow-[0_30px_80px_-40px_rgba(26,26,26,0.4)]">
        {/* ── Header — the claim + the price, exactly as the card states them ── */}
        <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-5 py-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
              Service details
            </p>
            <h2
              id="service-details-title"
              className="mt-0.5 text-base font-semibold text-ink sm:text-lg"
            >
              {c.label}
            </h2>
            <p className="mt-0.5 font-mono text-sm text-ink/80">{c.priceLabel}</p>
            {c.priceDetail ? (
              <p className="font-mono text-[11px] text-ink/50">{c.priceDetail}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-m-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {c.discountLabel ? (
            <span className="inline-flex w-fit items-center gap-1 rounded-full border border-terracotta/30 bg-terracotta/10 px-2 py-0.5 text-[11px] font-medium text-terracotta-700">
              <BadgePercent className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
              {c.discountLabel}
            </span>
          ) : null}

          {/* ── Showcase media — the whole point of a details screen. The card
                 crops these into a 64px strip; here they get room. ────────── */}
          {c.photos.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {c.photos.map((url, idx) => (
                <div
                  key={url}
                  className={`relative overflow-hidden rounded-xl bg-ink/5 ${
                    idx === 0 && c.photos.length > 1 ? 'col-span-2 aspect-[16/10]' : 'aspect-[4/3]'
                  }`}
                >
                  <Image
                    src={url}
                    alt={`${c.label} showcase ${idx + 1}`}
                    fill
                    sizes="(min-width: 640px) 512px, 100vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          ) : null}

          {c.videoUrl ? (
            /* Poster-first, same contract as the card: preload="metadata" shows
               the first frame without pulling the clip down. */
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              src={c.videoUrl}
              controls
              preload="metadata"
              playsInline
              muted
              className="max-h-72 w-full rounded-xl bg-ink/5 object-cover"
            />
          ) : null}

          {/* ── What's included — the WHOLE list. The card's "+N more included"
                 tail is exactly what a couple opens a details screen to see. ── */}
          {inclusions.length > 0 ? (
            <section className="space-y-1.5">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50">
                What&rsquo;s included
              </h3>
              <ul className="space-y-1">
                {inclusions.map((line) => (
                  <li key={line} className="flex items-start gap-1.5 text-sm text-ink/75">
                    <Check
                      className="mt-1 h-3 w-3 shrink-0 text-mulberry"
                      strokeWidth={2.25}
                      aria-hidden
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {c.meta ? <p className="text-sm text-ink/60">{c.meta}</p> : null}

          {c.notIncluded.length > 0 ? (
            <section className="space-y-1.5">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50">
                Not included
              </h3>
              <ul className="flex flex-wrap gap-1.5">
                {c.notIncluded.map((line) => (
                  <li
                    key={line}
                    className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5 text-[12px] text-ink/60"
                  >
                    <Info className="h-3 w-3 shrink-0 text-ink/40" strokeWidth={2} aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {c.serves ? (
            <p className="inline-flex items-start gap-1.5 text-[12px] text-ink/55">
              <Users className="mt-0.5 h-3 w-3 shrink-0 text-ink/35" strokeWidth={2} aria-hidden />
              <span>Serves: {c.serves}</span>
            </p>
          ) : null}

          {/* ── The record this card has earned — booked count, mix, ledger,
                 medals. The SAME compiled object the card renders, from the
                 page's one batched read. Absent unless the card-record flag is
                 on AND this card has actually been booked. ────────────────── */}
          {c.record ? (
            <CardRecordSection record={c.record} variant="couple" rating={c.recordRating} />
          ) : null}
        </div>

        {/* ── The doorway out. Fixes the seam the composer had: it always opened
               on activeServices[0], so a couple reading the fifth card inquired
               about the first one. ─────────────────────────────────────────── */}
        {inquireMode !== 'none' ? (
          <div className="border-t border-ink/10 bg-cream px-5 py-4">
            {inquireMode === 'focus' ? (
              <button
                type="button"
                onClick={onInquire}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-mulberry px-5 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mulberry"
              >
                <MessageCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Inquire about this
              </button>
            ) : (
              <a
                href="#get-in-touch"
                onClick={onClose}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-mulberry px-5 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600"
              >
                <MessageCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Inquire about this
              </a>
            )}
            <p className="mt-2 text-center text-[10px] text-ink/45">
              Starting price set by the vendor. Final quotes happen in chat.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
