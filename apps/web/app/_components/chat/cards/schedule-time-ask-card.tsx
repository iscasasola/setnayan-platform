'use client';

/**
 * 🗓 THE TIME-CHANGE CARD, BOTH WAYS (Unichat part F, owner 2026-11-20; drawing
 * `build-sessions/UNICHAT-LIVE-2026-11-19.html`, card type `time`) — the sibling of `schedule-change-card.tsx`: that
 * one says a move that already HAPPENED (Seen); this one is a move that is ASKED and still needs an answer.
 *
 *   · a supplier asks to move or add its moment → the hosts' copy has Decline · Accept (the drawing's word on every side); the supplier's own copy
 *     says "Waiting for the host" with Take back;
 *   · the host or coordinator asks the supplier → the supplier's copy has Decline · Accept; the hosts' copy says
 *     "Waiting for <shop>".
 * Answered anywhere (here, the Schedule page, the Requests sheet), every copy reads the same settled line.
 *
 * NO NEW DOOR, NO NEW FACT: the ask is the shipped `event_schedule_suggestions` row, found from the line
 * (`findTimeAsk`); the buttons press the shipped actions — `resolveScheduleSuggestion` (the Requests sheet's) and
 * `suggestScheduleChange` (`answer` · `take_back`, the supplier Schedule's). A row that cannot be read is said; a line
 * whose request is gone says so — never the state of a different request.
 *
 * LOOK — the drawing's `time` card (Unichat v3, 20 Nov), on the one card look (`KindCard`, the meeting kind):
 *   · the TITLE is the moment ("Sound check") — no kind word; the stopwatch is its mark;
 *   · the line under it: [Your turn] ~~2:30 PM~~ → 3:00 PM · 18 Dec · 30 min;
 *   · ⓘ holds the rest — who asked whom, "Waiting for …", the note, the reason on a No, who owns the Schedule, and
 *     (on a supplier's own open ask) Take back: the drawing draws no Take back on the card, the ability stays;
 *   · Decline asks for a reason first (required); the reason rides the answer, and a quiet line says
 *     "<moment> stays <time> · <reason>" in the chat.
 * An answered ask folds to its settled line (accepted ticked, declined or taken back struck); a press opens the card.
 * 🧩 A SUPPLIER'S "NEW MOMENT" ASK has no card in the drawing; it stays, because the owner ruled a supplier may add
 * its own moments as requests the hosts approve (DECISION_LOG 2026-10-03 "SUPPLIERS WRITE THEIR OWN PART OF THE
 * SCHEDULE" — *"yes correct. they still approve or decline"* — and 2026-11-02 "+ My moment"). Same card, "New · " line.
 */
