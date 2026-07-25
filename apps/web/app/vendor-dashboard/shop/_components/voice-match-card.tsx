'use client';

import { useMemo, useState, useTransition } from 'react';
import { MessageSquareQuote, Sparkles, Wand2 } from 'lucide-react';

import { useToast } from '@/app/_components/toast/toast-provider';
import {
  VOICE_EMOJI_LEVELS,
  VOICE_FRAGMENT_MAX,
  VOICE_LANGUAGE_MIXES,
  VOICE_WARMTHS,
  coerceVoiceProfile,
  type VoiceProfile,
} from '@/lib/vendor-voice-profile';
import {
  buildPhrasingsForIntent,
  renderPhrasing,
} from '@/lib/vendor-autoreply/phrasings';

import {
  suggestVoiceProfile,
  updateVoiceProfile,
  type VoiceSaveResult,
} from '../autoreply-actions';

/**
 * My Shop → "Your voice" — the Vendor AI **ADVANCED** voice-match panel
 * (flag-dark: the page renders this only behind NEXT_PUBLIC_VENDOR_AI_VOICE_MATCH).
 *
 * Three honest beats, in the § 6 order:
 *   1. LEARN — "Use my past replies" derives a PROPOSAL from the vendor's own
 *      sent messages (deterministic, ₱0). Nothing is saved by that button.
 *   2. EDIT + PREVIEW — every field is vendor-editable and the preview renders
 *      through the SAME pure functions the server precomputes with, so what the
 *      vendor sees is exactly what couples will get.
 *   3. SAVE — stores the approved profile and regenerates the phrasing library.
 *
 * The preview's numbers are a fixed EXAMPLE sentence: voice never carries facts
 * (`assertFactFree`), so the panel must not imply it does.
 */

const PREVIEW_ANSWER =
  'Our Full-Day Coverage starts at ₱48,000 (covers 8 hrs). Our Signature package is ₱85,000.';

const LANGUAGE_LABEL: Record<string, string> = {
  english: 'English',
  taglish_light: 'Taglish (light)',
  taglish_heavy: 'Taglish (heavy)',
  cebuano: 'Cebuano',
};
const EMOJI_LABEL: Record<string, string> = {
  none: 'No emoji',
  light: 'A little',
  rich: 'Plenty',
};
const WARMTH_LABEL: Record<string, string> = {
  concise: 'Straight to the point',
  friendly: 'Warm and friendly',
  effusive: 'Very warm',
};

