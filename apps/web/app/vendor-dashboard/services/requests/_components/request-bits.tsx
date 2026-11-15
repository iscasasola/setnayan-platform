/**
 * request-bits.tsx — the small pieces the supplier's request pages share: the status pill (the
 * owner's five words, `supplierStatusWord`), one request row, and the decision notice that also
 * shows at the top of Services.
 *
 * Words and arithmetic come from `lib/service-requests.ts`; nothing here decides anything.
 */
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { ShopPill, type ShopPillTone } from '@/app/vendor-dashboard/_components/kit';
import {
  noticeLine,
  placeOf,
  SERVICE_REQUESTS_HREF,
  supplierStatusWord,
  type RequestStatus,
  type StatusTone,
} from '@/lib/service-requests';
import type { MyRequest, RequestTree } from '@/lib/service-requests.server';

const PILL: Record<StatusTone, ShopPillTone> = { wait: 'gold', ok: 'success', info: 'action', grey: 'ink', bad: 'danger' };

/** The decided service's label, when the request was added or moved and the service is live. */
export function decidedOf(r: MyRequest, tree: RequestTree | null): { categoryLabel: string | null; serviceLabel: string } | null {
  if (!r.mapped_to_canonical) return null;
  const s = tree?.service.get(r.mapped_to_canonical);
  return s ? { categoryLabel: s.categoryLabel, serviceLabel: s.label } : null;
}

export function placeOfMine(r: MyRequest, tree: RequestTree | null): string {
  return placeOf({
    status: r.status,
    categoryLabel: r.tile_id ? tree?.categoryLabel.get(r.tile_id) ?? null : null,
    decided: decidedOf(r, tree),
  });
}

export function RequestStatusPill({ status, movedTo }: { status: RequestStatus; movedTo: string | null }) {
  const { word, tone } = supplierStatusWord(status, movedTo);
  return (
    <ShopPill tone={PILL[tone]} className="shrink-0 normal-case tracking-normal">
      {word}
    </ShopPill>
  );
}

const dateFmt = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });

export function RequestRowLink({ r, tree }: { r: MyRequest; tree: RequestTree | null }) {
  const category = r.tile_id ? tree?.categoryLabel.get(r.tile_id) ?? 'Your category' : 'No category picked';
  return (
    <li>
      <Link
        href={`${SERVICE_REQUESTS_HREF}/${r.request_id}`}
        className="flex min-h-12 items-center gap-3 px-4 py-3 hover:bg-ink/[0.03]"
        data-request-row=""
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium text-ink">{r.proposed_label}</span>
          <span className="block truncate text-[12.5px] text-ink/60">
            {category} · {dateFmt.format(new Date(r.created_at))}
          </span>
        </span>
        <RequestStatusPill status={r.status} movedTo={decidedOf(r, tree)?.serviceLabel ?? null} />
        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-terracotta-700" strokeWidth={1.75} />
      </Link>
    </li>
  );
}

/**
 * "We decided on …" — the decided request this shop has not opened yet. Tapping opens it, which
 * marks it seen, so the notice leaves by itself.
 */
export function DecisionNotice({ r, tree }: { r: MyRequest; tree: RequestTree | null }) {
  if (r.status === 'pending') return null;
  const line = noticeLine(r.status, r.cards ?? 0, placeOfMine(r, tree));
  return (
    <Link
      href={`${SERVICE_REQUESTS_HREF}/${r.request_id}`}
      className="flex items-start gap-3 rounded-2xl bg-terracotta/10 px-4 py-3 text-terracotta-700"
      data-request-notice=""
    >
      <span aria-hidden className="mt-0.5 font-semibold">✓</span>
      <span className="min-w-0 flex-1 text-sm">
        <span className="block font-semibold">We decided on “{r.proposed_label}”</span>
        <span className="block">{line} Tap to see the note.</span>
      </span>
    </Link>
  );
}
