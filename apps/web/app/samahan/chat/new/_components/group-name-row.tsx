'use client';

/** "+ New group" — the group's name, in the house field (TypedRow, the Form-row template); posts as `name`. */
import { useState } from 'react';
import { FormRows, TypedRow } from '@/app/_components/form-row';

export function GroupNameRow() {
  const [name, setName] = useState('');
  return (
    <FormRows>
      <TypedRow
        name="Name"
        value={name}
        required
        empty="Name the group"
        placeholder="Day-of crew"
        maxLength={60}
        autoCapitalize="sentences"
        fieldName="name"
        onKeep={(t) => setName(t)}
        data="new-group-name"
      />
    </FormRows>
  );
}
