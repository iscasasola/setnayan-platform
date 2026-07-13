import { createClient } from '@/lib/supabase/server';
import { manilaToday } from '@/lib/std-views';
import {
  DEPENDENT_RELATIONSHIPS,
  DEPENDENT_RELATIONSHIP_LABELS,
  DEPENDENT_KINDS,
  DEPENDENT_KIND_LABELS,
  DEPENDENT_SEXES,
  RELIGIONS,
  fenceBand,
  dependentNextMilestone,
  type DependentSex,
  type DependentKind,
} from '@/lib/dependent-people';
import { RELIGION_LABELS } from '@/lib/profile-personalization';
import { SubmitButton } from '@/app/_components/submit-button';
import { ConfirmForm } from '@/app/_components/confirm-form';
import {
  addDependent,
  deleteDependent,
  addGodparent,
  deleteGodparent,
  setDependentSharing,
} from '../dependent-actions';

/**
 * "The ones you care for" — the dependent capture (Phase 3 family graph ·
 * flag-gated). Rendered only when dependentPeopleEnabled(). A dependent is a
 * person, a pet, or anything else. Only a PERSON carries a birthdate/religion +
 * the age fence (child <18 / elder >50); pets/other are just a name (+ optional
 * birthday). Milestones + godparents apply to the person case only.
 */

type DependentRow = {
  dependent_id: string;
  dependent_kind: DependentKind | null;
  name: string;
  birth_date: string | null;
  sex: DependentSex | null;
  religion: string | null;
  relationship: string | null;
  owner_user_id: string;
  shared_with_spouse: boolean;
};

