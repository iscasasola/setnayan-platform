/**
 * 📅 "THEIR REAL CALENDAR" — the open-dates peek in the verified shop's calling card (prototype
 * `public_pages_three_2026-11-13`, `.peek`; owner 13 Nov "date check only for verified" → the peek stays on the
 * verified page and appears on NO unverified shop).
 *
 * The next Saturdays in the window, each Open or Not bookable, then "Check your own date →" to the shipped landing
 * (`/v/[slug]/dates`). 🔑 ONE SOURCE: the facts are `readCheckADate` — the very read behind that landing — so the peek
 * and the page it opens can never disagree, and it carries nothing more than that page shows (no reason, no couple,
 * no count).
 *
 * ⚖ A READ THAT FAILED NEVER READS AS "OPEN". The caller renders the peek only on `kind: 'ok'`; anything else draws
 * no days at all (the Check a date door beside it still works and says itself when it cannot load).
 */
import Link from 'next/link';

export type PeekDay = { iso: string; month: string; day: string; open: boolean };

const PEEK_COUNT = 5;

/** The next `count` Saturdays from `today` (inclusive) inside [from, to], each marked open unless the read says not. */
export function nextSaturdays(
  today: string,
  window: { from: string; to: string },
  notBookable: ReadonlyArray<string>,
  count = PEEK_COUNT,
): PeekDay[] {
  const closed = new Set(notBookable);
  const start = today > window.from ? today : window.from;
  const d = new Date(`${start}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return [];
  d.setUTCDate(d.getUTCDate() + ((6 - d.getUTCDay() + 7) % 7));
  const out: PeekDay[] = [];
  while (out.length < count) {
    const iso = d.toISOString().slice(0, 10);
    if (iso > window.to) break;
    out.push({
      iso,
      month: d.toLocaleDateString('en-PH', { month: 'short', timeZone: 'UTC' }),
      day: String(d.getUTCDate()),
      open: !closed.has(iso),
    });
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

/** `checkHref` null — the sample shop page: the same peek on sample days, its door drawn without a calendar to open. */
export function OpenDatesPeek({ days, checkHref }: { days: ReadonlyArray<PeekDay>; checkHref: string | null }) {
  if (days.length === 0) return null;
  return (
    <div data-open-dates-peek="" data-rise="" className="grid w-full gap-2 rounded-2xl bg-ink/[0.04] px-3.5 py-3">
      <p className="text-[0.84rem] text-ink/75">
        <span className="inline-flex items-center gap-1.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.1em] text-success-700">
          <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-success-600" />
          Their real calendar
        </span>
        <br />
        <b className="font-semibold text-ink">Open Saturdays coming up</b>
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {days.map((d) => (
          <li
            key={d.iso}
            title={d.open ? 'Open' : 'Not bookable'}
            className={`grid min-h-[48px] min-w-[52px] content-center justify-items-center rounded-xl px-2 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-[0.06em] text-ink/60 ${
              d.open ? 'bg-page' : 'border border-dashed border-ink/20'
            }`}
          >
            {d.month}
            <b className={`font-sans text-base font-extrabold leading-tight tracking-[-0.02em] ${d.open ? 'text-ink' : 'text-ink/50 line-through'}`}>
              {d.day}
            </b>
            <span className="sr-only">{d.open ? 'Open' : 'Not bookable'}</span>
          </li>
        ))}
      </ul>
      {checkHref === null ? (
        <span className="inline-flex min-h-[44px] items-center text-sm font-semibold text-link">Check your own date →</span>
      ) : (
        <Link href={checkHref} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-link">
          Check your own date →
        </Link>
      )}
    </div>
  );
}
