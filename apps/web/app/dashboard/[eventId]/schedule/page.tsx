import { redirect } from 'next/navigation';
import { Plus, Trash2, Eye, EyeOff, MapPin, CalendarClock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  SCHEDULE_BLOCK_LABEL,
  SCHEDULE_BLOCK_TYPES,
  fetchScheduleBlocks,
  formatBlockTime,
  formatBlockTimeRange,
  type ScheduleBlockRow,
} from '@/lib/schedule';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  createScheduleBlock,
  deleteScheduleBlock,
  toggleBlockVisibility,
} from './actions';

export const metadata = { title: 'Schedule' };

type Props = { params: Promise<{ eventId: string }> };

export default async function CoupleSchedulePage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const blocks = await fetchScheduleBlocks(supabase, eventId);
  const publicCount = blocks.filter((b) => b.is_public).length;

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Schedule</h1>
        <p className="max-w-prose text-base text-ink/65">
          Build your wedding-day timeline. Public blocks show up on every guest&rsquo;s
          invitation site with a live &ldquo;happening now&rdquo; highlight as the day
          unfolds. Drafts stay private until you flip them visible.
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
          {blocks.length} block{blocks.length === 1 ? '' : 's'} · {publicCount} public
        </p>
      </header>

      <AddBlockForm eventId={eventId} />

      {blocks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center">
          <CalendarClock
            aria-hidden
            className="mx-auto mb-2 h-6 w-6 text-ink/30"
            strokeWidth={1.5}
          />
          <p className="text-sm font-medium text-ink">No blocks yet.</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-ink/60">
            Add your first one above — start with the ceremony, then layer cocktails,
            reception, dinner, dancing, and send-off.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {blocks.map((b) => (
            <li key={b.block_id}>
              <BlockCard eventId={eventId} block={b} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AddBlockForm({ eventId }: { eventId: string }) {
  return (
    <details className="rounded-xl border border-ink/10 bg-cream">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium">
        <Plus aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={2} />
        Add a block
      </summary>
      <form
        action={createScheduleBlock}
        className="grid gap-4 border-t border-ink/10 p-4 sm:grid-cols-2"
      >
        <input type="hidden" name="event_id" value={eventId} />
        <label className="space-y-1">
          <span className="block text-xs font-medium text-ink">Label</span>
          <input
            name="label"
            required
            maxLength={120}
            placeholder="e.g. Ceremony at San Agustin"
            className="input-field"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-ink">Type</span>
          <select name="block_type" defaultValue="custom" className="input-field">
            {SCHEDULE_BLOCK_TYPES.map((t) => (
              <option key={t} value={t}>
                {SCHEDULE_BLOCK_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-ink">Starts</span>
          <input
            name="start_at"
            type="datetime-local"
            required
            className="input-field"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-ink">Ends (optional)</span>
          <input name="end_at" type="datetime-local" className="input-field" />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="block text-xs font-medium text-ink">Location</span>
          <input
            name="location"
            maxLength={200}
            placeholder="e.g. San Agustin Church, Intramuros"
            className="input-field"
          />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="block text-xs font-medium text-ink">Notes</span>
          <textarea
            name="notes"
            rows={3}
            className="input-field min-h-[80px] py-2"
            placeholder="Dress code, parking notes, anything guests should know"
          />
        </label>
        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="is_public"
            defaultChecked
            className="mt-0.5 h-4 w-4 cursor-pointer accent-terracotta"
          />
          <span>
            <span className="block font-medium text-ink">Show to guests</span>
            <span className="block text-xs text-ink/55">
              When on, this block appears on every guest&rsquo;s invitation site.
            </span>
          </span>
        </label>
        <div className="sm:col-span-2">
          <SubmitButton className="button-primary" pendingLabel="Adding…">
            Add block
          </SubmitButton>
        </div>
      </form>
    </details>
  );
}

function BlockCard({ eventId, block }: { eventId: string; block: ScheduleBlockRow }) {
  return (
    <article className="space-y-3 rounded-xl border border-ink/10 bg-cream p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <h2 className="truncate text-base font-semibold text-ink">{block.label}</h2>
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
            {SCHEDULE_BLOCK_LABEL[block.block_type]} ·{' '}
            {formatBlockTime(block.start_at)}
            {block.end_at ? ` → ${formatBlockTimeRange(block.start_at, block.end_at)}` : ''}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
            block.is_public
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-ink/5 text-ink/55'
          }`}
        >
          {block.is_public ? 'Public' : 'Hidden'}
        </span>
      </header>

      {block.location ? (
        <p className="inline-flex items-center gap-1 text-sm text-ink/65">
          <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          {block.location}
        </p>
      ) : null}

      {block.notes ? (
        <p className="rounded-md bg-ink/[0.03] p-3 text-xs text-ink/75 whitespace-pre-wrap">
          {block.notes}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3">
        <form action={toggleBlockVisibility}>
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="block_id" value={block.block_id} />
          <input
            type="hidden"
            name="desired"
            value={block.is_public ? 'false' : 'true'}
          />
          <SubmitButton
            className="inline-flex items-center gap-1 rounded-md bg-ink/5 px-2 py-1 text-xs font-medium text-ink/70 hover:bg-ink/10 disabled:opacity-60"
            pendingLabel="…"
          >
            {block.is_public ? (
              <>
                <EyeOff className="h-3.5 w-3.5" strokeWidth={1.75} />
                Hide from guests
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
                Show to guests
              </>
            )}
          </SubmitButton>
        </form>
        <form action={deleteScheduleBlock}>
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="block_id" value={block.block_id} />
          <SubmitButton
            aria-label="Delete block"
            pendingLabel=""
            className="rounded-md p-1.5 text-ink/40 hover:bg-ink/5 hover:text-rose-700 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          </SubmitButton>
        </form>
      </div>
    </article>
  );
}
