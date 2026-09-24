/**
 * <Section> — a group separated by SPACE AND TYPE, never by a box (design brief
 * 2026-09-24 §3: "separate logical groupings … purely using generous,
 * intentional padding, negative space, and typographic scale"). No border, no
 * radius, no fill. Read build-sessions/DESIGN-FOUNDATION.md.
 *
 *     <Section title="Budget" info="What counts toward the total." action={<Link …/>}>
 *       …
 *     </Section>
 *
 * The title is 1–3 words. Anything longer goes in `info`, behind an `(i)`
 * beside the title — never as a sub-line under it.
 */

import { useId, type ReactNode } from 'react';
import { InfoTip } from './info-tip';

export type SectionProps = {
  /** One to three words. */
  title: string;
  /** Secondary explanation, behind an `(i)` beside the title. */
  info?: ReactNode;
  /** One control at the title's far end (a "See all ›", an Add). */
  action?: ReactNode;
  /** Heading level — `h2` under a page title, `h3` inside a SidePanel. */
  level?: 'h2' | 'h3';
  id?: string;
  className?: string;
  children: ReactNode;
};

export function Section({
  title,
  info,
  action,
  level = 'h2',
  id,
  className,
  children,
}: SectionProps) {
  const headingId = useId();
  const Heading = level;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={`sn-section${className ? ` ${className}` : ''}`}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        {info ? (
          <InfoTip
            label={title}
            labelAs={Heading}
            labelId={headingId}
            labelClassName="sn-sec"
            align="start"
          >
            {info}
          </InfoTip>
        ) : (
          <Heading id={headingId} className="sn-sec">
            {title}
          </Heading>
        )}
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
