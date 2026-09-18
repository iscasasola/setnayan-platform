'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  previewGiftForTotal,
  giftQuoteCopy,
  type GiftQuoteBasis,
} from '@/lib/setnayan-gift';
import { SubmitButton } from '@/app/_components/submit-button';
import { sendProposalFromChat } from '../proposal-actions';
import { resolveQuoteTotalCentavos } from '@/lib/quote-total';

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
  templates,
  packages,
  giftBasis = null,
}: {
  threadId: string;
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
  const giftCopy = giftQuoteCopy(gift, 'supplier');

  if (templates.length === 0) {
    return (
      <div className="rounded-xl border border-mulberry/25 bg-mulberry/[0.04] p-3 text-sm text-ink/70">
        {/* Under the builder now (SUP-H): a shop with no template still has
            the builder above, so this must not read as "you cannot quote". */}
        Quote the same thing often?{' '}
        <Link href="/vendor-dashboard/proposals" className="font-medium text-mulberry underline hover:text-mulberry-600">
          Save a proposal template
        </Link>{' '}
        and sending it is one tap from any chat.
      </div>
    );
  }

  const field =
    'h-10 w-full rounded-lg border border-ink/15 bg-white/70 px-3 text-sm text-ink focus:border-mulberry focus:outline-none';

  return (
    <div className="rounded-xl border border-mulberry/25 bg-mulberry/[0.04] p-3">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-mulberry/30 bg-white/70 px-4 text-sm font-medium text-mulberry hover:border-mulberry/60"
        >
          <span aria-hidden>📄</span> Send from a saved template
        </button>
      ) : (
        <form action={sendProposalFromChat} className="space-y-2.5">
          <p className="text-sm font-semibold text-ink">Send a proposal</p>
          <input type="hidden" name="thread_id" value={threadId} />

          <label className="block space-y-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">Template</span>
            <select
              name="template_id"
              required
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className={field}
            >
              <option value="" disabled>
                Choose a template…
              </option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          {packages.length > 0 ? (
            <label className="block space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                Package (optional)
              </span>
              <select
                name="package_id"
                value={packageId}
                onChange={(e) => setPackageId(e.target.value)}
                className={field}
              >
                <option value="">No package — set a price below</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">Price ₱</span>
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
            <label className="block space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                Valid until (optional)
              </span>
              <input name="valid_until" type="date" className={field} />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">Title (optional)</span>
            <input name="title" type="text" maxLength={160} placeholder="Auto-titled if blank" className={field} />
          </label>

          {/* THE SETNAYAN GIFT — what the couple gets AND what it costs the
              supplier, re-priced as they type (owner 2026-09-15: "show both").
              Renders only when this booking will really be billed for it. */}
          {giftCopy ? (
            <div
              data-testid="compose-setnayan-gift"
              className="rounded-lg border border-mulberry-600/25 bg-mulberry-600/5 px-3 py-2.5"
            >
              <p className="text-sm font-semibold text-mulberry-600">{giftCopy.headline}</p>
              <p className="mt-0.5 text-xs text-ink/60">{giftCopy.detail}</p>
            </div>
          ) : null}

          <p className="text-xs text-ink/55">
            The proposal appears in this chat. The couple reviews + accepts it — accepting just adds it to
            their plan, never a payment.
          </p>

          <div className="flex gap-2 pt-0.5">
            <SubmitButton
              pendingLabel="Sending…"
              className="inline-flex h-10 items-center rounded-lg bg-mulberry px-4 text-sm font-semibold text-cream hover:bg-mulberry-600"
            >
              Send proposal
            </SubmitButton>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 items-center rounded-lg border border-ink/15 px-4 text-sm text-ink/70 hover:border-ink/40"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
