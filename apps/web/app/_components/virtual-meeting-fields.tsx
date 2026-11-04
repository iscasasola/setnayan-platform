'use client';

// The Virtual half of every meeting composer — a Jitsi link Setnayan makes
// itself, shown read-only with its ⓘ (owner 2026-11-04, DECISION_LOG "VIRTUAL =
// JITSI ONLY": "let's go with jitsi" · "just jitsi"). No app menu, no field to
// type in, no API, no account. Posts `virtual_value`; the server keeps it only
// if it is a link Setnayan made (`virtualLocationFromForm`), else makes a fresh
// one. No call ever happens inside Setnayan.

import { useEffect, useState } from 'react';
import { InfoTip } from './info-tip';
import { JITSI_HOST_TIP, JITSI_MADE_NOTE, makeJitsiLink } from '@/lib/virtual-meeting';

export function VirtualMeetingFields({
  labelClassName = 'flex flex-col gap-1 text-[11px] font-medium text-ink/60',
}: {
  labelClassName?: string;
}) {
  const [link, setLink] = useState('');
  // Random — so made after mount, never during the server render.
  useEffect(() => {
    setLink(makeJitsiLink());
  }, []);

  return (
    <div className={labelClassName} data-virtual-fields>
      <span>Meeting link</span>
      <input type="hidden" name="virtual_value" value={link} />
      <p className="break-all text-sm font-normal normal-case tracking-normal text-ink/85" data-jitsi-link>
        {link || '…'}
      </p>
      <InfoTip label={JITSI_MADE_NOTE} align="start" labelClassName="text-[11px] font-normal normal-case tracking-normal text-ink/55">
        {JITSI_HOST_TIP}
      </InfoTip>
    </div>
  );
}
