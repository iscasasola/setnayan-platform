'use client';

/**
 * Card 16 Create Website · Programming tier (T-6m-ish · before STD video).
 *
 * Inline-completion card for the wedding-website setup step. Host picks a
 * slug + a visibility setting (Public · Unlisted · Private) right inside
 * the focus card · no jump out to `/dashboard/[eventId]/website`. The full
 * Website hub stays as a sibling surface where the host can later add the
 * hero photo · dress code · widget order · etc. — Card 16 covers the
 * load-bearing first pass that lets the wizard advance.
 *
 * UX shape:
 *   - Slug input with debounced live-check via /api/slugs/check (same
 *     endpoint as the Website hub's SlugField · reused convention).
 *   - Visibility radio group (Public · Unlisted · Private) with the
 *     current value pre-selected so a returning host who already picked
 *     visibility elsewhere doesn't accidentally reset it.
 *   - One [Save & continue] CTA that fires the wizard-specific server
 *     action: validates slug + visibility · writes events.slug +
 *     events.landing_page_visibility · stamps wizard_state.create_website
 *     · revalidatePath WITHOUT redirect (host stays on event home and
 *     the wizard transitions to Card 17 inline).
 *
 * Per hard NO-LINKS constraint (CLAUDE.md Sixth 2026-05-23 row): the card
 * never navigates the host away. A small footer note points to the
 * Website hub for later refinement — but it lives as informational copy,
 * not a primary CTA, and the wizard advances regardless of whether the
 * host visits the hub.
 *
 * Brand voice per [[feedback_setnayan_no_dev_text_post_launch]]: the
 * helper copy reads as polite editorial Filipino — no "TODO", no
 * "coming soon", no engineering jargon.
 */

import { useEffect, useRef, useState, useTransition } from 'react';
import {
  Check,
  X,
  AlertTriangle,
  Loader2,
  Globe,
  Lock,
  EyeOff,
  CheckCircle2,
} from 'lucide-react';
import { completeCreateWebsiteTask } from '../../wizard-actions';

type Visibility = 'public' | 'unlisted' | 'private';

type SlugCheckResult =
  | { status: 'current' }
  | { status: 'available'; slug: string }
  | { status: 'taken'; suggestions: string[] }
  | { status: 'invalid_format'; reason: string }
  | { status: 'reserved'; reason: string };

type Props = {
  eventId: string;
  /** events.slug · pre-populates the input when a host returns to the card. */
  initialSlug: string | null;
  /** events.landing_page_visibility · pre-selects the radio. */
  initialVisibility: Visibility;
};

