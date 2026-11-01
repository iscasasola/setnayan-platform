'use client';

import { useId, useMemo, useState } from 'react';
import { CalendarPlus, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { ChosenRow, FormRows, SwitchRow, TypedRow } from '@/app/_components/form-row';
import { DateRow } from '@/app/_components/form-row-date';
import { TimeRow } from '@/app/_components/form-row-time';
import { MAKER_QUIET_FIELD } from '@/lib/maker-live-preview';
import {
  CALL_LEAD_CHOICES,
  PHOTO_WHEN,
  PHOTO_WHEN_WORDS,
  PHOTO_WHO,
  PHOTO_WHO_WORDS,
  VENUE_TBA,
  callLeadWords,
  capChapterDay,
  chapterLine,
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
  type Chapter,
} from '@/lib/schedule-chapters';
import { createScheduleBlock, deleteScheduleBlock, updateScheduleBlock } from '../schedule/actions';

/**
 * 📖 HOME › EVENT SETTINGS › CHAPTERS — make, change and delete the event's chapters (owner 2026-11-01, DECISION_LOG
 * "SCHEDULE AND CHAPTERS — THE PLAN" · "CHAPTER EDIT + DELETE; INGRESS AND EGRESS ARE OPTIONAL TIMES" · "BACK OUT OF A
 * CHAPTER; DATES STOP AT THE EVENT DAY"; corpus SCHEDULE_CHAPTERS_BUILD_PLAN §2, §3, §8 step 3 "Chapters + Event
 * Settings"; approved prototype `prototypes/schedule_chapters_2026-11-01/` — its `chSheet`).
 *
 * A chapter is a top-level schedule block (migration 20271300072429), so every save is the Schedule's OWN door —
 * `createScheduleBlock` · `updateScheduleBlock` · `deleteScheduleBlock` — with the same refusals, the same RLS (the
 * couple, and a helper holding Edit on the Schedule), and no new server action (the route budget).
 *
 *   · A NEW CHAPTER ASKS ONLY NAME AND TIME (plan §2, "the clean slate"): What · Date · Starts, then Create.
 *   · CHAPTER DETAILS: every field saves as it is kept (the Form Row rule), the sheet stays where it is — a save never
 *     resets the screen. What · Date · Starts · Ends · Where (or Venue TBA) · Exact spot · Ingress from · Egress until
 *     (blank = none; both may cross midnight) · Call time · Who sees the photos · When · On the invitation · Notes.
 *   · DELETE CHAPTER at its foot: it warns (cannot be undone · its moments · photos stay safe under Unsorted), then
 *     Continue, then a deleting state — the owner's standing delete pattern.
 *   · Moving the date or the start moves its moments with it (`with_moments`, one statement in the database).
 *   · Dates stop at the event day: the calendar ends there, and a later day is set back to it, with a note.
 *
 * 🔒 NO GUEST-VISIBLE CHANGE (Step 2): a chapter made here starts hidden from guests, and nothing here turns that on.
 * "On the invitation" is stored for the RSVP step and read by no guest page yet.
 *
 * 🧪 `lab` — the Home lab (`/dev/home-lab?settings=1&row=chapters`) runs the same rows on fake chapters with doors that
 * only answer "saved"; nothing is written anywhere.
 */
export type ChaptersInput =
  | {
      measured: true;
      chapters: Chapter[];
      /** The event's own venues by name (Event Settings › Venues) — Where offers them first. */
      venues: string[];
      /** The event's last day (`YYYY-MM-DD`) — chapters stop there; null = no exact date yet (no cap). */
      lastDay: string | null;
      /** May put a chapter on the invitation (a host or the coordinator — the rule for showing guests anything). */
      mayInvite: boolean;
    }
  | { measured: false };

type Doors = {
  create: (blockId: string, label: string, startLocal: string) => Promise<boolean>;
  save: (blockId: string, fields: Record<string, string>) => Promise<boolean>;
  remove: (blockId: string) => Promise<boolean>;
};

function form(eventId: string, fields: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set('event_id', eventId);
  // The sheet holds the answer: a save renders no page behind it (the Maker's quiet write — cache freshness only).
  fd.set(MAKER_QUIET_FIELD, '1');
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function realDoors(eventId: string): Doors {
  const ok = (p: Promise<unknown>) => p.then(() => true, () => false);
  return {
    create: (blockId, label, startLocal) =>
      ok(createScheduleBlock(form(eventId, { block_id: blockId, label, block_type: 'custom', start_at: startLocal }))),
    save: (blockId, fields) => ok(updateScheduleBlock(form(eventId, { block_id: blockId, ...fields }))),
    remove: (blockId) => ok(deleteScheduleBlock(form(eventId, { block_id: blockId }))),
  };
}

const LAB_DOORS: Doors = {
  create: () => new Promise((r) => setTimeout(() => r(true), 250)),
  save: () => new Promise((r) => setTimeout(() => r(true), 150)),
  remove: () => new Promise((r) => setTimeout(() => r(true), 700)),
};

const OTHER_PLACE = '__other__';
const NOT_SAVED = { ok: false as const, error: 'Try again.' };

export function EventSettingsChapters({ eventId, input, lab = false }: { eventId: string; input: ChaptersInput; lab?: boolean }) {
  const doors = useMemo(() => (lab ? LAB_DOORS : realDoors(eventId)), [eventId, lab]);
  const [chapters, setChapters] = useState<Chapter[]>(input.measured ? input.chapters : []);
  const [open, setOpen] = useState<{ kind: 'new' } | { kind: 'edit'; id: string } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  if (!input.measured) {
    return (
      <p role="alert" data-chapters-failed="" className="text-sm text-terracotta-700">
        The chapters couldn’t be read just now. Nothing was changed — close this and try again.
      </p>
    );
  }
  const sorted = [...chapters].sort((a, b) => (a.start_at < b.start_at ? -1 : a.start_at > b.start_at ? 1 : 0));
  const editing = open?.kind === 'edit' ? (chapters.find((c) => c.block_id === open.id) ?? null) : null;
  const patch = (id: string, next: Partial<Chapter>) => setChapters((cs) => cs.map((c) => (c.block_id === id ? { ...c, ...next } : c)));

  return (
    <div data-chapters="" className="flex flex-col gap-2">
      <p className="text-[13px] text-ink/60">Everything on the day is a chapter: preparations, the ceremony, the reception, a fitting.</p>
      {sorted.length === 0 ? (
        <p data-chapters-empty="" className="text-[14px] text-ink/70">
          No chapters yet. Start with a name and a time.
        </p>
      ) : (
        <ul data-chapters-list="" className="flex flex-col">
          {sorted.map((c) => (
            <li key={c.block_id} className="border-t border-ink/10 first:border-t-0">
              <button
                type="button"
                data-chapter-row={c.block_id}
                onClick={() => setOpen({ kind: 'edit', id: c.block_id })}
                className="sn-press flex min-h-14 w-full items-center gap-3 py-2 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-ink">{c.label}</span>
                  <span className="block truncate text-[13px] text-ink/60">
                    {dayWords(wallDay(c.start_at))} · {chapterLine(c)}
                  </span>
                </span>
                <ChevronRight aria-hidden className="h-4 w-4 flex-none text-ink/40" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {flash ? (
        <p role="status" data-chapters-flash="" className="text-[13px] text-ink/70">
          {flash}
        </p>
      ) : null}
      <div>
        <ActionButton tone="brand" icon={Plus} label="Add a chapter" onClick={() => setOpen({ kind: 'new' })} data-testid="chapters-add" />
      </div>

      {open?.kind === 'new' ? (
        <NewChapterSheet
          lastDay={input.lastDay}
          onClose={() => setOpen(null)}
          onCreate={async (label, day, hhmm) => {
            const startLocal = wallLocal(day, hhmm);
            const startIso = wallIso(day, hhmm);
            if (!startLocal || !startIso) return false;
            const blockId = crypto.randomUUID();
            const ok = await doors.create(blockId, label, startLocal);
            if (!ok) return false;
            setChapters((cs) => [
              ...cs,
              {
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
              },
            ]);
            setFlash(`${label} is added. Tap it to set its venue and the rest.`);
            setOpen(null);
            return true;
          }}
        />
      ) : null}

      {editing ? (
        <ChapterSheet
          key={editing.block_id}
          chapter={editing}
          venues={input.venues}
          used={chapters.map((c) => c.location).filter((v): v is string => Boolean(v))}
          lastDay={input.lastDay}
          mayInvite={input.mayInvite}
          doors={doors}
          onPatch={(next) => patch(editing.block_id, next)}
          onClose={() => setOpen(null)}
          onDeleted={() => {
            setChapters((cs) => cs.filter((c) => c.block_id !== editing.block_id));
            setFlash(`${editing.label} is deleted.`);
            setOpen(null);
          }}
        />
      ) : null}
    </div>
  );
}

/* ── a new chapter: name and time ────────────────────────────────────────────────────────────────────────────── */

function NewChapterSheet({
  lastDay,
  onClose,
  onCreate,
}: {
  lastDay: string | null;
  onClose: () => void;
  onCreate: (label: string, day: string, hhmm: string) => Promise<boolean>;
}) {
  const headingId = useId();
  const [label, setLabel] = useState('');
  const [day, setDay] = useState<string>(lastDay ?? todayDay());
  const [time, setTime] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'failed'>('idle');
  const ready = label.trim().length > 0 && /^\d{2}:\d{2}$/.test(time);
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

function ChapterSheet({
  chapter: c,
  venues,
  used,
  lastDay,
  mayInvite,
  doors,
  onPatch,
  onClose,
  onDeleted,
}: {
  chapter: Chapter;
  venues: string[];
  used: string[];
  lastDay: string | null;
  mayInvite: boolean;
  doors: Doors;
  onPatch: (next: Partial<Chapter>) => void;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const headingId = useId();
  const [stage, setStage] = useState<'details' | 'ask' | 'deleting' | 'failed'>('details');
  const [note, setNote] = useState<string | null>(null);
  const [other, setOther] = useState(false);

  /** Save these fields; on success lay the change on the list. */
  const keep = async (fields: Record<string, string>, next: Partial<Chapter>) => {
    const ok = await doors.save(c.block_id, fields);
    if (!ok) return NOT_SAVED;
    onPatch(next);
    return { ok: true as const };
  };

  /** A new start (date or clock): the chapter, its end and its moments move together. */
  const moveTo = async (day: string, hhmm: string) => {
    const capped = capChapterDay(day, lastDay);
    const local = wallLocal(capped.day, hhmm);
    const iso = wallIso(capped.day, hhmm);
    if (!local || !iso) return NOT_SAVED;
    const delta = Math.round((Date.parse(iso) - Date.parse(c.start_at)) / 60_000);
    const answer = await keep({ start_at: local, with_moments: '1' }, { start_at: iso, end_at: c.end_at ? shiftWall(c.end_at, delta) : null });
    if (answer.ok && capped.capped) setNote('Chapters stop at the event day, so the date was set back to it.');
    else if (answer.ok && delta !== 0 && c.moments > 0) setNote(`${c.label} moved. Its ${c.moments} moment${c.moments === 1 ? '' : 's'} moved with it.`);
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
    <Sheet open onClose={onClose} labelledById={headingId} title={stage === 'details' ? 'Chapter details' : 'Delete chapter'}>
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
              <DateRow
                name="Date"
                value={wallDay(c.start_at)}
                max={lastDay}
                onKeep={(d) => moveTo(d, wallTime(c.start_at))}
                data="chapter-date"
              />
              <TimeRow name="Starts" value={wallTime(c.start_at)} onKeep={(t) => (t ? moveTo(wallDay(c.start_at), t) : NOT_SAVED)} data="chapter-start" />
              <TimeRow
                name="Ends"
                value={wallTime(c.end_at)}
                clearable
                line={c.end_at && wallDay(c.end_at) !== wallDay(c.start_at) ? 'The next day' : undefined}
                onKeep={(t) => {
                  const end = endIsoFrom(c.start_at, t);
                  return keep({ end_at: end ? end.slice(0, 16) : '' }, { end_at: end });
                }}
                data="chapter-end"
              />
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
                    ? 'Guests reply to this chapter. A TBA venue still sends as “Venue TBA”.'
                    : 'Only the hosts and the coordinator can put a chapter on the invitation.'
                }
                on={c.on_invitation}
                disabled={!mayInvite && !c.on_invitation}
                onChange={(next) => void keep({ on_invitation: next ? 'true' : 'false' }, { on_invitation: next })}
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
                <>
                  <span className="font-semibold">{c.label}</span>
                  {c.moments > 0 ? ` and its ${c.moments} moment${c.moments === 1 ? '' : 's'}` : ''} will be deleted. This cannot be
                  undone. Its photos stay safe in Memories, under Unsorted.
                </>
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

function todayDay(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** "Fri 18 Dec" for a `YYYY-MM-DD` (a wall day — read as UTC, never a zone). */
function dayWords(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '';
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}
