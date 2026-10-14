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
  meter = true,
  say = null,
  pending = false,
}: {
  /** The row's door to its page — null draws the row without one (the store shell). */
  href: string | null;
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
  /** Draw the meter — only where there is a true total (Papic's credits). */
  meter?: boolean;
  /** ✅ The row's one quiet line under the status (services prototype `.say`). */
  say?: string | null;
  /** Bought, waiting for payment — the dashed edge. */
  pending?: boolean;
}) {
  const body = (
    <>
        <span className="sg-head">
          <span className="sg-mark" aria-hidden>
            {icon}
          </span>
          <span className="min-w-0">
            <span className="sg-name block truncate">{name}</span>
            {/* The Setnayan name, small under the plain one (owner d17). */}
            {brand ? <span className="sg-brand block truncate">{brand}</span> : null}
          </span>
          {href ? <ChevronRight aria-hidden className="sg-arrow h-[18px] w-[18px]" strokeWidth={1.9} /> : null}
        </span>
        <span className="sg-status" data-mood={mood} data-glance-status="">
          {mood !== 'plain' ? <GlanceDot mood={mood} /> : null}
          <span>
            <GlanceLineText line={line} />
          </span>
        </span>
        {meter && mood !== 'plain' ? <GlanceMeter mood={mood} pct={pct} label={meterLabel} /> : null}
        {say ? <span className="sg-say-row block">{say}</span> : null}
    </>
  );
  return (
    <div className="sg-row" data-mood={mood} data-pending={pending ? '' : undefined} {...marker}>
      {href ? (
        <Link href={href} className="block min-w-0">
          {body}
        </Link>
      ) : (
        <div className="block min-w-0">{body}</div>
      )}
      {actions ? <div className="sg-acts">{actions}</div> : null}
    </div>
  );
}

/**
 * ✅ THE SLIM ROW — a service not added yet (owner "approve all", 2026-10-14,
 * services prototype `rowSlim`): one line — the mark, the plain name with the
 * brand under, the PRICE under that — and Add on the right. Never a meter, never
 * a mood line. Bought and waiting for payment: the same size, the dashed edge,
 * the waiting words in place of the price, no Add. The name is the door to the
 * service's page (what it gives); Add opens the sheet.
 */
export function ServiceSlimRow({
  href,
  name,
  brand,
  icon,
  lead,
  price,
  tail,
  add,
  pending = false,
  marker,
}: {
  href: string | null;
  name: string;
  brand?: string;
  icon: ReactNode;
  lead: string | null;
  price: string | null;
  tail: string;
  add?: ReactNode;
  pending?: boolean;
  marker?: Record<string, string>;
}) {
  const body = (
    <span className="sg-head">
      <span className="sg-mark" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="sg-name block truncate">{name}</span>
        {brand ? <span className="sg-brand block truncate">{brand}</span> : null}
        <span className="sg-price block" data-glance-price="">
          {lead}
          {price ? <b>{price}</b> : null}
          {tail}
        </span>
      </span>
    </span>
  );
  return (
    <div className="sg-row sg-slim" data-pending={pending ? '' : undefined} {...marker}>
      {href ? (
        <Link href={href} className="block min-w-0 flex-1">
          {body}
        </Link>
      ) : (
        <div className="block min-w-0 flex-1">{body}</div>
      )}
      {add ? <span className="sg-tail">{add}</span> : null}
    </div>
  );
}

/**
 * ✅ A SERVICE PAGE'S ONE BAND (owner "approve all", 2026-10-14 — services
 * prototype `renderPage()`): the big count — or a word, never a clock — · what
 * it is · the status line with its dot · the page's ONE main button and the
 * second door. Papic keeps `ServiceGlanceBand` (it has a meter and a buy button
 * up top); the other five wear this one. Not added: the price is the big thing
 * and "Add for ₱…" the main button.
 */
export function ServiceBand({
  big,
  bigWord = false,
  word,
  mood,
  line,
  main,
  second,
  label,
  marker,
  name,
  brand,
}: {
  /**
   * The service's plain name, with the Setnayan name under it — ON SCREEN (the
   * prototype's top-bar pill): a page that asks for money says what it is
   * (`studio-buy-hero.test.ts`; owner, 2026-08: "it does not look appealing").
   */
  name?: string;
  brand?: string;
  big: string;
  bigWord?: boolean;
  word: string | null;
  mood: ServiceMood;
  line: string;
  main?: ReactNode;
  second?: ReactNode;
  /** What the band is about, for a screen reader ("Your Planner"). */
  label: string;
  marker?: Record<string, string>;
}) {
  return (
    <section className="sg-band" data-mood={mood} data-glance-band="" aria-label={label} {...marker}>
      {name ? (
        <p className="sg-band-name" data-band-name="">
          <b>{name}</b>
          {brand ? <span>{brand}</span> : null}
        </p>
      ) : null}
      <div className="min-w-0">
        <div className="sg-big" data-mood={mood} data-word={bigWord ? '' : undefined} data-glance-count="">
          {big}
        </div>
        {word ? <div className="sg-of">{word}</div> : null}
      </div>
      <p className="sg-line sg-band-line" data-mood={mood}>
        {mood !== 'plain' ? <GlanceDot mood={mood} /> : null}
        <span>{line}</span>
      </p>
      {main || second ? (
        <div className="sg-see sg-see-two">
          {main ?? null}
          {second ?? null}
        </div>
      ) : null}
    </section>
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
