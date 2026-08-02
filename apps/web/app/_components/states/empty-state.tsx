import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type Props = {
  Icon: LucideIcon;
  /** "No requests yet" — states the fact, never apologises. */
  title: string;
  /** Teaches how the surface fills: what lands here, and what starts it. */
  blurb: string;
  /**
   * The single action that fills this surface — one terracotta CTA, passed as
   * a rendered button/link so the component stays server-safe. Empty with no
   * next step is a dead end; omit only when the surface fills on its own
   * (e.g. requests arrive from guests with no host action).
   */
  action?: ReactNode;
  /**
   * Type-level enforcement of the six-state rule: Empty may only render after
   * the read was POSITIVELY proven permitted. There is no way to pass `false`
   * — if you cannot write `readPermitted` honestly here, you are looking at
   * Denied, never Empty. Route through `resolveSurfaceState` instead of
   * branching on a bare `count === 0`.
   */
  readPermitted: true;
  /** Overrides the "Verified: read permitted · 0 rows" audit line. */
  verifiedNote?: string;
};

// State 03 · EMPTY — centred, warm, teaching. Nothing exists yet AND the read
// was permitted. Must never be mistakable for Denied (left-anchored slate) or
// Locked (ghosted feature under a gold lock): different geometry on purpose.
export function EmptyState({ Icon, title, blurb, action, verifiedNote }: Props) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full border border-terracotta/30 bg-terracotta/10 text-terracotta">
        <Icon aria-hidden className="h-6 w-6" strokeWidth={1.75} />
      </span>
      <h3 className="text-lg font-extrabold tracking-tight text-ink">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-ink/65">{blurb}</p>
      {action ? <div className="mt-5">{action}</div> : null}
      <span className="mt-6 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-ink/45">
        {verifiedNote ?? 'Verified: read permitted · 0 rows'}
      </span>
    </div>
  );
}
