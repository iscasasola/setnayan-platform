'use client';

import { useState, useTransition } from 'react';
import { ArrowDown, ArrowUp, Camera, CircleSlash, Plus, Sparkles, Trash2 } from 'lucide-react';
import { updatePhotoMoments } from '../actions';
import {
  PHOTO_MOMENT_LIMITS,
  PHOTO_MOMENT_MODES,
  PHOTO_MOMENT_MODE_HINT,
  PHOTO_MOMENT_MODE_LABEL,
  type PhotoMoment,
  type PhotoMomentMode,
  type PhotoMomentsConfig,
} from '../config';

/**
 * Client-side editor for the Photo Moments JSONB column. Keeps the
 * moments list in local state so the host can add / remove / reorder
 * rows without a round-trip; on Save, dispatches the full list as
 * parallel form arrays (time_label[], title[], note[], mode[]) for the
 * server action to read in DOM order.
 *
 * Why client-side state instead of separate per-row server actions:
 * the underlying column is JSONB on events. Each row addition or move
 * is a re-write of the whole config blob; doing that on every keystroke
 * would be noisy + slow. A single "Save changes" button matches the
 * host's mental model ("I'm editing my photo guidance list") and keeps
 * Postgres updates batched.
 *
 * Rows with empty titles are silently dropped by the server action —
 * scaffold rows the host adds but never fills in won't land on the
 * public landing page, so the host doesn't have to manually delete
 * unused rows before saving.
 */
