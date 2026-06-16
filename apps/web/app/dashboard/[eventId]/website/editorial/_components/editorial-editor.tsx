'use client';

// ============================================================================
// Editorial editor (iteration 0046) — one page where the couple controls their
// post-event "front-page story": the words, which photos/inputs to bring in,
// and which features show. Wires to the existing piece-editors (living hero,
// photos, thank-you note) and writes content + section visibility to draft_json.
// ============================================================================

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { saveEditorial, type EditorialEditorInput } from '../actions';
import type { EditorialSections } from '@/app/[slug]/_components/editorial/data';

const SECTIONS: Array<{ key: keyof EditorialSections; label: string; help: string }> = [
  { key: 'byTheNumbers', label: 'By the Numbers', help: 'Your day in stats — guests, vendors, time saved.' },
  { key: 'gallery', label: 'Photo gallery', help: 'The shared photos from the day.' },
  { key: 'reviews', label: 'Guest wishes', help: 'What your guests, vendors, and you said.' },
  { key: 'team', label: 'Vendor team', help: 'The suppliers who made the day.' },
  { key: 'poweredBy', label: 'Powered by Setnayan', help: 'The Setnayan services you used.' },
  { key: 'liveWall', label: 'Live Photo Wall', help: 'The day’s candid photo wall, if you have it.' },
  { key: 'fromTheCouple', label: 'From the couple', help: 'Your thank-you note to guests.' },
];

