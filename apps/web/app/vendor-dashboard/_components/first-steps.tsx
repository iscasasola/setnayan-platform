import Link from 'next/link';
import { ArrowRight, BadgeCheck, Check, Clock, Lock } from 'lucide-react';

import type { FirstStep, FirstStepsRail } from '@/lib/vendor-first-steps';

/**
 * "First steps" — the vendor's order of operations, at the top of the Overview
 * until their shop is approved.
 *
 * Renders exactly one recommended step at full weight; the rest are a check, a
 * clock, or a dimmed line. See `lib/vendor-first-steps.ts` for the ordering
 * rules and why later steps stay clickable (a dimmed step is a recommendation
 * not to bother yet — never a door that was open yesterday and is shut today).
 *
 * Server component: nothing here needs state, and the whole rail recomputes on
 * the revalidate that every step's own save already fires.
 */
export function VendorFirstSteps({ rail }: { rail: FirstStepsRail }) {
  // Verified shops have no use for this — the page gates on the same flag, but
  // guarding here too means a future caller can't accidentally show a live shop
  // a getting-started rail.
  if (rail.complete) return null;

  return (
    <section aria-labelledby="first-steps-heading" className="mt-6">
      <div className="sn-tile p-5 sm:p-6">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 id="first-steps-heading" className="text-base font-semibold" style={{ color: 'var(--m-ink)' }}>
              First steps
            </h2>
            <p className="max-w-[62ch] text-xs" style={{ color: 'var(--m-slate)' }}>
              Do these in order. Nothing you build is visible to a stranger yet —
              your page goes live the day Setnayan approves your shop.
            </p>
          </div>
          <span
            className="shrink-0 rounded-full px-2.5 py-1 font-mono text-[11px] tabular-nums"
            style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-deep)' }}
          >
            {rail.doneCount} of {rail.total} done
          </span>
        </header>

        <ol className="space-y-2.5">
          {rail.steps.map((step) => (
            <StepRow key={step.key} step={step} />
          ))}
        </ol>
      </div>
    </section>
  );
}

function StepRow({ step }: { step: FirstStep }) {
  const isNow = step.state === 'now';
  const isDone = step.state === 'done';
  const isWaiting = step.state === 'waiting';

  return (
    <li
      className="flex gap-3 rounded-xl border p-3.5 transition-colors sm:p-4"
      style={{
        borderColor: isNow ? 'var(--m-orange-3)' : 'var(--m-line)',
        background: isNow
          ? 'var(--m-orange-4)'
          : isWaiting
            ? 'color-mix(in srgb, var(--m-sage-deep) 6%, transparent)'
            : 'transparent',
        opacity: step.state === 'later' ? 0.55 : 1,
      }}
    >
      <Marker step={step} />

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p
            className="text-sm font-semibold"
            style={{
              color: isDone ? 'var(--m-slate)' : 'var(--m-ink)',
              textDecoration: isDone ? 'line-through' : undefined,
            }}
          >
            {step.title}
          </p>
          {step.meter ? (
            <span
              className="font-mono text-[11px] tabular-nums"
              style={{ color: 'var(--m-slate-3)' }}
            >
              {step.meter}
            </span>
          ) : null}
          {isNow ? (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ background: 'var(--m-orange-deep)', color: 'white' }}
            >
              Do this now
            </span>
          ) : null}
          {isWaiting ? (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ background: 'var(--m-sage-deep)', color: 'white' }}
            >
              With Setnayan
            </span>
          ) : null}
        </div>

        {/* The body earns its space only where the vendor is being asked to act
            or told to wait. A done step is a tick; a later step is a title. */}
        {isNow || isWaiting ? (
          <p className="max-w-[62ch] text-xs leading-relaxed" style={{ color: 'var(--m-slate)' }}>
            {step.body}
          </p>
        ) : null}

        {/* The one genuinely enforced gate in the flow, in the server's own
            words — a vendor who reads this has read the real refusal. */}
        {isNow && step.blockedBy ? (
          <p
            className="flex items-center gap-1.5 text-xs font-medium"
            style={{ color: 'var(--m-orange-deep)' }}
          >
            <Lock aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            Can&rsquo;t send yet — {step.blockedBy.toLowerCase()}.
          </p>
        ) : null}

        {isNow && step.href && step.cta ? (
          <div className="pt-1">
            <Link
              href={step.href}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90"
              style={{ background: 'var(--m-orange-deep)', color: 'white' }}
            >
              {step.cta}
              <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </div>
        ) : null}

        {/* A later step is dimmed, not disabled. It stays reachable because it
            always was — the rail advises an order, it doesn't withdraw ability. */}
        {step.state === 'later' && step.href ? (
          <Link
            href={step.href}
            className="inline-block text-xs underline underline-offset-2"
            style={{ color: 'var(--m-slate)' }}
          >
            Go there anyway
          </Link>
        ) : null}
      </div>
    </li>
  );
}

function Marker({ step }: { step: FirstStep }) {
  const base =
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums';

  if (step.state === 'done') {
    return (
      <span
        aria-hidden
        className={base}
        style={{ background: 'var(--m-sage-deep)', color: 'white' }}
      >
        <Check className="h-4 w-4" strokeWidth={2.5} />
      </span>
    );
  }
  if (step.state === 'waiting') {
    return (
      <span
        aria-hidden
        className={base}
        style={{
          background: 'color-mix(in srgb, var(--m-sage-deep) 18%, transparent)',
          color: 'var(--m-sage-deep)',
        }}
      >
        <Clock className="h-4 w-4" strokeWidth={2} />
      </span>
    );
  }
  if (step.key === 'go_live') {
    return (
      <span
        aria-hidden
        className={base}
        style={{
          background: 'color-mix(in srgb, var(--m-orange-deep) 12%, transparent)',
          color: 'var(--m-orange-deep)',
        }}
      >
        <BadgeCheck className="h-4 w-4" strokeWidth={2} />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={base}
      style={
        step.state === 'now'
          ? { background: 'var(--m-orange-deep)', color: 'white' }
          : { background: 'var(--m-line)', color: 'var(--m-slate)' }
      }
    >
      {step.n}
    </span>
  );
}
