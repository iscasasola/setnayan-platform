import {
  CalendarClock,
  CheckCircle2,
  FileText,
  Handshake,
  PackageCheck,
  Wallet,
} from 'lucide-react';
import { ClientNotes, type ClientNote } from './customer-card-notes';

/**
 * Customer Card — Activity tab.
 *
 * A merged, newest-first feed of the booking's system events (proposals sent /
 * resolved, completion handshake, schedule suggestions, payment confirmations)
 * interleaved with the vendor team's private CRM notes + the note composer.
 * Everything is passed in pre-shaped from the page (which owns every read); this
 * component is pure render + the notes island.
 */

export type ActivityEvent = {
  id: string;
  kind: 'proposal' | 'payment' | 'handshake' | 'schedule' | 'deposit' | 'import';
  title: string;
  detail: string | null;
  at: string | null; // ISO or null (pending / undated)
  sortAt: number; // epoch ms for ordering (0 sinks undated to the bottom)
};

const ICONS = {
  proposal: FileText,
  payment: Wallet,
  handshake: PackageCheck,
  schedule: CalendarClock,
  deposit: Handshake,
  import: CheckCircle2,
} as const;

const TONES: Record<ActivityEvent['kind'], string> = {
  proposal: 'text-terracotta bg-terracotta/10',
  payment: 'text-success-700 bg-success-50',
  handshake: 'text-ink/70 bg-ink/5',
  schedule: 'text-terracotta bg-terracotta/10',
  deposit: 'text-success-700 bg-success-50',
  import: 'text-ink/60 bg-ink/5',
};

function fmtWhen(iso: string | null): string {
  if (!iso) return 'Pending';
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ActivityFeed({
  eventId,
  events,
  notes,
}: {
  eventId: string;
  events: ActivityEvent[];
  notes: ClientNote[];
}) {
  const ordered = [...events].sort((a, b) => b.sortAt - a.sortAt);
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          History · newest first
        </p>
        {ordered.length === 0 ? (
          <p className="text-sm text-ink/55">Nothing has happened on this booking yet.</p>
        ) : (
          <ul className="space-y-3">
            {ordered.map((e) => {
              const Icon = ICONS[e.kind];
              return (
                <li key={e.id} className="flex items-start gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONES[e.kind]}`}
                  >
                    <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{e.title}</p>
                    {e.detail ? <p className="text-xs text-ink/55">{e.detail}</p> : null}
                  </div>
                  <span className="shrink-0 text-[11px] text-ink/45">{fmtWhen(e.at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          Private notes · only your team
        </p>
        <ClientNotes eventId={eventId} notes={notes} />
      </div>
    </div>
  );
}
