'use client';

/**
 * The small interactive parts of the shared marketing widgets (controller's prototype, 5 Nov 2026). Everything they
 * show is handed in by the server widgets in `trade-widgets.tsx`; these only open, close and pick.
 */
import { Children, useRef, useState, type ReactNode } from 'react';
import { formatCount } from '@/lib/format-number';
import { useRevealOnOpen } from '@/app/_components/reveal-on-open';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import css from './trade.module.css';
import type { Role } from './trade-data';

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A list that shows its first `first` items and opens the rest in place ("See all N" / "Show less"). */
export function FoldList({
  items,
  first = 4,
  className,
  ordered = false,
}: {
  items: readonly ReactNode[];
  first?: number;
  className?: string;
  ordered?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const intend = useRevealOnOpen(open, () => ({ head: box.current }));
  const List = ordered ? 'ol' : 'ul';
  const cls = className ?? `${css.dots} ${css.big}`;
  if (items.length <= first) {
    return (
      <List className={cls}>
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </List>
    );
  }
  return (
    <div ref={box} className={open ? `${css.fold} ${css.foldOpen}` : css.fold}>
      <List className={cls}>
        {items.slice(0, first).map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </List>
      <div className={css.foldMore} aria-hidden={!open}>
        <div>
          <List className={cls} start={ordered ? first + 1 : undefined}>
            {items.slice(first).map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </List>
        </div>
      </div>
      <button type="button" className={css.foldBtn} aria-expanded={open} onClick={() => { intend(); setOpen((v) => !v); }}>
        {open ? 'Show less' : `See all ${formatCount(items.length)}`}
      </button>
    </div>
  );
}

/** The hub diagram: four roles around the event; the chosen role's node and line light up. */
function Hub({ role }: { role: Role }) {
  const node = (r: Role, x: number, y: number, w: number, label: string) => (
    <g className={r === role ? `${css.node} ${css.nodeOn}` : css.node}>
      <rect x={x} y={y} width={w} height={36} rx={18} />
      <text x={x + w / 2} y={y + 18}>
        {label}
      </text>
    </g>
  );
  const line = (r: Role, x1: number, y1: number, x2: number, y2: number) => (
    <line className={r === role ? `${css.ln} ${css.lnOn}` : css.ln} x1={x1} y1={y1} x2={x2} y2={y2} />
  );
  return (
    <svg viewBox="0 0 320 320" role="presentation">
      <circle className={css.ring} cx={160} cy={160} r={118} />
      {line('host', 160, 118, 160, 56)}
      {line('guest', 202, 160, 236, 160)}
      {line('coordinator', 160, 202, 160, 264)}
      {line('supplier', 118, 160, 84, 160)}
      <g className={css.core}>
        <circle cx={160} cy={160} r={42} />
        <text x={160} y={160}>
          The event
        </text>
      </g>
      {node('host', 118, 20, 84, 'Hosts')}
      {node('guest', 236, 142, 80, 'Guests')}
      {node('coordinator', 104, 264, 112, 'Coordinator')}
      {node('supplier', 4, 142, 80, 'Suppliers')}
    </svg>
  );
}

const FLOWS_FIRST = 4;

/** "Show me as": lights the flows (and the hub's node) that touch the chosen role. */
export function EcoFlows({
  flows,
  roles,
  initial,
}: {
  flows: readonly { who: readonly Role[]; steps: readonly string[] }[];
  roles: readonly { value: Role; label: string }[];
  initial: Role;
}) {
  const [role, setRole] = useState<Role>(initial);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const intend = useRevealOnOpen(open, () => ({ head: box.current }));
  const row = (f: (typeof flows)[number], i: number) => (
    <li key={i} className={f.who.includes(role) ? css.flowOn : css.flowOff}>
      <i className={css.flowN} aria-hidden>
        {i + 1}
      </i>
      <span>
        {f.steps.map((step, k) => (
          <span key={k}>
            {k > 0 ? (
              <span className={css.arr} aria-label="then">
                →
              </span>
            ) : null}
            {step}
          </span>
        ))}
      </span>
    </li>
  );
  return (
    <div className={css.eco}>
      <div className={css.hub} aria-hidden>
        <Hub role={role} />
      </div>
      <div>
        <div className={css.ecoCtl}>
          <span className={css.hint}>Show me as</span>
          <PickMenu
            label="Show the flows that touch this role"
            value={role}
            options={roles.map((r) => ({ key: r.value, label: r.label }))}
            onPick={(k) => setRole(k as Role)}
          />
        </div>
        <div ref={box} className={open ? `${css.fold} ${css.foldOpen}` : css.fold}>
          <ol className={css.flows}>{flows.slice(0, FLOWS_FIRST).map((f, i) => row(f, i))}</ol>
          {flows.length > FLOWS_FIRST ? (
            <>
              <div className={css.foldMore} aria-hidden={!open}>
                <div>
                  <ol className={css.flows} start={FLOWS_FIRST + 1}>
                    {flows.slice(FLOWS_FIRST).map((f, i) => row(f, i + FLOWS_FIRST))}
                  </ol>
                </div>
              </div>
              <button type="button" className={css.foldBtn} aria-expanded={open} onClick={() => { intend(); setOpen((v) => !v); }}>
                {open ? 'Show less' : `See all ${formatCount(flows.length)}`}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** One plan card's "See everything" fold. */
export function PlanMore({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const intend = useRevealOnOpen(open, () => ({ head: box.current }));
  return (
    <div ref={box} className={open ? `${css.fold} ${css.foldOpen}` : css.fold}>
      <div className={css.foldMore} aria-hidden={!open}>
        <div>
          <div className={css.planMore}>{children}</div>
        </div>
      </div>
      <button type="button" className={css.foldBtn} aria-expanded={open} onClick={() => { intend(); setOpen((v) => !v); }}>
        {open ? 'Show less' : 'See everything'}
      </button>
    </div>
  );
}

/** The five plan cards in a swipe row on a phone, with a dropdown that jumps to a plan. */
export function PlanRow({ options, children }: { options: readonly { key: string; label: string }[]; children: ReactNode }) {
  const row = useRef<HTMLDivElement>(null);
  const [pick, setPick] = useState(options[0]?.key ?? '');
  const cards = Children.toArray(children);
  const jump = (key: string) => {
    setPick(key);
    const el = row.current?.querySelector<HTMLElement>(`[data-plan="${key}"]`);
    if (el && row.current) {
      const pad = parseFloat(getComputedStyle(row.current).paddingLeft) || 0;
      row.current.scrollTo({ left: el.offsetLeft - pad, behavior: reduced() ? 'auto' : 'smooth' });
    }
  };
  return (
    <>
      <div className={css.plansCtl}>
        <PickMenu label="Jump to a plan" value={pick} options={options.map((o) => ({ key: o.key, label: o.label }))} onPick={jump} />
        <span className={css.hint}>Swipe to compare the five.</span>
      </div>
      <div className={css.plans} ref={row} aria-label="The five plans">
        {cards}
      </div>
    </>
  );
}

/** The print-format dropdown: shows one mockup at a time. */
export function FormatPicker({ formats }: { formats: readonly { key: string; label: string; mock: ReactNode }[] }) {
  const [key, setKey] = useState(formats[0]?.key ?? '');
  const current = formats.find((f) => f.key === key) ?? formats[0];
  return (
    <div className={css.formats}>
      <div className={css.ecoCtl}>
        <span className={css.hint}>Format</span>
        <PickMenu label="Print format" value={key} options={formats.map((f) => ({ key: f.key, label: f.label }))} onPick={setKey} />
      </div>
      {current?.mock}
    </div>
  );
}
