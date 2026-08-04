import { ShieldX } from 'lucide-react';
import type { ReactNode } from 'react';

type Props = {
  /** "You don't have access to this desk" */
  title: string;
  /** Who this surface IS scoped to — names the role, e.g. "the booked band's team". */
  scopedTo: string;
  /**
   * The person who can fix it, e.g. "Jomar Reyes (band lead)". Denied always
   * gives the reader somewhere to go; a wall with no door is a dead end.
   */
  askPerson?: string;
  /** "Request access" / "Switch account" — rendered buttons/links. */
  actions?: ReactNode;
};

// State 05 · DENIED — left-anchored slate. Must never resemble Empty: the
// rows may exist, and this component SAYS so. It never renders a count and
// never claims the surface is empty — a denial and an empty read both return
// `count: 0`, which is exactly why this frame exists.
export function DeniedState({ title, scopedTo, askPerson, actions }: Props) {
  return (
    <div className="flex flex-col justify-center px-4 py-10">
      <div className="border-l-[3px] border-link py-1 pl-4">
        <ShieldX aria-hidden className="mb-2.5 h-6 w-6 text-link" strokeWidth={1.75} />
        <h3 className="text-lg font-extrabold tracking-tight text-ink">{title}</h3>
        <p className="mt-1.5 max-w-md text-sm text-ink/65">
          This surface is scoped to {scopedTo}, and your sign-in isn&rsquo;t on it.{' '}
          <strong className="text-ink">
            This is not an empty surface — its contents may already be waiting.
          </strong>
        </p>
        {askPerson ? (
          <p className="mt-2 max-w-md text-sm text-ink/65">
            Ask <strong className="text-ink">{askPerson}</strong> to add you.
          </p>
        ) : null}
        {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
