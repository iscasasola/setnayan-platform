/**
 * request-bits.tsx — the small pieces the supplier's request pages share: the status pill (the
 * owner's five words, `supplierStatusWord`), one request row, and the decision notice that also
 * shows at the top of Services.
 *
 * Words and arithmetic come from `lib/service-requests.ts`; nothing here decides anything.
 */
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { Badge, type BadgeTone } from '@/app/_components/badge';
import { TEMPLATE_SUBLINE } from '@/app/_components/template-rows';
import {
  noticeLine,
  placeOf,
  SERVICE_REQUESTS_HREF,
  supplierStatusWord,
  type RequestStatus,
  type StatusTone,
} from '@/lib/service-requests';
import type { MyRequest, RequestTree } from '@/lib/service-requests.server';

// Rule 5 — the template's soft chips: green done · amber waiting · red refused · grey nothing yet.
const PILL: Record<StatusTone, BadgeTone> = { wait: 'wait', ok: 'ok', info: 'ok', grey: 'quiet', bad: 'no' };

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
    <span className="shrink-0">
      <Badge tone={PILL[tone]}>{word}</Badge>
    </span>
  );
}

const dateFmt = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });

export function RequestRowLink({ r, tree }: { r: MyRequest; tree: RequestTree | null }) {
  const category = r.tile_id ? tree?.categoryLabel.get(r.tile_id) ?? 'Your category' : 'No category picked';
  return (
    <li>
      <Link
        href={`${SERVICE_REQUESTS_HREF}/${r.request_id}`}
        className="sn-press flex min-h-14 items-center gap-2.5 py-2"
        data-request-row=""
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold leading-tight text-ink">{r.proposed_label}</span>
          <span className={`mt-0.5 block truncate ${TEMPLATE_SUBLINE}`}>
            {category} · {dateFmt.format(new Date(r.created_at))}
          </span>
        </span>
        <RequestStatusPill status={r.status} movedTo={decidedOf(r, tree)?.serviceLabel ?? null} />
        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-mulberry" strokeWidth={2.2} />
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
      className="sn-press flex items-start gap-3 rounded-[var(--m-r-lg)] bg-[color:var(--m-paper-2)] px-4 py-3"
      data-request-notice=""
    >
      <span aria-hidden className="mt-0.5 font-semibold" style={{ color: 'rgb(var(--color-ok))' }}>✓</span>
      <span className="min-w-0 flex-1 text-[14px]">
        <span className="block font-semibold text-ink">We decided on “{r.proposed_label}”</span>
        <span className={`block ${TEMPLATE_SUBLINE}`}>{line} Tap to see the note.</span>
      </span>
      <ChevronRight aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-mulberry" strokeWidth={2.2} />
    </Link>
  );
}
