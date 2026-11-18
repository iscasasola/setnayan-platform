'use client';

import { customerLandingHref } from '../../../customers/anchors';
import Link from 'next/link';
import { useState } from 'react';
import { FileText, Send, X } from 'lucide-react';
import {
  previewGiftForTotal,
  giftQuoteCopy,
  type GiftQuoteBasis,
} from '@/lib/setnayan-gift';
import { SubmitButton } from '@/app/_components/submit-button';
import { ActionButton, actionButtonClass } from '@/components/action-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

/** A field's label — the template's dark grey at 13 px, never 10 px typewriter capitals (rule 13). */
const FIELD_LABEL = 'block text-[13px] font-medium text-[color:var(--m-slate-2)]';
import { sendProposalFromChat } from '../proposal-actions';
import { ValidUntilPicker } from '@/app/_components/valid-until-picker';
import { resolveQuoteTotalCentavos } from '@/lib/quote-total';
import { bookingFeeForecast, type BookingFeeStanding } from '@/lib/booking-fee-disclosure';
import { BookingFeeNotice } from '@/app/_components/booking-fee-notice';
import { papicTopUpForQuote, type PapicQuoteStanding } from '@/lib/papic-on-a-quote';

type Option = { id: string; name: string };
/** A package carries the price the SEND PATH bills — see resolveQuoteTotalCentavos. */
type PackageOption = Option & { totalCentavos: number };
/** A template can price the proposal through its default package. */
type TemplateOption = Option & { defaultPackageId: string | null };

/**
 * In-chat "Send from a saved template" — the vendor-only composer affordance
 * that creates + sends a full structured proposal into the thread (see
 * proposal-actions.ts). Collapsed to a single button so it never crowds the
 * conversation; expands to the template/package/price form. If the vendor has
 * no templates yet, we point them to build one rather than show a dead form.
 *
 * ── ONE QUOTE TOOL (SUP-H · AREA-CHAT, 2026-09-19) ──────────────────────────
 * This card no longer has a panel of its own. It mounts INSIDE the one
 * `build-quote` panel, under the line-item builder (`ProposalMaker`), as the
 * shortcut for a shop that keeps templates. Every deep link names
 * `#build-quote`; nothing links `#send-proposal` any more.
 */
