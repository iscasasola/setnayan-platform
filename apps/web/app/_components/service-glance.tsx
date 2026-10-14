import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import type { GlanceLine, ServiceMood } from '@/lib/service-glance';

/**
 * 🎨 THE SERVICE GLANCE — one object at two sizes (owner "approve all",
 * 2026-10-14, DECISION_LOG 🎨; prototype
 * `Setnayan/prototypes/papic_easy_home_and_band_2026-10-14_fable.html`):
 *
 *   ServiceGlanceRow  — Home › Your services: name · status line (dot + words,
 *                       the count bold) · meter · two doors. The name and status
 *                       are a door to the service's page.
 *   ServiceGlanceBand — the service page's ONE band: the big count · "of N
 *                       bought" · Buy more · meter · the mood said · See N · when.
 *
 * Server components with no reads and no state: every word arrives worked out
 * (`lib/papic-glance.ts`), and the two buttons arrive as elements. The mood is
 * ALWAYS in words as well as in the dot/meter colour — never colour alone.
 * The shape is the template for every paid service; only Papic wears it today.
 */

export function GlanceDot({ mood }: { mood: ServiceMood }) {
  return <span aria-hidden className="sg-dot" data-mood={mood} />;
}

export function GlanceMeter({ mood, pct, label }: { mood: ServiceMood; pct: number; label: string }) {
  return (
    <div
      className="sg-meter"
      data-mood={mood}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <span style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

export function GlanceLineText({ line }: { line: GlanceLine }) {
  return (
    <>
      {line.lead ?? null}
      {line.strong ? <b>{line.strong}</b> : null}
      {line.tail ? line.tailWhileNext ? <span data-while-next="">{line.tail}</span> : line.tail : null}
    </>
  );
}

export function ServiceGlanceRow({
  href,
  name,
  brand,
  icon,
  mood,
  pct,
  line,
  meterLabel,
  actions,
  marker,
}: {
  href: string;
  name: string;
  brand?: string;
  icon: ReactNode;
  mood: ServiceMood;
  pct: number;
  line: GlanceLine;
  meterLabel: string;
  /** The row's doors (Buy more · See N), already filtered by NEVER TWICE. */
  actions?: ReactNode;
  /** A data-* hook for guards and walks, e.g. `{ 'data-home-service': 'papic' }`. */
  marker?: Record<string, string>;
}) {
  return (
    <div className="sg-row" data-mood={mood} {...marker}>
      <Link href={href} className="block min-w-0">
        <span className="sg-head">
          <span className="sg-mark" aria-hidden>
            {icon}
          </span>
          <span className="min-w-0">
            <span className="sg-name block truncate">{name}</span>
            {/* The Setnayan name, small under the plain one (owner d17). */}
            {brand ? <span className="sg-brand block truncate">{brand}</span> : null}
          </span>
          <ChevronRight aria-hidden className="sg-arrow h-[18px] w-[18px]" strokeWidth={1.9} />
        </span>
        <span className="sg-status" data-mood={mood} data-glance-status="">
          {mood !== 'plain' ? <GlanceDot mood={mood} /> : null}
          <span>
            <GlanceLineText line={line} />
          </span>
        </span>
        {mood !== 'plain' ? <GlanceMeter mood={mood} pct={pct} label={meterLabel} /> : null}
      </Link>
      {actions ? <div className="sg-acts">{actions}</div> : null}
    </div>
  );
}

export function ServiceGlanceBand({
  big,
  word,
  mood,
  pct,
  meterLabel,
  say,
  buy,
  see,
  when,
}: {
  /** The count, already formatted ("1,240"), or the status when there is none ("—"). */
  big: string;
  /** "credits left · of 2,000 bought" — what the count is. */
  word: string | null;
  mood: ServiceMood;
  pct: number;
  meterLabel: string;
  /** The mood in words, when it is not simply "on" (low · stopped). */
  say?: string | null;
  /** Buy more — the page's one main button. */
  buy?: ReactNode;
  /** See your N photos — or the waiting "No photos yet". */
  see?: ReactNode;
  /** "On from [date] · until 12 hours after your day". */
  when?: string | null;
}) {
  return (
    <section className="sg-band" data-mood={mood} data-glance-band="" aria-label="Your credits and photos">
      <div className="sg-row1">
        <div className="min-w-0">
          <div className="sg-big" data-mood={mood} data-glance-count="">
            {big}
          </div>
          {word ? <div className="sg-of">{word}</div> : null}
        </div>
        {buy ?? null}
      </div>
      {mood !== 'plain' ? <GlanceMeter mood={mood} pct={pct} label={meterLabel} /> : null}
      {say ? (
        <p className="sg-say" data-mood={mood}>
          {say}
        </p>
      ) : null}
      {see ? <div className="sg-see">{see}</div> : null}
      {when ? (
        <p className="sg-line">
          {mood !== 'plain' ? <GlanceDot mood={mood} /> : null}
          <span>{when}</span>
        </p>
      ) : null}
    </section>
  );
}
