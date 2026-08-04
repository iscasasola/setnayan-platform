import type { ReactNode } from 'react';
import { EyeOff, Megaphone, Mic, Radio, ScrollText } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  buildStageScript,
  nextTimingLabel,
  type StageAnnouncement,
  type StageScriptBlock,
  type StageScriptEntry,
  type StageScriptModel,
} from '@/lib/stage-script';
import type { SpecializationSurfaceProps } from '../specialization-registry';

/**
 * SCRIPT & CUES — the host / MC specialization surface (`stage_script`).
 *
 * Registered in `specialization-registry.tsx`; mounted by the frame only for an
 * entitled, booked, authenticated host on the day of their event. This file is a
 * RENDERER — every decision it draws (what is on now, what is coming, which note
 * must never be read aloud, which card sits on top) is made by the pure
 * `buildStageScript` in `lib/stage-script.ts` and unit-tested there.
 *
 * ── THE READ, AND WHY IT IS THE ONLY ONE ───────────────────────────────────
 *
 * One query: this event's `event_schedule_blocks`, under the CALLER's client so
 * `event_schedule_blocks_booked_vendor_read` decides scope (full timeline, minus
 * the coordinator's unreleased prep). No admin client anywhere on this path.
 *
 * The two things a host might expect and will NOT find here, both deliberate:
 *
 *   • The wedding-party ROSTER that the couple's downloadable emcee script
 *     prints. `guests` is readable only by event members; a booked vendor is not
 *     one, and forcing it with the admin client would be precisely the guest-PI
 *     exposure the standing DPO/NPC item governs. Absent beats elevated.
 *   • Coordinator BROADCASTS. `coordinator_broadcasts` is member/moderator/admin
 *     only, so a host would have seen a permanently empty card — a fake door.
 *
 * Announcements are therefore the couple's own `notes` on their blocks, which is
 * both the readable source and the right one: a note on a block is the couple
 * telling the host what to say at that moment.
 *
 * ── THE ONE THING THIS UI MUST NEVER GET WRONG ─────────────────────────────
 *
 * A booked vendor sees PRIVATE blocks too. The host is holding a live
 * microphone, so every private line is rendered with an explicit "don't read
 * aloud" marker rather than being styled merely a little differently — and it is
 * never dropped, because a host who is told nothing about a private moment is
 * worse off than one who is told and told to keep quiet. The `publicFacing`
 * flag driving that marker is pinned exhaustively in `lib/stage-script.test.ts`.
 */

/** Exactly the columns `buildStageScript` consumes — a subset of the row a
 *  booked vendor may select. */
const BLOCK_COLUMNS =
  'block_id,label,block_type,start_at,end_at,location,notes,is_public,sort_order,parent_block_id,run_state,actual_start_at';

