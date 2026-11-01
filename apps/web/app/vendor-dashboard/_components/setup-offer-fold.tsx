'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import { Badge } from '@/app/_components/badge';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { formatCount } from '@/lib/format-number';
import { formatPhp } from '@/lib/orders';
import { CARDS_PER_SERVICE, SERVICE_TIERS, toGoWord } from '@/lib/supplier-setup';

export type OfferFoldService = {
  service: string;
  /** The service's own word (`displayServiceLabel`). */
  label: string;
  cards: Array<{ id: string; title: string | null; pricePhp: number | null }>;
  toGo: number;
};

/**
 * 🧰 STEP 4 · WHAT YOU OFFER — Good · Better · Best, counted per service (owner 2026-10-28: "≥ 3 cards per Service,
 * 'N to go'"; prototype `stepBody('offer')`). Each service: its count and what is left, then three slots — a card
 * the supplier made (its own title and its own starting price, lowest first) or an empty slot that OPENS THE SERVICE
 * MAKER AS A SHEET over Today. The maker is the shipped one (`NewServiceMaker`), handed in already drawn; its Save
 * brings the supplier back to Today (`servicesReturnBase`), the count moves, and the sheet shuts itself.
 *
 * `services` null = the cards could not be read: said, never drawn as "0 of 3".
 */
export function SetupOfferFold({ services, maker }: { services: readonly OfferFoldService[] | null; maker: ReactNode }) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const cards = services?.reduce((n, s) => n + s.cards.length, 0) ?? -1;
  const was = useRef(cards);
  // A card was made (the server re-read the count) → the sheet has done its job.
  useEffect(() => {
    if (cards !== was.current) setOpen(false);
    was.current = cards;
  }, [cards]);

  if (services === null) {
    return (
      <p role="status" data-setup-offer-unread="" className="py-2 text-[13.5px] text-[rgb(var(--color-warn))]">
        Your service cards couldn’t load. Refresh to try again — nothing is lost.
      </p>
    );
  }

  const add = (label: string, tier: string) => (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-haspopup="dialog"
      data-setup-add-card={tier}
      className="sn-press grid min-h-[76px] place-items-center rounded-md border-2 border-dashed border-ink/20 px-2 py-2 text-center text-[12.5px] text-ink/70"
    >
      <span className="flex items-center gap-1 font-semibold text-sn-accent">
        <Plus aria-hidden className="h-4 w-4" strokeWidth={2.2} />
        {tier}
      </span>
      <span>{label}</span>
    </button>
  );

  return (
    <div data-setup-offer="">
      {services.length === 0 ? (
        <div className="grid grid-cols-3 gap-2 py-2">{add('Add your first card', SERVICE_TIERS[0])}</div>
      ) : (
        services.map((s) => (
          <div key={s.service} data-setup-service={s.service} className="border-t border-ink/10 py-2 first:border-t-0">
            <div className="flex min-h-11 items-center gap-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-ink">{s.label}</span>
                <span className="block text-[12.5px] text-ink/60">
                  {formatCount(Math.min(s.cards.length, CARDS_PER_SERVICE))} of {formatCount(CARDS_PER_SERVICE)}
                </span>
              </span>
              {s.cards.length === 0 ? (
                /* Nothing made yet for this service: one Start, the prototype's "＋ Start" (the maker, as a sheet). */
                <ActionButton tone="neutral" icon={Plus} label="Start" name={`Start — ${s.label}`} onClick={() => setOpen(true)} aria-haspopup="dialog" data-testid={`setup-start-${s.service}`} />
              ) : null}
              <Badge tone={s.toGo > 0 ? 'wait' : 'ok'} data="setup-service">
                {s.toGo > 0 ? toGoWord(s.toGo) : `${formatCount(CARDS_PER_SERVICE)} of ${formatCount(CARDS_PER_SERVICE)} ✓`}
              </Badge>
            </div>
            {s.cards.length === 0 ? null : (
            <div className="grid grid-cols-3 gap-2">
              {SERVICE_TIERS.map((tier, i) => {
                const c = s.cards[i];
                return c ? (
                  <div key={tier} data-setup-card={tier} className="min-w-0 px-1 py-2">
                    <small className="block text-[10.5px] font-semibold uppercase tracking-[0.08em] text-sn-accent">{tier}</small>
                    <b className="block truncate text-[13.5px] font-semibold text-ink">{c.title?.trim() || s.label}</b>
                    <span className="block text-[12.5px] text-ink/65">{c.pricePhp == null ? 'No price yet' : `from ${formatPhp(c.pricePhp)}`}</span>
                  </div>
                ) : (
                  <span key={tier}>{add(i === 2 ? 'Add your top option' : 'Add a card', tier)}</span>
                );
              })}
            </div>
            )}
          </div>
        ))
      )}
      {open ? (
        <OnBody>
          <Sheet open onClose={() => setOpen(false)} labelledById={headingId} title="New service" wide rise>
            <h2 id={headingId} className="sr-only">
              New service
            </h2>
            <div data-setup-maker-sheet="" className="px-4 pb-6">
              {maker}
            </div>
          </Sheet>
        </OnBody>
      ) : null}
    </div>
  );
}

function OnBody({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  return host ? createPortal(children, host) : null;
}
