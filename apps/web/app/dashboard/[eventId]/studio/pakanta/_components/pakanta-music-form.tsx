'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Music, Loader2 } from 'lucide-react';
import {
  savePakantaIntake,
  type PakantaIntakeResponses,
} from '../../../pakanta-actions';
import { buyService } from '@/app/dashboard/[eventId]/service-buy-actions';

type Props = {
  eventId: string;
  /** Existing draft responses (the couple can come back and edit). */
  initial: Partial<PakantaIntakeResponses> | null;
  pricePhp: number;
  /**
   * The couple ALREADY paid (Pakanta is active / in production). Hides the
   * payment CTA + checkout drawer — they can still refine their music notes
   * while the song is being written, but must never be asked to pay again.
   */
  paid?: boolean;
};

type FieldKey = keyof PakantaIntakeResponses;

/**
 * The Pakanta MUSIC top-up. The couple's love story (how they met, the
 * proposal, milestones) comes from onboarding — see the read-only preview on
 * the page — so this form only asks the four things the love story doesn't
 * carry (what they call each other, each side's favourite singer, the music
 * type) plus two optional "anything else" boxes. [Save for later] stores a
 * draft; [Continue to payment] saves the brief, then MINTS the order and opens
 * /pay — the one way to pay (owner 2026-10-14 🧩 5; `buyService`, the Papic
 * shape: one press, one bill). It reads "Opening payment…" while it goes.
 */
export function PakantaMusicForm({ eventId, initial, pricePhp, paid = false }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [buying, setBuying] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<FieldKey, string>>
  >({});

  function submit(intent: 'skip' | 'purchase') {
    const formEl = formRef.current;
    if (!formEl) return;
    const fd = new FormData(formEl);
    fd.set('event_id', eventId);
    fd.set('intent', intent);
    setError(null);
    setFieldErrors({});
    setBuying(intent === 'purchase');
    startTransition(async () => {
      const res = await savePakantaIntake(fd);
      if (!res.ok) {
        setError(res.error);
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        return;
      }
      // Brief saved (status=purchase_pending). For a purchase, reveal the
      // in-page checkout drawer instead of the retired /orders/new redirect.
      if (intent === 'purchase') {
        // The brief is saved — now the order, then /pay (a redirect ends this transition).
        setPaying(true);
        const buy = new FormData();
        buy.set('event_id', eventId);
        buy.set('offer', 'music');
        await buyService(buy);
        setPaying(false);
      } else router.refresh();
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        submit(paid ? 'skip' : 'purchase');
      }}
      className="space-y-4 rounded-xl border border-ink/10 bg-white p-5 shadow-sm"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">
        A few music notes
      </p>

      <Field
        name="pet_names"
        label="What do you call each other?"
        placeholder="e.g. Bibo &amp; Honey"
        defaultValue={initial?.pet_names}
        error={fieldErrors.pet_names}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="groom_favorite_singer"
          label="Favourite singer (partner 1)"
          placeholder="e.g. Bruno Mars"
          defaultValue={initial?.groom_favorite_singer}
          error={fieldErrors.groom_favorite_singer}
        />
        <Field
          name="bride_favorite_singer"
          label="Favourite singer (partner 2)"
          placeholder="e.g. Moira"
          defaultValue={initial?.bride_favorite_singer}
          error={fieldErrors.bride_favorite_singer}
        />
      </div>
      <Field
        name="music_type"
        label="What kind of music?"
        placeholder="e.g. acoustic ballad, OPM, kundiman, upbeat pop"
        defaultValue={initial?.music_type}
        error={fieldErrors.music_type}
      />
      <Field
        name="memorable_story"
        label="A moment you’d love in the song"
        placeholder="Optional — a memory you want the lyrics to capture"
        defaultValue={initial?.memorable_story}
        optional
        textarea
      />
      <Field
        name="story_to_add"
        label="Anything else?"
        placeholder="Optional — names, in-jokes, a line you’d love included"
        defaultValue={initial?.story_to_add}
        optional
        textarea
      />

      {error ? (
        <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>
      ) : null}

      {paying && !paid ? (
        <p className="sg-step" aria-live="polite">
          Your music notes are saved. Taking you to GCash, card or bank — one order, never two.
        </p>
      ) : null}

      {paid ? (
        /* Already paid (in production): save-only — no payment CTA. */
        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-mulberry px-4 py-2 text-sm font-semibold text-white hover:bg-mulberry/90 disabled:opacity-50"
          >
            {pending ? (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            ) : (
              <Music aria-hidden className="h-4 w-4" />
            )}
            Save my music notes
          </button>
        </div>
      ) : (
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            disabled={pending}
            onClick={() => submit('skip')}
            className="rounded-lg px-4 py-2 text-sm font-medium text-ink/70 hover:bg-ink/5 disabled:opacity-50"
          >
            Save for later
          </button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-mulberry px-4 py-2 text-sm font-semibold text-white hover:bg-mulberry/90 disabled:opacity-50"
          >
            {pending ? (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            ) : (
              <Music aria-hidden className="h-4 w-4" />
            )}
            {pending && buying ? 'Opening payment…' : `Continue to payment · ₱${pricePhp.toLocaleString('en-PH')}`}
          </button>
        </div>
      )}
    </form>
  );
}

function Field({
  name,
  label,
  placeholder,
  defaultValue,
  error,
  optional,
  textarea,
}: {
  name: FieldKey;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  error?: string;
  optional?: boolean;
  textarea?: boolean;
}) {
  const base =
    'mt-1 w-full rounded-lg border bg-cream px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:outline-none focus:ring-2 focus:ring-mulberry/40';
  const borderCls = error ? 'border-danger-400' : 'border-ink/15';
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink/80">
        {label}
        {optional ? <span className="ml-1 text-xs text-ink/40">(optional)</span> : null}
      </span>
      {textarea ? (
        <textarea
          name={name}
          rows={2}
          placeholder={placeholder}
          defaultValue={defaultValue ?? ''}
          className={`${base} ${borderCls}`}
        />
      ) : (
        <input
          name={name}
          type="text"
          placeholder={placeholder}
          defaultValue={defaultValue ?? ''}
          className={`${base} ${borderCls}`}
        />
      )}
      {error ? <span className="mt-1 block text-xs text-danger-600">{error}</span> : null}
    </label>
  );
}
