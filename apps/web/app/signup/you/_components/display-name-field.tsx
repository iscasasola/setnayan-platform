'use client';

/**
 * DisplayNameField — the You card's "Display name", drawn by the ONE Field template (`TypedRow`, owner 1 Nov 2026:
 * every field follows it). Posts as `display_name`, exactly as the raw box did; required, 128 at most; an empty one
 * holds the card's Done and shakes into view (`RequiredRowsHold`), as the raw box's `required` did in the browser.
 */
import { useState } from 'react';
import { TypedRow } from '@/app/_components/form-row';
import { RequiredRowsHold } from '@/app/_components/required-rows-hold';

export function DisplayNameField({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <TypedRow
        name="Display name"
        value={value}
        required
        maxLength={128}
        autoCapitalize="words"
        autoComplete="nickname"
        empty="How you want to appear"
        fieldName="display_name"
        onKeep={(t) => setValue(t)}
        data="you-name"
        pillAttrs={{ 'data-you-name': '' }}
      />
      <RequiredRowsHold />
    </>
  );
}
