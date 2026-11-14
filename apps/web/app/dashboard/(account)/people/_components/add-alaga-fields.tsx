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
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { InfoTip } from '@/app/_components/info-tip';
import { PostedPick } from '@/app/dashboard/[eventId]/_components/posted-pick';

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
        <span className="block text-sm font-medium text-ink">
          What is this?
        </span>
        {/* Rule 4 (design template 14 Nov 2026): the ▾ pick, posting the same `dependent_kind` field. */}
        <span className="block sm:max-w-[14rem]">
          <input type="hidden" name="dependent_kind" value={kind} />
          <PickMenu
            label="What is this?"
            value={kind}
            options={DEPENDENT_KINDS.map((k) => ({ key: k, label: DEPENDENT_KIND_LABELS[k] }))}
            onPick={(k) => setKind(k as DependentKind)}
            dataAttr="data-posted-pick-dependent_kind"
            className="w-full !min-h-12"
          />
        </span>
        {!person ? (
          <p className="text-xs text-ink/70">
            {DEPENDENT_KIND_LABELS[kind]} is just a name and, if you like, one date — no other
            details.
          </p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-ink" htmlFor="dep_name">
          Name <span className="text-[color:var(--sn-gold-700)]">*</span>
        </label>
        <input
          autoComplete="off"
          id="dep_name"
          name="name"
          className="input-field"
          placeholder={NAME_PLACEHOLDERS[kind]}
          required
        />
      </div>
      <div className="space-y-1.5">
        {person ? (
          <span className="flex items-center gap-1">
            <InfoTip label="Birthday" labelClassName="text-sm font-medium text-ink" align="start">
              A stored birthday is only for a child (under 18) or an elder (over 50) — adults keep
              their own, so invite them instead.
            </InfoTip>
            <span className="text-sm text-ink/70">(optional)</span>
          </span>
        ) : (
          <label className="block text-sm font-medium text-ink" htmlFor="dep_birth">
            {DEPENDENT_DATE_LABELS[kind]} <span className="text-ink/70">(optional)</span>
          </label>
        )}
        <input
          id="dep_birth"
          name="birth_date"
          type="date"
          aria-label={person ? 'Birthday (optional)' : undefined}
          className="input-field sm:max-w-[14rem]"
        />
      </div>
      {person ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-ink">Relationship</span>
              <PostedPick
                name="relationship"
                label="Relationship"
                initial="child"
                className="block"
                options={DEPENDENT_RELATIONSHIPS.map((r) => ({ key: r, label: DEPENDENT_RELATIONSHIP_LABELS[r] }))}
              />
            </div>
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-ink">For the debut year (optional)</span>
              <PostedPick
                name="sex"
                label="For the debut year"
                className="block"
                options={[
                  { key: '', label: 'Prefer not to say' },
                  ...DEPENDENT_SEXES.map((s) => ({ key: s, label: s === 'female' ? '18th (daughter)' : '21st (son)' })),
                ]}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-ink">Religion (optional — unlocks their rites)</span>
            <PostedPick
              name="religion"
              label="Religion"
              className="block"
              options={[{ key: '', label: 'Prefer not to say' }, ...RELIGIONS.map((r) => ({ key: r, label: RELIGION_LABELS[r] }))]}
            />
          </div>
        </>
      ) : null}
    </>
  );
}
