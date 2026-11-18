'use client';

/**
 * The "Match to" dropdown and its button, as the v5 drawing draws them: the
 * button names who was picked ("Match to Carlo M."). Same house dropdown as
 * `FormPick` (`PickMenu`), with the pick also feeding the button's words.
 */
import { useState } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { SubmitButton } from '@/app/_components/submit-button';

export function ReceivedMatchPick({
  name,
  label,
  placeholder,
  options,
  dataAttr,
  verb,
}: {
  name: string;
  label: string;
  placeholder: string;
  /** `who` is what the button names once picked. */
  options: ReadonlyArray<{ key: string; label: string; who: string }>;
  dataAttr: string;
  /** "Match to" on a received card; "Confirm payment" on a buyer card. */
  verb: string;
}) {
  const [value, setValue] = useState<string | null>(null);
  const picked = value ? options.find((o) => o.key === value) : undefined;
  return (
    <>
      <input type="hidden" name={name} value={value ?? ''} />
      <PickMenu
        label={label}
        value={value}
        options={options.map(({ key, label: l }) => ({ key, label: l }))}
        onPick={setValue}
        buttonText={picked?.label ?? placeholder}
        dataAttr={dataAttr}
        className="min-h-11 w-full max-w-[420px]"
      />
      <SubmitButton className="ab ab-ok min-h-11" pendingLabel="Confirming…" disabled={!picked}>
        {picked && verb === 'Match to' ? `Match to ${picked.who}` : verb}
      </SubmitButton>
    </>
  );
}
