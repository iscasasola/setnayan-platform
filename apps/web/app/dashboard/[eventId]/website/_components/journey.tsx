import Link from 'next/link';
import { ArrowRight, ArrowUpRight, type LucideIcon } from 'lucide-react';

/**
 * Journey-layout primitives for the Wedding website tab.
 *
 * Restructure per CLAUDE.md 2026-05-30 "V2.1 Amendment #3" — the website
 * page reads top-to-bottom as the wedding's lifecycle (address → save-the-
 * date → on the day → after the wedding → keep your photos → Free vs Pro)
 * instead of a flat tile grid.
 *
 * Per the blueprint's wiring rule, journey rows are NAVIGATION, not buy
 * buttons: a clickable row deep-links to where the surface already lives
 * (an /add-ons/<key> detail page that owns its own pricing + buy/coming-
 * soon state, a /website/<editor> sub-route, or the guest list). Net-new
 * features that don't have a route yet render as honest "Coming soon" rows
 * — never clickable, never priced as buyable, per the no-fake-availability
 * rule + [[feedback_setnayan_no_dev_text_post_launch]].
 *
 * Server components — no interactivity beyond <Link>/<a>, so no 'use client'.
 * Clean Editorial palette via the token-remapped legacy classes
 * (cream/ink/terracotta/mulberry) per CLAUDE.md 2026-05-30 unification.
 */

export function JourneySection({
  step,
  title,
  blurb,
  children,
}: {
  /** Lifecycle ordinal shown in the eyebrow, e.g. "1". */
  step: string;
  title: string;
  blurb?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          Step {step}
        </p>
        <h2 className="font-serif text-2xl italic tracking-tight sm:text-[1.7rem]">
          {title}
        </h2>
        {blurb ? <p className="max-w-prose text-sm text-ink/60">{blurb}</p> : null}
      </header>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

type RowBase = {
  icon: LucideIcon;
  title: string;
  blurb: string;
};

type JourneyRowProps = RowBase &
  (
    | {
        /** Internal route — renders a clickable Next <Link> with a chevron. */
        href: string;
        external?: false;
        download?: never;
        comingSoon?: false;
      }
    | {
        /** External / new-tab link (preview, etc.) — opens with an up-right arrow. */
        href: string;
        external: true;
        download?: never;
        comingSoon?: false;
      }
    | {
        /** Plain <a download> (QR PNG, etc.). */
        href: string;
        download: string;
        external?: false;
        comingSoon?: false;
      }
    | {
        /** Net-new feature with no route yet — muted, not clickable. */
        href?: never;
        external?: never;
        download?: never;
        comingSoon: true;
      }
  );

function RowBody({
  icon: Icon,
  title,
  blurb,
  trailing,
  muted = false,
}: RowBase & { trailing: React.ReactNode; muted?: boolean }) {
  return (
    <div className="flex items-center gap-4">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
          muted ? 'border-ink/10 bg-cream/60' : 'border-ink/10 bg-white/60'
        }`}
      >
        <Icon
          aria-hidden
          className={`h-5 w-5 ${muted ? 'text-ink/35' : 'text-terracotta'}`}
          strokeWidth={1.75}
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${muted ? 'text-ink/50' : 'text-ink'}`}>
          {title}
        </p>
        <p className={`text-xs ${muted ? 'text-ink/40' : 'text-ink/55'}`}>{blurb}</p>
      </div>
      {trailing}
    </div>
  );
}

export function JourneyRow(props: JourneyRowProps) {
  const { icon, title, blurb } = props;

  if ('comingSoon' in props && props.comingSoon) {
    return (
      <li className="rounded-xl border border-ink/10 bg-cream/50 p-4">
        <RowBody
          icon={icon}
          title={title}
          blurb={blurb}
          muted
          trailing={
            <span className="shrink-0 rounded-full border border-ink/15 bg-cream px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
              Coming soon
            </span>
          }
        />
      </li>
    );
  }

  const rowClass =
    'group block min-h-[44pt] rounded-xl border border-ink/10 bg-cream p-4 transition-colors hover:border-terracotta/40 hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta';

  // External / new-tab links (preview) use an up-right arrow; plain
  // downloads (QR PNG) reuse the same chevron affordance via <a download>.
  if ('external' in props && props.external) {
    return (
      <li>
        <a href={props.href} target="_blank" rel="noreferrer" className={rowClass}>
          <RowBody
            icon={icon}
            title={title}
            blurb={blurb}
            trailing={
              <ArrowUpRight
                aria-hidden
                className="h-4 w-4 shrink-0 text-ink/40 transition-colors group-hover:text-terracotta"
                strokeWidth={1.75}
              />
            }
          />
        </a>
      </li>
    );
  }

  if ('download' in props && props.download) {
    return (
      <li>
        <a href={props.href} download={props.download} className={rowClass}>
          <RowBody
            icon={icon}
            title={title}
            blurb={blurb}
            trailing={
              <ArrowRight
                aria-hidden
                className="h-4 w-4 shrink-0 text-ink/40 transition-colors group-hover:text-terracotta"
                strokeWidth={1.75}
              />
            }
          />
        </a>
      </li>
    );
  }

  return (
    <li>
      <Link href={props.href} className={rowClass}>
        <RowBody
          icon={icon}
          title={title}
          blurb={blurb}
          trailing={
            <ArrowRight
              aria-hidden
              className="h-4 w-4 shrink-0 text-ink/40 transition-colors group-hover:text-terracotta"
              strokeWidth={1.75}
            />
          }
        />
      </Link>
    </li>
  );
}
