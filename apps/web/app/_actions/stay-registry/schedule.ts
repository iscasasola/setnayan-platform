import 'server-only';
import type { ScheduleStayDoor } from '@/lib/stay-doors/schedule';
import { eventScreen, type StayWords } from '@/lib/save-in-place';
import { applyActivityPicks, toggleActivityPick } from '@/app/dashboard/[eventId]/schedule/activity-picks-actions';
import { saveHostAnswers } from '@/app/dashboard/[eventId]/schedule/question-answers-actions';
import { sendStageNoteFromEvent } from '@/app/dashboard/[eventId]/schedule/stage-note-actions';
import { kind, type Door } from './_door';

/** Schedule's refusals in the page's own words (`host-questions.tsx` · `tell-the-host.tsx`'s banners). */
const SCHEDULE_WORDS: StayWords = {
  within: [eventScreen('schedule')],
  refuse: (q) =>
    q.get('host_answers') === 'error'
      ? 'We couldn’t save every answer. Nothing you typed before was lost — please try again.'
      : q.get('note') === 'error'
        ? 'That didn’t send. Nothing reached your host — please try again.'
        : null,
};
const schedule = kind(SCHEDULE_WORDS, 'schedule');

export const SCHEDULE: Readonly<Record<ScheduleStayDoor, Door>> = {
  'schedule.toggleActivityPick': schedule(toggleActivityPick),
  'schedule.applyActivityPicks': schedule(applyActivityPicks),
  'schedule.saveHostAnswers': schedule(saveHostAnswers),
  'schedule.sendStageNoteFromEvent': schedule(sendStageNoteFromEvent),
};
