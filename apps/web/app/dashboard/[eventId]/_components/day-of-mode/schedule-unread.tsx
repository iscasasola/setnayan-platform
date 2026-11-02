'use client';

/**
 * 🛑 THE DAY'S SCHEDULE COULD NOT BE READ (audit 2026-11-02 #1). Home computed `dayOfBlocksFailed` and never passed it,
 * so a refused read drew `[]` — and the banner said "everything looks wrapped" on the wedding day. Every day-of card
 * that reads the schedule says THIS instead, with a Reload. Held by `the-day-of-grid-says-a-failed-read.test.ts`.
 */
export const DAY_OF_SCHEDULE_UNREAD = 'Couldn’t load the schedule.';

export function ScheduleUnread({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  return (
    <p role="alert" data-day-of-schedule-unread="" className={`text-sm font-semibold ${tone === 'dark' ? 'text-cream' : 'text-danger-700'}`}>
      {DAY_OF_SCHEDULE_UNREAD}{' '}
      <button type="button" onClick={() => window.location.reload()} className="min-h-11 underline underline-offset-2">
        Reload
      </button>
    </p>
  );
}
