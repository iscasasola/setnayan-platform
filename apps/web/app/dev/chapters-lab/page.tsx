import { notFound } from 'next/navigation';
import { clockWords, findTaskClashes, taskPlace, taskWho, type TaskRow } from '@/lib/schedule-chapters';
import { LAB_CHAPTERS, LAB_CLASH_TASK, LAB_MOMENT, LAB_SUPPLIERS, LAB_TASKS } from './lab-chapters';
import { LabScheduleChapters } from './lab-schedule-chapters';

/**
 * /dev/chapters-lab — 📖 Step 2 "Chapters" on fake data, no sign-in and no database (owner 2026-11-01, corpus
 * SCHEDULE_CHAPTERS_BUILD_PLAN §12 Step 2). DEV-ONLY: production builds 404 it.
 *
 *   1. THE SCHEDULE PAGE'S CHAPTERS (Step 3a — chapters moved off Home › Event Settings, owner 2026-11-01): the REAL
 *      frame, rail, chapter page and sheets on fake chapters, with doors that only answer "saved": the rail with the
 *      time between chapters and a "Time TBA" one under it, + Add a chapter (name and time), a tap opens the chapter's
 *      page (‹ back · the dropdown · Ingress · Event · Egress · Edit), Chapter details, Delete (warning → Continue →
 *      deleting), and Planning Stage's "Final fitting". `?empty=1` none · `?fail=1` the failed read · `?view=1` view only.
 *   2. THE RUN-OF-SHOW SHAPE (§3c): one moment holding three parallel tasks in two places, each place resolved by the
 *      real `taskPlace` (a task with no place follows its moment's room). `?clash=1` adds the planner's Coord A in a
 *      second place at the same time, and the real `findTaskClashes` flags it — flagged, never blocked.
 */
export default async function ChaptersLabPage({
  searchParams,
}: {
  searchParams: Promise<{ empty?: string; fail?: string; clash?: string; view?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const q = await searchParams;
  const chapter = LAB_CHAPTERS[0]!;
  const tasks: TaskRow[] = q.clash === '1' ? [...LAB_TASKS, LAB_CLASH_TASK] : LAB_TASKS;
  const clashes = findTaskClashes(tasks.map((task) => ({ task, moment: LAB_MOMENT, chapter })));
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-8 bg-cream px-4 py-6 text-ink dark:bg-ink-950">
      <section data-lab="chapters" className="flex flex-col gap-3">
        <LabScheduleChapters empty={q.empty === '1'} fail={q.fail === '1'} viewOnly={q.view === '1'} />
      </section>

      <section data-lab="moment-tasks" className="flex flex-col gap-2 border-t border-ink/10 pt-6">
        <h2 className="text-[17px] font-semibold">One moment, tasks at once</h2>
        <p className="text-[13px] text-ink/60">
          {chapter.label} · {LAB_MOMENT.label} · {clockWords(LAB_MOMENT.start_at)}–{clockWords(LAB_MOMENT.end_at)}
        </p>
        <ul className="flex flex-col">
          {tasks.map((t) => (
            <li key={t.task_id} data-task={t.task_id} className="border-t border-ink/10 py-2.5 first:border-t-0">
              <span className="block text-[15px] font-semibold">{whoWords(t)}</span>
              <span className="block text-[14px]">{t.what}</span>
              <span data-task-place="" className="block text-[13px] text-ink/60">
                {taskPlace(t, LAB_MOMENT, chapter) ?? 'No place yet'}
              </span>
            </li>
          ))}
        </ul>
        <p data-task-places="" className="text-[13px] text-ink/60">
          {new Set(tasks.map((t) => taskPlace(t, LAB_MOMENT, chapter))).size} places at once.
        </p>
        {clashes.length > 0 ? (
          <p role="alert" data-task-clash="" className="text-[13px] font-semibold text-danger-700">
            {clashes.map((c) => `${whoWords(tasks.find((t) => t.task_id === c.first)!)} is in two places at once: ${c.places[0]} and ${c.places[1]}.`).join(' ')}
          </p>
        ) : (
          <p data-task-clash="none" className="text-[13px] text-ink/60">
            No one is in two places at once.
          </p>
        )}
      </section>
    </main>
  );
}

function whoWords(t: TaskRow): string {
  const w = taskWho(t);
  if (!w) return 'Someone';
  switch (w.kind) {
    case 'supplier':
      return `${LAB_SUPPLIERS[w.vendorId] ?? 'A supplier'}${w.crew ? ` · ${w.crew}` : ''}`;
    case 'role':
      return w.role;
    case 'label':
      return w.label;
    case 'guest':
      return 'A guest';
    case 'group':
      return 'A group';
  }
}
