'use client';

/**
 * 🔗 ASK FOR ACCESS — from the supplier's (+), for EVERY supplier and the coordinator (chat gaps, owner 8 Nov 2026:
 * *"suppliers also get ask for access"*).
 *
 * NOT a second ask. It is the shipped one — `askHostForAccess` (the floor command's and the client page's "Ask the host
 * for access", `floor-command/access-actions.ts`) — with its gates untouched: booked on this event, the booking fee
 * when that flag is on, junk and already-held parts dropped, one waiting ask at a time. WHO ANSWERS is untouched too:
 * a host, or for a supplier who is not the coordinator the booked coordinator as well (`access-requests/`). That ask
 * now also posts a plain Setnayan line into this chat, and the waiting ask pins itself (`access_ask:<id>`).
 *
 * ONE dropdown of the parts (owner: any set of choices is one dropdown — the same `PickMenu` with checkmarks the
 * shipped ask draws), then Send.
 */
import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FLOOR_AREA_LABEL, FLOOR_REQUESTABLE_AREAS } from '@/lib/floor-command';
import { formatCount } from '@/lib/format-number';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { askHostForAccess } from '@/app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/access-actions';
import { ChatStepCard, type ChatCardStep } from '../chat-step-card';
import { Problem } from './card-bits';

export function AccessStepCard({ eventId, onClose, onSent }: { eventId: string; onClose?: () => void; onSent?: () => void }) {
  const formId = useId();
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const toggle = (area: string) =>
    setPicked((prev) => (prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]));

  const steps: ChatCardStep[] = [
    {
      title: 'Which parts do you need?',
      body: (
        <div className="grid gap-2" data-plus-access="">
          <PickMenu
            label="Parts to ask for"
            value={null}
            options={FLOOR_REQUESTABLE_AREAS.map((a) => ({ key: a, label: FLOOR_AREA_LABEL[a] }))}
            picked={picked}
            onPick={toggle}
            buttonText={
              picked.length === 0
                ? 'Pick the parts you need'
                : `${formatCount(picked.length)} ${picked.length === 1 ? 'part' : 'parts'} picked`
            }
            dataAttr="data-plus-access-parts"
            doneNote="Tick each part you need."
          />
          <p className="text-[13px] text-ink/55">The host decides each part, and can take it back any time.</p>
          <Problem text={problem} />
        </div>
      ),
      ok: picked.length > 0,
    },
  ];

  return (
    <form
      id={formId}
      action={async () => {
        setSending(true);
        setProblem(null);
        const r = await askHostForAccess(eventId, picked, null);
        setSending(false);
        if (!r.ok) return setProblem(r.error ?? 'Could not send that.');
        // one-render: keep (client-write) — the waiting ask is a new pin; re-read so the pin row shows it.
        router.refresh();
        onSent?.();
      }}
    >
      <ChatStepCard
        topic="access"
        kicker="You · not sent yet"
        title="Ask for access"
        steps={steps}
        step={0}
        onStep={() => {}}
        sendLabel="Send"
        sending={sending}
        onClose={onClose}
        submitForm={formId}
      />
    </form>
  );
}
