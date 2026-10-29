'use client';

/**
 * 📱 CREW FOR THE DAY — Hub › Crew (owner 2026-10-29, DECISION_LOG "CREW JOIN THE SUPPLIER'S EVENT HUB BY QR — AND SEE
 * ONLY THE EVENT HUB"; prototype `hubCrew`): the phones on this event's crew, each with its state and role — a waiting
 * phone with **Allow**, an allowed one with its role ▾ (Member · Helper · Remove) — and the event's ONE crew QR with
 * Share · Save · Show. A forwarded QR admits nobody: every new phone waits here for the Allow. The pass ends after the
 * event by itself (the database's rule, not this screen's).
 *
 * Every press runs the shipped-shape server action (`crew-actions.ts`) under the caller's own RLS and answers in the
 * row; a refused one says why and the row goes back.
 */
import { useState, useTransition } from 'react';
import { Check, Download, Expand, QrCode, Send } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Explain } from '@/app/_components/explain';
import { Sheet } from '@/app/_components/sheet';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { CREW_ROLE_LABEL, CREW_ROLE_TOOLS_WORDS, crewRowLine, type CrewRole, type CrewStatus } from '@/lib/crew-pass';
import { changeCrew } from '../crew-actions';

export type CrewPanelPass = { passId: string; name: string; role: CrewRole; status: CrewStatus };
export type CrewPanelQr = { url: string; svg: string; endsWords: string };

