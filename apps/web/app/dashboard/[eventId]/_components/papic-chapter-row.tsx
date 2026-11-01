'use client';

import { useEffect, useState, useTransition } from 'react';
import { Play } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { papicSaveInPlace } from '@/app/dashboard/[eventId]/studio/papic/in-place-actions';
import {
  PAPIC_SHOOTS_INTO,
  PAPIC_WHOLE_EVENT,
  PAPIC_WHOLE_EVENT_WORDS,
  papicChapterCanStartNow,
  papicChapterCountWords,
  papicChapterOptionWords,
  papicChapterState,
  papicChapterTarget,
  papicChapterWhoWords,
  papicChapterWindowWords,
  type PapicChapter,
} from '@/lib/papic-chapter';

/**
 * 📷 PAPIC SHOOTS INTO A CHAPTER — the card's one added row (owner 2026-11-01, DECISION_LOG "THE PAPIC CARD ON HOME
 * SHOOTS INTO A CHAPTER": *"the card shows which chapter Papic shoots into (the one happening now, or one picked from a
 * dropdown, e.g. 'Meeting with caterer'); … counts and Add more stay event-wide plus one line 'This chapter: N
 * photos'"*). EXTENDS the shipped card (`papic-home-card.tsx`) — its head, counts and Add more are untouched.
 *
 *   Shooting into  [Meeting with caterer ▾]     ← ONE PickMenu: every chapter + Whole event
 *   On now · until 4 PM ⓘ          [Start now]  ← the window; Start now only before it opens; who may shoot in the ⓘ
 *   This chapter: 12 photos
 *
 *   · The chapter it names is `papicChapterTarget` — the host's pick, else the one happening now — the SAME rule the
 *     cameras are given, so the card and the camera can never name two chapters.
 *   · A pick and Start now save IN PLACE (`papicSaveInPlace`; the door revalidates Home); a refusal is said under the row,
 *     and the shown pick goes back to what is stored.
 *   · `chapters === null` = the read failed: the row says so — never "Whole event", which would hide a real meeting.
 *   · No chapters at all: nothing is drawn (Papic shoots into the whole event, as before chapters).
 *
 * `standIn` is the dev lab's only (`/dev/home-lab?card=1&chapter=…`): picks answer with no server.
 */
/** 📏 The open list's least width — "Meeting with caterer · 2 PM" on one line (options never wrap, owner 2026-10-30). */
const PAPIC_CHAPTER_MENU_MIN_WIDTH = 288;

function chapterForm(eventId: string, chapter: string): FormData {
  const fd = new FormData();
  fd.set('event_id', eventId);
  fd.set('chapter', chapter);
  return fd;
}