export async function StageScript({
  eventId,
  vendorProfileId,
  coupleName,
}: SpecializationSurfaceProps) {
  const supabase = await createClient();
  const [blocksRes, scriptsRes] = await Promise.all([
    supabase
      .from('event_schedule_blocks')
      .select(BLOCK_COLUMNS)
      .eq('event_id', eventId)
      .order('start_at', { ascending: true })
      .order('sort_order', { ascending: true }),
    // HIS OWN LINES for this wedding (owner-locked 2026-08-01). Scoped to his
    // profile, under the caller's client — `vendor_block_scripts` is
    // vendor-private and its RLS is the only thing deciding this read.
    //
    // Best-effort: a failure here must NEVER cost him the desk. The couple's
    // program is the load-bearing half; his own lines are an addition to it, so
    // the desk degrades to exactly what it rendered before this feature existed.
    supabase
      .from('vendor_block_scripts')
      .select('block_id, body')
      .eq('event_id', eventId)
      .eq('vendor_profile_id', vendorProfileId),
  ]);
  const { data, error } = blocksRes;

  // A read failure and an empty library are the same value here, deliberately:
  // both mean "no lines to show", and neither is a reason to withhold the
  // program he is standing on stage to run.
  const myLines = new Map<string, string>();
  for (const r of (scriptsRes.data ?? []) as Array<{ block_id: string; body: string }>) {
    if (r.body?.trim()) myLines.set(r.block_id, r.body.trim());
  }

  if (error) {
    return (
      <p className="text-sm leading-relaxed text-ink/70">
        We couldn&rsquo;t load the program just now. Your other tools on this screen are
        unaffected — reopen this screen to try again.
      </p>
    );
  }

  // Normalise at the boundary rather than trusting the cast, matching the
  // defensiveness of the shipped `fetchRunOfShowBlocks`:
  //   • `run_state` — coerced to 'upcoming' when absent, so a row predating the
  //     run-of-show migration cannot land the desk in a phase that is neither
  //     "not started" nor "running".
  //   • `is_public` — required to be strictly TRUE. Anything else (null, absent,
  //     a future tri-state) reads as PRIVATE, so the failure direction of an
  //     unexpected value is "don't read this aloud", never the reverse.
  const blocks: StageScriptBlock[] = (
    (data ?? []) as unknown as Record<string, unknown>[]
  ).map((r) => ({
    ...(r as unknown as StageScriptBlock),
    run_state: (r.run_state as StageScriptBlock['run_state'] | null) ?? 'upcoming',
    is_public: r.is_public === true,
  }));
  const model = buildStageScript({ blocks });

  if (model.phase === 'empty') {
    return (
      <p className="text-sm leading-relaxed text-ink/70">
        {coupleName} hasn&rsquo;t built their timeline yet. The moment they add their
        program, your running script and cue card appear here — nothing for you to set up.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {model.order.map((card) =>
        card === 'cue' ? (
          <CueCard key={card} model={model} myLines={myLines} />
        ) : card === 'announcements' ? (
          <AnnouncementsCard key={card} items={model.announcements} />
        ) : (
          <ScriptCard key={card} entries={model.script} myLines={myLines} />
        ),
      )}
    </div>
  );
}

/** The inner card shell. Deliberately NOT a `ConsolePlate` — the slot already
 *  wraps this surface in one, and a plate inside a plate double-draws the
 *  inset hairline frame. */
function Card({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Radio;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border border-ink/10 bg-paper p-4">
      <h4 className="flex items-center gap-2 font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/70">
        <Icon aria-hidden className="h-3.5 w-3.5 shrink-0 text-gild" strokeWidth={1.75} />
        {title}
      </h4>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * "Don't read aloud" — the private-block marker. A worded badge, not a colour:
 * the whole point is that it survives a glance on a dim venue floor.
 */
function PrivateBadge() {
  return (
    <span className="inline-flex items-center gap-1 border border-ink/20 bg-ink/[0.04] px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-ink/70">
      <EyeOff aria-hidden className="h-3 w-3" strokeWidth={2} />
      Don&rsquo;t read aloud
    </span>
  );
}

/**
 * HIS LINE — the words he wrote for this moment (owner-locked 2026-08-01).
 *
 * ── TYPOGRAPHY IS THE SAFETY CONTROL ───────────────────────────────────────
 *
 * On a PUBLIC moment the line is set in the reading serif at the largest size
 * on the card: it is the one thing read at arm's length under stage lighting,
 * and the eye learns that serif means SAY THIS.
 *
 * On a PRIVATE moment the read-aloud typography is deliberately WITHHELD — ink
 * plate, UI face, a "not for the mic" chip — so a half-second glance in a dark
 * hall can never mistake staging notes for copy. This works WITH the shipped
 * `PrivateBadge` above it, not instead of it.
 *
 * The colour carries none of that meaning: strip every hue and the say /
 * don't-say boundary is still legible from the words and the shapes alone.
 */
function MyLine({ body, publicFacing }: { body: string; publicFacing: boolean }) {
  if (!publicFacing) {
    return (
      <div className="mt-2 border-l-2 border-ink bg-ink/[0.05] px-3 py-2">
        <p className="flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-ink/70">
          <span className="bg-ink px-1.5 py-0.5 font-bold text-paper">Not for the mic</span>
          Your note
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink/80">{body}</p>
      </div>
    );
  }
  return (
    <div className="mt-2 border-l-2 border-gild bg-gild/10 px-3 py-2">
      <p className="flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gild">
        <Mic aria-hidden className="h-3 w-3" strokeWidth={2} />
        Your line
      </p>
      <p className="mt-1 font-pahina text-[1.05rem] leading-relaxed text-ink">{body}</p>
    </div>
  );
}

/** The glance card: what you say now, what is next, how far off the plan you are. */
function CueCard({
  model,
  myLines,
}: {
  model: StageScriptModel;
  myLines: ReadonlyMap<string, string>;
}) {
  const { cue } = model;
  const nowLine = cue.now ? myLines.get(cue.now.blockId) : undefined;
  const nextLine = cue.next ? myLines.get(cue.next.blockId) : undefined;
  const timing = cue.next ? nextTimingLabel(cue.next.minutesAway) : null;
  return (
    <Card icon={Radio} title="On now">
      <p className="font-pahina text-2xl font-light leading-snug tracking-tight text-ink">
        {cue.headline}
      </p>

      {cue.drift ? (
        <p className="mt-1 font-mono text-xs uppercase tracking-[0.16em] text-ink/60">
          Running {cue.drift}
        </p>
      ) : null}

      {cue.now ? (
        <div className="mt-3 space-y-1.5 border-l-2 border-gild/60 pl-3">
          <p className="font-mono text-xs text-ink/60">{cue.now.time}</p>
          {cue.now.cue ? <p className="text-sm leading-relaxed text-ink">{cue.now.cue}</p> : null}
          {cue.now.note ? (
            <div className="space-y-1">
              {!cue.now.publicFacing ? <PrivateBadge /> : null}
              <p className="text-sm leading-relaxed text-ink/80">{cue.now.note}</p>
            </div>
          ) : null}
          {/* His words sit closest to the moment — it is what he needs fastest. */}
          {nowLine ? <MyLine body={nowLine} publicFacing={cue.now.publicFacing} /> : null}
        </div>
      ) : null}

      {cue.next ? (
        <div className="mt-3 border-t border-ink/10 pt-3">
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/55">
            Next
            {timing ? ` · ${timing}` : ''}
          </p>
          <p className="mt-1 text-sm font-medium text-ink">
            {cue.next.label}{' '}
            <span className="font-mono text-xs font-normal text-ink/60">{cue.next.time}</span>
          </p>
          {cue.next.note ? (
            <div className="mt-1 space-y-1">
              {!cue.next.publicFacing ? <PrivateBadge /> : null}
              <p className="text-sm leading-relaxed text-ink/80">{cue.next.note}</p>
            </div>
          ) : null}
          {/* Shown under NEXT too, so he can pre-read while the current moment runs. */}
          {nextLine ? <MyLine body={nextLine} publicFacing={cue.next.publicFacing} /> : null}
        </div>
      ) : null}
    </Card>
  );
}

/** The full running script, top to bottom, with each block's state. */
function ScriptCard({
  entries,
  myLines,
}: {
  entries: StageScriptEntry[];
  myLines: ReadonlyMap<string, string>;
}) {
  return (
    <Card icon={ScrollText} title="Running script">
      <ol className="space-y-3">
        {entries.map((e) => (
          <li
            key={e.blockId}
            className={`${e.depth === 1 ? 'ml-4 border-l border-ink/10 pl-3' : ''} ${
              e.state === 'done' ? 'opacity-55' : ''
            }`}
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-mono text-xs text-ink/60">{e.time}</span>
              <span
                className={`text-sm text-ink ${e.depth === 0 ? 'font-semibold' : 'font-medium'}`}
              >
                {e.label}
              </span>
              {e.state === 'live' ? (
                <span className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-terracotta-700">
                  On now
                </span>
              ) : null}
              {!e.publicFacing ? <PrivateBadge /> : null}
            </div>
            {e.cue ? <p className="mt-0.5 text-sm leading-relaxed text-ink/75">{e.cue}</p> : null}
            {e.note ? (
              <p className="mt-0.5 text-sm leading-relaxed text-ink/80">{e.note}</p>
            ) : null}
            {e.location ? (
              <p className="mt-0.5 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-ink/50">
                {e.location}
              </p>
            ) : null}
            {/* A block with no line of his shows nothing extra — the desk never
                nags mid-show. Counting what is unwritten belongs to prep. */}
            {myLines.has(e.blockId) ? (
              <MyLine body={myLines.get(e.blockId)!} publicFacing={e.publicFacing} />
            ) : null}
          </li>
        ))}
      </ol>
    </Card>
  );
}

/** The couple's own words, lifted out of the program so they cannot be missed. */
function AnnouncementsCard({ items }: { items: StageAnnouncement[] }) {
  return (
    <Card icon={Megaphone} title="Announcements">
      {items.length === 0 ? (
        <p className="text-sm leading-relaxed text-ink/70">
          No notes on the program yet. Anything the couple writes against a block shows up
          here, so you can say it in their words.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.blockId} className={a.state === 'done' ? 'opacity-55' : ''}>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-mono text-xs text-ink/60">{a.time}</span>
                <span className="text-sm font-medium text-ink">{a.blockLabel}</span>
                {!a.publicFacing ? <PrivateBadge /> : null}
              </div>
              <p className="mt-0.5 text-sm leading-relaxed text-ink/80">{a.note}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
