'use client';

/**
 * 🧮 "WHO THEY COUNT" — one row in an opened Booked supplier (owner 2026-11-04, the approved prototype
 * `count-and-quotes.html`, "Couple · who a supplier counts": *"Couple · Suppliers › each booked service › 'Who they
 * count'"*). Drawn ONLY for a service priced per head (owner: *"not counted for will be for service cards with pax
 * only"*); a flat-priced one has no row.
 *
 *   Who they count   Only Principal Sponsors          18 ›
 *   ── a tap opens the sheet ──
 *   Catering · Juan's Kitchen                            ✕
 *   Who they count                 [ Only… ▾ ]            ← the PickMenu (Everyone attending · Only… · Everyone except…)
 *   ( ) Principal Sponsors   Role · 18 attending          ← the tick list, while the rule is not "Everyone attending"
 *   ( ) Kids                 Group · 12 attending
 *   Juan's Kitchen counts 157
 *   180 attending · 12 outside this rule · 11 ticked on guest cards
 *                                                [ Done ]
 *
 * The count moves as they tick — `countFor` over the anonymous roster (`lib/supplier-count.ts`), the same arithmetic
 * the supplier's readers run. Done saves in place (`saveCountRule`): no redirect, the screen stays.
 */
import { useContext, useId, useMemo, useState, useTransition } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { ActionButton } from '@/components/action-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import {
  COUNT_MODES,
  COUNT_MODE_HINTS,
  COUNT_MODE_WORDS,
  audienceOf,
  countFor,
  keysOfRule,
  ruleLabels,
  ruleOfKeys,
  ruleWords,
  sheetWords,
  type CountGroup,
  type CountMode,
  type CountedService,
  type RosterEntry,
} from '@/lib/supplier-count';
import type { RoleNames } from '@/lib/role-names';
import { saveCountRule } from '../_actions/count-rule';
import { BookedStandInCtx } from './booked-stand-ins';

export function BookedCountRule({
  eventId,
  service,
  groups,
  roster,
  names = null,
}: {
  eventId: string;
  service: CountedService;
  groups: readonly CountGroup[];
  roster: readonly RosterEntry[];
  /** The couple's words for roles — "Only Bride's Crew" when they renamed her. */
  names?: RoleNames | null;
}) {
  const [saved, setSaved] = useState(service.rule);
  const [open, setOpen] = useState(false);
  const shown = useMemo(() => countFor(roster, saved, service.id), [roster, saved, service.id]);
  const words = ruleWords(saved.mode, ruleLabels(saved, groups, names));
  return (
    <>
      <button
        type="button"
        className="grid w-full grid-cols-[minmax(0,1fr)_auto_16px] items-center gap-2 border-b border-ink/10 py-2 text-left text-[14px]"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        data-booked-count-rule={service.id}
      >
        <span className="min-w-0">
          <span className="block text-ink">Who they count</span>
          <span className="block truncate text-[12.5px] text-ink/55">
            {words}
            {service.booked ? '' : ' · quoted, not booked'}
          </span>
        </span>
        <span className="text-right">
          <b className="block text-[20px] font-medium leading-none tabular-nums text-ink" data-booked-count={shown.counted}>
            {shown.counted}
          </b>
          <span className="block text-[12px] text-ink/55">counted</span>
        </span>
        <ChevronRight aria-hidden strokeWidth={2} className="h-4 w-4 text-sn-accent" />
      </button>
      {open ? (
        <CountRuleSheet
          eventId={eventId}
          service={service}
          groups={groups}
          roster={roster}
          names={names}
          start={saved}
          onClose={() => setOpen(false)}
          onSaved={(next) => {
            setSaved(next);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function CountRuleSheet({
  eventId,
  service,
  groups,
  roster,
  names,
  start,
  onClose,
  onSaved,
}: {
  eventId: string;
  service: CountedService;
  groups: readonly CountGroup[];
  roster: readonly RosterEntry[];
  names: RoleNames | null;
  start: CountedService['rule'];
  onClose: () => void;
  onSaved: (rule: CountedService['rule']) => void;
}) {
  const titleId = useId();
  const standIn = useContext(BookedStandInCtx);
  const [mode, setMode] = useState<CountMode>(start.mode);
  const [keys, setKeys] = useState<string[]>(() => keysOfRule(start));
  const [pending, run] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const audience = useMemo(() => audienceOf(roster, groups, keys, names), [roster, groups, keys, names]);
  const rule = ruleOfKeys(mode, keys);
  const c = countFor(roster, rule, service.id);
  const shop = service.shop ?? service.label;
  const flip = (k: string) => setKeys((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  const done = () =>
    run(async () => {
      setError(null);
      const args = { eventId, serviceId: service.id, mode, keys: mode === 'all' ? [] : keys };
      const res = standIn.saveRule ? await standIn.saveRule(args) : await saveCountRule(args);
      if (res.ok) onSaved(rule);
      else setError(res.error);
    });
  return (
    <Sheet open onClose={onClose} labelledById={titleId} rise>
      <div className="space-y-1 px-5 pb-6 pt-5" data-count-rule-sheet={service.id}>
        <h2 id={titleId} className="pr-10 text-[17px] font-semibold leading-snug text-ink">
          {service.label} · {shop}
        </h2>
        <div className="flex items-center justify-between gap-3 border-b border-ink/10 py-3 text-[15px]">
          <span className="text-ink/70">Who they count</span>
          <PickMenu
            label="Who they count"
            value={mode}
            options={COUNT_MODES.map((m) => ({ key: m, label: COUNT_MODE_WORDS[m], hint: COUNT_MODE_HINTS[m] }))}
            onPick={(k) => {
              const m = k as CountMode;
              setMode(m);
              if (m === 'all') setKeys([]);
            }}
            dataAttr="count-rule-mode"
          />
        </div>
        {mode === 'all' ? null : (
          <ul data-count-rule-ticks="">
            {audience.map((a) => {
              const on = keys.includes(a.key);
              return (
                <li key={a.key}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 border-b border-ink/10 py-3 text-left"
                    aria-pressed={on}
                    onClick={() => flip(a.key)}
                    data-count-rule-tick={a.key}
                  >
                    <span
                      aria-hidden
                      className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md border-[1.5px] ${
                        on ? 'border-sn-accent bg-sn-accent text-white' : 'border-ink/25'
                      }`}
                    >
                      {on ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                    </span>
                    <span className="min-w-0 flex-1 text-[15px] text-ink">
                      {a.label}
                      <small className="block text-[12.5px] text-ink/55">
                        {a.type} · {a.n} attending
                      </small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 rounded-xl bg-success-50 px-4 py-3 text-[13.5px] leading-snug" role="status" data-count-rule-count={c.counted}>
          <b className="block font-medium text-ink">
            {shop} counts {c.counted}
          </b>
          <span className="text-ink/60">{sheetWords(c, mode)}</span>
        </p>
        {error ? (
          <p className="text-[12.5px] text-[rgb(var(--color-danger))]" role="alert">
            {error}
          </p>
        ) : null}
        <div className="pt-3">
          <ActionButton tone="brand" main icon={Check} label={pending ? 'Saving…' : 'Done'} disabled={pending} onClick={done} className="w-full justify-center" />
        </div>
      </div>
    </Sheet>
  );
}