import { useCallback, useEffect, useId, useState } from 'react';
import { Check, Undo2, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { FormRows, TypedRow } from '@/app/_components/form-row';
import { Sheet } from '@/app/_components/sheet';
import { createClient } from '@/lib/supabase/client';
import { TIME_ASK_CARD_READ, TIME_ASK_LINE_SLACK_MS, findTimeAsk, timeAskFacts, timeAskSettledWords, timeAskTurn, type TimeAskLine, type TimeAskRow } from '@/lib/schedule-time-ask';
import { ANSWER_NOTE_MAX } from '@/lib/schedule-ask';
import { resolveScheduleSuggestion } from '@/app/dashboard/[eventId]/schedule/actions';
import { suggestScheduleChange } from '@/app/vendor-dashboard/clients/[eventId]/actions';
import { EqualRow, KindCard, Problem } from './card-bits';

/** The request behind the line: its id and state, and what the card's second line and its ⓘ say. */
type Ask = {
  eventId: string;
  suggestionId: string;
  status: string;
  /** "18 Dec" — the day of the new time. */
  day?: string | null;
  /** How long the moment runs, in minutes. */
  minutes?: number | null;
  /** The asker's note. */
  note?: string | null;
  /** The reason given with a No. */
  reason?: string | null;
};
type Read = { at: 'loading' } | { at: 'failed' } | { at: 'gone' } | { at: 'ok'; ask: Ask };

/** The request this line speaks for — read with the viewer's own session (RLS: the hosts their event's, the shop its own). */
async function loadTimeAsk(threadId: string, line: TimeAskLine, lineAt: string): Promise<Read> {
  const supabase = createClient();
  const t = await supabase.from('chat_threads').select('event_id, vendor_profile_id').eq('thread_id', threadId).maybeSingle();
  const thread = t.data as { event_id: string | null; vendor_profile_id: string | null } | null;
  if (t.error || !thread?.event_id || !thread.vendor_profile_id) return { at: 'failed' };
  const at = Date.parse(lineAt);
  if (!Number.isFinite(at)) return { at: 'failed' };
  const { data, error } = await supabase
    .from('event_schedule_suggestions')
    .select(TIME_ASK_CARD_READ)
    .eq('event_id', thread.event_id)
    .eq('vendor_profile_id', thread.vendor_profile_id)
    .gte('created_at', new Date(at - TIME_ASK_LINE_SLACK_MS - 5_000).toISOString())
    .lte('created_at', new Date(at + 5_000).toISOString())
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return { at: 'failed' };
  const row = findTimeAsk((data ?? []) as unknown as TimeAskRow[], line, lineAt);
  return row ? { at: 'ok', ask: { eventId: row.event_id, suggestionId: row.suggestion_id, status: row.status, ...timeAskFacts(row) } } : { at: 'gone' };
}

const NOT_SENT = 'That didn’t send — try again.';

export function ScheduleTimeAskCard({
  threadId,
  createdAt,
  line,
  viewer,
  supplierName,
  seed,
}: {
  threadId: string;
  /** When the line was posted — its request was written just before it. */
  createdAt: string;
  line: TimeAskLine;
  viewer: 'vendor' | 'couple';
  supplierName: string;
  /** Labs only: the request as read, so no request is made and the buttons write nothing. */
  seed?: Ask;
}) {
  const [read, setRead] = useState<Read>(seed ? { at: 'ok', ask: seed } : { at: 'loading' });
  const [busy, setBusy] = useState<'yes' | 'no' | 'back' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [info, setInfo] = useState(false);
  // Decline asks for a reason first (the drawing's "Decline · say why"): null = not declining yet.
  const [reason, setReason] = useState<string | null>(null);
  const sheetTitle = useId();
  const load = useCallback(() => {
    void loadTimeAsk(threadId, line, createdAt).then(setRead, () => setRead({ at: 'failed' }));
    // The line is this card's identity: its words never change after it is posted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, createdAt, line.by, line.add, line.to]);
  useEffect(() => {
    if (!seed) load();
  }, [load, seed]);

  const turn = timeAskTurn(line, viewer);
  const ask = read.at === 'ok' ? read.ask : null;

  /** Press one of the shipped doors, then show the row as it now is — in place, nothing else on the screen moves. */
  const press = async (what: 'yes' | 'no' | 'back') => {
    if (!ask || busy) return;
    const why = what === 'no' ? (reason ?? '').trim().slice(0, ANSWER_NOTE_MAX) : '';
    if (what === 'no' && !why) {
      setProblem('Say why first — they read it beside the time.');
      return;
    }
    setBusy(what);
    setProblem(null);
    const settledAs = what === 'back' ? 'withdrawn' : what === 'yes' ? 'accepted' : 'declined';
    if (seed) {
      setRead({ at: 'ok', ask: { ...ask, status: settledAs, reason: why || ask.reason } });
      setBusy(null);
      setReason(null);
      setInfo(false);
      return;
    }
    const fd = new FormData();
    fd.set('event_id', ask.eventId);
    fd.set('suggestion_id', ask.suggestionId);
    let error: string | null = null;
    try {
      if (turn === 'approve') {
        fd.set('decision', what === 'yes' ? 'accept' : 'decline');
        if (why) fd.set('reason', why);
        const r = await resolveScheduleSuggestion(fd);
        if (!r.ok) error = r.error;
      } else {
        fd.set('quiet', '1');
        if (what === 'back') fd.set('request', 'take_back');
        else {
          fd.set('request', 'answer');
          fd.set('decision', what === 'yes' ? 'accept' : 'decline');
          if (why) fd.set('reason', why);
        }
        const r = await suggestScheduleChange(fd);
        if (!r || !r.ok) error = r && !r.ok ? r.error : NOT_SENT;
      }
    } catch {
      error = NOT_SENT;
    }
    setBusy(null);
    if (error) {
      setProblem(error);
      // It may have been answered elsewhere in the meantime: show what is true now.
      load();
      return;
    }
    setRead({ at: 'ok', ask: { ...ask, status: settledAs, reason: why || ask.reason } });
    setReason(null);
    setInfo(false);
  };

  const settled = ask && ask.status !== 'open' ? timeAskSettledWords(line, ask.status) : null;
  const answers = turn === 'approve' || turn === 'accept';
  const them = line.by === 'host' ? supplierName : 'the hosts';
  // The drawing's second line: ~~from~~ → to · 18 Dec · 30 min ("New · 3:30 PM · …" for an added moment).
  const when = (
    <span className="tabular-nums" data-time-ask-when="">
      {line.add ? (
        <>New · <b className="font-semibold text-ink">{line.to}</b></>
      ) : line.from ? (
        <>
          <s>{line.from}</s> → <b className="font-semibold text-ink">{line.to}</b>
        </>
      ) : (
        <b className="font-semibold text-ink">{line.to}</b>
      )}
      {ask?.day ? ` · ${ask.day}` : ''}
      {ask?.minutes ? ` · ${ask.minutes} min` : ''}
    </span>
  );
  // ⓘ — everything the drawing took off the card.
  const details = (
    <div className="grid gap-1.5 text-[15px] text-ink/80" data-time-ask-info="">
      <p>{line.by === 'host' ? `Asked of ${viewer === 'vendor' ? 'you' : supplierName}.` : `Asked by ${viewer === 'vendor' ? 'you' : supplierName}.`}</p>
      {ask?.status === 'open' && !answers ? <p data-time-ask-waiting="">Waiting for {turn === 'take_back' ? 'the hosts' : supplierName}.</p> : null}
      {ask?.note ? <p>Note: {ask.note}</p> : null}
      {ask?.reason ? <p data-time-ask-reason="">Reason: {ask.reason}</p> : null}
      <p>The hosts and their coordinator own the event Schedule.</p>
      {ask?.status === 'open' && turn === 'take_back' ? (
        <div className="flex pt-1">
          <ActionButton tone="neutral" icon={Undo2} label={busy === 'back' ? 'Taking back…' : 'Take back'} disabled={busy !== null} onClick={() => void press('back')} data-testid="time-ask-take-back" />
        </div>
      ) : null}
    </div>
  );
  return (
    <>
    <KindCard
      kind="meeting"
      topic="schedule"
      mark="time"
      kicker={when}
      title={line.label}
      turn={settled ? (ask?.status === 'accepted' ? 'done' : 'old') : ask && answers ? 'me' : 'wait'}
      // The fold line's own tick is KindCard's — the words drop theirs so an accepted ask is ticked once.
      settled={settled ? settled.replace(/^✓ /, '') : undefined}
      info={settled || read.at !== 'ok' ? undefined : { onOpen: () => setInfo(true), data: { 'data-time-ask-info-button': '' } }}
    >
      <div className="grid gap-2" data-schedule-time-ask={ask ? ask.status : read.at} data-time-ask-turn={turn}>
        {read.at === 'loading' ? (
          <p role="status" className="text-[14px] text-ink/70">
            Loading…
          </p>
        ) : read.at === 'failed' ? (
          <div className="grid gap-2">
            <p role="alert" className="text-[14px] font-medium text-danger-700">
              This ask couldn’t be read just now.
            </p>
            <div className="flex">
              <ActionButton tone="neutral" icon={Undo2} label="Try again" onClick={load} />
            </div>
          </div>
        ) : read.at === 'gone' ? (
          <p className="text-[14px] text-ink/70" data-time-ask-gone="">
            This ask is no longer open. See the Schedule for where it stands.
          </p>
        ) : settled ? (
          // Opened from its folded line: what the card held.
          <div className="grid gap-1.5">
            <p className="text-[14px] text-ink/70">{when}</p>
            {details}
          </div>
        ) : answers && reason !== null ? (
          <div className="grid gap-2" data-time-ask-declining="">
            <FormRows>
              <TypedRow
                name="Reason"
                about={{ words: `Required. ${them === 'the hosts' ? 'The supplier' : supplierName} reads it beside the time.` }}
                value={reason}
                empty="The venue opens the hall later"
                long
                boxed
                required
                maxLength={ANSWER_NOTE_MAX}
                onType={(t) => setReason(t)}
                onKeep={(t) => {
                  setReason(t);
                  return { ok: true as const };
                }}
                data="time-ask-reason"
              />
            </FormRows>
            <EqualRow>
              <ActionButton tone="neutral" icon={X} label="Cancel" disabled={busy !== null} onClick={() => setReason(null)} data-testid="time-ask-decline-cancel" />
              <ActionButton tone="danger" main icon={X} label={busy === 'no' ? 'Declining…' : 'Decline'} disabled={busy !== null} onClick={() => void press('no')} data-testid="time-ask-decline-send" />
            </EqualRow>
          </div>
        ) : answers ? (
          <EqualRow>
            <ActionButton tone="neutral" icon={X} label={busy === 'no' ? 'Declining…' : 'Decline'} disabled={busy !== null} onClick={() => setReason('')} data-testid="time-ask-decline" />
            <ActionButton
              tone="brand"
              main
              icon={Check}
              label={busy === 'yes' ? 'Saving…' : 'Accept'}
              disabled={busy !== null}
              onClick={() => void press('yes')}
              data-testid="time-ask-yes"
            />
          </EqualRow>
        ) : null}
        <Problem text={problem} />
      </div>
    </KindCard>
    <Sheet open={info} onClose={() => setInfo(false)} labelledById={sheetTitle} rise>
      <div className="grid gap-2 px-4 pb-5 pt-1" data-time-ask-sheet="">
        <p id={sheetTitle} className="text-base font-semibold text-ink">
          {line.label}
        </p>
        <p className="text-[14px] text-ink/70">{when}</p>
        {details}
        <Problem text={problem} />
      </div>
    </Sheet>
    </>
  );
}
