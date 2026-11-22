'use client';

/**
 * Team › Roles — the six boxes (owner 19 Nov 2026, drawing (a)). Each role is ONE house Field (`TypedRow`): its fixed
 * name on the left with ⓘ for what it can and can't do, the shop's own name in the pill. Posted under `name_<role>` to
 * the SHIPPED `setVendorRoleNames`; a blank box keeps the fixed name. Every write is handed in — no action imported.
 */
import { useState } from 'react';
import { Check } from 'lucide-react';
import { FormRows, TypedRow } from '@/app/_components/form-row';
import { StayForm } from '@/app/_components/stay-form';
import { SupplierSubmit } from '../../_components/supplier-submit';
import {
  VENDOR_DUTIES,
  VENDOR_DUTY_DETAIL,
  VENDOR_DUTY_LINE,
  VENDOR_DUTY_NAME,
  type VendorDuty,
  type VendorRoleNames,
} from '@/lib/vendor-duties';

type Action = (formData: FormData) => void | Promise<void>;

function badgeOf(duty: VendorDuty): string | null {
  if (duty === 'helper') return '1 free';
  if (duty === 'shop_manager' || duty === 'marketing') return 'Whole shop';
  return null;
}

export function RolesForm({ names, action }: { names: VendorRoleNames; action: Action }) {
  const [typed, setTyped] = useState<VendorRoleNames>(names);
  return (
    <StayForm door="supTeam.setVendorRoleNames" action={action} className="mt-4" data-team-roles-form="">
      <FormRows width="wide" data="team-roles">
        {VENDOR_DUTIES.map((duty) => (
          <TypedRow
            key={duty}
            name={VENDOR_DUTY_NAME[duty]}
            about={{ title: VENDOR_DUTY_NAME[duty], words: VENDOR_DUTY_DETAIL[duty] }}
            value={typed[duty] ?? ''}
            empty="Your name for it"
            placeholder={VENDOR_DUTY_NAME[duty]}
            maxLength={40}
            fieldName={`name_${duty}`}
            onKeep={(t) => {
              setTyped((prev) => ({ ...prev, [duty]: t.trim() }));
              return { ok: true };
            }}
            attrs={{ 'data-team-role': duty }}
            note={[badgeOf(duty), VENDOR_DUTY_LINE[duty]].filter(Boolean).join(' · ')}
          />
        ))}
      </FormRows>
      <p className="mt-2 text-[12.5px] text-[color:var(--m-slate-2)]">
        A blank box keeps the fixed name. Renaming changes only the words.
      </p>
      <div className="mt-4">
        <SupplierSubmit
          tone="brand"
          main
          icon={<Check aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
          label="Save names"
          pendingLabel="Saving…"
          className="w-full"
        />
      </div>
    </StayForm>
  );
}
