'use client';

/**
 * The reason an admin gives for taking back a free booking fee (Admin › Gifts › Badge rewards), drawn by the ONE Field
 * template (`TypedRow`). Posts as `reason`; the action itself refuses one under ten characters.
 */
import { useState } from 'react';
import { TypedRow } from '@/app/_components/form-row';

export function TakeBackReasonField() {
  const [value, setValue] = useState('');
  return (
    <TypedRow
      name="Reason"
      value={value}
      required
      maxLength={200}
      empty="Why"
      placeholder="Why (10+ characters)"
      fieldName="reason"
      onKeep={(t) => setValue(t)}
      data="badge-take-back-reason"
    />
  );
}
