import { redirect } from 'next/navigation';
import { Plus, Trash2, Eye, EyeOff, MapPin, CalendarClock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { seedNonWeddingRunOfShow } from './actions';
import {
  SCHEDULE_BLOCK_LABEL,
  SCHEDULE_BLOCK_TYPES,
  fetchScheduleBlocks,
  formatBlockTime,
  formatBlockTimeRange,
  type ScheduleBlockRow,
} from '@/lib/schedule';
import { fetchPreparationAgenda } from '@/lib/preparation';
import { buildJourneyTimeline } from '@/lib/journey';
import { resolveProfile } from '@/lib/event-type-profile';
import { term } from '@/lib/event-term-copy';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  createScheduleBlock,
  deleteScheduleBlock,
  toggleBlockVisibility,
  resolveScheduleSuggestion,
} from './actions';
// Inline edit affordance for time/range on existing blocks, per
// CLAUDE.md 2026-05-30 owner directive: "Customer Schedule can be
// edited on the time." Client component owns the view → edit form
// toggle + calls the existing updateScheduleBlock server action.
import { BlockTimeEditor } from './_components/block-time-editor';
// Preparation ⇄ Event Day toggle (chrome redesign delta #3, 2026-06-03).
// The toggle is a URL-driven segmented control; the agenda is a read-only
// aggregation of EXISTING dated data (payments / paperwork / meetings /
// statutory milestones) — see lib/preparation.ts for the source map.
import { ScheduleModeToggle } from './_components/schedule-mode-toggle';
import { EmceeScriptButton } from './_components/emcee-script-button';
import { PreparationAgendaView } from './_components/preparation-agenda';
// Journey mode — the full event-lifecycle arc (creation → the day →
// editorial), a phase-grouped read-only view over the same agenda data plus
// three lifecycle bookends. See lib/journey.ts.
import { JourneyView } from './_components/journey-view';
import { RunOfShowHeader } from '@/app/_components/run-of-show-header';
import type { RunOfShowBlock } from '@/lib/run-of-show';

export const metadata = { title: 'Schedule' };

type ScheduleView = 'journey' | 'preparation' | 'event-day';

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ view?: string }>;
};