export function PhotoMomentsEditor({
  eventId,
  initial,
}: {
  eventId: string;
  initial: PhotoMomentsConfig;
}) {
  const [intro, setIntro] = useState(initial.intro_copy);
  const [moments, setMoments] = useState<PhotoMoment[]>(() =>
    initial.moments.length > 0
      ? initial.moments
      : [
          // Start with one empty scaffold row so the host sees the
          // shape of an entry. They can fill it in or click Remove.
          { time_label: '', title: '', note: '', mode: 'phone_down' },
        ],
  );
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [isPending, startTransition] = useTransition();

  const canAddRow = moments.length < PHOTO_MOMENT_LIMITS.MAX_MOMENTS;

  function addRow() {
    if (!canAddRow) return;
    setMoments((prev) => [
      ...prev,
      { time_label: '', title: '', note: '', mode: 'phone_down' },
    ]);
    setSavedAt(null);
  }

  function removeRow(index: number) {
    setMoments((prev) => prev.filter((_, i) => i !== index));
    setSavedAt(null);
  }

  function moveRow(index: number, direction: -1 | 1) {
    setMoments((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (!removed) return prev;
      next.splice(target, 0, removed);
      return next;
    });
    setSavedAt(null);
  }

  function updateRow(
    index: number,
    field: keyof PhotoMoment,
    value: string,
  ) {
    setMoments((prev) =>
      prev.map((row, i) =>
        i === index
          ? field === 'mode'
            ? { ...row, mode: value as PhotoMomentMode }
            : { ...row, [field]: value }
          : row,
      ),
    );
    setSavedAt(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('intro_copy', intro);
    for (const m of moments) {
      formData.append('time_label[]', m.time_label);
      formData.append('title[]', m.title);
      formData.append('note[]', m.note);
      formData.append('mode[]', m.mode);
    }

    startTransition(async () => {
      const result = await updatePhotoMoments(formData);
      if (result.ok) {
        setSavedAt(new Date());
        // After a successful save, re-trim moments locally so the host
        // sees the same dropped-empty-rows behavior the server applied.
        setMoments((prev) => prev.filter((m) => m.title.trim().length > 0));
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Intro copy */}
      <section className="space-y-2 rounded-xl border border-ink/10 bg-cream p-5">
        <label htmlFor="intro_copy" className="block">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            Intro paragraph
          </span>
          <span className="mt-1 block text-sm text-ink/65">
            Optional. Sets the tone above the list. Up to{' '}
            {PHOTO_MOMENT_LIMITS.MAX_INTRO_LEN} characters.
          </span>
        </label>
        <textarea
          id="intro_copy"
          name="intro_copy"
          value={intro}
          onChange={(e) => {
            setIntro(e.target.value.slice(0, PHOTO_MOMENT_LIMITS.MAX_INTRO_LEN));
            setSavedAt(null);
          }}
          rows={3}
          maxLength={PHOTO_MOMENT_LIMITS.MAX_INTRO_LEN}
          placeholder="We'll have our shutterbugs around so you can be fully present. Here's what we'd love you phone-down for —"
          className="input-field min-h-[88px] py-2"
        />
        <p className="text-right text-[11px] text-ink/45">
          {intro.length} / {PHOTO_MOMENT_LIMITS.MAX_INTRO_LEN}
        </p>
      </section>

      {/* Moments list */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
              Your moments
            </h2>
            <p className="mt-1 text-sm text-ink/65">
              {moments.length} of {PHOTO_MOMENT_LIMITS.MAX_MOMENTS} · displayed in
              this order on your landing page
            </p>
          </div>
          <button
            type="button"
            onClick={addRow}
            disabled={!canAddRow}
            className="inline-flex h-11 items-center gap-1.5 rounded-md border border-ink/20 bg-cream px-3 text-sm font-medium text-ink transition-colors hover:border-terracotta/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
            Add a moment
          </button>
        </div>

        {moments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center">
            <Sparkles
              aria-hidden
              className="mx-auto mb-2 h-6 w-6 text-ink/30"
              strokeWidth={1.5}
            />
            <p className="text-sm font-medium text-ink">No moments yet.</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-ink/60">
              Tap &ldquo;Add a moment&rdquo; to start curating your phone-down list.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {moments.map((m, i) => (
              <li key={i}>
                <MomentRow
                  index={i}
                  total={moments.length}
                  moment={m}
                  onChange={(field, value) => updateRow(i, field, value)}
                  onMove={(direction) => moveRow(i, direction)}
                  onRemove={() => removeRow(i)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Status + actions */}
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {error}
        </p>
      ) : null}
      {savedAt ? (
        <p
          role="status"
          className="rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          Saved. Your guests will see the new list on their next visit.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="button-primary"
          aria-busy={isPending}
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

/**
 * Single moment row. Time label + title + note + mode picker, with
 * inline reorder + remove controls. Mode picker is a select rather
 * than a radio group to keep the row compact on mobile.
 */
function MomentRow({
  index,
  total,
  moment,
  onChange,
  onMove,
  onRemove,
}: {
  index: number;
  total: number;
  moment: PhotoMoment;
  onChange: (field: keyof PhotoMoment, value: string) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const modeBadge = MODE_BADGE[moment.mode];

  return (
    <article className="space-y-3 rounded-xl border border-ink/10 bg-cream p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${modeBadge.bgClass} ${modeBadge.textClass}`}>
            <modeBadge.Icon aria-hidden className="h-3 w-3" strokeWidth={2} />
            {PHOTO_MOMENT_MODE_LABEL[moment.mode]}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label="Move up"
            className="rounded-md p-1.5 text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink/80 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ArrowUp className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            aria-label="Move down"
            className="rounded-md p-1.5 text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink/80 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ArrowDown className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove moment"
            className="rounded-md p-1.5 text-ink/40 transition-colors hover:bg-ink/5 hover:text-rose-700"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="block text-xs font-medium text-ink">When</span>
          <input
            value={moment.time_label}
            onChange={(e) =>
              onChange(
                'time_label',
                e.target.value.slice(0, PHOTO_MOMENT_LIMITS.MAX_TIME_LABEL_LEN),
              )
            }
            maxLength={PHOTO_MOMENT_LIMITS.MAX_TIME_LABEL_LEN}
            placeholder="e.g. 3:00 PM · Ceremony"
            className="input-field"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-ink">Mode</span>
          <select
            value={moment.mode}
            onChange={(e) => onChange('mode', e.target.value)}
            className="input-field"
          >
            {PHOTO_MOMENT_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {PHOTO_MOMENT_MODE_LABEL[mode]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="block text-xs font-medium text-ink">Title</span>
          <input
            value={moment.title}
            onChange={(e) =>
              onChange('title', e.target.value.slice(0, PHOTO_MOMENT_LIMITS.MAX_TITLE_LEN))
            }
            maxLength={PHOTO_MOMENT_LIMITS.MAX_TITLE_LEN}
            placeholder="e.g. The Kiss"
            className="input-field"
          />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="block text-xs font-medium text-ink">Note</span>
          <input
            value={moment.note}
            onChange={(e) =>
              onChange('note', e.target.value.slice(0, PHOTO_MOMENT_LIMITS.MAX_NOTE_LEN))
            }
            maxLength={PHOTO_MOMENT_LIMITS.MAX_NOTE_LEN}
            placeholder="e.g. After the vows · cheer when ready"
            className="input-field"
          />
        </label>
      </div>

      <p className="text-xs italic text-ink/55">{PHOTO_MOMENT_MODE_HINT[moment.mode]}</p>
    </article>
  );
}

const MODE_BADGE: Record<
  PhotoMomentMode,
  {
    bgClass: string;
    textClass: string;
    Icon: typeof Camera;
  }
> = {
  camera_ok: {
    bgClass: 'bg-emerald-100',
    textClass: 'text-emerald-800',
    Icon: Camera,
  },
  phone_down: {
    bgClass: 'bg-ink/5',
    textClass: 'text-ink/70',
    Icon: CircleSlash,
  },
  papic_only: {
    bgClass: 'bg-terracotta/15',
    textClass: 'text-terracotta-700',
    Icon: Sparkles,
  },
};
