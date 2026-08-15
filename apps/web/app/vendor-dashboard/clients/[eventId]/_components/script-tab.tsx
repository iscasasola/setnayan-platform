import Link from 'next/link';
import { Lock, Mic, EyeOff, Sparkles, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { buildScriptWorkbook, type ScriptBlock } from '@/lib/emcee-script-layer';
import { matchLines, fillSlots, needsAttention, type SavedLine } from '@/lib/emcee-lines';
import { ScriptComposer } from './script-composer';

/**
 * SCRIPT — the host/MC's prep surface on the Customer Card.
 *
 * Owner-locked 2026-08-01. Spec: `Emcee_Script_Layer_LOCKED_BUILD_SPEC_2026-08-01.md`.
 * Prototype: `Emcee_Script_Prototype_2026-08-01.html`.
 *
 * ── WHAT MAKES THIS A SERVICE RATHER THAN A FORM ───────────────────────────
 *
 * v1 of this design handed him ~18 blank boxes on every wedding. He does ~40 a
 * year saying nearly the same things with the names swapped, so the owner
 * rejected it. This surface opens ALREADY WRITTEN: his own saved lines are
 * matched onto the couple's timeline and the names are filled in. He edits the
 * few moments that are genuinely special.
 *
 * ── A RENDERER, NOTHING MORE ───────────────────────────────────────────────
 *
 * Every decision here is made by a tested pure module and only drawn by this
 * file: `buildScriptWorkbook` (the layer), `matchLines` (the three-rung ladder
 * + the never-reuse-a-private-line rule), `fillSlots` (names).
 *
 * ── THE READ ───────────────────────────────────────────────────────────────
 *
 * Three queries, all under the CALLER's client so RLS decides scope — the
 * booked-vendor timeline policy, his own event copies, his own library. No
 * admin client on this path, and no `guests` read: a booked vendor cannot read
 * the roster, which is exactly why sponsor names are ask-slots and not
 * auto-filled.
 *
 * ── THE ONE THING THIS UI MUST NOT GET WRONG ───────────────────────────────
 *
 * He sees PRIVATE blocks, because a host told nothing about a private moment is
 * worse off than one told to keep quiet. But a private block's note is CONTEXT,
 * never copy — he is holding a live microphone. So it renders with an explicit
 * "don't read aloud" banner, never a merely subtler shade, and its own text is
 * set in the UI face rather than the read-aloud serif.
 */

const BLOCK_COLUMNS =
  'block_id,label,block_type,start_at,end_at,notes,is_public,sort_order,parent_block_id';

function fmtTime(startIso: string): string {
  const d = new Date(startIso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  });
}