type GodparentRow = {
  godparent_id: string;
  dependent_id: string;
  godparent_name: string;
  role: string | null;
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const myUserId = user?.id ?? '';

  // RLS now returns MY dependents + any my spouse marked shared (PR-G household).
  const { data } = await supabase
    .from('dependents')
    .select('dependent_id, dependent_kind, name, birth_date, sex, religion, relationship, owner_user_id, shared_with_spouse')
    .order('created_at', { ascending: true });
  const dependents = (data ?? []) as DependentRow[];
  const today = manilaToday();

  // Do I have a spouse on Setnayan? Only then is the "share with spouse" toggle
  // meaningful. current_spouse_user_ids() returns the co-host(s) of my wedding.
  const { data: spouseIds } = await supabase.rpc('current_spouse_user_ids');
  const hasSpouse = Array.isArray(spouseIds) && spouseIds.length > 0;

  // Godparents (ninong/ninang) per dependent — RLS scopes to the owner's rows.
  const { data: gpData } = await supabase
    .from('godparents')
    .select('godparent_id, dependent_id, godparent_name, role')
    .order('created_at', { ascending: true });
  const godparentsByDependent = new Map<string, GodparentRow[]>();
  for (const g of (gpData ?? []) as GodparentRow[]) {
    const list = godparentsByDependent.get(g.dependent_id) ?? [];
    list.push(g);
    godparentsByDependent.set(g.dependent_id, list);
  }

  return (
    <section className="mt-10">
      <header className="mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/50">
          The ones you care for
        </h2>
        <p className="mt-1 text-sm text-ink/55">
          A person, a pet, or anyone else. We store the names, dates, and events that matter — not
          documents. Milestones and rites apply to a person you plan for (a child or an elder).
        </p>
      </header>

      {dependents.length > 0 ? (
        <ul className="mb-6 space-y-2.5">
          {dependents.map((d) => {
            // Fence band, milestones + godparents are the PERSON case only — a
            // pet's birthday is never a "debut". Legacy rows (null kind) = person.
            const isPersonRow = (d.dependent_kind ?? 'person') === 'person';
            const band = isPersonRow && d.birth_date ? fenceBand(d.birth_date, today) : null;
            const next = isPersonRow && d.birth_date ? dependentNextMilestone(d.birth_date, d.sex, today) : null;
            const mine = d.owner_user_id === myUserId;
            const gps = godparentsByDependent.get(d.dependent_id) ?? [];
            return (
              <li
                key={d.dependent_id}
                className="rounded-xl border border-ink/10 bg-ink/[0.015] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{d.name}</p>
                    <p className="truncate text-xs text-ink/55">
                      {d.dependent_kind && d.dependent_kind !== 'person'
                        ? DEPENDENT_KIND_LABELS[d.dependent_kind]
                        : d.relationship
                          ? DEPENDENT_RELATIONSHIP_LABELS[d.relationship as keyof typeof DEPENDENT_RELATIONSHIP_LABELS]
                          : 'Someone I care for'}
                      {band === 'child' ? ' · under 18' : band === 'elder' ? ' · over 50' : ''}
                      {next ? ` · next: turns ${next.age} on ${fmt(next.dateISO)}` : ''}
                    </p>
                  </div>
                  {mine ? (
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
                  ) : (
                    <span className="shrink-0 rounded-full border border-gold/30 bg-gold/[0.08] px-2.5 py-1 text-[0.7rem] font-medium text-gold-deep">
                      Shared by your spouse
                    </span>
                  )}
                </div>

                {/* Share-with-spouse toggle — my own rows, only if I have a spouse */}
                {mine && hasSpouse ? (
                  <form action={setDependentSharing} className="mt-2">
                    <input type="hidden" name="dependent_id" value={d.dependent_id} />
                    <input type="hidden" name="share" value={d.shared_with_spouse ? '0' : '1'} />
                    <SubmitButton
                      className="text-xs font-medium text-ink/55 underline-offset-2 transition-colors hover:text-ink hover:underline"
                      pendingLabel="Saving…"
                    >
                      {d.shared_with_spouse
                        ? '✓ Shared with your spouse — tap to make private'
                        : 'Share with your spouse'}
                    </SubmitButton>
                  </form>
                ) : null}

                {/* Godparents (ninong / ninang) — only meaningful for a child */}
                {band === 'child' ? (
                  <div className="mt-3 border-t border-ink/10 pt-3">
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink/40">
                      Ninong &amp; ninang
                    </p>
                    {gps.length > 0 ? (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {gps.map((g) => (
                          <li
                            key={g.godparent_id}
                            className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white/60 py-1 pl-3 pr-1.5 text-xs text-ink/70"
                          >
                            <span>
                              {g.godparent_name}
                              {g.role ? <span className="text-ink/40"> · {g.role}</span> : null}
                            </span>
                            {mine ? (
                              <ConfirmForm
                                action={deleteGodparent}
                                title="Remove godparent?"
                                message={`Remove ${g.godparent_name}?`}
                                confirmLabel="Remove"
                              >
                                <input type="hidden" name="godparent_id" value={g.godparent_id} />
                                <button
                                  type="submit"
                                  aria-label={`Remove ${g.godparent_name}`}
                                  className="rounded-full px-1.5 text-ink/40 transition-colors hover:text-terracotta"
                                >
                                  ×
                                </button>
                              </ConfirmForm>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {mine ? (
                      <form action={addGodparent} className="mt-2 flex flex-wrap items-end gap-2">
                        <input type="hidden" name="dependent_id" value={d.dependent_id} />
                        <input
                          name="godparent_name"
                          className="input-field h-9 flex-1 py-1 text-sm sm:max-w-[12rem]"
                          placeholder="Add a ninong or ninang"
                          aria-label={`Godparent name for ${d.name}`}
                          required
                        />
                        <select
                          name="role"
                          defaultValue=""
                          aria-label="Role"
                          className="input-field h-9 w-auto py-1 text-sm"
                        >
                          <option value="">Role</option>
                          <option value="ninong">Ninong</option>
                          <option value="ninang">Ninang</option>
                        </select>
                        <input
                          name="godparent_email"
                          type="email"
                          className="input-field h-9 flex-1 py-1 text-sm sm:max-w-[13rem]"
                          placeholder="Email (optional — for reminders)"
                          aria-label={`Godparent email for ${d.name}`}
                        />
                        <SubmitButton className="button-secondary h-9 px-3 py-1 text-sm" pendingLabel="Adding…">
                          Add
                        </SubmitButton>
                      </form>
                    ) : gps.length === 0 ? (
                      <p className="mt-1 text-xs text-ink/40">No godparents added.</p>
                    ) : null}
                  </div>
                ) : null}
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
        <p className="text-sm font-medium text-ink">Add someone (or a pet)</p>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-ink" htmlFor="dep_kind">
            What is this?
          </label>
          <select id="dep_kind" name="dependent_kind" defaultValue="person" className="input-field sm:max-w-[14rem]">
            {DEPENDENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {DEPENDENT_KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <p className="text-xs text-ink/50">
            A pet or “something else” is just a name and, if you like, a birthday — no other details.
          </p>
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-ink" htmlFor="dep_name">
            Name <span className="text-terracotta">*</span>
          </label>
          <input id="dep_name" name="name" className="input-field" placeholder="e.g. Amara, or Bantay" required />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-ink" htmlFor="dep_birth">
            Birthday <span className="text-ink/40">(optional)</span>
          </label>
          <input id="dep_birth" name="birth_date" type="date" className="input-field sm:max-w-[14rem]" />
          <p className="text-xs text-ink/50">
            For a person, a stored birthday is only for a child (under 18) or an elder (over 50) —
            adults keep their own, so invite them instead. A pet can have any birthday, or none.
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
