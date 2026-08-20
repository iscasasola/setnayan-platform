'use client';

import { useState } from 'react';
import {
  DEPENDENT_KINDS,
  DEPENDENT_KIND_LABELS,
  DEPENDENT_DATE_LABELS,
  DEPENDENT_RELATIONSHIPS,
  DEPENDENT_RELATIONSHIP_LABELS,
  DEPENDENT_SEXES,
  RELIGIONS,
  isPersonDependent,
  type DependentKind,
} from '@/lib/dependent-people';
import { RELIGION_LABELS } from '@/lib/profile-personalization';

/** A name example that fits what is being named — "e.g. Bantay" on a business read wrong. */
const NAME_PLACEHOLDERS: Record<DependentKind, string> = {
  person: 'e.g. Amara',
  pet: 'e.g. Bantay',
  business: "e.g. Amara's Kitchen",
  item: 'e.g. The red Vios',
  other: 'e.g. The family farm',
};

/**
 * The add-form's fields, client-side so the kind choice can hide what it makes
 * irrelevant. addDependent nulls relationship/sex/religion for every non-person
 * kind, so rendering those questions for a business/pet/item asked for answers
 * the save was always going to discard. Only a PERSON sees them; everything
 * else is a name + one optional date, labelled per kind (founding date, the
 * day it became yours, …) instead of the static all-kinds enumeration.
 */
export function AddAlagaFields() {
  const [kind, setKind] = useState<DependentKind>('person');
  const person = isPersonDependent(kind);
  return (
    <>
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-ink" htmlFor="dep_kind">
          What is this?
        </label>
        <select
          id="dep_kind"
          name="dependent_kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as DependentKind)}
          className="input-field sm:max-w-[14rem]"
        >
          {DEPENDENT_KINDS.map((k) => (
            <option key={k} value={k}>
              {DEPENDENT_KIND_LABELS[k]}
            </option>
          ))}
        </select>
        {!person ? (
          <p className="text-xs text-ink/50">
            {DEPENDENT_KIND_LABELS[kind]} is just a name and, if you like, one date — no other
            details.
          </p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-ink" htmlFor="dep_name">
          Name <span className="text-terracotta">*</span>
        </label>
        <input
          id="dep_name"
          name="name"
          className="input-field"
          placeholder={NAME_PLACEHOLDERS[kind]}
          required
        />
      </div>
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-ink" htmlFor="dep_birth">
          {person ? 'Birthday' : DEPENDENT_DATE_LABELS[kind]}{' '}
          <span className="text-ink/40">(optional)</span>
        </label>
        <input id="dep_birth" name="birth_date" type="date" className="input-field sm:max-w-[14rem]" />
        {person ? (
          <p className="text-xs text-ink/50">
            A stored birthday is only for a child (under 18) or an elder (over 50) — adults keep
            their own, so invite them instead.
          </p>
        ) : null}
      </div>
      {person ? (
        <>
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
        </>
      ) : null}
    </>
  );
}
