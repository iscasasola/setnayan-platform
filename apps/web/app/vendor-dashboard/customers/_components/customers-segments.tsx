import { PillLink, PillTrack } from '@/app/_components/pill-track';
import { formatCount } from '@/lib/format-number';
import {
  CUSTOMER_SEGMENTS,
  CUSTOMER_SEGMENT_LABEL,
  customersSegmentHref,
  type CustomersSegment,
} from '../segments';

/**
 * People · Dates · Money — the one segmented control, each a link with its own
 * address. "People 3" carries the waiting count (frame 03) — drawn by People,
 * which has just counted it; the other two segments do not read the roster, so
 * they draw the words alone rather than a number they did not measure.
 */
export function CustomersSegments({
  seg,
  waiting = null,
  hrefOf = customersSegmentHref,
}: {
  seg: CustomersSegment;
  waiting?: number | null;
  /** Each segment's address — the hub's own, unless a fixture page (the dev lab) draws them. */
  hrefOf?: (s: CustomersSegment) => string;
}) {
  return (
    <PillTrack as="nav" grow aria-label="Customers views" data-customers-segmented="" className="w-full">
      {CUSTOMER_SEGMENTS.map((s) => (
        <PillLink
          key={s}
          on={s === seg}
          href={hrefOf(s)}
          scroll={false}
          aria-current={s === seg ? 'page' : undefined}
          data-customers-seg={s}
          className="min-h-11 text-[13.5px]"
        >
          {CUSTOMER_SEGMENT_LABEL[s]}
          {s === 'people' && waiting ? <b className="font-medium opacity-80">{formatCount(waiting)}</b> : null}
        </PillLink>
      ))}
    </PillTrack>
  );
}

