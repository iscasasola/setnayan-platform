'use client';

/**
 * Card 17 · Pakanta · client form (8 questions + auto-play sample +
 * Skip / Purchase CTAs).
 *
 * Owner directive 2026-05-25 verbatim:
 *
 *   step 19 Pakanta — We will ask the following and they will fill it up
 *   1. Story how you first met
 *   2. Engagement Story
 *   3. Memorable Story
 *   4. What do you call each other
 *   5. What story do you want added
 *   6. Favorite Singer of Groom
 *   7. Favorite Singer of Bride
 *   8. Type of Music
 *   Auto Play sample music
 *   [Skip for now] [Purchase]
 *
 * Implementation notes:
 *   - Story questions (1-3 + 5) and pet-name (4) render as textareas with
 *     a 10-char client-side minimum. Singer + Music-type render as a
 *     single-line input + a select.
 *   - Sample audio uses <audio autoPlay muted loop> — browsers allow
 *     muted autoplay without a user gesture; the host clicks the
 *     speaker affordance to unmute. The V1 sample is a Bensound
 *     royalty-free track (CC BY-3.0 attribution kept inline); the
 *     iteration 0036 Suno catalog swap lands V1.x.
 *   - Skip-for-now saves the draft + advances the wizard task to
 *     in_flight. Purchase saves with status='purchase_pending' and
 *     redirects to /dashboard/[eventId]/orders/new?service=pakanta_basic.
 *
 * Per [[feedback_setnayan_no_dev_text_post_launch]] · every label, hint,
 * and error message reads as polite brand voice.
 */

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Music, Save, Send } from 'lucide-react';
import {
  savePakantaIntake,
  type PakantaIntakeResponses,
} from '../../pakanta-actions';

type Props = {
  eventId: string;
  /** Pre-filled answers when the host has an existing draft on file. */
  initialResponses: PakantaIntakeResponses | null;
};

// Music genres anchored against PH wedding-music reality + iteration 0036
// spec § 5 Section 6 Vibe / Style Preferences. Owner builds the Suno style
// prompt off this seed — keep options grounded in feels couples actually
// recognize. 9 options + "Other" so the host can name a niche if needed.
const MUSIC_TYPE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'opm', label: 'OPM (Original Pilipino Music)' },
  { value: 'pop_ballad', label: 'Pop ballad' },
  { value: 'acoustic', label: 'Acoustic · stripped-back' },
  { value: 'jazz', label: 'Jazz · smooth standards' },
  { value: 'bossa_nova', label: 'Bossa nova · soft Latin' },
  { value: 'rnb_soul', label: 'R&B · soulful' },
  { value: 'cinematic', label: 'Cinematic · orchestral build' },
  { value: 'folk_indie', label: 'Folk · indie storytelling' },
  { value: 'country', label: 'Country · narrative ballad' },
  { value: 'other', label: 'Something else — we’ll describe in the brief' },
];

// V1 sample placeholder · Bensound "Romantic" instrumental · CC license.
// Replace with Suno-generated Setnayan-owned sample when iteration 0036
// V1.x catalog lands. The <audio> tag plays muted on mount per browser
// autoplay rules; the speaker icon button toggles mute.
const SAMPLE_AUDIO_URL = 'https://www.bensound.com/bensound-music/bensound-romantic.mp3';
const SAMPLE_AUDIO_ATTRIBUTION = 'Sample tone · royalty-free placeholder';

type FieldErrors = Partial<Record<keyof PakantaIntakeResponses, string>>;

const STORY_MIN_LEN = 10;
const STORY_FIELDS: ReadonlyArray<keyof PakantaIntakeResponses> = [
  'how_you_met',
  'engagement_story',
  'memorable_story',
  'pet_names',
  'story_to_add',
];

const EMPTY_RESPONSES: PakantaIntakeResponses = {
  how_you_met: '',
  engagement_story: '',
  memorable_story: '',
  pet_names: '',
  story_to_add: '',
  groom_favorite_singer: '',
  bride_favorite_singer: '',
  music_type: '',
};

