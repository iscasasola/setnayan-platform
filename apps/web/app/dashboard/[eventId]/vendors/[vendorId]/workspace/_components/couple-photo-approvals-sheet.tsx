'use client';

import { useId, useState, useTransition } from 'react';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import { ActionButton } from '@/components/action-button';
import { formatCount } from '@/lib/format-number';
import { eventFilesAction } from '@/app/_actions/event-files-actions';

type Row = {
  fileId: string;
  name: string;
  url: string | null;
  kind: string;
  service: string;
  takenAt: string | null;
  decision: 'waiting' | 'shown' | 'hidden';
};

/**
 * 📸 The couple's approval line + sheet (Piece 3b, legend row 150). Every photo the shop asked about, waiting first:
 * thumb · name · service · "taken 14 Mar" / "no date on the photo" · a Show · Hide pill; "Approve all". A Hide takes a
 * shown photo off the shop AT ONCE (the listing is a live view) and posts a line in the supplier's chat. Never a word
 * about how many photos the day has.
 */
export function CouplePhotoApprovalsSheet({
  eventId,
  shopName,
  coupleName,
  returnPath,
  rows,
}: {
  eventId: string;
  shopName: string;
  coupleName: string;
  returnPath: string;
  rows: Row[];
}) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<Record<string, Row['decision']>>({});
  const [said, setSaid] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const decisionOf = (r: Row) => local[r.fileId] ?? r.decision;
  const waiting = rows.filter((r) => decisionOf(r) === 'waiting');

  const decide = (ids: string[], decision: 'shown' | 'hidden') =>
    start(async () => {
      const prev = { ...local };
      setLocal((l) => ({ ...l, ...Object.fromEntries(ids.map((i) => [i, decision])) }));
      const fd = new FormData();
      fd.set('op', 'decide');
      fd.set('event_id', eventId);
      fd.set('decision', decision);
      fd.set('file_ids', JSON.stringify(ids));
      fd.set('couple_name', coupleName);
      fd.set('return_path', returnPath);
      const r = await eventFilesAction({ status: 'idle' }, fd);
      if (r.status === 'error') {
        setLocal(prev);
        setSaid(r.message);
      } else setSaid(decision === 'shown' ? `Shown on ${shopName}’s shop` : `Taken off ${shopName}’s shop`);
    });

  return (
    <div data-couple-photo-approvals="">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-14 w-full items-center justify-between gap-3 border-t border-ink/10 px-0.5 py-2.5 text-left"
        data-couple-approvals-line
      >
        <span className="text-[15px] text-ink">
          {waiting.length
            ? `${shopName} wants to show ${formatCount(waiting.length)} photo${waiting.length === 1 ? '' : 's'} as from your day`
            : `Photos ${shopName} shows from your day`}
        </span>
        <span className="flex flex-none items-center gap-1 text-sm font-semibold text-sn-accent">
          Review
          <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </span>
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        labelledById={titleId}
        rise
        foot={
          waiting.length ? (
            <div className="px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3">
              <ActionButton
                tone="brand"
                main
                icon={CheckCircle2}
                label={busy ? 'Approving…' : 'Approve all'}
                waiting={busy}
                className="w-full"
                onClick={() => decide(waiting.map((r) => r.fileId), 'shown')}
                data-testid="approvals-approve-all"
              />
            </div>
          ) : undefined
        }
      >
        <div className="space-y-3 px-4 pb-4 pt-3" data-couple-approvals-sheet>
          <h2 id={titleId} className="sr-only">
            {shopName} wants to show these on their shop as from your day
          </h2>
          <InfoTip label={`${shopName} wants to show these on their shop as from your day`} labelAs="p" labelClassName="pr-12 text-[17px] font-semibold text-ink" align="start">
            Only with your yes, and only photos taken around your day. You can change it later.
          </InfoTip>
          {said ? (
            <p role="status" className="text-sm text-ink/70">
              {said}
            </p>
          ) : null}
          <ul className="divide-y divide-ink/10">
            {rows.map((r) => {
              const d = decisionOf(r);
              return (
                <li key={r.fileId} className="flex min-h-14 items-center gap-3 py-2" data-approval-row={d}>
                  <span className="h-14 w-14 flex-none overflow-hidden rounded-lg bg-ink/[0.08]">
                    {r.url && r.kind === 'photo' ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a signed private R2 link, not an optimisable asset
                      <img src={r.url} alt={r.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{r.name}</span>
                    <span className="block text-xs text-ink/70">
                      {r.service} · {r.takenAt ? `taken ${dayWords(r.takenAt)}` : 'no date on the photo'}
                    </span>
                  </span>
                  <span className="flex flex-none overflow-hidden rounded-full bg-ink/[0.06]" role="radiogroup" aria-label={`Show or hide ${r.name}`}>
                    {(['shown', 'hidden'] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={d === k}
                        disabled={busy}
                        onClick={() => decide([r.fileId], k)}
                        className={`min-h-11 px-3 text-[13px] font-semibold ${d === k ? 'bg-ink text-cream' : 'text-ink/70'}`}
                      >
                        {k === 'shown' ? 'Show' : 'Hide'}
                      </button>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </Sheet>
    </div>
  );
}

function dayWords(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-PH', { day: 'numeric', month: 'short', timeZone: 'Asia/Manila' });
}