export async function ScriptTab({
  eventId,
  vendorProfileId,
  coupleName,
}: {
  eventId: string;
  vendorProfileId: string;
  coupleName: string;
}) {
  const supabase = await createClient();

  const [blocksRes, scriptsRes, linesRes, picksRes] = await Promise.all([
    supabase
      .from('event_schedule_blocks')
      .select(BLOCK_COLUMNS)
      .eq('event_id', eventId),
    supabase
      .from('vendor_block_scripts')
      .select('block_id, body')
      .eq('event_id', eventId)
      .eq('vendor_profile_id', vendorProfileId),
    supabase
      .from('vendor_lines')
      .select('line_id, activity_id, label_key, block_type, body, is_private_note')
      .eq('vendor_profile_id', vendorProfileId)
      .is('deleted_at', null),
    supabase
      .from('event_activity_picks')
      .select('scheduled_block_id, activity_id')
      .eq('event_id', eventId),
  ]);

  const blocks = (blocksRes.data ?? []) as ScriptBlock[];
  const scripts = (scriptsRes.data ?? []) as Array<{ block_id: string; body: string }>;
  const lines = (linesRes.data ?? []) as SavedLine[];

  // Rung 1 of the ladder: the shipped pick bridge. Absent for any moment the
  // couple typed by hand — which is when rung 2 (by name) earns its keep.
  const activityByBlock = new Map<string, string | null>();
  for (const p of (picksRes.data ?? []) as Array<{
    scheduled_block_id: string | null;
    activity_id: string | null;
  }>) {
    if (p.scheduled_block_id) activityByBlock.set(p.scheduled_block_id, p.activity_id);
  }

  const workbook = buildScriptWorkbook({
    blocks,
    scripts,
    options: { formatTime: (s) => fmtTime(s) },
  });

  const written = new Set(scripts.filter((s) => s.body.trim()).map((s) => s.block_id));
  const matches = new Map(
    matchLines({ blocks, lines, activityByBlock }).map((m) => [m.blockId, m]),
  );

  if (workbook.empty) {
    return (
      <section className="rounded-2xl border border-ink/10 bg-white p-8 text-center">
        <Mic className="mx-auto h-6 w-6 text-ink/25" aria-hidden />
        <p className="mt-3 text-sm font-medium text-ink">
          {coupleName} haven&rsquo;t built their timeline yet.
        </p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-ink/55">
          The moment they add their program, every moment of the night appears here ready to
          script — nothing for you to set up.
        </p>
      </section>
    );
  }

  // TRIAGE, not a completion counter (spec 3.3) — decided by the tested pure
  // module, drawn here. Blanks he would ad-lib stay silent; what surfaces is
  // only what must not be got wrong, including an ask sitting on top of a
  // reused line, which a written/blank binary misses entirely.
  const unfilledByBlock = new Map<string, readonly string[]>();
  for (const [blockId, m] of matches) {
    const { unfilled } = fillSlots(m.line.body, { 'the couple': coupleName });
    if (unfilled.length > 0) unfilledByBlock.set(blockId, unfilled);
  }
  const attentionItems = needsAttention({
    entries: workbook.entries,
    reusedBlockIds: new Set(matches.keys()),
    unfilledByBlock,
  });
  const byBlock = new Map(workbook.entries.map((e) => [e.blockId, e]));
  const attention = attentionItems
    .map((a) => ({ item: a, entry: byBlock.get(a.blockId) }))
    .filter((x): x is { item: typeof x.item; entry: NonNullable<typeof x.entry> } => !!x.entry);

  const prefilled = workbook.entries.filter(
    (e) => !written.has(e.blockId) && matches.has(e.blockId),
  ).length;

  return (
    <section className="space-y-4">
      {/* His craft is his. Mirrors the shipped CRM-notes lock copy. */}
      <p className="flex items-start gap-2 rounded-xl border border-ink/10 bg-gold/5 px-3 py-2 text-xs text-ink/65">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" aria-hidden />
        <span>
          <strong className="text-ink">Only your team sees these lines.</strong> Never {coupleName},
          never their coordinator, never other suppliers. Their timeline and notes come from them —
          your script stays yours.
        </span>
      </p>

      {prefilled > 0 ? (
        <p className="flex items-start gap-2 rounded-xl border border-sage/30 bg-sage/10 px-3 py-2 text-sm text-ink/75">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sage-deep" aria-hidden />
          <span>
            <strong className="text-ink">Drafted from your lines</strong> — {prefilled} of{' '}
            {workbook.entries.length} moments arrived already written, in your words with their
            names filled in. Edit anything that should be different for {coupleName}.{' '}
            <Link href="/vendor-dashboard/lines" className="underline">
              My lines
            </Link>
          </span>
        </p>
      ) : (
        <p className="text-xs text-ink/50">
          Lines you write here are saved to{' '}
          <Link href="/vendor-dashboard/lines" className="underline">
            My lines
          </Link>{' '}
          automatically — with {coupleName}&rsquo;s names swapped out — so your next wedding opens
          already written.
        </p>
      )}

      {attention.length > 0 ? (
        <div className="rounded-xl border border-gold/40 border-l-4 border-l-gold bg-white p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold-dark">
            Get these right — {attention.length}
          </p>
          <p className="mt-1 text-sm text-ink/75">
            {coupleName} asked for something specific on these moments. Everything else you can
            ad-lib.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {attention.map(({ item, entry }) => (
              <li key={entry.blockId}>
                <a
                  href={`#script-${entry.blockId}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold text-ink"
                  title={
                    item.reason === 'ask_on_reused_line'
                      ? 'They asked for something your saved line cannot know about'
                      : item.reason === 'unfilled_slot'
                        ? `Still to fill: ${(item.slots ?? []).join(', ')}`
                        : 'They asked and nothing answers it yet'
                  }
                >
                  <span className="font-mono text-[10px] text-gold-dark">{entry.time}</span>
                  {entry.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ol className="space-y-2.5">
        {workbook.entries.map((e) => {
          const match = matches.get(e.blockId);
          const saved = e.script;
          const suggestion = match
            ? fillSlots(match.line.body, { 'the couple': coupleName })
            : null;
          const isPrivate = !e.publicFacing;

          return (
            <li
              key={e.blockId}
              id={`script-${e.blockId}`}
              className={[
                'scroll-mt-24 rounded-xl border bg-white p-3',
                e.depth === 1 ? 'ml-5' : '',
                isPrivate ? 'border-ink/30 bg-ink/[0.03]' : 'border-ink/10',
                !isPrivate && e.note && !saved ? 'border-gold/40 border-l-4 border-l-gold' : '',
              ].join(' ')}
            >
              {isPrivate ? (
                // Never a subtler shade — a worded banner. He is holding a mic.
                <p className="-mx-3 -mt-3 mb-2.5 flex items-center gap-2 rounded-t-xl bg-ink px-3 py-2 text-cream">
                  <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <strong className="font-mono text-[10px] uppercase tracking-[0.2em]">
                    Don&rsquo;t read aloud
                  </strong>
                  <span className="ml-auto text-right text-[10px] leading-tight text-cream/65">
                    Private moment —<br />
                    context for you only
                  </span>
                </p>
              ) : null}

              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-[11px] text-ink/50">{e.time}</span>
                <span className={e.depth === 1 ? 'text-sm text-ink' : 'text-sm font-semibold text-ink'}>
                  {e.label}
                </span>
              </div>

              {e.note ? (
                <div className="mt-2 rounded-lg bg-gold/10 px-3 py-2">
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-gold-dark">
                    {isPrivate ? 'They told you' : 'They asked'}
                  </p>
                  <p className="mt-0.5 text-sm text-ink/80">{e.note}</p>
                </div>
              ) : null}

              {e.cue && !isPrivate ? (
                <p className="mt-2 text-xs italic text-ink/45">{e.cue}</p>
              ) : null}

              {/* Rung 2 and 3 are guesses and must say so. */}
              {suggestion && !saved && match && !match.trusted ? (
                <p className="mt-2 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink/45">
                  <AlertCircle className="h-3 w-3" aria-hidden />
                  {match.rung === 'by_name' ? 'Matched by name — glance it' : 'From your usual line'}
                </p>
              ) : null}

              <ScriptComposer
                eventId={eventId}
                blockId={e.blockId}
                coupleName={coupleName}
                label={e.label}
                initialBody={saved ?? suggestion?.text ?? ''}
                isDraft={!saved && !!suggestion}
                isPrivate={isPrivate}
                unfilled={suggestion?.unfilled ?? []}
              />
            </li>
          );
        })}
      </ol>
    </section>
  );
}
