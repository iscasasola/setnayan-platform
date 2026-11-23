import Link from 'next/link';
import type { ReactNode } from 'react';
import { BookOpen, ChevronRight, type LucideIcon } from 'lucide-react';

/**
 * 📋 GUIDES, TOPICS, ANSWERS — ROWS IN ONE WHITE CARD (the Guide & Help drawing, owner "Approved" 21 Nov 2026, corpus
 * `prototypes/guide_help_2026-11-20/index.html` § "The parts, by kind": *"Rows in one white card. Tap opens."*).
 * The card is THE frame (`.sn-frame`, flush); a row is a whole-row press with an optional round mark, its name, an
 * optional line under it, and a › at the end. One piece for Help, a topic, all topics and the ⓘ sheet, so the four
 * never drift. No hooks here: a server page draws its rows as links; the ⓘ sheet (a client part) draws button rows.
 */

/** A section head over a card ("Start here", "Topics" · All 14). */
export function HelpSection({ title, more, children, data }: { title: string; more?: ReactNode; children: ReactNode; data?: string }) {
  return (
    <section aria-label={title} className="mt-6" data-help-section={data}>
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-sn-xl font-semibold text-ink">{title}</h2>
        {more}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function HelpRows({ children, data }: { children: ReactNode; data?: string }) {
  return (
    <ul className="sn-frame sn-frame-flush py-1" data-help-rows={data}>
      {children}
    </ul>
  );
}

type RowProps = {
  title: string;
  line?: ReactNode;
  /** The round mark at the left (a guide is a book). */
  icon?: LucideIcon;
  data?: string;
} & ({ href: string; onClick?: undefined } | { href?: undefined; onClick: () => void });

const ROW = 'sn-press flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left';

export function HelpRow({ title, line, icon: Icon, data, href, onClick }: RowProps) {
  const body = (
    <>
      {Icon ? (
        <span aria-hidden className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ink/[0.05] text-ink/70">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-sn-lg font-semibold text-ink">{title}</span>
        {line ? <span className="mt-0.5 flex flex-wrap items-center gap-2 text-sn-md text-ink/60">{line}</span> : null}
      </span>
      <ChevronRight aria-hidden className="h-5 w-5 flex-none text-ink/40" strokeWidth={1.75} />
    </>
  );
  return (
    <li data-help-row-link={data}>
      {href ? (
        <Link href={href} className={ROW}>
          {body}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={ROW}>
          {body}
        </button>
      )}
    </li>
  );
}

/** A guide's row: the book, its title, "4 steps". */
export function GuideRow({ title, steps, href, data }: { title: string; steps: string; href: string; data?: string }) {
  return <HelpRow icon={BookOpen} title={title} line={steps} href={href} data={data} />;
}
