'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Lock } from 'lucide-react';
import { Field } from '@/app/_components/forms/field';
import { SubmitButton } from '@/app/_components/submit-button';
import { FileUpload } from '@/app/_components/file-upload';
import { commitVendorService } from '../actions';

/**
 * ServiceWizard — the guided "create a service" flow (vendor Services builder
 * redesign, owner 2026-06-20). One <form> posting to commitVendorService (the
 * single atomic save). All step sections live in the DOM (so every field
 * submits); only the active one is shown.
 *
 * The listing is the MENU; the per-couple price/terms are negotiated in the
 * inquiry (owner 2026-06-20). Two things the listing does NOT carry anymore:
 *   • Availability/limits live on a CALENDAR the vendor names + assigns
 *     services to (owner 2026-06-20 "the calendar has the limits, not the
 *     service") — not a per-service field here.
 *   • Payment plans are offered during negotiation (owner 2026-06-20), not
 *     declared on the listing.
 * So the card is simple: a photo + category/title → from-price → perk →
 * comes-with. Publish needs a category (route), a PHOTO, and a perk; price is
 * optional (quote-on-request).
 */

type OtherCategory = { value: string; label: string };

export function ServiceWizard({
  categoryValue,
  categoryLabel,
  otherCategories,
  vendorProfileId,
}: {
  categoryValue: string;
  categoryLabel: string;
  otherCategories: OtherCategory[];
  vendorProfileId: string;
}) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [perk, setPerk] = useState('');
  const [linkCount, setLinkCount] = useState(0);
  const [photoKey, setPhotoKey] = useState('');

  // Step sequence — the links step prunes out when the vendor has no other
  // categories to bundle.
  const steps = useMemo(() => {
    const s: { id: string; label: string }[] = [
      { id: 'what', label: 'What you offer' },
      { id: 'price', label: 'Pricing' },
      { id: 'perk', label: 'Setnayan Exclusive' },
    ];
    if (otherCategories.length > 0) s.push({ id: 'links', label: "What's included" });
    s.push({ id: 'review', label: 'Review & publish' });
    return s;
  }, [otherCategories.length]);

  const clamped = Math.min(step, steps.length - 1);
  const activeId = steps[clamped]?.id ?? 'what';
  const isLast = clamped === steps.length - 1;
  const hasPhoto = photoKey.trim().length > 0;
  const hasPerk = perk.trim().length > 0;
  const canPublish = hasPhoto && hasPerk;

  const show = (id: string) => (activeId === id ? {} : { hidden: true });

  return (
    <form action={commitVendorService} className="space-y-5">
      <input type="hidden" name="category" value={categoryValue} />

      {/* Progress */}
      <ol className="flex flex-wrap gap-1.5">
        {steps.map((s, i) => (
          <li
            key={s.id}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
              i === clamped
                ? 'bg-ink text-cream'
                : i < clamped
                  ? 'bg-ink/10 text-ink/70'
                  : 'bg-ink/[0.04] text-ink/45'
            }`}
          >
            {i + 1}. {s.label}
          </li>
        ))}
      </ol>

      {/* 1 · What you offer — category + cover photo + title */}
      <section {...show('what')} className="space-y-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink/45">Category</p>
          <p className="mt-1 flex items-center gap-2 text-lg font-medium text-ink">
            <Lock aria-hidden className="h-4 w-4 text-ink/40" strokeWidth={1.75} />
            {categoryLabel}
          </p>
          <p className="mt-1 text-sm text-ink/55">This is what you&rsquo;re listing. Pick a different one from the Services page if it&rsquo;s wrong.</p>
        </div>
        <Field
          label="Cover photo"
          htmlFor="primary_photo_r2_key"
          help="Couples see this on your service card — it's the first thing they notice. PNG, JPEG, or WebP up to 5 MB. Required to publish."
        >
          <FileUpload
            bucket="media"
            pathPrefix={`vendors/${vendorProfileId}/services`}
            name="primary_photo_r2_key"
            onChange={(v) => setPhotoKey(typeof v === 'string' ? v : '')}
            maxSizeMB={5}
            acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
            variant="square"
          />
        </Field>
        <Field label="Listing title (optional)" htmlFor="title">
          <input
            id="title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder={`e.g. "${categoryLabel} — Full Day"`}
            className="input-field"
          />
        </Field>
      </section>

      {/* 2 · Pricing */}
      <section {...show('price')} className="space-y-3">
        <Field label="Starting price (₱)" htmlFor="starting_price_php">
          <input
            id="starting_price_php"
            name="starting_price_php"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            type="number"
            min={0}
            step={1}
            placeholder="Leave blank for quote-on-request"
            className="input-field"
          />
        </Field>
        <p className="text-xs text-ink/55">A &ldquo;from&rdquo; price. The real number is quoted in each couple&rsquo;s inquiry.</p>
        <Field label="Crew size (optional)" htmlFor="crew_size">
          <input id="crew_size" name="crew_size" type="number" min={0} step={1} className="input-field" />
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink/75">
          <input type="checkbox" name="crew_meal_required" className="h-4 w-4 accent-terracotta" />
          Crew meal required
        </label>
        <details className="rounded-lg border border-ink/10 p-3">
          <summary className="cursor-pointer text-sm font-medium text-ink/75">Pricing rules (advanced) — optional</summary>
          <div className="mt-3 space-y-3">
            <p className="text-xs text-ink/55">
              Starting points the platform uses — the real numbers are set in each couple&rsquo;s inquiry. Skip these and you can still publish.
            </p>
            <Field label="Per extra guest (₱)" htmlFor="added_pax_price_php">
              <input id="added_pax_price_php" name="added_pax_price_php" type="number" min={0} step={1} className="input-field" />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Recommended lead (months)" htmlFor="recommended_lead_time_months">
                <input id="recommended_lead_time_months" name="recommended_lead_time_months" type="number" min={0} step="0.5" className="input-field" />
              </Field>
              <Field label="Last-minute ends (months)" htmlFor="last_minute_end_months">
                <input id="last_minute_end_months" name="last_minute_end_months" type="number" min={0} step={1} className="input-field" />
              </Field>
              <Field label="Last-minute surcharge (%)" htmlFor="last_minute_surcharge_pct">
                <input id="last_minute_surcharge_pct" name="last_minute_surcharge_pct" type="number" min={0} max={100} step={1} className="input-field" />
              </Field>
            </div>
          </div>
        </details>
      </section>

      {/* 3 · Setnayan Exclusive perk */}
      <section {...show('perk')} className="space-y-2">
        <Field label="Your Setnayan Exclusive" htmlFor="exclusive_perk_text">
          <input
            id="exclusive_perk_text"
            name="exclusive_perk_text"
            value={perk}
            onChange={(e) => setPerk(e.target.value)}
            maxLength={500}
            placeholder="e.g. Free engagement mini-shoot for Setnayan couples"
            className="input-field"
          />
        </Field>
        <p className="text-sm text-ink/55">
          One thing couples only get by booking you through Setnayan. This is required to <span className="font-medium text-ink">publish</span> — you can save a draft without it.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {['Free add-on', 'Priority date hold', 'Setnayan-only rate', 'Complimentary upgrade'].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setPerk(c)}
              className="rounded-full border border-ink/15 bg-cream px-2.5 py-1 text-xs text-ink/70 hover:bg-ink/5"
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      {/* 4 · What's included (links) — only when the vendor offers other categories */}
      {otherCategories.length > 0 ? (
        <section {...show('links')} className="space-y-2">
          <p className="text-sm font-medium text-ink">What&rsquo;s included with this service?</p>
          <p className="text-sm text-ink/55">Pick other things you offer that come bundled — couples see &ldquo;comes with&rdquo; on your card. Up to 6.</p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {otherCategories.map((c) => (
              <label key={c.value} className="flex items-center gap-2 rounded-lg border border-ink/10 px-3 py-2 text-sm text-ink/80">
                <input
                  type="checkbox"
                  name="linked"
                  value={c.value}
                  onChange={(e) => setLinkCount((n) => n + (e.target.checked ? 1 : -1))}
                  className="h-4 w-4 accent-terracotta"
                />
                {c.label}
              </label>
            ))}
          </div>
        </section>
      ) : null}

      {/* 5 · Review & publish */}
      <section {...show('review')} className="space-y-3">
        <p className="text-sm font-medium text-ink">Review</p>
        <dl className="space-y-1.5 rounded-lg border border-ink/10 bg-cream p-4 text-sm">
          <Recap k="Category" v={categoryLabel} />
          <Recap k="Cover photo" v={hasPhoto ? 'Added' : '— none yet (required to publish)'} />
          {title ? <Recap k="Title" v={title} /> : null}
          <Recap k="Price" v={price ? `₱${price}` : 'Quote on request'} />
          <Recap k="Setnayan Exclusive" v={perk || '— not set (required to publish)'} />
          {linkCount > 0 ? <Recap k="Comes with" v={`${linkCount} service${linkCount === 1 ? '' : 's'}`} /> : null}
        </dl>
        <p className="text-xs text-ink/55">
          Availability is set on your <span className="font-medium text-ink">Calendar</span>, and payment terms are agreed in each couple&rsquo;s inquiry — so this listing stays simple.
        </p>
        {!canPublish ? (
          <p className="rounded-md bg-warn-50 px-3 py-2 text-xs text-warn-900">
            {!hasPhoto && !hasPerk
              ? 'Add a cover photo (step 1) and a Setnayan Exclusive (step 3) to publish — or save as a draft for now.'
              : !hasPhoto
                ? 'Add a cover photo (step 1) to publish — or save as a draft for now.'
                : 'Add a Setnayan Exclusive (step 3) to publish — or save as a draft for now.'}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <SubmitButton
            name="publish"
            value="true"
            disabled={!canPublish}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-terracotta px-5 py-2.5 text-sm font-semibold text-cream hover:bg-terracotta-600 disabled:opacity-50"
            pendingLabel="Publishing…"
          >
            <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
            Publish service
          </SubmitButton>
          <SubmitButton
            name="publish"
            value="false"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-ink/20 px-5 py-2.5 text-sm font-medium text-ink/75 hover:bg-ink/5"
            pendingLabel="Saving…"
          >
            Save as draft
          </SubmitButton>
        </div>
      </section>

      {/* Nav chrome (hidden on the final step, which has its own submit buttons) */}
      {!isLast ? (
        <div className="flex items-center justify-between border-t border-ink/10 pt-4">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={clamped === 0}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-ink/60 hover:bg-ink/5 disabled:opacity-40"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Back
          </button>
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream hover:bg-ink/90"
          >
            Continue
            <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      ) : null}
    </form>
  );
}

function Recap({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink/55">{k}</dt>
      <dd className="text-right font-medium text-ink">{v}</dd>
    </div>
  );
}
