'use client';

/**
 * HostServiceDetails — the DIY-parity editor for a MANUAL (off-platform)
 * vendor's package (owner doctrine 2026-06-11: pure-DIY planning must let the
 * host "add information about their order… what's included on their service.
 * link other services to it as well.").
 *
 * Renders in the workspace's "What's included" slot when the booking has no
 * vendor-authored package. Two host-authored fields, saved together:
 *   1. Inclusions — free-text lines ("Full-day coverage", "2 photographers").
 *      Flow to Compare's expandable inclusions cell.
 *   2. Also covers — plan-group links ("my caterer includes the cake").
 *      Flow to the Shortlist card's "✓ comes with" chips via the same
 *      linked-services pipeline marketplace vendors use.
 *
 * Marketplace vendors never see this editor — their package/links are
 * vendor-authored (the server action is manual-only too).
 */

import { useState, useTransition } from 'react';
import { Check, Link2, Loader2, Package as PackageIcon } from 'lucide-react';
import { updateHostServiceDetails } from '../actions';

export function HostServiceDetails({
  eventId,
  vendorId,
  initialInclusions,
  initialCovers,
  options,
}: {
  eventId: string;
  vendorId: string;
  initialInclusions: string[];
  initialCovers: string[];
  /** Plan groups this vendor may "also cover" (own group excluded server-side). */
  options: { id: string; label: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(initialInclusions.join('\n'));
  const [covers, setCovers] = useState<ReadonlySet<string>>(() => new Set(initialCovers));
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleCover(id: string) {
    setSaved(false);
    setCovers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onSave() {
    setErr(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set('event_id', eventId);
        fd.set('vendor_id', vendorId);
        fd.set('inclusions', text);
        for (const c of covers) fd.append('covers', c);
        await updateHostServiceDetails(fd);
        setSaved(true);
      } catch {
        setErr('Could not save — try again.');
      }
    });
  }

  return (
    <section
      aria-labelledby="included-heading"
      className="rounded-2xl border border-ink/10 bg-white/60 p-5 sm:p-6"
    >
      <h2
        id="included-heading"
        className="mb-1 flex items-center gap-2 font-display text-lg italic text-ink"
      >
        <PackageIcon aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
        What&apos;s included
      </h2>
      <p className="mb-4 text-xs text-ink/55">
        You booked them outside Setnayan — describe the package so your plan
        stays complete.
      </p>

      <label
        htmlFor="host-inclusions"
        className="block text-xs font-medium uppercase tracking-[0.08em] text-ink/65"
      >
        Inclusions <span className="font-normal normal-case text-ink/45">(one per line)</span>
      </label>
      <textarea
        id="host-inclusions"
        rows={4}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        placeholder={'e.g.\nFull-day coverage\n2 photographers\nSame-day edit'}
        className="mt-1.5 w-full rounded-lg border border-ink/15 bg-cream px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none"
        disabled={pending}
      />

      <p className="mt-4 flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.08em] text-ink/65">
        <Link2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.9} />
        Also covers <span className="font-normal normal-case text-ink/45">(optional)</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = covers.has(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => toggleCover(o.id)}
              aria-pressed={on}
              disabled={pending}
              className={`inline-flex min-h-[32px] items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                on
                  ? 'border-mulberry/50 bg-mulberry/10 text-mulberry'
                  : 'border-ink/15 text-ink/60 hover:border-ink/30 hover:text-ink'
              }`}
            >
              {on ? <Check aria-hidden className="h-3 w-3" strokeWidth={2.5} /> : null}
              {o.label}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] text-ink/45">
        Covered categories show on your shortlist card as &ldquo;✓ comes
        with&rdquo; — so you remember this package has them handled.
      </p>

      {err ? (
        <p role="alert" className="mt-3 text-[11px] text-danger-900">
          {err}
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-md border border-terracotta/40 bg-mulberry px-4 text-sm font-medium text-cream transition-colors hover:bg-mulberry-700 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : null}
          {pending ? 'Saving…' : 'Save details'}
        </button>
        {saved ? (
          <span className="inline-flex items-center gap-1 text-xs text-success-800">
            <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.2} />
            Saved — your card and Compare are up to date.
          </span>
        ) : null}
      </div>
    </section>
  );
}
