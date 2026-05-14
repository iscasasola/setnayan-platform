'use client';

import { useState } from 'react';

// Normalizes any input shape (`300003455000`, `300 003 455 000`,
// `300-003-455000`, etc.) to the canonical `XXX-XXX-XXX-XXX` BIR TIN format.
// Caps at 12 digits — additional input is dropped silently.
export function formatTin(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 12);
  return digits.replace(/(\d{3})(?=\d)/g, '$1-');
}

export function TinInput({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(() => formatTin(defaultValue));
  return (
    <input
      id="business_tin"
      name="business_tin"
      value={value}
      onChange={(event) => setValue(formatTin(event.target.value))}
      placeholder="000-000-000-000"
      inputMode="numeric"
      maxLength={15}
      autoComplete="off"
      className="input-field font-mono"
    />
  );
}
