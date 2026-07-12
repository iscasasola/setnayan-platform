import { createClient } from '@/lib/supabase/server';
import { manilaToday } from '@/lib/std-views';
import {
  DEPENDENT_RELATIONSHIPS,
  DEPENDENT_RELATIONSHIP_LABELS,
  DEPENDENT_SEXES,
  RELIGIONS,
  fenceBand,
  dependentNextMilestone,
  type DependentSex,
} from '@/lib/dependent-people';
import { RELIGION_LABELS } from '@/lib/profile-personalization';
import { SubmitButton } from '@/app/_components/submit-button';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { addDependent, deleteDependent } from '../dependent-actions';

/**
 * "The people you care for" — the guardian-held dependent capture (Phase 3
 * family graph · COUNSEL-GATED). Rendered only when dependentPeopleEnabled().
 * A dependent is a child (<18) or elder (>50); the age fence blocks 18–50
 * (invite, never register). Milestones derive from the birthdate.
 */

type DependentRow = {
  dependent_id: string;
  name: string;
  birth_date: string | null;
  sex: DependentSex | null;
  religion: string | null;
  relationship: string | null;
};

const FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
function fmt(iso: string): string {
  return FMT.format(new Date(`${iso}T12:00:00+08:00`));
}

export async function DependentsSection() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('dependents')
    .select('dependent_id, name, birth_date, sex, religion, relationship')
    .order('created_at', { ascending: true });
  const dependents = (data ?? []) as DependentRow[];
  const today = manilaToday();

  return (
    <section className="mt-10">
      <header className="mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/50">
          The people you care for
        </h2>
        <p className="mt-1 text-sm text-ink/55">
          A child or an elder you plan milestones for. We store the people, dates, and events that
          matter — not documents.
        </p>
      </header>

      {dependents.length > 0 ? (
        <ul className="mb-6 space-y-2.5">
          {dependents.map((d) => {
            const band = d.birth_date ? fenceBand(d.birth_date, today) : null;
            const next = d.birth_date ? dependentNextMilestone(d.birth_date, d.sex, today) : null;
            return (
              <li
                key={d.dependent_id}
                className="flex items-center gap-3 rounded-xl border border-ink/10 bg-ink/[0.015] px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{d.name}</p>
                  <p className="truncate text-xs text-ink/55">
                    {d.relationship ? DEPENDENT_RELATIONSHIP_LABELS[d.relationship as keyof typeof DEPENDENT_RELATIONSHIP_LABELS] : 'Someone I care for'}
                    {band === 'child' ? ' · under 18' : band === 'elder' ? ' · over 50' : ''}
                    {next ? ` · next: turns ${next.age} on ${fmt(next.dateISO)}` : ''}
                  </p>
                </div>
                <ConfirmForm
                  action={deleteDependent}
                  title="Remove this record?"
                  message={`Remove ${d.name}? This permanently deletes their record.`}
                  confirmLabel="Remove"
                  className="shrink-0"
                >
                  <input type="hidden" name="dependent_id" value={d.dependent_id} />
                  <button
                    type="submit"
                    className="rounded-md px-2 py-1 text-xs font-medium text-ink/45 transition-colors hover:text-terracotta"
                  >
                    Remove
                  </button>
                </ConfirmForm>
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* Add form */}
      <form
        action={addDependent}
        className="space-y-4 rounded-xl border border-ink/10 bg-cream p-4"
      >
        <p className="text-sm font-medium text-ink">Add someone</p>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-ink" htmlFor="dep_name">
            Name <span className="text-terracotta">*</span>
          </label>
          <input id="dep_name" name="name" className="input-field" placeholder="e.g. Amara" required />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-ink" htmlFor="dep_birth">
            Birthday <span className="text-terracotta">*</span>
          </label>
          <input id="dep_birth" name="birth_date" type="date" className="input-field sm:max-w-[14rem]" required />
          <p className="text-xs text-ink/50">
            Only for a child (under 18) or an elder (over 50). Adults keep their own — invite them
            instead.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-ink" htmlFor="dep_rel">
              Relationship
            </label>
            <select id="dep_rel" name="relationship" defaultValue="child" className="input-field">
              {DEPENDENT_RELATIONSHIPS.map((r) => (
                <option key={r} value={r}>
                  {DEPENDENT_RELATIONSHIP_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-ink" htmlFor="dep_sex">
              For the debut year (optional)
            </label>
            <select id="dep_sex" name="sex" defaultValue="" className="input-field">
              <option value="">Prefer not to say</option>
              {DEPENDENT_SEXES.map((s) => (
                <option key={s} value={s}>
                  {s === 'female' ? '18th (daughter)' : '21st (son)'}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-ink" htmlFor="dep_religion">
            Religion (optional — unlocks their rites)
          </label>
          <select id="dep_religion" name="religion" defaultValue="" className="input-field">
            <option value="">Prefer not to say</option>
            {RELIGIONS.map((r) => (
              <option key={r} value={r}>
                {RELIGION_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <SubmitButton className="button-primary" pendingLabel="Adding…">
          Add
        </SubmitButton>
      </form>
    </section>
  );
}
