'use client';

/**
 * 🗓 THE TIME-CHANGE CARD, BOTH WAYS (Unichat part F, owner 2026-11-20; drawing
 * `build-sessions/UNICHAT-LIVE-2026-11-19.html`, card type `time`) — the sibling of `schedule-change-card.tsx`: that
 * one says a move that already HAPPENED (Seen); this one is a move that is ASKED and still needs an answer.
 *
 *   · a supplier asks to move or add its moment → the hosts' copy has Decline · Approve; the supplier's own copy
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
 * LOOK: the same `ChatCardShell` + type sizes as the schedule card, on purpose — Unichat part A restyles the cards'
 * look; this file holds the data and the flow.
 */
import { useCallback, useEffect, useState } from 'react';
import { Check, Undo2, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { createClient } from '@/lib/supabase/client';
import { TIME_ASK_COLUMNS, TIME_ASK_LINE_SLACK_MS, findTimeAsk, timeAskSettledWords, timeAskTurn, type TimeAskLine, type TimeAskRow } from '@/lib/schedule-time-ask';
import { resolveScheduleSuggestion } from '@/app/dashboard/[eventId]/schedule/actions';
import { suggestScheduleChange } from '@/app/vendor-dashboard/clients/[eventId]/actions';
import { ChatCardShell } from '../chat-step-card';
import { EqualRow, Problem } from './card-bits';

type Ask = { eventId: string; suggestionId: string; status: string };
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
    .select(TIME_ASK_COLUMNS)
    .eq('event_id', thread.event_id)
    .eq('vendor_profile_id', thread.vendor_profile_id)
    .gte('created_at', new Date(at - TIME_ASK_LINE_SLACK_MS - 5_000).toISOString())
    .lte('created_at', new Date(at + 5_000).toISOString())
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return { at: 'failed' };
  const row = findTimeAsk((data ?? []) as unknown as TimeAskRow[], line, lineAt);
  return row ? { at: 'ok', ask: { eventId: row.event_id, suggestionId: row.suggestion_id, status: row.status } } : { at: 'gone' };
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
    setBusy(what);
    setProblem(null);
    const settledAs = what === 'back' ? 'withdrawn' : what === 'yes' ? 'accepted' : 'declined';
    if (seed) {
      setRead({ at: 'ok', ask: { ...ask, status: settledAs } });
      setBusy(null);
      return;
    }
    const fd = new FormData();
    fd.set('event_id', ask.eventId);
    fd.set('suggestion_id', ask.suggestionId);
    let error: string | null = null;
    try {
      if (turn === 'approve') {
        fd.set('decision', what === 'yes' ? 'accept' : 'decline');
        const r = await resolveScheduleSuggestion(fd);
        if (!r.ok) error = r.error;
      } else {
        fd.set('quiet', '1');
        if (what === 'back') fd.set('request', 'take_back');
        else {
          fd.set('request', 'answer');
          fd.set('decision', what === 'yes' ? 'accept' : 'decline');
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
    setRead({ at: 'ok', ask: { ...ask, status: settledAs } });
  };

  const title = line.add ? 'New moment' : 'Time change';
  const settled = ask && ask.status !== 'open' ? timeAskSettledWords(line, ask.status) : null;
  return (
    <ChatCardShell topic="schedule" kicker="Schedule" title={title} tone="auto">
      <div className="grid gap-2" data-schedule-time-ask={ask ? ask.status : read.at} data-time-ask-turn={turn}>
        <p className="text-[15px] font-semibold text-ink">{line.label}</p>
        <p className="text-[14px] tabular-nums text-ink/70">
          {line.from ? (
            <>
              <s>{line.from}</s> → <b className="font-semibold text-ink">{line.to}</b>
            </>
          ) : (
            <b className="font-semibold text-ink">{line.to}</b>
          )}
          {' · '}
          {line.by === 'host' ? `asked of ${viewer === 'vendor' ? 'you' : supplierName}` : `asked by ${viewer === 'vendor' ? 'you' : supplierName}`}
        </p>
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
          <p className={`text-[14px] font-medium ${ask?.status === 'accepted' ? 'text-success-700' : 'text-ink/70'}`} data-time-ask-settled="">
            {settled}
          </p>
        ) : turn === 'approve' || turn === 'accept' ? (
          <EqualRow>
            <ActionButton tone="neutral" icon={X} label={busy === 'no' ? 'Declining…' : 'Decline'} disabled={busy !== null} onClick={() => void press('no')} data-testid="time-ask-decline" />
            <ActionButton
              tone="brand"
              main
              icon={Check}
              label={busy === 'yes' ? 'Saving…' : turn === 'approve' ? 'Approve' : 'Accept'}
              disabled={busy !== null}
              onClick={() => void press('yes')}
              data-testid="time-ask-yes"
            />
          </EqualRow>
        ) : turn === 'take_back' ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[14px] text-ink/70">Waiting for the host</span>
            <ActionButton tone="neutral" icon={Undo2} label={busy === 'back' ? 'Taking back…' : 'Take back'} disabled={busy !== null} onClick={() => void press('back')} data-testid="time-ask-take-back" />
          </div>
        ) : (
          <p className="text-[14px] text-ink/70" data-time-ask-waiting="">
            Waiting for {supplierName}
          </p>
        )}
        <Problem text={problem} />
      </div>
    </ChatCardShell>
  );
}