export function CreateWebsiteCard({
  eventId,
  initialSlug,
  initialVisibility,
}: Props) {
  const [slug, setSlug] = useState(initialSlug ?? '');
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
  const [slugCheck, setSlugCheck] = useState<SlugCheckResult | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<number | null>(null);

  // Debounced live slug check · same shape as the Website hub's SlugField.
  // Skipped when the field is empty OR matches the current slug exactly
  // (returns 'current' so the badge reads green without a network call).
  useEffect(() => {
    if (!slug) {
      setSlugCheck(null);
      return;
    }
    if (slug === initialSlug) {
      setSlugCheck({ status: 'current' });
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    setCheckingSlug(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/slugs/check?slug=${encodeURIComponent(slug)}&entity_type=event&entity_id=${eventId}`,
          { method: 'GET' },
        );
        if (res.ok) {
          const json = (await res.json()) as SlugCheckResult;
          setSlugCheck(json);
        }
      } finally {
        setCheckingSlug(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [slug, eventId, initialSlug]);

  // Save is enabled when EITHER (a) slug is current (no change), the host
  // is just changing visibility OR (b) the live-check returned 'available'.
  // We never block on 'taken' / 'invalid_format' / 'reserved'.
  const slugIsAcceptable =
    slug === (initialSlug ?? '') ||
    slugCheck?.status === 'available' ||
    slugCheck?.status === 'current';
  const visibilityChanged = visibility !== initialVisibility;
  const slugChanged = slug !== (initialSlug ?? '');
  // A host with no slug yet MUST pick one — Card 16's primary job is
  // making the public URL exist. Empty slug + no changes blocks save.
  const slugIsRequired = !initialSlug && slug.length === 0;
  const canSave =
    !slugIsRequired &&
    slugIsAcceptable &&
    (slugChanged || visibilityChanged || !initialSlug);

  function handleSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setErrorMessage(null);
    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('slug', slug.trim().toLowerCase());
    formData.set('visibility', visibility);

    startTransition(async () => {
      try {
        await completeCreateWebsiteTask(formData);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't save your website settings. Try again.";
        setErrorMessage(message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Slug field · debounced live-check pattern · same UX as the
          Website hub's SlugField, laid out vertically for the wizard
          card's narrower column. */}
      <div className="space-y-2">
        <label
          htmlFor="wizard-website-slug"
          className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60"
        >
          <Globe aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Your wedding URL
        </label>
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-ink/45"
          >
            setnayan.com/
          </span>
          <input
            id="wizard-website-slug"
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="maria-and-juan"
            pattern="[a-z0-9-]{3,32}"
            className="w-full rounded-md border border-ink/15 bg-white py-2.5 pl-[8.5rem] pr-9 font-mono text-sm placeholder-ink/35 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
          />
          <SlugStatusBadge busy={checkingSlug} check={slugCheck} />
        </div>
        <SlugSuggestionsRow check={slugCheck} onPick={(s) => setSlug(s)} />
        <SlugStatusLine check={slugCheck} />
        <p className="text-xs text-ink/55">
          Three to thirty-two lowercase letters, numbers, or hyphens. You can
          change this later — old links keep working for ninety days.
        </p>
      </div>

      {/* Visibility radio group · three polite-voice options matching the
          Privacy editor at /website/privacy. Pre-selected from the current
          events.landing_page_visibility value so a returning host doesn't
          accidentally reset their pick. */}
      <fieldset className="space-y-2">
        <legend className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60">
          Who can see your page?
        </legend>
        <div className="space-y-2">
          <VisibilityOption
            value="public"
            currentValue={visibility}
            onChange={setVisibility}
            icon={Globe}
            title="Public"
            description="Anyone with the link can view. The page also appears in your wedding showcase after the day."
          />
          <VisibilityOption
            value="unlisted"
            currentValue={visibility}
            onChange={setVisibility}
            icon={EyeOff}
            title="Unlisted"
            description="Only people you share the link with can view. Hidden from your wedding showcase."
          />
          <VisibilityOption
            value="private"
            currentValue={visibility}
            onChange={setVisibility}
            icon={Lock}
            title="Private"
            description="Guests still see their own RSVP page; everyone else sees a quiet placeholder."
          />
        </div>
      </fieldset>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {errorMessage}
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={!canSave || isPending}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-mulberry px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-700 focus:outline-none focus:ring-2 focus:ring-mulberry focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            'Saving…'
          ) : (
            <>
              <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={2} />
              Save &amp; continue
            </>
          )}
        </button>
      </div>

      <p className="text-xs leading-relaxed text-ink/55">
        Once saved, your wedding website is live at the URL above. Your
        Website tab in the dashboard is where you&apos;ll later add a hero
        photo, dress code, and the rest of the polish.
      </p>
    </form>
  );
}

/** Single visibility radio · matches the radio-as-card pattern used by
 *  the Privacy editor at /website/privacy. Whole row is clickable for
 *  generous touch targets. */
function VisibilityOption({
  value,
  currentValue,
  onChange,
  icon: Icon,
  title,
  description,
}: {
  value: Visibility;
  currentValue: Visibility;
  onChange: (v: Visibility) => void;
  icon: typeof Globe;
  title: string;
  description: string;
}) {
  const isSelected = currentValue === value;
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
        isSelected
          ? 'border-terracotta bg-terracotta/5'
          : 'border-ink/15 bg-white hover:border-ink/30'
      }`}
    >
      <input
        type="radio"
        name="visibility"
        value={value}
        checked={isSelected}
        onChange={() => onChange(value)}
        className="mt-1 h-4 w-4 text-terracotta focus:ring-terracotta"
      />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Icon
            aria-hidden
            className={`h-4 w-4 ${isSelected ? 'text-terracotta' : 'text-ink/55'}`}
            strokeWidth={1.75}
          />
          <span className="text-sm font-semibold text-ink">{title}</span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-ink/65">{description}</p>
      </div>
    </label>
  );
}

/** Status badge inside the slug input · spinner during debounced check ·
 *  green check when available · red X when taken/reserved · amber alert
 *  on invalid format. Mirrors the Website hub's SlugField pattern. */
function SlugStatusBadge({
  busy,
  check,
}: {
  busy: boolean;
  check: SlugCheckResult | null;
}) {
  let tone = '';
  let Icon: typeof Check | null = null;
  let spin = false;
  if (busy) {
    tone = 'text-ink/45';
    Icon = Loader2;
    spin = true;
  } else if (!check) {
    Icon = null;
  } else if (check.status === 'available' || check.status === 'current') {
    tone = 'text-emerald-700';
    Icon = Check;
  } else if (check.status === 'taken' || check.status === 'reserved') {
    tone = 'text-rose-700';
    Icon = X;
  } else if (check.status === 'invalid_format') {
    tone = 'text-amber-700';
    Icon = AlertTriangle;
  }

  if (!Icon) return null;
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${tone}`}
    >
      <Icon className={`h-4 w-4 ${spin ? 'animate-spin' : ''}`} strokeWidth={2} />
    </span>
  );
}

function SlugStatusLine({ check }: { check: SlugCheckResult | null }) {
  if (!check) return null;
  if (check.status === 'available') {
    return <p className="mt-1 text-xs text-emerald-700">Available · ready to save.</p>;
  }
  if (check.status === 'current') {
    return <p className="mt-1 text-xs text-ink/55">That&rsquo;s your current URL.</p>;
  }
  if (check.status === 'taken') {
    return <p className="mt-1 text-xs text-rose-700">Taken — try one of these:</p>;
  }
  if (check.status === 'invalid_format') {
    return <p className="mt-1 text-xs text-amber-700">{check.reason}</p>;
  }
  if (check.status === 'reserved') {
    return <p className="mt-1 text-xs text-rose-700">{check.reason}</p>;
  }
  return null;
}

function SlugSuggestionsRow({
  check,
  onPick,
}: {
  check: SlugCheckResult | null;
  onPick: (slug: string) => void;
}) {
  if (!check || check.status !== 'taken' || check.suggestions.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {check.suggestions.map((s) => (
        <li key={s}>
          <button
            type="button"
            onClick={() => onPick(s)}
            className="rounded-full border border-ink/15 bg-cream px-3 py-1 font-mono text-xs hover:border-terracotta"
          >
            {s}
          </button>
        </li>
      ))}
    </ul>
  );
}
