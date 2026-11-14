'use client';

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';

import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';

import { useToast } from '@/app/_components/toast/toast-provider';
import { TAGLINE_MAX } from '@/lib/vendor-public-line';
import { updatePublicLine } from '../public-line-actions';
import { findFairHits } from '@/lib/fair-presentation';
import type { ClaimWord } from '@/lib/service-card-checks';
import { FairNote } from '@/app/_components/fair-note';

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
  fairWords = null,
}: {
  initialTagline: string | null;
  initialWebsite: string | null;
  /** 🚫 The claim words this shop may not use (`loadClaimWordsFor`); `null` = unread — the save asks again. */
  fairWords?: ClaimWord[] | null;
}) {
  const toast = useToast();
  const [, startTransition] = useTransition();

  const [tagline, setTagline] = useState(initialTagline ?? '');
  const [website, setWebsite] = useState(initialWebsite ?? '');
  const [pending, setPending] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const remaining = TAGLINE_MAX - tagline.length;
  // 🚫 FAIR PRESENTATION (owner 2026-11-08) — the tagline's note, live; Save is off while it is open. Pure, over the
  // list the page already read: typing costs no request. The server asks again (`updatePublicLine`).
  const fair = findFairHits([{ field: 'tagline', value: tagline }], { words: fairWords });

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
    <section className="mt-5" data-public-line-card>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--m-slate-2)]">
        Your line and your link (optional)
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
      <p className="mt-1 text-sm text-[color:var(--m-slate-2)]">
        The one line couples read under your name on your page and in search results.
      </p>

      <div className="mt-2 divide-y divide-[color:var(--m-line)]">
        <div className="py-3">
          <label htmlFor="public-line-tagline" className="block text-sm font-semibold text-ink">
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
          <p className="mt-1 text-sm tabular-nums text-[color:var(--m-slate-2)]">
            {remaining} character{remaining === 1 ? '' : 's'} left
          </p>
          <FairNote hits={fair} field="tagline" />
        </div>

        <div className="py-3">
          <div className="flex items-center gap-1">
            <label htmlFor="public-line-website" className="block text-sm font-semibold text-ink">
              Your website
            </label>
            <InfoTip label="" ariaLabel="About your website" align="start">
              Your own site, not your Setnayan page. Setnayan never puts a link off the app on your page — your
              enquiries stay in your Setnayan inbox. The first time you add this, Setnayan reads it once, for free, to
              suggest coverage you might be missing — you always confirm before anything is added.
            </InfoTip>
          </div>
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
          {/* Says where the value DOES and does not go, in the voice /v/[slug]
              already uses when it tells a shop previewing itself why its email
              and phone are absent. Saved, not published. The rest (no link off the app; the one free read
              that suggests coverage) sits behind the ⓘ beside the label. */}
          <p className="mt-1 text-sm text-[color:var(--m-slate-2)]">
            Couples don&rsquo;t see this. Leave blank if you don&rsquo;t have one.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <ActionButton
          tone="brand"
          icon={Check}
          label={pending ? 'Saving…' : 'Save'}
          onClick={save}
          waiting={pending}
          disabled={pending || fair.length > 0}
        />
        {justSaved && !pending ? (
          <span className="inline-flex items-center gap-1 text-sm text-[color:var(--m-slate-2)]" role="status">
            <Check className="h-4 w-4" strokeWidth={2} aria-hidden />
            Saved
          </span>
        ) : null}
      </div>
    </section>
  );
}