export function PapicChapterRow({
  eventId,
  chapters,
  nowMs,
  standIn,
}: {
  eventId: string;
  /** The event's chapters as Papic sees them (`papic_event_chapters`); null = the read failed. */
  chapters: PapicChapter[] | null;
  /** The server's now, so the server and the first paint agree on "happening now". */
  nowMs: number;
  standIn?: 'ok' | 'fail';
}) {
  const [pending, start] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);
  const [shown, setShown] = useState<PapicChapter[] | null>(chapters);
  useEffect(() => {
    if (!pending) setShown(chapters);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- follows the saved facts only
  }, [chapters]);

  if (shown === null) {
    return (
      <p role="status" className="pt-2 text-[13px] text-ink/60" data-papic-chapter="unread">
        {PAPIC_SHOOTS_INTO} · Couldn&rsquo;t check the chapters just now
      </p>
    );
  }
  if (shown.length === 0) return null;

  const target = papicChapterTarget(shown, nowMs);
  const current = target?.chapter ?? null;
  const value = current?.blockId ?? PAPIC_WHOLE_EVENT;

  const save = (run: () => Promise<{ ok: true } | { ok: false; error: string }>, next: PapicChapter[]) => {
    const before = shown;
    setShown(next);
    setProblem(null);
    start(async () => {
      const answer = standIn
        ? standIn === 'ok'
          ? ({ ok: true } as const)
          : ({ ok: false, error: 'That did not save. Nothing changed — please try again.' } as const)
        : await run().catch(() => ({ ok: false as const, error: 'That did not save. Nothing changed — please try again.' }));
      // Saved: the door revalidates Home, which re-renders in place with the stored facts.
      if (!answer.ok) {
        setShown(before);
        setProblem(answer.error);
      }
    });
  };

  const pick = (key: string) => {
    if (pending || key === value) return;
    const next = shown.map((c) => ({ ...c, picked: c.blockId === key }));
    save(() => papicSaveInPlace('pickPapicChapter', chapterForm(eventId, key)), next);
  };

  const startNow = () => {
    if (pending || !current) return;
    const at = new Date(nowMs).toISOString();
    const next = shown.map((c) =>
      c.blockId === current.blockId ? { ...c, picked: true, openedEarlyAt: at, opensAt: at } : { ...c, picked: false },
    );
    save(() => papicSaveInPlace('startPapicChapterNow', chapterForm(eventId, current.blockId)), next);
  };

  // While a chapter is ON, its shots go into it — "Whole event" only un-picks a chapter that has not started.
  const onNow = papicChapterTarget(
    shown.map((c) => ({ ...c, picked: false })),
    nowMs,
  );
  const options = [
    ...shown.map((c) => ({ key: c.blockId, label: papicChapterOptionWords(c) })),
    onNow
      ? { key: PAPIC_WHOLE_EVENT, label: PAPIC_WHOLE_EVENT_WORDS, disabledNote: `${onNow.chapter.label} is on now — its shots go into it.` }
      : { key: PAPIC_WHOLE_EVENT, label: PAPIC_WHOLE_EVENT_WORDS },
  ];

  return (
    <div className="flex flex-col gap-1 pt-3" data-papic-chapter={current ? current.blockId : PAPIC_WHOLE_EVENT} aria-busy={pending || undefined}>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <span className="shrink-0 text-[13px] text-ink/65">{PAPIC_SHOOTS_INTO}</span>
        <span className="min-w-0" data-papic-chapter-pick="">
          <PickMenu
            label={PAPIC_SHOOTS_INTO}
            value={value}
            options={options}
            buttonText={current ? current.label : PAPIC_WHOLE_EVENT_WORDS}
            onPick={pick}
            compact
            menuMinWidth={PAPIC_CHAPTER_MENU_MIN_WIDTH}
            dataAttr="data-papic-chapter-button"
          />
        </span>
      </div>
      {current ? (
        <>
          <div className="flex min-w-0 items-center justify-between gap-3">
            <InfoTip
              label={papicChapterWindowWords(current, nowMs)}
              labelClassName={`text-[13px] ${papicChapterState(current, nowMs) === 'open' ? 'font-semibold text-success-700' : 'text-ink/70'}`}
              align="start"
            >
              {papicChapterWhoWords(current.photoWho)} Papic turns on for it at its start and off at its end; a chapter
              with no end closes at the end of its day. Credits and Add more are the whole event&rsquo;s.
            </InfoTip>
            {papicChapterCanStartNow(current, nowMs) ? (
              <span className="shrink-0" data-papic-chapter-start="">
                <ActionButton tone="brand" icon={<Play aria-hidden strokeWidth={1.9} />} label="Start now" onClick={startNow} waiting={pending} />
              </span>
            ) : null}
          </div>
          <p className="text-[13px] text-ink/65" data-papic-chapter-count={current.captures}>
            {papicChapterCountWords(current.captures)}
          </p>
        </>
      ) : null}
      {problem ? (
        <p role="alert" className="text-[12.5px] font-semibold leading-snug text-danger-700" data-papic-chapter-problem="">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
