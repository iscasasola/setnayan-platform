'use client';

/**
 * WhyRow — the optional "Why?" a supplier sends with a no (turning a booking down · keeping an event for now), drawn
 * by the ONE Field template (`TypedRow`, owner 1 Nov 2026: every field follows it). It posts as `reason`, 240 at
 * most, exactly as the raw box did; the couple reads it.
 */
import { useState } from 'react';
import { FormRows, TypedRow } from '@/app/_components/form-row';

export function WhyRow() {
  const [why, setWhy] = useState('');
  return (
    <div className="w-full min-w-0">
      <FormRows width="wide">
        <TypedRow
          name="Why?"
          value={why}
          empty="Optional · the couple sees it"
          maxLength={240}
          fieldName="reason"
          onKeep={(t) => setWhy(t)}
          data="answer-why"
          pillAttrs={{ 'data-answer-why': '' }}
        />
      </FormRows>
    </div>
  );
}
