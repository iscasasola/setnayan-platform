'use client';

/**
 * 📅 MEETING — the first real (+) card on the shared frame (Supplier Build 3 · lane B).
 *
 * Owner, 8 Nov: *"Meeting: ① name → ② date → ③ time → ④ who → Send. The other side answers the same way."* The card
 * posts the SHIPPED meeting request (`createScheduleRequestFromChat`, in place): one `event_appointments` row (status
 * `proposed`) and its card in the chat — the same act the old "Deal or meeting" panel posted, so the answer side is
 * the shipped meeting card (Accept · Propose a new time · Decline) and Decisions / Details / the Schedule read it.
 *
 * ④ is HOW (in person · virtual, the shipped `MeetingHowFields`). "Who is included" has no column on
 * `event_appointments` today — every host of the chat and the shop are in it by being in the chat — so the card does
 * not draw a picker that would store nothing (reported to the owner, not invented).
 */
import { useId, useState } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { DateRow } from '@/app/_components/form-row-date';
import { TypedRow } from '@/app/_components/form-row';
import { MeetingHowFields } from '@/app/_components/meeting-how-fields';
import { createScheduleRequestFromChat } from '@/app/_components/negotiation-actions';
import { MEETING_IN_PLACE_FIELD } from '@/lib/appointments';
import { Problem } from './cards/card-bits';
import { TIME_SLOTS, dayBeforeEventIso, todayIsoLocal } from '@/lib/appointment-slots';
import { ChatStepCard, type ChatCardStep } from './chat-step-card';
import { dayWords } from '@/lib/agreed-now';

const KINDS = [
  { key: 'Ocular visit', label: 'Ocular visit' },
  { key: 'Tasting', label: 'Tasting' },
  { key: 'Final meeting', label: 'Final meeting' },
  { key: 'other', label: 'Something else' },
];

export function MeetingStepCard({
  threadId,
  returnPath,
  eventDate,
  onClose,
  onSent,
  anchorId,
  initialStep = 0,
  seed,
}: {
  threadId: string;
  returnPath: string;
  eventDate: string | null;
  onClose?: () => void;
  onSent?: () => void;
  anchorId?: string;
  /** Labs only — open on a given step with fields filled. */
  initialStep?: number;
  seed?: { kind?: string; name?: string; date?: string; time?: string };
}) {
  const formId = useId();
  const [step, setStep] = useState(initialStep);
  const [kind, setKind] = useState<string | null>(seed?.kind ?? null);
  const [name, setName] = useState(seed?.name ?? '');
  const [date, setDate] = useState<string | null>(seed?.date ?? null);
  const [time, setTime] = useState<string | null>(seed?.time ?? null);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const today = todayIsoLocal();
  const lastDay = dayBeforeEventIso(eventDate);
  const title = kind === 'other' ? name.trim() || 'Meeting' : kind ?? 'Meeting';
  const timeLabel = TIME_SLOTS.find((t) => t.value === time)?.label ?? null;

  const steps: ChatCardStep[] = [
    {
      title: 'What is the meeting?',
      body: (
        <div className="grid gap-2">
          <PickMenu
            label="What is the meeting?"
            value={kind}
            options={KINDS}
            onPick={(k) => {
              setKind(k);
              if (k !== 'other') setName(k);
            }}
            buttonText={kind ? undefined : 'Pick one'}
            dataAttr="data-meeting-kind"
          />
          {kind === 'other' ? (
            <TypedRow
              name="Name the meeting"
              value={name}
              empty="Name it"
              placeholder="Name it"
              maxLength={120}
              openAsk={1}
              onType={(v) => setName(v)}
              onKeep={(v) => {
                setName(v);
              }}
            />
          ) : null}
        </div>
      ),
      ok: !!kind && (kind !== 'other' || name.trim().length > 0),
    },
    {
      title: 'Which day?',
      sub: lastDay ? 'From today to the day before the event.' : undefined,
      body: (
        <DateRow
          name="meeting_day_pick"
          value={date}
          today={today}
          min={today}
          max={lastDay}
          onKeep={(d) => {
            setDate(d);
          }}
        />
      ),
      ok: !!date,
    },
    {
      title: 'What time?',
      body: (
        <PickMenu
          label="What time?"
          value={time}
          options={TIME_SLOTS.map((t) => ({ key: t.value, label: t.label }))}
          onPick={setTime}
          buttonText={time ? undefined : 'Pick a time'}
          dataAttr="data-meeting-time"
        />
      ),
      ok: !!time,
    },
    {
      title: 'How will you meet?',
      sub: date && timeLabel ? `${title} · ${dayWords(date) ?? date} · ${timeLabel}` : undefined,
      body: (
        <div className="grid gap-2">
          <MeetingHowFields />
          <Problem text={problem} />
        </div>
      ),
      ok: true,
    },
  ];

  return (
    <form
      id={formId}
      action={async (fd) => {
        // 📅 The card closes only on a SAVED meeting (owner 12 Nov 2026, "cannot add schedule"): it used to close before
        // the server answered, so a refusal took the meeting with it and the page reloaded with nothing said.
        setSending(true);
        setProblem(null);
        fd.set(MEETING_IN_PLACE_FIELD, '1');
        const r = await createScheduleRequestFromChat(fd);
        setSending(false);
        if (!r || !r.ok) return setProblem(r?.message ?? 'Couldn’t send the meeting. Try again.');
        onSent?.();
      }}
    >
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="return_to" value={returnPath} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="date" value={date ?? ''} />
      <input type="hidden" name="time" value={time ?? ''} />
      <ChatStepCard
        topic="schedule"
        kicker="You · not sent yet"
        title={title === 'Meeting' ? 'Meeting' : `Meeting · ${title}`}
        steps={steps}
        step={step}
        onStep={setStep}
        sending={sending}
        onClose={onClose}
        anchorId={anchorId}
        submitForm={formId}
      />
    </form>
  );
}
