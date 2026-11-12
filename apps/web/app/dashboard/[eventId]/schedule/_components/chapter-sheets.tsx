'use client';

import { useId, useMemo, useState } from 'react';
import { CalendarPlus, Check, MessageSquare, Trash2, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { ChosenRow, FactRow, FormRows, SwitchRow, TypedRow } from '@/app/_components/form-row';
import { DateRow } from '@/app/_components/form-row-date';
import { TimeRow } from '@/app/_components/form-row-time';
import { chapterMove } from '@/lib/chapter-move';
import { doneWarnings, timesThatStay, type DoneWarning } from '@/lib/schedule-hand-in-hand';
import type { KeepAnswer } from '@/lib/form-row';
import {
  CALL_LEAD_CHOICES,
  PHOTO_WHEN,
  PHOTO_WHEN_WORDS,
  PHOTO_WHO,
  PHOTO_WHO_WORDS,
  TIME_TBA,
  VENUE_TBA,
  callLeadWords,
  clockWords,
  capChapterDay,
  chapterWindowFlags,
  egressAt,
  egressMinutesFrom,
  endIsoFrom,
  ingressAt,
  ingressMinutesFrom,
  isCallLead,
  isPhotoWhen,
  isPhotoWho,
  shiftWall,
  wallDay,
  wallIso,
  wallLocal,
  wallTime,
  heldHoursLine,
  type Chapter,
} from '@/lib/schedule-chapters';
import { createScheduleBlock, deleteScheduleBlock, updateScheduleBlock } from '../actions';
import { chapterCountLine, joinChapterNames, type ChapterCount } from '@/lib/invitation-chapters';

/**
 * 📖 THE SCHEDULE'S CHAPTER SHEETS — make, change and delete a chapter (owner 2026-11-01, DECISION_LOG "CHAPTERS LIVE ON
 * THE SCHEDULE PAGE, NOT EVENT SETTINGS": *"Why is the chapters there? Shouldn't it be in schedules?"*; corpus
 * SCHEDULE_CHAPTERS_BUILD_PLAN §2, §3, §12 Step 3; approved prototype `prototypes/schedule_chapters_2026-11-01/` — its
 * `chSheet`). Moved here WHOLE from Home › Event Settings (Step 2, #7143), so there is ONE place per thing: the
 * Schedule page. Event Settings holds no chapters row and no link here (house rule: no go-edit-elsewhere links).
 *
 * A chapter is a top-level schedule block (migration 20271300072429), so every save is the Schedule's OWN door —
 * `createScheduleBlock` · `updateScheduleBlock` · `deleteScheduleBlock` — with the same refusals, the same RLS (the
 * couple, and a helper holding Edit on the Schedule), and no new server action (the route budget).
 *
 *   · A NEW CHAPTER ASKS ONLY NAME AND TIME (plan §2, "the clean slate"): What · Date · Starts, then Create. A blank
 *     Starts is TIME TBA (owner 2026-11-01, ruled yes; migration 20271300482585): the chapter keeps its day, shows
 *     "Time TBA" and has no call time.
 *   · CHAPTER DETAILS: every field saves as it is kept (the Form Row rule) and the sheet stays where it is — a save never
 *     resets the screen. What · Date · Starts (✕ = Time TBA) · Ends · Where (or Venue TBA) · Exact spot · Ingress from ·
 *     Egress until (blank = none; both may cross midnight) · Call time · Who sees the photos · When · On the invitation
 *     · Notes.
 *   · DELETE CHAPTER at its foot: it warns (cannot be undone · its moments · photos stay safe under Unsorted), then
 *     Continue, then a deleting state — the owner's standing delete pattern. Nothing is removed before Continue.
 *   · Moving the date or the start moves its moments with it (`with_moments`, one statement in the database).
 *   · Dates stop at the event day: the calendar ends there, and a later day is set back to it, with a note.
 *
 * 🔒 NO GUEST-VISIBLE CHANGE: a chapter made here starts hidden from guests, and nothing here turns that on. "On the
 * invitation" is stored for the RSVP step and read by no guest page yet. A TBA chapter cannot be shown to guests at all.
 *
 * 🧪 `LAB_DOORS` — `/dev/schedule-chapters-lab` runs the same sheets on fake chapters with doors that only answer
 * "saved"; nothing is written anywhere.
 */

export type ChapterDoors = {
  create: (blockId: string, label: string, startLocal: string, tba: boolean) => Promise<boolean>;
  save: (blockId: string, fields: Record<string, string>) => Promise<boolean>;
  remove: (blockId: string) => Promise<boolean>;
};

function form(eventId: string, fields: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set('event_id', eventId);
  // 🔄 NOT the Maker's quiet write: these sheets live only on the Schedule page (the Maker draws no chapters), so every
  // save revalidates — Home, Planning and Booked › Schedule read the new answer, and the page behind the sheet
  // re-renders IN PLACE (ChaptersHost takes the fresh rows; the open sheet stays open). Held by
  // `every-schedule-save-refreshes-the-pages.test.ts`.
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

export function realChapterDoors(eventId: string): ChapterDoors {
  const ok = (p: Promise<unknown>) => p.then(() => true, () => false);
  return {
    create: (blockId, label, startLocal, tba) =>
      ok(
        createScheduleBlock(
          form(eventId, { block_id: blockId, label, block_type: 'custom', start_at: startLocal, ...(tba ? { time_tba: '1' } : {}) }),
        ),
      ),
    save: (blockId, fields) => ok(updateScheduleBlock(form(eventId, { block_id: blockId, ...fields }))),
    remove: (blockId) => ok(deleteScheduleBlock(form(eventId, { block_id: blockId }))),
  };
}

export const LAB_CHAPTER_DOORS: ChapterDoors = {
  create: () => new Promise((r) => setTimeout(() => r(true), 250)),
  save: () => new Promise((r) => setTimeout(() => r(true), 150)),
  remove: () => new Promise((r) => setTimeout(() => r(true), 700)),
};

const OTHER_PLACE = '__other__';
const NOT_SAVED = { ok: false as const, error: 'Try again.' };
/** The clock a TBA chapter is stored at: its DAY at 00:00 (never drawn). */
const TBA_CLOCK = '00:00';

/** A new chapter as the page lays it on the list at once (the write has landed). */
export function newChapter(blockId: string, label: string, startIso: string, tba: boolean): Chapter {
  return {
    block_id: blockId,
    label,
    start_at: startIso,
    end_at: null,
    location: null,
    spot: null,
    notes: null,
    ingress_minutes_before: null,
    egress_minutes_after: null,
    call_lead_minutes: 60,
    on_invitation: false,
    photo_who: 'chapter',
    photo_when: 'right_away',
    is_public: false,
    moments: 0,
    time_tba: tba,
  };
}

/* ── a new chapter: name and time ────────────────────────────────────────────────────────────────────────────── */

export function NewChapterSheet({
  lastDay,
  onClose,
  onCreate,
}: {
  lastDay: string | null;
  onClose: () => void;
  /** `hhmm` blank = Time TBA. */
  onCreate: (label: string, day: string, hhmm: string) => Promise<boolean>;
}) {
  const headingId = useId();
  const [label, setLabel] = useState('');
  const [day, setDay] = useState<string>(lastDay ?? todayDay());
  const [time, setTime] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'failed'>('idle');
  // A name is enough: a blank Starts is Time TBA (owner 2026-11-01).
  const ready = label.trim().length > 0 && (time === '' || /^\d{2}:\d{2}$/.test(time));
  return (
    <Sheet open onClose={onClose} labelledById={headingId} title="New chapter">
      <div data-new-chapter="" className="flex flex-col gap-3 px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-2">
        <h3 id={headingId} className="sr-only">
          New chapter
        </h3>
        <FormRows width="short">
          <TypedRow
            name="What"
            value={label}
            empty="Preparation · Bride"
            maxLength={120}
            required
            onKeep={(t) => {
              setLabel(t.trim());
              return { ok: true };
            }}
            data="chapter-name"
          />
          <DateRow
            name="Date"
            value={day}
            max={lastDay}
            onKeep={(d) => {
              setDay(capChapterDay(d, lastDay).day);
              return { ok: true };
            }}
            data="chapter-date"
          />
          <TimeRow
            name="Starts"
            value={time}
            empty={TIME_TBA}
            clearable
            line={time ? undefined : 'Leave it blank while the time is not known.'}
            onKeep={(t) => {
              setTime(t);
              return { ok: true };
            }}
            data="chapter-start"
          />
        </FormRows>
        {state === 'failed' ? (
          <p role="alert" className="text-[13px] font-semibold text-danger-700">
            The chapter didn’t save. Nothing was added — try again.
          </p>
        ) : null}
        <div className="flex justify-end">
          <ActionButton
            tone="brand"
            main
            icon={CalendarPlus}
            label={state === 'saving' ? 'Creating…' : 'Create'}
            disabled={!ready || state === 'saving'}
            data-testid="chapter-create"
            onClick={async () => {
              setState('saving');
              const ok = await onCreate(label.trim(), day, time);
              if (!ok) setState('failed');
            }}
          />
        </div>
      </div>
    </Sheet>
  );
}

/* ── chapter details ─────────────────────────────────────────────────────────────────────────────────────────── */

export function ChapterSheet({
  chapter: c,
  venues,
  used,
  lastDay,
  mayInvite,
  doors,
  onPatch,
  onClose,
  onDeleted,
  replyCount,
  deleteSuppliers = [],
  heldBy = null,
  moments = [],
  onAsk,
}: {
  /** 🏛 The venue that holds this chapter's hours (by name) — its hours are a fact here, not fields. */
  heldBy?: string | null;
  /**
   * 🗓 This chapter's moments (SCHEDULES HAND-IN-HAND part (b), 2026-11-12): a supplier's own "is done" among them
   * WARNS before a new time is saved (rule 2) and their arrive / done stay put when it moves (rule 1).
   */
  moments?: readonly { block_id: string; parent_block_id: string; label: string; start_at: string; vendor_ids: string[] }[];
  /** "Ask them" — opens that supplier's done moment, where the shipped "Ask a supplier to change their times" is. */
  onAsk?: (momentId: string) => void;
  /** 👷 Who Delete chapter takes off their parts, by name (the host reads them; the warning says them). */
  deleteSuppliers?: readonly string[];
  chapter: Chapter;
  venues: string[];
  used: string[];
  lastDay: string | null;
  mayInvite: boolean;
  doors: ChapterDoors;
  /**
   * ✉ Who replied to this chapter (Step 5, `readChapterCounts`) — only for a chapter on the invitation. `null` = the
   * count could not be read (said, never 0). Taking a chapter off the invitation that guests said yes to shows them
   * first (ruled 1 Nov: *"removed = hosts first see who said yes, then guests are notified"*).
   */
  replyCount?: ChapterCount | null;
  onPatch: (next: Partial<Chapter>) => void;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const headingId = useId();
  const [stage, setStage] = useState<'details' | 'ask' | 'deleting' | 'failed' | 'uninvite'>('details');
  const [note, setNote] = useState<string | null>(null);
  const [other, setOther] = useState(false);

  /**
   * ⚠ RULE 2 (owner 2026-11-12): a new start or end that runs the chapter past a supplier's "is done" WARNS here before
   * it saves — "<Shop> is done at 10:30 PM — ask them?" — and never blocks: Save anyway saves. Only a NEW crossing warns
   * (one already true before this edit was already said). Lock my times still refuses in the database, as shipped.
   */
  const [warn, setWarn] = useState<{ row: 'start' | 'end'; lines: DoneWarning[]; go: () => Promise<KeepAnswer>; settle: (a: KeepAnswer) => void } | null>(null);
  const tagged = moments.map((m) => ({ ...m, responsible_vendor_ids: m.vendor_ids }));
  const kept = timesThatStay(c.block_id, tagged).length;
  const gate = (row: 'start' | 'end', next: { start_at: string | null; end_at: string | null }, go: () => Promise<KeepAnswer>): Promise<KeepAnswer> => {
    const already = new Set(doneWarnings({ start_at: c.start_at, end_at: c.end_at }, c.block_id, tagged).map((w) => w.blockId));
    const lines = doneWarnings(next, c.block_id, tagged).filter((w) => !already.has(w.blockId));
    if (lines.length === 0) return go();
    return new Promise((settle) => setWarn({ row, lines, go, settle }));
  };
  const warning = (row: 'start' | 'end') =>
    warn && warn.row === row ? (
      <div role="alert" data-chapter-done-warning="" className="mt-2 grid gap-2 rounded-xl bg-warn-100/60 px-3 py-2">
        {warn.lines.map((w) => (
          <p key={w.blockId} className="text-[14px] font-medium text-warn-800">
            {w.line}
          </p>
        ))}
        <div className="flex flex-wrap gap-2">
          {onAsk ? (
            <ActionButton
              tone="brand"
              icon={MessageSquare}
              label={warn.lines.length === 1 ? `Ask ${warn.lines[0]!.shop}` : 'Ask them'}
              data-testid="chapter-done-ask"
              onClick={() => {
                const first = warn.lines[0]!;
                warn.settle({ ok: false, error: `You chose to ask ${first.shop} first.` });
                setWarn(null);
                onAsk(first.blockId);
              }}
            />
          ) : null}
          <ActionButton
            tone="neutral"
            icon={Check}
            label="Save anyway"
            data-testid="chapter-done-save-anyway"
            onClick={() => {
              const w = warn;
              setWarn(null);
              void w.go().then(w.settle, () => w.settle({ ok: false }));
            }}
          />
        </div>
      </div>
    ) : null;

  /** Save these fields; on success lay the change on the list. */
  const keep = async (fields: Record<string, string>, next: Partial<Chapter>) => {
    const ok = await doors.save(c.block_id, fields);
    if (!ok) return NOT_SAVED;
    onPatch(next);
    return { ok: true as const };
  };

  /** A new start (date or clock): the chapter, its end and its moments move together. A TBA chapter that gets a clock
   *  leaves TBA in the same save; one that only changes day stays TBA and its moments move by the days. */
  const moveTo = async (day: string, hhmm: string) => {
    // ↕ ONE RULE with the desktop board's drag (`lib/chapter-move.ts`, slice 10): the same fields, the same row.
    // Leaving TBA sets a clock where there was none: the moments keep their own times. Every other move carries them.
    const move = chapterMove(c, day, hhmm, lastDay);
    if (!move) return NOT_SAVED;
    return gate('start', { start_at: move.next.start_at ?? null, end_at: move.next.end_at ?? null }, async () => {
      const answer = await keep(move.fields, move.next);
      const carried = Math.max(0, c.moments - kept);
      if (answer.ok && move.capped) setNote('Chapters stop at the event day, so the date was set back to it.');
      else if (answer.ok && !move.leavingTba && move.delta !== 0 && c.moments > 0)
        setNote(
          `${c.label} moved. ${carried > 0 ? `Its ${carried} moment${carried === 1 ? '' : 's'} moved with it.` : ''}${
            kept > 0 ? `${carried > 0 ? ' ' : ''}Suppliers’ arrive and done times stay — each one is told in their chat.` : ''
          }`,
        );
      return answer;
    });
  };

  /** ✕ on Starts — the time is not known (yet): the chapter keeps its DAY, has no end, no ingress, no egress, no call
   *  time, and is hidden from guests (the database refuses a TBA chapter on the Event Hub). Its moments stay put. */
  const goTba = async () => {
    const local = wallLocal(wallDay(c.start_at), TBA_CLOCK);
    const iso = wallIso(wallDay(c.start_at), TBA_CLOCK);
    if (!local || !iso) return NOT_SAVED;
    const answer = await keep(
      { start_at: local, time_tba: '1' },
      { start_at: iso, end_at: null, ingress_minutes_before: null, egress_minutes_after: null, is_public: false, time_tba: true },
    );
    if (answer.ok) setNote(`${c.label} is Time TBA. It has no call time until the time is set.`);
    return answer;
  };

  const venueOptions = useMemo(() => {
    const names = [...new Set([...venues, ...used].map((v) => v.trim()).filter(Boolean))];
    if (c.location && !names.includes(c.location)) names.push(c.location);
    return [{ key: '', label: VENUE_TBA }, ...names.map((n) => ({ key: n, label: n })), { key: OTHER_PLACE, label: 'Somewhere else…' }];
  }, [venues, used, c.location]);

  const ingress = ingressAt(c);
  const egress = egressAt(c);
  const flags = chapterWindowFlags(c);

  return (
    <Sheet
      open
      onClose={onClose}
      labelledById={headingId}
      title={stage === 'details' ? 'Chapter details' : stage === 'uninvite' ? 'Take it off the invitation?' : 'Delete chapter'}
    >
      <div data-chapter-sheet={c.block_id} className="flex flex-col gap-3 px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-2">
        <h3 id={headingId} className="sr-only">
          {c.label}
        </h3>
        {stage === 'details' ? (
          <>
            <FormRows width="wide">
              <TypedRow
                name="What"
                value={c.label}
                maxLength={120}
                required
                check={(t) => (t.trim() ? null : 'A chapter needs a name.')}
                onKeep={(t) => keep({ label: t.trim() }, { label: t.trim() })}
                data="chapter-name"
              />
              {/* 🏛 VENUE HOURS (2026-11-04): a venue holds them — one fact row, never a field the host can change. */}
              {heldBy ? (
                <FactRow
                  name="Hours"
                  value={heldHoursLine(c)}
                  where={`🔒 ${heldBy} holds these hours — ask them to change on the chapter’s page.`}
                  data="chapter-held-hours"
                />
              ) : null}
              {heldBy ? null : (
              <DateRow
                name="Date"
                value={wallDay(c.start_at)}
                max={lastDay}
                onKeep={(d) => moveTo(d, c.time_tba ? '' : wallTime(c.start_at))}
                data="chapter-date"
              />
              )}
              {heldBy ? null : (
              <TimeRow
                name="Starts"
                value={c.time_tba ? '' : wallTime(c.start_at)}
                empty={TIME_TBA}
                clearable
                line={c.time_tba ? 'No call time until the time is set.' : undefined}
                onKeep={(t) => (t ? moveTo(wallDay(c.start_at), t) : goTba())}
                below={warning('start')}
                data="chapter-start"
              />
              )}
              {c.time_tba || heldBy ? null : (
              <TimeRow
                name="Ends"
                value={wallTime(c.end_at)}
                clearable
                line={c.end_at && wallDay(c.end_at) !== wallDay(c.start_at) ? 'The next day' : undefined}
                onKeep={(t) => {
                  const end = endIsoFrom(c.start_at, t);
                  return gate('end', { start_at: c.start_at, end_at: end }, () => keep({ end_at: end ? end.slice(0, 16) : '' }, { end_at: end }));
                }}
                below={warning('end')}
                data="chapter-end"
              />
              )}
              <ChosenRow
                name="Where"
                value={other ? OTHER_PLACE : (c.location ?? '')}
                options={venueOptions}
                onPick={(k) => {
                  if (k === OTHER_PLACE) {
                    setOther(true);
                    return;
                  }
                  setOther(false);
                  void keep({ location: k }, { location: k || null });
                }}
                data="chapter-where"
              />
              {other ? (
                <TypedRow
                  name="Place"
                  value=""
                  empty="Type the venue"
                  maxLength={200}
                  openAsk={1}
                  onKeep={async (t) => {
                    const answer = await keep({ location: t.trim() }, { location: t.trim() || null });
                    if (answer.ok) setOther(false);
                    return answer;
                  }}
                  data="chapter-place"
                />
              ) : null}
              <TypedRow
                name="Exact spot"
                value={c.spot ?? ''}
                empty="Bridal suite, 2F, garden side"
                maxLength={120}
                onKeep={(t) => keep({ spot: t.trim() }, { spot: t.trim() || null })}
                data="chapter-spot"
              />
              {c.time_tba || heldBy ? null : (
              <TimeRow
                name="Ingress from"
                about={{ words: 'When suppliers can start setting up here. Leave it blank for no ingress.' }}
                value={wallTime(ingress)}
                empty="None"
                clearable
                line={ingress && wallDay(ingress) !== wallDay(c.start_at) ? 'The day before' : undefined}
                onKeep={(t) => {
                  const m = ingressMinutesFrom(c.start_at, t);
                  return keep({ ingress_minutes_before: m === null ? '' : String(m) }, { ingress_minutes_before: m });
                }}
                data="chapter-ingress"
              />
              )}
              {c.time_tba || heldBy ? null : (
              <TimeRow
                name="Egress until"
                about={{ words: 'When everything must be out. Leave it blank for no egress. It can be after midnight.' }}
                value={wallTime(egress)}
                empty="None"
                clearable
                line={egress && wallDay(egress) !== wallDay(c.start_at) ? 'The next day' : undefined}
                note={flags.includes('egress_before_end') ? 'Egress is before this chapter ends.' : undefined}
                onKeep={(t) => {
                  const m = egressMinutesFrom(c.start_at, t);
                  return keep({ egress_minutes_after: m === null ? '' : String(m) }, { egress_minutes_after: m });
                }}
                data="chapter-egress"
              />
              )}
              <ChosenRow
                name="Call time"
                value={String(c.call_lead_minutes)}
                options={CALL_LEAD_CHOICES.map((m) => ({ key: String(m), label: callLeadWords(m) }))}
                onPick={(k) => {
                  const n = Number(k);
                  if (isCallLead(n)) void keep({ call_lead_minutes: k }, { call_lead_minutes: n });
                }}
                data="chapter-call"
              />
              <ChosenRow
                name="Who sees the photos"
                value={c.photo_who}
                options={PHOTO_WHO.map((k) => ({ key: k, label: PHOTO_WHO_WORDS[k] }))}
                onPick={(k) => {
                  if (isPhotoWho(k)) void keep({ photo_who: k }, { photo_who: k });
                }}
                data="chapter-photo-who"
              />
              <ChosenRow
                name="When"
                label="When they see the photos"
                value={c.photo_when}
                options={PHOTO_WHEN.map((k) => ({ key: k, label: PHOTO_WHEN_WORDS[k] }))}
                onPick={(k) => {
                  if (isPhotoWhen(k)) void keep({ photo_when: k }, { photo_when: k });
                }}
                data="chapter-photo-when"
              />
              <SwitchRow
                name="On the invitation"
                line={
                  mayInvite || c.on_invitation
                    ? `Guests reply to this chapter. A TBA venue still sends as “Venue TBA”.${
                        c.on_invitation && replyCount !== undefined ? ` ${chapterCountLine(replyCount)}.` : ''
                      }`
                    : 'Only the hosts and the coordinator can put a chapter on the invitation.'
                }
                on={c.on_invitation}
                disabled={!mayInvite && !c.on_invitation}
                onChange={(next) => {
                  // ✉ Off, with guests who said yes (or a count that could not be read): show them first.
                  if (!next && c.on_invitation && (replyCount === null || (replyCount?.yes ?? 0) > 0)) {
                    setStage('uninvite');
                    return;
                  }
                  void keep({ on_invitation: next ? 'true' : 'false' }, { on_invitation: next });
                }}
                data="chapter-invite"
              />
              <TypedRow
                name="Notes"
                value={c.notes ?? ''}
                long
                boxed
                maxLength={2000}
                onKeep={(t) => keep({ notes: t.trim() }, { notes: t.trim() || null })}
                data="chapter-notes"
              />
            </FormRows>
            {note ? (
              <p role="status" data-chapter-note="" className="text-[13px] text-ink/70">
                {note}
              </p>
            ) : null}
            <div className="flex justify-start border-t border-ink/10 pt-3">
              <ActionButton tone="danger" icon={Trash2} label="Delete chapter" onClick={() => setStage('ask')} data-testid="chapter-delete" />
            </div>
          </>
        ) : stage === 'uninvite' ? (
          <div data-chapter-uninvite="" className="flex flex-col gap-3">
            <p className="text-[15px] text-ink">
              {replyCount ? (
                <>
                  <span className="font-semibold">
                    {replyCount.yes} {replyCount.yes === 1 ? 'guest' : 'guests'} said yes to {c.label}
                  </span>
                  {replyCount.yesNames.length > 0
                    ? `: ${joinChapterNames(
                        replyCount.yes > replyCount.yesNames.length
                          ? [...replyCount.yesNames, `${replyCount.yes - replyCount.yesNames.length} more`]
                          : replyCount.yesNames,
                      )}.`
                    : '.'}
                </>
              ) : (
                <span className="font-semibold">Who said yes to {c.label} could not be read just now.</span>
              )}{' '}
              If you take it off, everyone who said yes sees that {c.label} is no longer part of their invitation. Their
              replies are kept.
            </p>
            <div className="flex justify-end gap-2">
              <ActionButton tone="neutral" icon={X} label="Not now" quiet onClick={() => setStage('details')} />
              <ActionButton
                tone="danger"
                main
                icon={X}
                label="Take it off"
                data-testid="chapter-uninvite-continue"
                onClick={async () => {
                  const answer = await keep({ on_invitation: 'false' }, { on_invitation: false });
                  setStage('details');
                  setNote(answer.ok ? `${c.label} is off the invitation. Guests who said yes will see it when they open their invitation.` : `${c.label} is still on the invitation — that didn’t save. Try again.`);
                }}
              />
            </div>
          </div>
        ) : (
          <div data-chapter-delete={stage} className="flex flex-col gap-3">
            <p className="text-[15px] text-ink">
              {stage === 'deleting' ? (
                'Deleting…'
              ) : stage === 'failed' ? (
                <span role="alert" className="font-semibold text-danger-700">
                  {c.label} wasn’t deleted. Nothing was changed — try again.
                </span>
              ) : (
                <ChapterDeleteWords c={c} suppliers={deleteSuppliers} />
              )}
            </p>
            {stage === 'deleting' ? null : (
              <div className="flex justify-end gap-2">
                <ActionButton tone="neutral" icon={X} label="Not now" quiet onClick={() => setStage('details')} />
                <ActionButton
                  tone="danger"
                  main
                  icon={Trash2}
                  label="Continue"
                  data-testid="chapter-delete-continue"
                  onClick={async () => {
                    setStage('deleting');
                    const ok = await doors.remove(c.block_id);
                    if (ok) onDeleted();
                    else setStage('failed');
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

/**
 * 🗑 WHAT DELETING A CHAPTER TAKES — the ONE warning, read by the chapter's own Delete chapter and by a swipe left on
 * the Event Day rail (owner 2026-11-03, prototype frame 3: *"Because deleting a chapter has consequences, the in-page
 * warning stays"*). Since the same ruling a delete has an Undo (frame 4), so it no longer says it cannot be undone.
 */
export function ChapterDeleteWords({
  c,
  suppliers = [],
}: {
  c: Pick<Chapter, 'label' | 'moments' | 'on_invitation'>;
  /** The suppliers on this chapter or its moments, by name — they are taken off their parts (and told, as shipped). */
  suppliers?: readonly string[];
}) {
  const who = joinChapterNames([...suppliers]);
  return (
    <>
      <span className="font-semibold">{c.label}</span>
      {c.moments > 0 ? ` and its ${c.moments} moment${c.moments === 1 ? '' : 's'}` : ''} will be deleted.
      {c.on_invitation ? ' It comes off the invitation and out of every reply.' : ''}
      {suppliers.length > 0 ? ` ${who} ${suppliers.length === 1 ? 'is' : 'are'} taken off ${suppliers.length === 1 ? 'its' : 'their'} parts.` : ''}
      {c.moments > 0 ? ' Its photos stay safe in Memories, under Unsorted.' : ' No moments are in it yet, so no photos move.'} You can undo it for a few
      seconds.
    </>
  );
}

function todayDay(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