export function VoiceMatchCard({
  advancedActive,
  initialProfile,
  initialMode,
  initialLearnFromPastMessages,
}: {
  advancedActive: boolean;
  initialProfile: VoiceProfile;
  initialMode: string;
  initialLearnFromPastMessages: boolean;
}) {
  const toast = useToast();
  const [, startTransition] = useTransition();

  const [profile, setProfile] = useState<VoiceProfile>(initialProfile);
  const [saved, setSaved] = useState<VoiceProfile>(initialProfile);
  const [smart, setSmart] = useState(initialMode === 'smart');
  const [learn, setLearn] = useState(initialLearnFromPastMessages);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dirty = useMemo(
    () => JSON.stringify(profile) !== JSON.stringify(saved),
    [profile, saved],
  );

  // Preview through the very functions the server precomputes with.
  const previews = useMemo(() => {
    const envelopes = buildPhrasingsForIntent(profile, 'price');
    const rendered = envelopes
      .map((e) => renderPhrasing(e, PREVIEW_ANSWER))
      .filter((t): t is string => !!t);
    return Array.from(new Set(rendered)).slice(0, 3);
  }, [profile]);

  function set<K extends keyof VoiceProfile>(key: K, value: VoiceProfile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  function onLearn() {
    setBusy(true);
    startTransition(async () => {
      const res = await suggestVoiceProfile();
      setBusy(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setProfile(coerceVoiceProfile(res.profile));
      setNote(
        res.sampleCount === 0
          ? 'We couldn’t find any replies of yours to learn from yet — set your voice by hand below.'
          : res.confident
            ? `Suggested from your last ${res.sampleCount} replies. Edit anything, then Save.`
            : `Only ${res.sampleCount} of your replies to go on — treat this as a rough guess and edit it.`,
      );
    });
  }

  function onSave() {
    const fd = new FormData();
    fd.set('greeting', profile.greeting);
    fd.set('signoff', profile.signoff);
    fd.set('language_mix', profile.languageMix);
    fd.set('emoji_level', profile.emojiLevel);
    fd.set('warmth', profile.warmth);
    fd.set('honorifics', profile.honorifics ? 'true' : 'false');
    fd.set('mode', smart ? 'smart' : 'free');
    fd.set('learn_from_past_messages', learn ? 'true' : 'false');
    setBusy(true);
    startTransition(async () => {
      const res: VoiceSaveResult = await updateVoiceProfile(null, fd);
      setBusy(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSaved(profile);
      setNote(null);
      toast.success('Your voice is saved — replies are ready.');
    });
  }

  return (
    <div
      className="rounded-xl border p-4 sm:p-5"
      style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
          >
            <MessageSquareQuote className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h3 id="voice-match-heading" className="text-sm font-semibold text-ink">
              Your voice
            </h3>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--m-slate)' }}>
              {advancedActive
                ? 'Replies go out sounding like you — the facts still come straight from your catalog.'
                : 'Included with Vendor AI — Advanced.'}
            </p>
          </div>
        </div>
        {advancedActive ? (
          <Switch
            on={smart}
            onClick={() => setSmart((v) => !v)}
            label="Use my voice on replies"
          />
        ) : null}
      </div>

      {!advancedActive ? (
        <p className="mt-4 text-xs" style={{ color: 'var(--m-slate)' }}>
          Right now your assistant answers in Setnayan&rsquo;s neutral voice. Upgrade
          to Vendor AI — Advanced to have it greet, phrase and sign off the way you
          do. Your prices and dates never change: those always come from your own
          catalog.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onLearn}
              disabled={busy || !learn}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ borderColor: 'var(--m-line)', color: 'var(--m-ink)' }}
            >
              <Wand2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              Use my past replies
            </button>
            <label className="inline-flex items-center gap-2 text-xs" style={{ color: 'var(--m-slate)' }}>
              <Switch
                on={learn}
                onClick={() => setLearn((v) => !v)}
                label="Learn from my past replies"
              />
              Learn from my past replies
            </label>
          </div>
          {note ? (
            <p className="mt-2 text-xs" style={{ color: 'var(--m-slate)' }}>
              {note}
            </p>
          ) : null}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Greeting" hint={`How you open. Up to ${VOICE_FRAGMENT_MAX} characters, no numbers or links.`}>
              <input
                type="text"
                value={profile.greeting}
                maxLength={VOICE_FRAGMENT_MAX}
                placeholder="Hi po"
                onChange={(e) => set('greeting', e.target.value)}
                className="input-field"
                aria-label="Greeting"
              />
            </Field>
            <Field label="Sign-off" hint="How you close.">
              <input
                type="text"
                value={profile.signoff}
                maxLength={VOICE_FRAGMENT_MAX}
                placeholder="Salamat po"
                onChange={(e) => set('signoff', e.target.value)}
                className="input-field"
                aria-label="Sign-off"
              />
            </Field>
            <Field label="Language" hint="How you mix English and Filipino.">
              <select
                value={profile.languageMix}
                onChange={(e) => set('languageMix', e.target.value as VoiceProfile['languageMix'])}
                className="input-field"
                aria-label="Language"
              >
                {VOICE_LANGUAGE_MIXES.map((v) => (
                  <option key={v} value={v}>
                    {LANGUAGE_LABEL[v]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tone" hint="How warm your replies read.">
              <select
                value={profile.warmth}
                onChange={(e) => set('warmth', e.target.value as VoiceProfile['warmth'])}
                className="input-field"
                aria-label="Tone"
              >
                {VOICE_WARMTHS.map((v) => (
                  <option key={v} value={v}>
                    {WARMTH_LABEL[v]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Emoji" hint="How often you use them.">
              <select
                value={profile.emojiLevel}
                onChange={(e) => set('emojiLevel', e.target.value as VoiceProfile['emojiLevel'])}
                className="input-field"
                aria-label="Emoji"
              >
                {VOICE_EMOJI_LEVELS.map((v) => (
                  <option key={v} value={v}>
                    {EMOJI_LABEL[v]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Say “po”" hint="Adds po to your greeting and sign-off.">
              <Switch
                on={profile.honorifics}
                onClick={() => set('honorifics', !profile.honorifics)}
                label="Use po and opo"
              />
            </Field>
          </div>

          {/* ── Preview: same pure functions the server precomputes with ──── */}
          <div className="mt-5 rounded-lg border p-3" style={{ borderColor: 'var(--m-line)' }}>
            <p
              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--m-sage-deep)' }}
            >
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              Preview
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--m-slate-3)' }}>
              Example numbers — your real replies always quote your live catalog.
            </p>
            <ul className="mt-2 space-y-2">
              {previews.map((t) => (
                <li key={t} className="text-xs leading-relaxed" style={{ color: 'var(--m-slate)' }}>
                  “{t}”
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={busy}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: 'var(--m-accent-deep)' }}
            >
              {dirty ? 'Save voice' : 'Save'}
            </button>
            <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
              Saving prepares your phrasings once — answering a couple costs
              nothing after that.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="block text-xs font-medium text-ink">{label}</p>
      <p className="mt-0.5 text-xs" style={{ color: 'var(--m-slate)' }}>
        {hint}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/* ─── Switch (WebsiteEditor idiom — mirrors autoreply-card.tsx) ───────────── */
function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors"
      style={{ background: on ? 'var(--m-orange)' : 'var(--m-line)' }}
    >
      <span
        aria-hidden
        className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
        style={{ transform: on ? 'translateX(18px)' : 'translateX(2px)' }}
      />
    </button>
  );
}