export function CrewPanel({
  eventId,
  eventName,
  qr,
  passes,
  unreadable = false,
}: {
  eventId: string;
  eventName: string;
  /** The event's crew QR, drawn server-side — null when it has not been made yet. */
  qr: CrewPanelQr | null;
  passes: readonly CrewPanelPass[];
  /** The crew read was refused — said, never an empty crew. */
  unreadable?: boolean;
}) {
  const [rows, setRows] = useState<readonly CrewPanelPass[]>(passes);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [showing, setShowing] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const decide = (p: CrewPanelPass, next: Partial<Pick<CrewPanelPass, 'status' | 'role'>>) => {
    const before = rows;
    setRows(rows.map((r) => (r.passId === p.passId ? { ...r, ...next } : r)));
    setError(null);
    start(async () => {
      const res = await changeCrew(eventId, {
        kind: 'decide',
        passId: p.passId,
        status: next.status === 'allowed' || next.status === 'removed' ? next.status : undefined,
        role: next.role,
      });
      if (!res.ok) {
        setRows(before);
        setError(res.error);
      }
    });
  };
  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
    });
  };
  const share = async () => {
    if (!qr) return;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: `Crew QR · ${eventName}`, url: qr.url });
        return;
      }
      await navigator.clipboard.writeText(qr.url);
      setNote('Link copied — send it to your crew.');
    } catch {
      /* the share sheet was closed — nothing to say */
    }
  };
  const save = () => {
    if (!qr) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([qr.svg], { type: 'image/svg+xml' }));
    a.download = `crew-qr-${eventName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const live = rows.filter((r) => r.status !== 'removed');
  const removed = rows.filter((r) => r.status === 'removed');

  return (
    <div data-hub-crew="">
      <div className="flex items-center justify-between gap-2 pt-4">
        <p className="home-k2">Crew for the day</p>
        <Explain title="Crew for the day">
          Your crew scan the QR with any phone and land on your Event Hub for this event only — just the tools their
          role allows. Member = {CREW_ROLE_TOOLS_WORDS.member}; Helper = {CREW_ROLE_TOOLS_WORDS.helper}. No Today,
          Customers, Shop or money. A new phone waits for your Allow; the pass ends after the event.
        </Explain>
      </div>
      {error ? (
        <p role="alert" className="py-2 text-[13px] font-semibold text-danger-700">
          {error}
        </p>
      ) : null}
      {unreadable ? (
        <p className="py-3 text-[14px] text-ink/65">Couldn’t load your crew — try again in a moment.</p>
      ) : live.length === 0 && qr ? (
        <p className="py-3 text-[14px] text-ink/65">No phones yet — show them the QR below.</p>
      ) : null}
      {live.map((p) => (
        <div key={p.passId} className="flex min-h-14 items-center gap-3 border-b border-ink/10 py-2" data-crew-pass={p.status}>
          <span aria-hidden className="grid h-9 w-9 flex-none place-items-center rounded-full bg-sn-accent/10 text-[12px] font-semibold text-ink">
            {initials(p.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] text-ink">{p.name}</span>
            <span className={`block truncate text-[12.5px] ${p.status === 'waiting' ? 'text-warn-700 dark:text-warn-300' : 'text-success-700 dark:text-success-600'}`}>
              {crewRowLine(p.status, p.role)}
            </span>
          </span>
          <PickMenu
            label={`${p.name}’s role`}
            value={p.role}
            buttonText={CREW_ROLE_LABEL[p.role]}
            compact
            dataAttr="data-crew-role"
            options={[
              { key: 'member', label: CREW_ROLE_LABEL.member, hint: CREW_ROLE_TOOLS_WORDS.member },
              { key: 'helper', label: CREW_ROLE_LABEL.helper, hint: CREW_ROLE_TOOLS_WORDS.helper },
              { key: 'remove', label: 'Remove from the crew', hint: 'This phone leaves the Event Hub now' },
            ]}
            onPick={(k) => (k === 'remove' ? decide(p, { status: 'removed' }) : decide(p, { role: k as CrewRole }))}
          />
          {p.status === 'waiting' ? (
            <ActionButton tone="brand" main icon={Check} label="Allow" name={`Allow ${p.name}`} disabled={pending} onClick={() => decide(p, { status: 'allowed' })} />
          ) : null}
        </div>
      ))}

      {qr ? (
        <div className="mt-4 rounded-2xl bg-ink/[0.04] p-4 text-center" data-crew-qr="">
          <div className="mx-auto w-[220px] max-w-full rounded-xl bg-white p-2 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr.svg }} />
          <p className="mt-2 text-[15px] font-medium text-ink">Crew QR · {eventName}</p>
          <p className="text-[12.5px] text-ink/60">One per event · they scan, you tap Allow · {qr.endsWords}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <ActionButton tone="brand" main icon={Send} label="Share" onClick={() => void share()} />
            <ActionButton tone="neutral" icon={Download} label="Save" onClick={save} />
            <ActionButton tone="neutral" icon={Expand} label="Show" onClick={() => setShowing(true)} />
          </div>
          {note ? <p className="pt-2 text-[12.5px] text-ink/60">{note}</p> : null}
          <div className="mt-2 flex justify-center">
            <PickMenu
              label="Crew QR"
              value={null}
              buttonText="More"
              compact
              dataAttr="data-crew-qr-more"
              options={[
                { key: 'replace', label: 'Replace the QR', hint: 'The printed one stops working; phones already in stay in' },
                { key: 'off', label: 'Turn the crew QR off', hint: 'Every phone on the crew leaves the Event Hub' },
              ]}
              onPick={(k) => run(() => changeCrew(eventId, { kind: k === 'replace' ? 'replace' : 'off' }))}
            />
          </div>
          <Sheet open={showing} onClose={() => setShowing(false)} labelledById="crew-qr-show" rise>
            <div className="px-5 pb-8 pt-5 text-center">
              <h2 id="crew-qr-show" className="text-[18px] font-medium text-ink">
                Crew QR · {eventName}
              </h2>
              <div className="mx-auto mt-4 w-[320px] max-w-full rounded-xl bg-white p-3 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr.svg }} />
              <p className="mt-3 text-[13px] text-ink/60">Hold it up — each phone that scans waits for your Allow.</p>
            </div>
          </Sheet>
        </div>
      ) : unreadable ? null : (
        <div className="mt-4 rounded-2xl bg-ink/[0.04] p-4 text-center" data-crew-qr="none">
          <QrCode aria-hidden className="mx-auto h-8 w-8 text-ink/50" strokeWidth={1.5} />
          <p className="mt-2 text-[15px] font-medium text-ink">No crew QR yet</p>
          <p className="text-[12.5px] text-ink/60">Make one for this event — your crew scan it with any phone.</p>
          <div className="mt-3 flex justify-center">
            <ActionButton tone="brand" main icon={QrCode} label="Make the crew QR" disabled={pending} onClick={() => run(() => changeCrew(eventId, { kind: 'make' }))} />
          </div>
        </div>
      )}

      {removed.length > 0 ? (
        <div className="pt-3" data-crew-removed="">
          <p className="home-k2">Removed</p>
          {removed.map((p) => (
            <div key={p.passId} className="flex min-h-12 items-center gap-3 border-b border-ink/10 py-1.5">
              <span className="min-w-0 flex-1 truncate text-[14px] text-ink/60">{p.name}</span>
              <ActionButton tone="neutral" quiet icon={Check} label="Let back in" name={`Let ${p.name} back in`} disabled={pending} onClick={() => decide(p, { status: 'allowed' })} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function initials(name: string): string {
  const w = name.trim().split(/\s+/).filter(Boolean);
  if (w.length === 0) return '·';
  if (w.length === 1) return w[0]!.slice(0, 2).toUpperCase();
  return (w[0]![0]! + w[w.length - 1]![0]!).toUpperCase();
}