export function SendProposalCard({
  threadId,
  eventDate = null,
  todayIso,
  templates,
  packages,
  giftBasis = null,
  feeStanding = null,
  papicStanding = null,
}: {
  threadId: string;
  /** The event day (yyyy-mm-dd) — a Valid until past it is not offered (📅 2026-11-09). */
  eventDate?: string | null;
  /** Manila today, from the server, so the picker and the send count from the same day. */
  todayIso: string;
  templates: TemplateOption[];
  packages: PackageOption[];
  /**
   * The Setnayan gift's basis, or null when this quote carries no gift.
   *
   * 🔑 THIS CARD GETS IT TOO, AND THAT IS THE POINT. Until 2026-09-19 every
   * shortcut in the app deep-linked `#send-proposal`, i.e. HERE, and the
   * builder had no inbound link; a gift line mounted only in the builder would
   * have been invisible to any supplier who followed a Quote button. The two
   * now share one panel, and BOTH still carry the line — a supplier prices from
   * whichever half they use. Same derived number, same two voices.
   */
  giftBasis?: GiftQuoteBasis | null;
  /**
   * WHERE THIS SHOP STANDS ON THE BOOKING FEE for this thread's couple —
   * resolved once on the server by `resolveBookingFeeStanding`, then re-priced
   * in the browser as the total changes.
   *
   * 🔴 OWNER, 2026-09-20: "as a vendor i do not know i have to pay." A supplier
   * deciding what to charge could see the Setnayan GIFT this quote buys their
   * couple and not the FEE that pays for it. Both now sit under the total.
   *
   * ⚠ Unlike `giftBasis`, null is NOT the only silent case and silence is NOT
   * the default: a free-5 booking says it is free, an imported client says it
   * carries no fee, and a failed read says we could not check. Only `silent`
   * (the fee system dark) renders nothing.
   */
  feeStanding?: BookingFeeStanding | null;
  /**
   * HOW MUCH EXCLUSIVE PAPIC THIS BOOKING CAN CARRY — the other half of the
   * owner's 2026-09-20 ruling: *"the maximum additional papic service they can
   * also purchase on top to offer that exclusive deal."*
   *
   * Same reasoning as `feeStanding` above: a shop that quotes from THIS card
   * must read the same ceiling a shop that quotes from the builder reads.
   */
  papicStanding?: PapicQuoteStanding | null;
}) {
  const [open, setOpen] = useState(false);
  // Controlled so the gift can be re-priced as they type. The field still posts
  // `total_php` exactly as before.
  const [totalPhp, setTotalPhp] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [packageId, setPackageId] = useState('');

  /**
   * 🔴 THE TOTAL IS NOT THE PRICE FIELD, AND ASSUMING IT WAS COST A REAL BUG.
   *
   * `sendProposalCore` bills the PACKAGE's price when one prices the proposal —
   * including the package a TEMPLATE supplies through `default_package_id`,
   * which applies even with the selector left on "No package — set a price
   * below". The typed figure is only a fallback when the package total is 0.
   *
   * A first cut of this preview read `totalPhp` alone. Measured against the real
   * send path: a ₱120,000 package with 45000 typed showed "1,786 free Papic
   * photos … ₱900" while the bill charged ₱2,080 for 4,880 — and with the Price
   * field blank (its normal use beside a package) it showed NOTHING at all while
   * the bill still carried a charge.
   *
   * `resolveQuoteTotalCentavos` is the SEND PATH'S OWN RULE, imported — not a
   * copy of it. The two cannot disagree.
   */
  const effectivePackageId =
    packageId || templates.find((t) => t.id === templateId)?.defaultPackageId || '';
  const packageTotalCentavos =
    packages.find((p) => p.id === effectivePackageId)?.totalCentavos ?? 0;
  const quoteTotalCentavos = resolveQuoteTotalCentavos(packageTotalCentavos, totalPhp);

  const gift = previewGiftForTotal(quoteTotalCentavos, giftBasis);
  const giftCopy = giftQuoteCopy(gift, 'supplier', {
    // 🏅 A free booking fee (badge reward) covers the gift — nothing is billed (owner 2026-11-05).
    freeWithBadge: papicStanding?.kind === 'included' && papicStanding.freeWithBadge === true,
  });
  // Same reasoning as the gift line above: a shop that quotes from THIS card
  // must read the same fee a shop that quotes from the builder reads.
  const feeCopy = feeStanding
    ? bookingFeeForecast(feeStanding, quoteTotalCentavos / 100)
    : null;
  // The maximum exclusive Papic deal, off the SAME total the gift is priced
  // from and the send path bills.
  const papicCopy = papicStanding
    ? papicTopUpForQuote(papicStanding, quoteTotalCentavos)
    : null;

  if (templates.length === 0) {
    return (
      <div className="py-1 text-sm text-[color:var(--m-slate-2)]">
        {/* Under the builder now (SUP-H): a shop with no template still has
            the builder above, so this must not read as "you cannot quote". */}
        Quote the same thing often?{' '}
        <Link href={customerLandingHref('proposals')} className="font-medium text-mulberry underline hover:text-mulberry-600">
          Save a quote template
        </Link>{' '}
        and sending it is one tap from any chat.
      </div>
    );
  }

  const field =
    'h-11 w-full rounded-xl border border-[color:var(--m-line)] bg-white px-3 text-sm text-ink focus:border-mulberry focus:outline-none dark:bg-raised';

  return (
    // Rule 2 · no card: it sits in the quote panel under the builder, as plain content.
    <div className="py-1">
      {!open ? (
        <ActionButton
          type="button"
          tone="neutral"
          icon={<FileText aria-hidden strokeWidth={1.9} />}
          label="Send from a saved template"
          onClick={() => setOpen(true)}
          className="!min-h-11"
        />
      ) : (
        <form action={sendProposalFromChat} className="space-y-2.5">
          <p className="text-sm font-semibold text-ink">Send a quote</p>
          <input type="hidden" name="thread_id" value={threadId} />

          <label className="block space-y-1">
            <span className={FIELD_LABEL}>Template</span>
            {/* Rule 4 · ONE PickMenu; the hidden field posts `template_id`, and Send waits until one is chosen. */}
            <input type="hidden" name="template_id" value={templateId} />
            <PickMenu
              label="Template"
              value={templateId}
              options={[
                { key: '', label: 'Choose a template…', disabledNote: 'Pick one of your saved templates' },
                ...templates.map((t) => ({ key: t.id, label: t.name })),
              ]}
              onPick={setTemplateId}
              dataAttr="data-quote-template"
              className="w-full !min-h-11"
            />
          </label>

          {packages.length > 0 ? (
            <label className="block space-y-1">
              <span className={FIELD_LABEL}>
                Package (optional)
              </span>
              <input type="hidden" name="package_id" value={packageId} />
              <PickMenu
                label="Package (optional)"
                value={packageId}
                options={[
                  { key: '', label: 'No package — set a price below' },
                  ...packages.map((p) => ({ key: p.id, label: p.name })),
                ]}
                onPick={setPackageId}
                dataAttr="data-quote-package"
                className="w-full !min-h-11"
              />
            </label>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className={FIELD_LABEL}>Price ₱</span>
              <input
                name="total_php"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                placeholder="e.g. 45000"
                className={field}
                value={totalPhp}
                onChange={(e) => setTotalPhp(e.target.value)}
              />
            </label>
            <div className="block space-y-1">
              <span className={FIELD_LABEL}>Valid until</span>
              {/* 📅 No lifetime quotation (2026-11-09): required to send, the one shared picker. */}
              <ValidUntilPicker todayIso={todayIso} eventDate={eventDate} />
            </div>
          </div>

          <label className="block space-y-1">
            <span className={FIELD_LABEL}>Title (optional)</span>
            <input name="title" type="text" maxLength={160} placeholder="Auto-titled if blank" className={field} />
          </label>

          {/* WHAT THIS QUOTE WILL COST YOU. Same line the builder above
              carries — a supplier prices from whichever half they use, so
              neither may be the only one that names the fee. */}
          <BookingFeeNotice disclosure={feeCopy} />

          {/* THE SETNAYAN GIFT — what the couple gets AND what it costs the
              supplier, re-priced as they type (owner 2026-09-15: "show both").
              Renders only when this booking will really be billed for it. */}
          {giftCopy ? (
            <div
              data-testid="compose-setnayan-gift"
              // Read-only, so a line between hairlines, not a tinted box (rule 2 · 13).
              className="border-y border-[color:var(--m-line)] py-2.5"
            >
              <p className="text-sm font-semibold text-ink">{giftCopy.headline}</p>
              <p className="mt-0.5 text-[13px] text-[color:var(--m-slate-2)]">{giftCopy.detail}</p>
            </div>
          ) : null}

          {/* THE MAXIMUM EXCLUSIVE PAPIC DEAL — owner 2026-09-20. The same line
              the builder carries; a supplier quotes from whichever half they
              use, so neither may be the only one that names the ceiling. */}
          <BookingFeeNotice
            testId="papic-quote-notice"
            disclosure={papicCopy}
            cta={papicCopy?.cta}
          />

          <p className="text-[13px] text-[color:var(--m-slate-2)]">
            The quote appears in this chat. The couple reviews + accepts it — accepting just adds it to
            their plan, never a payment.
          </p>

          <div className="flex gap-2 pt-0.5">
            {/* Rule 3 · the button piece; not `main` (the composer's Send is this screen's one). */}
            <SubmitButton
              pendingLabel="Sending…"
              disabled={!templateId}
              className={actionButtonClass('brand', { extra: '!min-h-11' })}
              aria-label="Send this quote"
              title="Send this quote"
            >
              <Send aria-hidden strokeWidth={1.9} />
              <span className="lbl">Send this quote</span>
            </SubmitButton>
            <ActionButton type="button" tone="neutral" icon={<X aria-hidden strokeWidth={1.9} />} label="Cancel" onClick={() => setOpen(false)} className="!min-h-11" />
          </div>
        </form>
      )}
    </div>
  );
}
