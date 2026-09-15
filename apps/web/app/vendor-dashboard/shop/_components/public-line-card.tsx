'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2 } from 'lucide-react';

import { useToast } from '@/app/_components/toast/toast-provider';
import { TAGLINE_MAX } from '@/lib/vendor-public-line';
import { updatePublicLine } from '../public-line-actions';

/**
 * My Shop → Business Profile → "Your line and your link".
 *
 * The missing writer for `vendor_profiles.tagline` and `vendor_profiles.website`.
 * The public shop page, the Explore cards and three v1 API routes have read
 * both since long before this card; the only form that ever posted them was
 * retired 2026-07-05. A vendor who claimed a seeded shop was stuck with
 * whatever tagline an admin typed for them, and could not publish their own
 * website at all.
 *
 * ── BOTH INPUTS ALWAYS RENDER, AND THAT IS THE CONTRACT ─────────────────────
 * The action decides what to write with `formData.has()`, which is only a
 * sound presence test because these are text inputs that always post. If a
 * future variant of this card drops one of the fields, the action correctly
 * leaves that column alone — but it must not render a field and then withhold
 * it from the submission, because "present and empty" is how a vendor CLEARS
 * the value. Submitting the whole form is therefore deliberate.
 */
export function PublicLineCard({
  initialTagline,
  initialWebsite,
}: {
  initialTagline: string | null;
  initialWebsite: string | null;
}) {
  const toast = useToast();
  const [, startTransition] = useTransition();

  const [tagline, setTagline] = useState(initialTagline ?? '');
  const [website, setWebsite] = useState(initialWebsite ?? '');
  const [pending, setPending] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const remaining = TAGLINE_MAX - tagline.length;

  function save() {
    const fd = new FormData();
    fd.set('tagline', tagline);
    fd.set('website', website);
    setPending(true);
    setJustSaved(false);
    startTransition(async () => {
      const res = await updatePublicLine(null, fd);
      setPending(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // Echo the SERVER's values back, not the typed ones — the tagline may
      // have been trimmed/truncated and the website normalized to an absolute
      // https URL. Showing what was actually stored avoids a card that
      // disagrees with the public page.
      setTagline(res.tagline ?? '');
      setWebsite(res.website ?? '');
      setJustSaved(true);
    });
  }

  return (
    <section
      className="mt-3 rounded-xl border p-4"
      style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)' }}
    >
      <h3 className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
        Your line and your link{' '}
        <span className="font-normal" style={{ color: 'var(--m-slate)' }}>
          (optional)
        </span>
      </h3>
      {/*
        SUP-30 · THIS SENTENCE USED TO PUT THE WEBSITE INSIDE "what couples read".
        It said: "…on your page and in search results — and your own website, if
        you have one." Couples never see it, and that is a RULING, not an
        oversight — owner 2026-09-11, DECISION_LOG "SEVEN SUPPLIER-SIDE
        QUESTIONS" Q3: "Never show links", no tappable website or social link on
        the shop page, before or after booking. `/v/[slug]` selects `website` and
        deliberately never renders it, and `lib/no-door-out-of-the-app.test.ts`
        fails if a website href reaches any couple-facing surface.

        So the shop was being told its website is part of its public line while
        the product is built, on purpose, never to show it. The tagline half of
        the sentence was true; only the website half was not.
      */}
      <p className="mt-0.5 text-xs" style={{ color: 'var(--m-slate)' }}>
        The one line couples read under your name on your page and in search results.
      </p>

      <div className="mt-3 space-y-3">
        <div>
          <label
            htmlFor="public-line-tagline"
            className="block text-xs font-medium"
            style={{ color: 'var(--m-ink)' }}
          >
            Your one line
          </label>
          <input
            id="public-line-tagline"
            type="text"
            value={tagline}
            maxLength={TAGLINE_MAX}
            onChange={(e) => {
              setTagline(e.currentTarget.value);
              setJustSaved(false);
            }}
            placeholder="Documentary wedding films, shot across Luzon"
            className="input-field mt-1 w-full"
          />
          <p className="mt-1 text-xs tabular-nums" style={{ color: 'var(--m-slate)' }}>
            {remaining} character{remaining === 1 ? '' : 's'} left
          </p>
        </div>

        <div>
          <label
            htmlFor="public-line-website"
            className="block text-xs font-medium"
            style={{ color: 'var(--m-ink)' }}
          >
            Your website
          </label>
          <input
            id="public-line-website"
            // Deliberately type="text", not type="url": the field accepts a
            // bare `yourstudio.com` and the server adds https://. type="url"
            // would have the browser reject that before it is ever sent.
            type="text"
            inputMode="url"
            value={website}
            onChange={(e) => {
              setWebsite(e.currentTarget.value);
              setJustSaved(false);
            }}
            placeholder="yourstudio.com"
            className="input-field mt-1 w-full"
          />
          <p className="mt-1 text-xs" style={{ color: 'var(--m-slate)' }}>
            Your own site, not your Setnayan page. Leave blank if you don&rsquo;t have one.
          </p>
          {/* Says where the value DOES and does not go, in the voice /v/[slug]
              already uses when it tells a shop previewing itself why its email
              and phone are absent. Saved, not published. */}
          <p className="mt-1 text-xs" style={{ color: 'var(--m-slate)' }}>
            Couples don&rsquo;t see this. Setnayan never puts a link off the app on
            your page — your enquiries stay in your Setnayan inbox.
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--m-slate)' }}>
            The first time you add this, Setnayan reads it once, for free, to
            suggest coverage you might be missing — you always confirm before
            anything is added.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: 'var(--m-accent-deep)' }}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : null}
          Save
        </button>
        {justSaved && !pending ? (
          <span
            className="inline-flex items-center gap-1 text-xs"
            style={{ color: 'var(--m-slate)' }}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2} />
            Saved
          </span>
        ) : null}
      </div>
    </section>
  );
}
