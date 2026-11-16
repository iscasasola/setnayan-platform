/**
 * The Check-in desk's Suppliers and Team parts, as drawn (owner 16 Nov 2026, "Yes, as drawn"; prototype § "Check-in
 * desk (three parts)" — "Desk · Suppliers", "Desk · Team"). Server-drawn and display-only: every word comes from
 * lib/checkin-desk.ts, every fact from a read the desk page already makes in its one batch.
 */
import type { BoardLine, TeamLine } from '@/lib/checkin-desk';
import { ARRIVAL_VERDICT_WORD } from '@/lib/checkin-desk';

const verdictTone: Record<BoardLine['verdict'], string> = {
  on_time: 'bg-success-50 text-success-800',
  late: 'bg-warn-50 text-warn-800',
  not_yet: 'bg-ink/5 text-ink/70',
};

function Initials({ text, dashed = false }: { text: string; dashed?: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-semibold text-ink/70 ${
        dashed ? 'border border-dashed border-ink/30' : 'bg-ink/5'
      }`}
    >
      {text}
    </span>
  );
}

export function SuppliersPart({ lines, here, unread }: { lines: readonly BoardLine[]; here: number; unread: boolean }) {
  return (
    <section aria-label="Suppliers" className="rounded-2xl bg-[var(--m-paper-2)] px-4 py-3">
      <div className="flex min-h-9 items-center gap-2">
        <h2 className="text-base font-semibold text-ink">Suppliers</h2>
        {lines.length ? (
          <span className="rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-bold text-success-800">
            {here} of {lines.length} here
          </span>
        ) : null}
      </div>
      <p className="text-sm text-ink/70">
        Each supplier marks &ldquo;On site&rdquo;. The desk checks it against the time they said they arrive, and
        &ldquo;Packed up&rdquo; against when they said they are done.
      </p>
      {unread ? (
        <p className="mt-2 text-sm text-warn-800">Couldn&rsquo;t load your suppliers&rsquo; updates just now — this refreshes on its own.</p>
      ) : lines.length === 0 ? (
        <p className="mt-2 text-sm text-ink/70">No supplier on Setnayan is booked for this event yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-ink/10">
          {lines.map((l) => (
            <li key={l.vendorProfileId} className="flex min-h-14 items-center gap-3 py-2">
              <Initials text={l.initials} dashed={l.noTimes} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{l.name}</span>
                <span className="block text-xs text-ink/70">{l.line}</span>
              </span>
              <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${verdictTone[l.verdict]}`}>
                {ARRIVAL_VERDICT_WORD[l.verdict]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function TeamPart({ lines, unread }: { lines: readonly TeamLine[]; unread: boolean }) {
  return (
    <section aria-label="On the desk" className="rounded-2xl bg-[var(--m-paper-2)] px-4 py-3">
      <div className="flex min-h-9 items-center gap-2">
        <h2 className="text-base font-semibold text-ink">On the desk</h2>
        <span className="rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-bold text-success-800">
          {lines.filter((l) => l.active).length}
        </span>
      </div>
      {unread ? (
        <p className="text-sm text-warn-800">Couldn&rsquo;t load everyone on the desk just now — this refreshes on its own.</p>
      ) : null}
      <ul className="mt-1 divide-y divide-ink/10">
        {lines.map((l) => (
          <li key={l.userId} className="flex min-h-14 items-center gap-3 py-2">
            <Initials text={l.initials} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{l.name}</span>
              <span className="block text-xs text-ink/70">{l.line}</span>
            </span>
            <span
              className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${
                l.active ? 'bg-success-50 text-success-800' : 'bg-ink/5 text-ink/70'
              }`}
            >
              {l.status}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
