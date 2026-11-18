'use client';

import { useState } from 'react';
import { SubmitButton } from '@/app/_components/submit-button';
import { StayForm } from '@/app/_components/stay-form';
import { formatCount } from '@/lib/format-number';
import { groupByLocation, type Location, type ScopedService } from '@/lib/branch-copy';

/**
 * 🏢 WHO WORKS WHAT — one person's services (owner 2026-11-14, SIMPLER SUPPLIER PLANS item 9; drawing artifact
 * Eiwc64wF1VHLfZ52Sjbs8c § 6). Extends the shipped picker (`AgentServiceAssignment`, Phase 2a) — same form, same door
 * (`supTeam.setVendorAgentServices`), same "they see only these, and those customers" — with three changes:
 *
 *   · each service is named by its CARD TITLE (two "Photo and video" cards no longer look the same);
 *   · with two or more locations, services sit under their branch, and a "Whole branch" choice comes first — ticking it
 *     gives the person every service there, and any added later (`vendor_team_members.whole_branch_keys` + trigger);
 *     that branch's services then show as included and cannot be unticked one by one ("untick the branch instead");
 *   · a shop with one location sees today's flat list, unchanged apart from the names.
 */
type Action = (formData: FormData) => void | Promise<void>;

export function AgentServiceAssignment({
  action,
  memberId,
  services,
  assigned,
  locations,
  wholeKeys,
}: {
  action: Action;
  memberId: string;
  services: ScopedService[];
  assigned: string[];
  locations: Location[];
  wholeKeys: string[];
}) {
  const [whole, setWhole] = useState<Set<string>>(() => new Set(wholeKeys));
  const assignedSet = new Set(assigned);
  const branched = locations.length >= 2;
  const groups = branched ? groupByLocation(services, locations) : [{ key: '', label: '', services }];

  const toggleWhole = (key: string, on: boolean) =>
    setWhole((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  return (
    <StayForm door="supTeam.setVendorAgentServices" action={action} className="mt-3 space-y-2" data-who-works-what="">
      <input type="hidden" name="vendor_team_member_id" value={memberId} />
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-success-900/70">
        Their services — they see only these, and those customers
      </p>
      {services.length === 0 && !branched ? (
        <p className="text-xs text-ink/55">Add services on the Services page first, then assign them here.</p>
      ) : (
        <>
          {branched ? (
            <fieldset className="space-y-1 pb-1" data-whole-branch="">
              <legend className="mb-1 text-[12.5px] font-semibold text-ink/70">Whole branch</legend>
              <div className="flex flex-wrap gap-2">
                {locations.map((l) => {
                  const n = services.filter((s) => s.key === l.key).length;
                  return (
                    <label
                      key={l.key}
                      className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-ink/15 bg-white/70 px-3 py-1 text-[13px] text-ink/80 hover:border-ink/30"
                    >
                      <input
                        type="checkbox"
                        name="whole_branch"
                        value={l.key}
                        checked={whole.has(l.key)}
                        onChange={(e) => toggleWhole(l.key, e.currentTarget.checked)}
                        className="h-3.5 w-3.5 accent-success-600"
                      />
                      <span className={whole.has(l.key) ? 'font-semibold' : undefined}>{l.label}</span>
                      <span className="text-ink/45">{formatCount(n)}</span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-1 text-[12.5px] text-ink/60">Every service there, and any you add later.</p>
            </fieldset>
          ) : null}

          {groups.map((g) => (
            <div key={g.key || 'all'} data-who-works-what-group={g.key || 'all'}>
              {branched ? <p className="mb-1 mt-2 text-[12.5px] font-semibold text-ink/65">{g.label}</p> : null}
              <div className="flex flex-wrap gap-2">
                {g.services.map((s) => {
                  const included = branched && whole.has(s.key);
                  if (included) {
                    return (
                      <span
                        key={s.id}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-ink/10 bg-ink/5 px-3 py-1 text-[13px] text-ink/55"
                        data-included-with-branch=""
                      >
                        <input type="checkbox" checked disabled readOnly aria-label={`${s.name}, included with ${g.label}`} className="h-3.5 w-3.5 accent-ink/40" />
                        {s.name} · with {g.label.replace(/^Main · /, '')}
                      </span>
                    );
                  }
                  return (
                    <label
                      key={s.id}
                      className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-ink/15 bg-white/70 px-3 py-1 text-[13px] text-ink/80 hover:border-ink/30"
                    >
                      <input type="checkbox" name="service_ids" value={s.id} defaultChecked={assignedSet.has(s.id)} className="h-3.5 w-3.5 accent-success-600" />
                      {s.name}
                      {s.active ? null : <span className="text-ink/40">(inactive)</span>}
                    </label>
                  );
                })}
                {g.services.length === 0 ? <span className="text-[12.5px] text-ink/50">No services here yet.</span> : null}
              </div>
            </div>
          ))}
          <SubmitButton
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-success-300 bg-white/70 px-4 text-[13px] font-medium text-success-900 hover:border-success-500"
            pendingLabel="Saving…"
          >
            Save their services
          </SubmitButton>
        </>
      )}
    </StayForm>
  );
}
