/**
 * <FirstCardDraft> — "Your first service card" as both supplier doors draw it (drawing 36jmQMWrANcgd2HxihAUw5 v4,
 * PB4 / P4, approved 19 Nov): the drafted card as couples will see it, then where each part came from.
 *
 * One piece, two doors. It was first drawn inline in the self-serve wizard (Door B, `open-shop-wizard.tsx`) and moved
 * here when the couple's QR door (Door A, `claim-door.tsx`) was brought to the same drawing — a second hand-drawn copy
 * would drift the first time either changed.
 *
 * It only DRAWS. The price box, Approve · Edit · Skip and every write stay with the door that owns the form.
 */
import { formatCount } from '@/lib/format-number';

/** One "Built from …" row: what it is, its value, and who said so ("you picked it" · "they booked you for"). */
export type FirstCardSource = readonly [label: string, value: string, why: string];

/** How many of the card's lines the face lists before "+ N more" (P4 draws four). */
const FACE_LINES = 4;

export function FirstCardDraft({
  category,
  name,
  price,
  lines,
  sourceHead,
  sources,
  between,
  faceAttr,
  sourceAttr,
}: {
  /** The category over the name ("Florist", "Venue"). */
  category: string;
  /** The card's name. */
  name: string;
  /** The "from" price in whole pesos; 0 or null reads "No price yet" — never a guessed number. */
  price: number | null;
  /** What's included, as the record has it. Empty: the face asks for them in the Card Maker. */
  lines: readonly string[];
  /** "Built from what you typed" · "Built from what <couple> recorded". */
  sourceHead: string;
  sources: readonly FirstCardSource[];
  /** Drawn between the card and "Built from …" — Door C's page puts its "Trusted partners" here (PC4). */
  between?: React.ReactNode;
  /** The door's own data attribute names for the two blocks (its tests and shots find them by these). */
  faceAttr: string;
  sourceAttr: string;
}) {
  const shown = lines.slice(0, FACE_LINES);
  const more = lines.length - shown.length;
  return (
    <>
      <div className="grid gap-1.5 border-y py-4" style={{ borderColor: 'var(--m-line)' }} {...{ [faceAttr]: '' }}>
        <span className="text-xs font-medium" style={{ color: 'var(--m-mulberry)' }}>
          {category}
        </span>
        <b className="text-[17px] font-semibold [overflow-wrap:anywhere]" style={{ color: 'var(--m-ink)' }}>
          {name}
        </b>
        <span className="text-sm tabular-nums" style={{ color: price ? 'var(--m-ink)' : 'var(--m-slate-3)' }}>
          {price ? `From ₱${formatCount(price)}` : 'No price yet'}
        </span>
        {shown.length ? (
          <ul className="list-disc pl-4 text-xs" style={{ color: 'var(--m-slate)' }}>
            {shown.map((l, n) => (
              <li key={n} className="[overflow-wrap:anywhere]">
                {l}
              </li>
            ))}
            {more > 0 ? <li>+ {more} more</li> : null}
          </ul>
        ) : (
          <span className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
            Add what&rsquo;s included in the Card Maker.
          </span>
        )}
      </div>
      {between}
      <div className="grid gap-1.5 text-[13.5px]" {...{ [sourceAttr]: '' }}>
        <span className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
          {sourceHead}
        </span>
        {sources.map(([k, v, why]) => (
          <span key={k} className="flex items-baseline gap-2">
            <span className="w-[72px] shrink-0" style={{ color: 'var(--m-slate-3)' }}>
              {k}
            </span>
            <span className="min-w-0 font-medium [overflow-wrap:anywhere]" style={{ color: 'var(--m-ink)' }}>
              {v}
            </span>
            <small style={{ color: 'var(--m-slate-3)' }}>{why}</small>
          </span>
        ))}
      </div>
    </>
  );
}