type FieldProps = {
  label: string;
  help?: string;
  children: React.ReactNode;
};
function Field({ label, help, children }: FieldProps) {
  return (
    <label className="block">
      <span className="font-display text-base italic text-ink">{label}</span>
      {help ? <span className="mt-0.5 block text-xs text-ink/55">{help}</span> : null}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

const inputCls =
  'w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-burgundy/50';

export function EditorialEditor({
  eventId,
  slug,
  initial,
}: {
  eventId: string;
  slug: string | null;
  initial: EditorialEditorInput;
}) {
  const [form, setForm] = useState<EditorialEditorInput>(initial);
  const [phase, setPhase] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof EditorialEditorInput>(k: K, v: EditorialEditorInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const toggle = (k: keyof EditorialSections) =>
    setForm((f) => ({ ...f, sections: { ...f.sections, [k]: !f.sections[k] } }));

  const onSave = async (publish: boolean) => {
    setPhase('saving');
    setError(null);
    try {
      const r = await saveEditorial(eventId, { ...form, publish });
      if (!r.ok) throw new Error(r.error);
      set('publish', publish);
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
      setPhase('error');
    }
  };

  const card = 'rounded-2xl border border-ink/10 bg-cream/40 p-5 sm:p-6';
  const linkCard =
    'flex items-center justify-between gap-3 rounded-xl border border-ink/15 bg-white px-4 py-3 text-sm transition hover:border-burgundy/40 hover:bg-burgundy/5';

  return (
    <div className="space-y-6">
      {/* Bring-in inputs (existing piece-editors) */}
      <section className={card}>
        <h2 className="font-display text-lg italic text-ink">What goes in</h2>
        <p className="mt-0.5 text-sm text-ink/60">
          The pieces below have their own editors. Save your text here first, then open one.
        </p>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          {[
            { href: `/dashboard/${eventId}/website/living-hero`, label: 'Living hero', sub: 'Boomerang or photo' },
            { href: `/dashboard/${eventId}/website/our-photos`, label: 'Photos', sub: 'The gallery' },
            { href: `/dashboard/${eventId}/website/special-message`, label: 'Thank-you note', sub: 'From the couple' },
          ].map((l) => (
            <Link key={l.href} href={l.href} className={linkCard}>
              <span>
                <span className="block font-medium text-ink">{l.label}</span>
                <span className="block text-xs text-ink/55">{l.sub}</span>
              </span>
              <ArrowUpRight aria-hidden className="h-4 w-4 flex-none text-ink/40" strokeWidth={1.75} />
            </Link>
          ))}
        </div>
      </section>

      {/* Words */}
      <section className={card}>
        <h2 className="font-display text-lg italic text-ink">The words</h2>
        <p className="mt-0.5 text-sm text-ink/60">
          These are written from your wedding details. Edit anything — or clear a field to let us
          rewrite it for you.
        </p>
        <div className="mt-4 space-y-4">
          <Field label="Eyebrow" help="The small line above the headline.">
            <input
              className={inputCls}
              value={form.superKicker}
              onChange={(e) => set('superKicker', e.target.value)}
              placeholder="A big-hearted celebration"
            />
          </Field>
          <Field label="Headline">
            <input
              className={inputCls}
              value={form.headline}
              onChange={(e) => set('headline', e.target.value)}
              placeholder="Maria & Juan Are Married"
            />
          </Field>
          <Field label="Sub-headline" help="The italic line under the headline.">
            <input
              className={inputCls}
              value={form.deck}
              onChange={(e) => set('deck', e.target.value)}
              placeholder="After seven years together, married at last…"
            />
          </Field>
          <Field label="Your story" help="Your front-page write-up. Leave blank to keep it photo-led.">
            <textarea
              className={`${inputCls} min-h-[120px] resize-y`}
              value={form.leadParagraphs}
              onChange={(e) => set('leadParagraphs', e.target.value)}
              placeholder="Write in a few short paragraphs — leave a blank line between each."
            />
          </Field>
          <Field label="Pull quote" help="One line, set large in the story.">
            <input
              className={inputCls}
              value={form.pullQuote}
              onChange={(e) => set('pullQuote', e.target.value)}
              placeholder="And on the day, everything was just set."
            />
          </Field>
          <Field label="Byline">
            <input
              className={inputCls}
              value={form.byline}
              onChange={(e) => set('byline', e.target.value)}
              placeholder="By the Setnayan Desk"
            />
          </Field>
        </div>
      </section>

      {/* Features */}
      <section className={card}>
        <h2 className="font-display text-lg italic text-ink">What shows</h2>
        <p className="mt-0.5 text-sm text-ink/60">
          Turn any feature off to keep it off your editorial. The masthead, headline, and hero always show.
        </p>
        <div className="mt-4 space-y-1.5">
          {SECTIONS.map((s) => {
            const on = form.sections[s.key] !== false;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggle(s.key)}
                aria-pressed={on}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-ink/10 bg-white px-4 py-3 text-left transition hover:border-ink/25"
              >
                <span>
                  <span className="block text-sm font-medium text-ink">{s.label}</span>
                  <span className="block text-xs text-ink/55">{s.help}</span>
                </span>
                <span
                  className={`relative h-6 w-11 flex-none rounded-full transition ${on ? 'bg-burgundy' : 'bg-ink/20'}`}
                  aria-hidden
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Save bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          {phase === 'done' ? (
            <span className="font-medium text-green-700">
              Saved{form.publish ? ' & published' : ' as a draft'}.
            </span>
          ) : phase === 'error' ? (
            <span className="font-medium text-red-700">{error ?? 'Could not save.'}</span>
          ) : slug ? (
            <Link
              href={`/${slug}?phase=editorial`}
              className="text-ink/60 underline-offset-4 hover:text-burgundy hover:underline"
              target="_blank"
            >
              Preview your editorial ↗
            </Link>
          ) : null}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={phase === 'saving'}
            onClick={() => onSave(false)}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-ink/15 bg-white px-5 text-sm font-medium text-ink/75 transition hover:bg-cream disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            type="button"
            disabled={phase === 'saving'}
            onClick={() => onSave(true)}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-burgundy/20 bg-burgundy px-5 text-sm font-semibold text-cream transition hover:bg-burgundy/90 disabled:opacity-50"
          >
            {phase === 'saving' ? 'Saving…' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}
