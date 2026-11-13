import { onlyTimedBlocks } from '@/lib/schedule';
import Link from 'next/link';
import { Lock, Mic, EyeOff, Sparkles, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { buildScriptWorkbook, type ScriptBlock } from '@/lib/emcee-script-layer';
import { formatWallClock } from '@/lib/schedule-datetime-local';
import { matchLines, fillSlots, needsAttention, type SavedLine } from '@/lib/emcee-lines';
import {
  buildQuestionnaire,
  type QuestionAnswer,
  type VendorQuestion,
} from '@/lib/emcee-questions';
// ❓ The answers renderer is shared with every other trade's customer card (Details tab) since 2026-11-04.
import { TheyToldYou } from './couple-answers';
import { ScriptComposer } from './script-composer';
import { InfoTip } from '@/app/_components/info-tip';
import { formatCount } from '@/lib/format-number';

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

/** ⏱ The venue wall clock, as the couple typed it — the same digits their
 *  Schedule and their guests see. Re-zoning it into Asia/Manila added eight
 *  hours a second time (a 1:30 PM arrival read 9:30 PM in the script). */
function fmtTime(startIso: string): string {
  return formatWallClock(startIso) || '—';
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

  const [blocksRes, scriptsRes, linesRes, picksRes, questionsRes, answersRes] = await Promise.all([
    // ⏰ A Time-TBA chapter has no clock to script against — left out, never drawn at 12:00 AM (onlyTimedBlocks).
    onlyTimedBlocks(supabase.from('event_schedule_blocks').select(BLOCK_COLUMNS).eq('event_id', eventId)),
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
    // DAY-7 · his own questions, and what THIS couple answered. RLS admits the
    // answers only while he is booked AND only to questions he wrote.
    supabase
      .from('vendor_questions')
      .select('question_id, vendor_profile_id, prompt, hint, is_asked, display_order')
      .eq('vendor_profile_id', vendorProfileId)
      .is('form_id', null),
    supabase
      .from('event_question_answers')
      .select('event_id, question_id, answer, updated_at')
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
    // 📐 Design template rule 6: an empty part is one honest line, no card; the "why" sits behind the ⓘ (rule 7).
    return (
      <div className="flex min-h-14 items-center gap-2 border-b border-ink/10 py-3" data-script-empty="">
        <Mic className="h-4 w-4 shrink-0 text-[color:var(--m-slate-3)]" aria-hidden />
        <InfoTip
          label={`${coupleName} haven’t built their timeline yet.`}
          labelAs="p"
          labelClassName="text-[15px] text-ink"
          align="start"
        >
          The moment they add their program, every moment of the night appears here ready to script — nothing for
          you to set up.
        </InfoTip>
      </div>
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
    <section>
      {/* His craft is his. Mirrors the shipped CRM-notes lock copy — the label stays, the explaining sits behind the
          ⓘ (design template rule 7). */}
      <div className="flex min-h-11 items-center gap-2 text-[13px] text-ink/70" data-script-private="">
        <Lock className="h-4 w-4 shrink-0 text-gold" aria-hidden />
        <InfoTip label="Only your team sees these lines" align="start">
          Never {coupleName}, never their coordinator, never other suppliers. Their timeline and notes come from them —
          your script stays yours.
        </InfoTip>
      </div>

      <TheyToldYou
        coupleName={coupleName}
        unread={Boolean(questionsRes.error || answersRes.error)}
        questionnaire={buildQuestionnaire(
          (questionsRes.data ?? []) as VendorQuestion[],
          (answersRes.data ?? []) as QuestionAnswer[],
        )}
      />

      {prefilled > 0 ? (
        <div className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-ink" data-script-prefilled="">
          <Sparkles className="h-4 w-4 shrink-0 text-sage-deep" aria-hidden />
          <InfoTip
            label={`Drafted from your lines — ${formatCount(prefilled)} of ${workbook.entries.length}`}
            align="start"
          >
            These moments arrived already written, in your words with their names filled in. Edit anything that should
            be different for {coupleName}.
          </InfoTip>
          <Link href="/vendor-dashboard/lines" className="inline-flex min-h-11 items-center font-semibold text-sn-accent">
            My lines ›
          </Link>
        </div>
      ) : (
        <div className="flex min-h-11 flex-wrap items-center gap-x-2 text-[13px] text-ink/70" data-script-saved-to-lines="">
          <InfoTip label="Lines you write here are saved to My lines" align="start">
            Automatically — with {coupleName}&rsquo;s names swapped out — so your next wedding opens already written.
          </InfoTip>
          <Link href="/vendor-dashboard/lines" className="inline-flex min-h-11 items-center font-semibold text-sn-accent">
            My lines ›
          </Link>
        </div>
      )}

      {attention.length > 0 ? (
        <div className="pt-4" data-script-attention="">
          <InfoTip
            label={`Get these right · ${attention.length}`}
            labelAs="h3"
            labelClassName="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink/70"
            align="start"
          >
            {coupleName} asked for something specific on these moments. Everything else you can ad-lib.
          </InfoTip>
          <ul className="mt-1">
            {attention.map(({ item, entry }) => (
              <li key={entry.blockId} className="border-b border-ink/10 border-l-4 border-l-gold">
                <a
                  href={`#script-${entry.blockId}`}
                  className="sn-press flex min-h-14 items-center gap-3 py-2 pl-3"
                  title={
                    item.reason === 'ask_on_reused_line'
                      ? 'They asked for something your saved line cannot know about'
                      : item.reason === 'unfilled_slot'
                        ? `Still to fill: ${(item.slots ?? []).join(', ')}`
                        : 'They asked and nothing answers it yet'
                  }
                >
                  <span className="w-16 shrink-0 text-[13px] tabular-nums text-ink/70">{entry.time}</span>
                  <span className="min-w-0 flex-1 text-[15px] font-semibold text-ink">{entry.label}</span>
                  <span aria-hidden className="text-sn-accent">›</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ol className="pt-4">
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
                'scroll-mt-24 border-b border-ink/10 py-4',
                e.depth === 1 ? 'ml-5' : '',
                !isPrivate && e.note && !saved ? 'border-l-4 border-l-gold pl-3' : '',
              ].join(' ')}
            >
              {isPrivate ? (
                // Never a subtler shade — a worded banner. He is holding a mic.
                <p className="mb-2.5 flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-cream">
                  <EyeOff className="h-4 w-4 shrink-0" aria-hidden />
                  <strong className="text-[13px] font-semibold uppercase tracking-[0.08em]">
                    Don&rsquo;t read aloud
                  </strong>
                  <span className="ml-auto text-right text-[13px] leading-tight text-cream">
                    Private moment —<br />
                    context for you only
                  </span>
                </p>
              ) : null}

              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-[13px] tabular-nums text-ink/70">{e.time}</span>
                <span className={e.depth === 1 ? 'text-[15px] text-ink' : 'text-[15px] font-semibold text-ink'}>
                  {e.label}
                </span>
              </div>

              {e.note ? (
                <div className="mt-2 border-l-2 border-gold pl-3">
                  <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink/70">
                    {isPrivate ? 'They told you' : 'They asked'}
                  </p>
                  <p className="mt-0.5 text-[15px] text-ink">{e.note}</p>
                </div>
              ) : null}

              {e.cue && !isPrivate ? (
                <p className="mt-2 text-[13px] italic text-ink/70">{e.cue}</p>
              ) : null}

              {/* Rung 2 and 3 are guesses and must say so. */}
              {suggestion && !saved && match && !match.trusted ? (
                <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-warn-800">
                  <AlertCircle className="h-4 w-4" aria-hidden />
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