export default async function CoupleSchedulePage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const { view: viewParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Pull the event row (for event_date + ceremony_type that drive the
  // Preparation agenda's statutory-milestone + paperwork-deadline math),
  // the day-of blocks, and the aggregated Preparation agenda in parallel.
  // Defensive maybeSingle — a missing event row falls through to nulls,
  // which the agenda treats as "no wedding date yet".
  const [eventRes, blocks, suggestionsRes, recapRes] = await Promise.all([
    supabase
      .from('events')
      .select('event_id, event_date, ceremony_type, event_type, created_at')
      .eq('event_id', eventId)
      .maybeSingle(),
    fetchScheduleBlocks(supabase, eventId),
    // Vendor suggestions queue (feature-access program Phase 3): open
    // proposals from booked vendors, resolved here by the couple or a
    // delegate with schedule edit (RLS-gated).
    supabase
      .from('event_schedule_suggestions')
      .select(
        'suggestion_id, block_id, kind, suggested_by_name, proposed_label, proposed_start_at, proposed_end_at, proposed_location, note, created_at',
      )
      .eq('event_id', eventId)
      .eq('status', 'open')
      .order('created_at', { ascending: true }),
    // Recap publish row — the Journey mode's editorial bookend. RLS lets the
    // couple/coordinator read their own row; a missing table (pre-migration)
    // or absent row both fall through to null (no editorial anchor yet).
    supabase
      .from('event_recaps')
      .select('status, published_at')
      .eq('event_id', eventId)
      .maybeSingle(),
  ]);
  const openSuggestions = (suggestionsRes.data ?? []) as VendorSuggestion[];
  const eventRow = eventRes.data as
    | {
        event_id: string;
        event_date: string | null;
        ceremony_type: string | null;
        event_type: string | null;
        created_at: string | null;
      }
    | null;
  const eventDate = eventRow?.event_date ?? null;
  const ceremonyType = eventRow?.ceremony_type ?? null;

  // Run-of-Show first-open seed (owner 2026-07-12: Run-of-Show is FREE). A
  // NON-WEDDING event that opens its schedule with zero blocks gets a per-type
  // Filipino program authored from its captured onboarding signals; weddings keep
  // their own (separate) spine and are untouched. Only pays the seed cost on the
  // first open — once any block exists this branch is skipped, so steady-state
  // schedule loads are unchanged.
  let scheduleBlocks = blocks;
  if (
    scheduleBlocks.length === 0 &&
    (eventRow?.event_type ?? 'wedding') !== 'wedding'
  ) {
    const seeded = await seedNonWeddingRunOfShow(eventId);
    if (seeded > 0) scheduleBlocks = await fetchScheduleBlocks(supabase, eventId);
  }
  // Iteration 0053 P4 Unit 1: only marriage-profile events get PH statutory
  // milestones in the agenda. Wedding → 'ph_marriage' → statutory true (byte-
  // identical); non-wedding → null → no PSA/CENOMAR/marriage-license rows.
  const profile = await resolveProfile(eventRow?.event_type ?? 'wedding');
  const statutory = profile.statutoryPackKey === 'ph_marriage';

  const now = new Date();
  const agenda = await fetchPreparationAgenda({
    supabase,
    eventId,
    eventDate,
    ceremonyType,
    now,
    statutory,
  });

  // Journey mode — the full event-lifecycle arc. Reuses the agenda for the
  // middle and adds three lifecycle bookends: creation (events.created_at),
  // the day (events.event_date), and the editorial (event_recaps.published_at).
  // The editorial anchor only counts when the recap is actually PUBLISHED —
  // a draft/unpublished row leaves the arc's end as a forward placeholder.
  const recapRow = recapRes.data as { status: string; published_at: string | null } | null;
  const recapPublishedAt =
    recapRow?.status === 'published' ? (recapRow.published_at ?? null) : null;
  const journey = buildJourneyTimeline({
    eventId,
    agenda,
    createdAt: eventRow?.created_at ?? null,
    eventDate,
    recapPublishedAt,
    now,
    copy: {
      dayLabel: term(profile, { wedding: 'your wedding day', generic: 'your event day' }),
      eventNoun: term(profile, { wedding: 'wedding', generic: 'event' }),
    },
  });

  // Resolve the active view. Explicit `?view=` wins (bookmarkable). With no
  // param, default to Preparation when there's something to prepare; else
  // open straight on the day-of timeline so empty-prep couples aren't met
  // with a blank agenda. (Journey is opt-in via its segment — it never
  // becomes the silent default, to keep the existing landing behavior.)
  const active: ScheduleView =
    viewParam === 'journey' || viewParam === 'preparation' || viewParam === 'event-day'
      ? viewParam
      : agenda.items.length > 0
        ? 'preparation'
        : 'event-day';

  // Run-of-show header rows (now/next/±N) off the shared run-state. Top-level
  // blocks only — the header tracks the headline timeline, not sub-parts.
  const runOfShowBlocks: RunOfShowBlock[] = scheduleBlocks
    .filter((b) => b.parent_block_id === null)
    .map((b) => ({
      block_id: b.block_id,
      label: b.label,
      start_at: b.start_at,
      end_at: b.end_at,
      location: b.location,
      run_state: b.run_state,
      actual_start_at: b.actual_start_at,
    }));

  return (
    <section className="space-y-6">
      <header className="sn-reveal space-y-3">
        <div>
          <p className="sn-eye">Timeline</p>
          <h1 className="sn-h1 mt-1.5">Schedule</h1>
        </div>
        <p className="max-w-prose text-base text-ink/65">
          {active === 'journey'
            ? term(profile, {
                wedding:
                  'The whole arc of your wedding — from the day you started planning, through every dated step, to the big day and the editorial you publish afterward. Your story, on one continuous timeline.',
                generic:
                  'The whole arc of your event — from the day you started planning, through every dated step, to the day itself and the editorial you publish afterward. Your story, on one continuous timeline.',
              })
            : active === 'preparation'
              ? term(profile, {
                  wedding:
                    'Your run-up to the wedding — every dated step, gathered from your payments, paperwork, and vendor meetings, sorted by month. Read-only here; tap any item to manage it on its own page.',
                  generic:
                    'Your run-up to the event — every dated step, gathered from your payments, paperwork, and vendor meetings, sorted by month. Read-only here; tap any item to manage it on its own page.',
                })
              : term(profile, {
                  wedding:
                    'Build your wedding-day timeline. Public blocks show up on every guest’s invitation site with a live “happening now” highlight as the day unfolds. Drafts stay private until you flip them visible.',
                  generic:
                    'Build your event-day timeline. Public blocks show up on every guest’s invitation site with a live “happening now” highlight as the day unfolds. Drafts stay private until you flip them visible.',
                })}
        </p>
        <ScheduleModeToggle
          active={active}
          prepCount={agenda.items.length}
          journeyCount={journey.totalEntries}
        />
      </header>

      {active === 'journey' ? (
        <JourneyView
          timeline={journey}
          hasEventDate={eventDate !== null}
          eventId={eventId}
        />
      ) : active === 'preparation' ? (
        <PreparationAgendaView
          eventId={eventId}
          agenda={agenda}
          hasEventDate={eventDate !== null}
        />
      ) : (
        <>
          {/* Run-of-show header — live now/next/±N driven by the shared
              run-state. The couple/host (and a delegate coordinator) advance it
              via the single-winner advance_schedule_block RPC. */}
          {runOfShowBlocks.length > 0 ? (
            <RunOfShowHeader eventId={eventId} initial={runOfShowBlocks} canAdvance />
          ) : null}
          <VendorSuggestionsQueue
            eventId={eventId}
            suggestions={openSuggestions}
            blocks={scheduleBlocks}
          />
          {/* Emcee script — compiles this timeline + the wedding-party names
           *  into a clean host script (copy / download). Read-only over the
           *  saved program; pure compiler in lib/emcee-script. */}
          {scheduleBlocks.length > 0 ? (
            <div className="sn-row flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <p className="text-sm text-ink/65">
                Turn this timeline into a ready-to-read emcee / host script.
              </p>
              <EmceeScriptButton eventId={eventId} />
            </div>
          ) : null}
          <EventDayView eventId={eventId} blocks={scheduleBlocks} />
        </>
      )}
    </section>
  );
}

type VendorSuggestion = {
  suggestion_id: string;
  block_id: string | null;
  kind: 'adjust' | 'new';
  suggested_by_name: string | null;
  proposed_label: string | null;
  proposed_start_at: string | null;
  proposed_end_at: string | null;
  proposed_location: string | null;
  note: string;
  created_at: string;
};

function fmtSuggestionTime(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Open vendor proposals on the day-of timeline (feature-access program
 * Phase 3 § 4). Vendors can't write the timeline — they propose; you (or a
 * delegate with schedule edit) accept or decline. Accepting an 'adjust'
 * applies the proposed fields to the block; accepting a 'new' creates the
 * block as a draft (is_public stays your call).
 */
function VendorSuggestionsQueue({
  eventId,
  suggestions,
  blocks,
}: {
  eventId: string;
  suggestions: VendorSuggestion[];
  blocks: { block_id: string; label: string }[];
}) {
  if (suggestions.length === 0) return null;
  const blockLabel = new Map(blocks.map((b) => [b.block_id, b.label]));
  return (
    <section className="space-y-3 rounded-2xl border border-terracotta/25 bg-terracotta/[0.04] p-5">
      <header className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
          Vendor requests · {suggestions.length}
        </p>
        <p className="max-w-prose text-sm text-ink/65">
          Your booked vendors asked for timeline changes. Accepting applies the
          change; vendors never edit your timeline directly.
        </p>
      </header>
      <ul className="divide-y divide-ink/10">
        {suggestions.map((s) => {
          const proposedWindow = [
            fmtSuggestionTime(s.proposed_start_at),
            fmtSuggestionTime(s.proposed_end_at),
          ]
            .filter(Boolean)
            .join(' – ');
          return (
            <li key={s.suggestion_id} className="space-y-1.5 py-3">
              <p className="text-sm">
                <span className="font-medium">{s.suggested_by_name ?? 'A booked vendor'}</span>{' '}
                {s.kind === 'adjust' ? (
                  <>
                    asks to change{' '}
                    <span className="font-medium">
                      {blockLabel.get(s.block_id ?? '') ?? 'a timeline block'}
                    </span>
                  </>
                ) : (
                  <>
                    suggests adding{' '}
                    <span className="font-medium">{s.proposed_label ?? 'a new entry'}</span>
                  </>
                )}
              </p>
              <p className="text-sm text-ink/70">&ldquo;{s.note}&rdquo;</p>
              {proposedWindow ? (
                <p className="text-xs text-ink/55">Proposed time: {proposedWindow}</p>
              ) : null}
              {s.proposed_location ? (
                <p className="text-xs text-ink/55">Location: {s.proposed_location}</p>
              ) : null}
              <div className="flex items-center gap-2 pt-0.5">
                <form action={resolveScheduleSuggestion}>
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="suggestion_id" value={s.suggestion_id} />
                  <input type="hidden" name="decision" value="accept" />
                  <SubmitButton pendingLabel="Accepting…" className="rounded-md bg-ink px-3 py-1 text-xs font-semibold text-cream hover:bg-ink/85">Accept</SubmitButton>
                </form>
                <form action={resolveScheduleSuggestion}>
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="suggestion_id" value={s.suggestion_id} />
                  <input type="hidden" name="decision" value="decline" />
                  <SubmitButton pendingLabel="Declining…" className="rounded-md border border-ink/20 px-3 py-1 text-xs font-medium text-ink/70 hover:bg-ink/5">Decline</SubmitButton>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Event Day mode — the existing editable day-of timeline. Behavior is
 * unchanged from before the Preparation toggle landed: the add-block form,
 * the per-block cards with inline time editing + visibility toggle +
 * delete, and the empty state all render exactly as they did.
 */
function EventDayView({
  eventId,
  blocks,
}: {
  eventId: string;
  blocks: ScheduleBlockRow[];
}) {
  const publicCount = blocks.filter((b) => b.is_public).length;
  // "Next up" (Glass PR-3 §3.1) — the imminent block: the first one that hasn't
  // started yet, else the first block. Real data; drives both the glass strip
  // and the gold accent on its row in the timeline below.
  const now = Date.now();
  const nextBlock =
    blocks.find((b) => new Date(b.start_at).getTime() >= now) ?? blocks[0] ?? null;
  return (
    <div className="space-y-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
        {blocks.length} block{blocks.length === 1 ? '' : 's'} · {publicCount} public
      </p>

      {/* Next-up glass strip — the imminent block, mono time. */}
      {nextBlock ? (
        <div className="sn-tile sn-reveal flex flex-wrap items-center gap-3">
          <span
            aria-hidden
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full"
            style={{ background: 'var(--sn-gold-100)', color: 'var(--sn-gold-700)' }}
          >
            <CalendarClock className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="sn-eye">Next up</p>
            <p className="mt-0.5 truncate text-base font-bold text-ink">
              {nextBlock.label}
            </p>
            <p className="mt-0.5 truncate font-mono text-xs text-ink/60">
              {nextBlock.end_at
                ? formatBlockTimeRange(nextBlock.start_at, nextBlock.end_at)
                : formatBlockTime(nextBlock.start_at)}
              {nextBlock.location ? ` · ${nextBlock.location}` : ''}
            </p>
          </div>
        </div>
      ) : null}

      <AddBlockForm eventId={eventId} />

      {blocks.length === 0 ? (
        <div className="sn-row border-dashed p-8 text-center">
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
              <BlockCard
                eventId={eventId}
                block={b}
                imminent={nextBlock?.block_id === b.block_id}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddBlockForm({ eventId }: { eventId: string }) {
  return (
    <details className="sn-row">
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

function BlockCard({
  eventId,
  block,
  imminent = false,
}: {
  eventId: string;
  block: ScheduleBlockRow;
  imminent?: boolean;
}) {
  // Pre-format the time/range string the same way the prior static
  // surface did, then hand off to the BlockTimeEditor client component
  // which owns the view→edit toggle. Keeps the SCHEDULE_BLOCK_LABEL +
  // formatting helpers on the server side; the client only handles
  // interaction.
  const viewLabel = block.end_at
    ? formatBlockTimeRange(block.start_at, block.end_at)
    : formatBlockTime(block.start_at);
  return (
    <article
      className="sn-row space-y-3 p-4"
      style={
        imminent
          ? { borderLeft: '3px solid var(--sn-gold-500)' }
          : undefined
      }
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h2 className="truncate text-base font-semibold text-ink">{block.label}</h2>
          <BlockTimeEditor
            eventId={eventId}
            blockId={block.block_id}
            blockTypeLabel={SCHEDULE_BLOCK_LABEL[block.block_type]}
            startAt={block.start_at}
            endAt={block.end_at}
            viewLabel={viewLabel}
          />
        </div>
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
            block.is_public
              ? 'bg-success-100 text-success-800'
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
            className="rounded-md p-1.5 text-ink/40 hover:bg-ink/5 hover:text-danger-700 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          </SubmitButton>
        </form>
      </div>
    </article>
  );
}
