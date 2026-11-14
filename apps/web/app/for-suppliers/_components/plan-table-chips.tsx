'use client';

/**
 * The plan comparison on a phone — one plan at a time, picked with chips (drawing § 2, "After · 390": *"The phone shows
 * one plan at a time, picked with the chips, instead of a five-column table you scroll sideways."*). It draws the SAME
 * groups as the desktop table (`planTable`, built on the server); nothing here reads a number of its own.
 */
import { useState } from 'react';
import type { TableGroup } from './plan-table-data';
import s from './supplier-front.module.css';

export function PlanTableChips({
  tiers,
  groups,
  start,
}: {
  tiers: readonly { key: string; name: string; note: string | null }[];
  groups: readonly TableGroup[];
  start: string;
}) {
  const [on, setOn] = useState(start);
  const tier = tiers.find((t) => t.key === on) ?? tiers[0]!;
  return (
    <div className={s.cmpNarrow}>
      <div className={s.cmpChips} role="tablist" aria-label="Pick a plan">
        {tiers.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === on}
            className={s.cmpChip}
            onClick={() => setOn(t.key)}
          >
            {t.name}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={tier.name} className={s.cmpList}>
        {tier.note ? <p className={s.cmpListNote}>{tier.note}</p> : null}
        {groups.map((g) => (
          <section key={g.title}>
            <h4 className={s.cmpListHead}>{g.title}</h4>
            {g.rows.map((r) => {
              const c = r.cells[tier.key as keyof typeof r.cells];
              if (!c) return null;
              return (
                <div key={r.key} className={s.cmpListRow}>
                  <span>
                    {r.label}
                    {r.note ? <small className={s.cmpWhy}>{r.note}</small> : null}
                  </span>
                  <span className={c.kind === 'yes' ? s.cmpYes : c.kind === 'no' ? s.cmpNo : c.kind === 'lock' ? s.cmpLock : undefined}>
                    {c.kind === 'yes' ? (c.text === 'Yes' ? '✓' : `✓ ${c.text}`) : c.kind === 'no' ? '—' : c.kind === 'lock' ? `🔒 ${c.text}` : c.text}
                    {c.kind === 'no' ? <span className={s.srOnly}>{c.text}</span> : null}
                  </span>
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