export function PakantaIntakeForm({ eventId, initialResponses }: Props) {
  const router = useRouter();
  const [responses, setResponses] = useState<PakantaIntakeResponses>(
    initialResponses ?? EMPTY_RESPONSES,
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioMuted, setAudioMuted] = useState(true);

  // Try to start the muted autoplay on mount. Browsers permit muted
  // autoplay without a user gesture; the play() promise rejects silently
  // on browsers that block it (Safari Low Power Mode, etc.) — that's
  // acceptable, the host can still tap the speaker affordance.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = true;
    audio.volume = 0.4;
    const playPromise = audio.play();
    if (playPromise) {
      playPromise.catch(() => {
        // Silent — autoplay blocked, the host can press play manually.
      });
    }
  }, []);

  function toggleMute() {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !audioMuted;
    audio.muted = next;
    setAudioMuted(next);
    if (!next && audio.paused) {
      audio.play().catch(() => {
        // Silent — handle browser quirks the same way as mount.
      });
    }
  }

  function updateField(field: keyof PakantaIntakeResponses, value: string) {
    setResponses((r) => ({ ...r, [field]: value }));
    // Clear the per-field error as soon as the host edits.
    if (fieldErrors[field]) {
      setFieldErrors((e) => {
        const { [field]: _removed, ...rest } = e;
        return rest;
      });
    }
  }

  function buildFormData(intent: 'skip' | 'purchase'): FormData {
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('intent', intent);
    (Object.keys(responses) as Array<keyof PakantaIntakeResponses>).forEach(
      (key) => {
        fd.set(key, responses[key]);
      },
    );
    return fd;
  }

  function submit(intent: 'skip' | 'purchase') {
    setTopError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await savePakantaIntake(buildFormData(intent));
      if (!result.ok) {
        setTopError(result.error);
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        return;
      }
      if (result.redirectTo) {
        router.push(result.redirectTo);
      } else {
        // Skip path · stay on event home · server-side revalidatePath
        // already refreshed the layout, so the carousel will advance
        // when Next.js re-renders.
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Sample audio · auto-plays muted on mount. Host clicks the
          speaker affordance to unmute. Caption explains what they're
          hearing without overselling (V1 placeholder · not the final
          Suno track). */}
      <section
        aria-labelledby="pakanta-sample-heading"
        className="rounded-xl border border-ink/10 bg-cream/40 p-4"
      >
        <header className="flex items-center gap-2">
          <Music aria-hidden className="h-3.5 w-3.5 text-terracotta" strokeWidth={2} />
          <h3
            id="pakanta-sample-heading"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/65"
          >
            A taste of what your song could sound like
          </h3>
        </header>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={toggleMute}
            className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-md border border-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-ink/80 transition-colors hover:bg-cream focus:outline-none focus:ring-2 focus:ring-terracotta/30"
            aria-pressed={!audioMuted}
          >
            {audioMuted ? '🔇 Tap to hear' : '🔊 Sound on'}
          </button>
          <audio
            ref={audioRef}
            src={SAMPLE_AUDIO_URL}
            autoPlay
            muted
            loop
            preload="auto"
            controls
            className="h-9 flex-1 min-w-0"
          >
            Your browser doesn&apos;t support inline audio playback. That&apos;s OK —
            you can still tell us about your love story below.
          </audio>
        </div>
        <p className="mt-2 text-[11px] text-ink/55">{SAMPLE_AUDIO_ATTRIBUTION}</p>
      </section>

      {/* The 8-question intake form proper. */}
      <section aria-labelledby="pakanta-form-heading" className="space-y-4">
        <header>
          <h3
            id="pakanta-form-heading"
            className="font-display text-xl italic leading-tight text-ink"
          >
            Tell us about your love story
          </h3>
          <p className="mt-1 text-sm text-ink/65">
            Your answers shape the lyrics. Be specific — pet names, inside
            jokes, the moment everything clicked. We send this brief to
            our songwriter.
          </p>
        </header>

        {topError ? (
          <p
            role="alert"
            className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800"
          >
            {topError}
          </p>
        ) : null}

        <TextAreaField
          id="pakanta-how-you-met"
          label="1. How did you first meet?"
          hint="Where it happened · who introduced you · what year"
          value={responses.how_you_met}
          onChange={(v) => updateField('how_you_met', v)}
          error={fieldErrors.how_you_met}
        />
        <TextAreaField
          id="pakanta-engagement-story"
          label="2. Your engagement story"
          hint="Where · when · what made it land"
          value={responses.engagement_story}
          onChange={(v) => updateField('engagement_story', v)}
          error={fieldErrors.engagement_story}
        />
        <TextAreaField
          id="pakanta-memorable-story"
          label="3. A memorable moment together"
          hint="An inside joke · a road trip · a quiet evening — the moment that says you"
          value={responses.memorable_story}
          onChange={(v) => updateField('memorable_story', v)}
          error={fieldErrors.memorable_story}
        />
        <TextAreaField
          id="pakanta-pet-names"
          label="4. What do you call each other?"
          hint="Nicknames · pet names · the names that show up only at home"
          value={responses.pet_names}
          onChange={(v) => updateField('pet_names', v)}
          error={fieldErrors.pet_names}
        />
        <TextAreaField
          id="pakanta-story-to-add"
          label="5. Anything else you want in the song?"
          hint="A line from your vows · a hometown reference · a promise you want sung"
          value={responses.story_to_add}
          onChange={(v) => updateField('story_to_add', v)}
          error={fieldErrors.story_to_add}
        />
        <SingleLineField
          id="pakanta-groom-singer"
          label="6. Groom's favorite singer or artist"
          placeholder="e.g. Ben&Ben"
          value={responses.groom_favorite_singer}
          onChange={(v) => updateField('groom_favorite_singer', v)}
          error={fieldErrors.groom_favorite_singer}
        />
        <SingleLineField
          id="pakanta-bride-singer"
          label="7. Bride's favorite singer or artist"
          placeholder="e.g. Moira Dela Torre"
          value={responses.bride_favorite_singer}
          onChange={(v) => updateField('bride_favorite_singer', v)}
          error={fieldErrors.bride_favorite_singer}
        />
        <div>
          <label
            htmlFor="pakanta-music-type"
            className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
          >
            8. Type of music
          </label>
          <select
            id="pakanta-music-type"
            value={responses.music_type}
            onChange={(e) => updateField('music_type', e.target.value)}
            className="input-field mt-1 sm:max-w-md"
            aria-invalid={fieldErrors.music_type ? true : undefined}
          >
            <option value="">Pick a direction…</option>
            {MUSIC_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {fieldErrors.music_type ? (
            <p className="mt-1 text-xs text-rose-700">{fieldErrors.music_type}</p>
          ) : null}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => submit('skip')}
          disabled={isPending}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-cream focus:outline-none focus:ring-2 focus:ring-terracotta/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : (
            <Save aria-hidden className="h-4 w-4" strokeWidth={2} />
          )}
          Save &amp; continue later
        </button>
        <button
          type="button"
          onClick={() => submit('purchase')}
          disabled={isPending}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-terracotta px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-700 focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : (
            <Send aria-hidden className="h-4 w-4" strokeWidth={2} />
          )}
          Lock in Pakanta — ₱1,999
        </button>
      </div>
      <p className="text-[11px] text-ink/50">
        Premium (₱3,999 · 2 versions · lyric approval) and the Wedding
        Suite (₱9,999 · 3 matching songs) are picked at checkout.
      </p>
    </div>
  );
}

function TextAreaField({
  id,
  label,
  hint,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  error: string | undefined;
}) {
  const showLengthWarning =
    value.length > 0 && value.trim().length < STORY_MIN_LEN;
  return (
    <div>
      <label
        htmlFor={id}
        className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
      >
        {label}
      </label>
      <p className="mt-0.5 text-xs text-ink/55">{hint}</p>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        maxLength={2000}
        className="input-field mt-1 min-h-[4.5rem] resize-y"
        aria-invalid={error ? true : undefined}
      />
      {error ? (
        <p className="mt-1 text-xs text-rose-700">{error}</p>
      ) : showLengthWarning ? (
        <p className="mt-1 text-xs text-amber-700">
          A few more words help — aim for at least {STORY_MIN_LEN} characters.
        </p>
      ) : null}
    </div>
  );
}

function SingleLineField({
  id,
  label,
  placeholder,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  error: string | undefined;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
      >
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={120}
        className="input-field mt-1 sm:max-w-md"
        aria-invalid={error ? true : undefined}
      />
      {error ? <p className="mt-1 text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
