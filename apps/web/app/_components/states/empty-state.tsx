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
  /**
   * 👻 THE GREYED-OUT EXAMPLE (owner 2026-11-09, DECISION_LOG 🧱👻 ×2; Build 5 Lane H): the REAL component of this
   * surface with sample rows, drawn faded and inert UNDER the line and the door. Omit = as shipped. It can only ever
   * be reached here, after `readPermitted: true` — so a refused read never wears an Example.
   */
  preview?: ReactNode;
};

// State 03 · EMPTY — centred, warm, teaching. Nothing exists yet AND the read
// was permitted. Must never be mistakable for Denied (left-anchored slate) or
// Locked (ghosted feature under a gold lock): different geometry on purpose.
export function EmptyState({ Icon, title, blurb, action, preview }: Props) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full border border-terracotta/30 bg-terracotta/10 text-terracotta">
        <Icon aria-hidden className="h-6 w-6" strokeWidth={1.75} />
      </span>
      <h3 className="text-lg font-extrabold tracking-tight text-ink">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-ink/65">{blurb}</p>
      {action ? <div className="mt-5">{action}</div> : null}
      {/* ✂ F-A-01 (admin walk 13 Nov 2026): no "Verified: read permitted · 0 rows" stamp under the line — engineering
          words on a screen a person reads. The read is still proven before Empty draws (`readPermitted: true`). */}
      {preview ? <ExamplePreview className="mt-6 w-full text-left">{preview}</ExamplePreview> : null}
    </div>
  );
}

/**
 * 👻 THE EXAMPLE — the ONE shared treatment of an empty part's greyed-out preview (owner 2026-11-09, DECISION_LOG
 * "AN EMPTY DASHBOARD PART SHOWS A GREYED-OUT PREVIEW OF ITS CONTENT" + "…ARE PART OF BUILD 5"; HOUSE_TEMPLATES T28;
 * approved prototype `prototypes/empty_looks_user_event_2026-11-10/`).
 *
 *   · `children` is the part's OWN component drawn with sample rows (`lib/empty-look-samples.ts`) — never new art,
 *     never a stranger's real event.
 *   · Faded and not pressable: `aria-hidden` + `inert` + `.sn-example` (opacity, grayscale, no pointer) — a tap on it
 *     opens nothing and a screen reader never reads sample names as the person's own.
 *   · Marked **Example** by a chip that is NOT faded, so a sample figure can never read as a real one.
 *   · It goes UNDER the honest line and the door, which stay exactly as shipped.
 *
 * 🔑 THE CALLER DECIDES WHEN, AND ONLY FROM A PERMITTED READ. Per part, the Example is gone the moment that part has
 * real content; and a failed or refused read never draws one — it still says "Couldn’t load" (reads-are-honest).
 * `<EmptyState preview>` and `<QuietStart preview>` mount it for their register; every other empty part on the
 * dashboards mounts this directly — one treatment, never a per-page copy (`every-empty-part-shows-an-example.test.ts`).
 */
export function ExamplePreview({
  children,
  className = '',
  flush = false,
}: {
  children: ReactNode;
  className?: string;
  /** The sample runs edge to edge (a photo grid): the chip keeps the page's 16-px gutter. */
  flush?: boolean;
}) {
  return (
    <div className={`sn-example-wrap${flush ? ' sn-example-flush' : ''} ${className}`.trim()} data-example="">
      <span className="sn-example-chip">Example</span>
      <div aria-hidden="true" inert className="sn-example">
        {children}
      </div>
    </div>
  );
}
