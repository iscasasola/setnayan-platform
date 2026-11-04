'use client';

// The Virtual half of every meeting composer (owner 2026-11-04): a "Via"
// dropdown (Jitsi Meet · Google Meet · Zoom · Messenger · Viber · Phone call)
// and ONE field whose label follows the pick — except Jitsi, whose link
// Setnayan makes itself, read-only (no API, no account). Posts `via` +
// `virtual_value`; the server re-validates with the same
// `normalizeVirtualValue` (lib/virtual-meeting.ts) and saves nothing when it
// fails. No call ever happens inside Setnayan.

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { InfoTip } from './info-tip';
import {
  JITSI_HOST_TIP,
  JITSI_MADE_NOTE,
  PHONE_IS_ONE_PERSON,
  VIRTUAL_VIAS,
  VIRTUAL_VIA_META,
  createLinkHref,
  makeJitsiLink,
  normalizeVirtualValue,
  type VirtualVia,
} from '@/lib/virtual-meeting';

const VIA_OPTIONS = VIRTUAL_VIAS.map((v) => ({ key: v, label: VIRTUAL_VIA_META[v].label }));

export function VirtualMeetingFields({
  initialVia = 'jitsi',
  initialValue = '',
  onValidChange,
  inputClassName = 'input-field h-9 text-sm',
  labelClassName = 'flex flex-col gap-1 text-[11px] font-medium text-ink/60',
}: {
  initialVia?: VirtualVia;
  initialValue?: string;
  /** Told whether the current value would be saved, so the parent can disable its submit. */
  onValidChange?: (ok: boolean) => void;
  inputClassName?: string;
  labelClassName?: string;
}) {
  const [via, setVia] = useState<VirtualVia>(initialVia);
  const [value, setValue] = useState(initialValue);
  const [touched, setTouched] = useState(false);
  const meta = VIRTUAL_VIA_META[via];
  const check = normalizeVirtualValue(via, value);
  const error = touched && !check.ok ? check.error : null;
  const createHref = createLinkHref(via);

  // Jitsi: make the link after mount — it is random, so never during the server render.
  useEffect(() => {
    if (via === 'jitsi' && value === '') setValue(makeJitsiLink());
  }, [via, value]);

  const report = (nextVia: VirtualVia, nextValue: string) =>
    onValidChange?.(normalizeVirtualValue(nextVia, nextValue).ok);

  return (
    <div className="flex flex-col gap-2" data-virtual-fields>
      <input type="hidden" name="via" value={via} />
      <div className={labelClassName}>
        <span>Via</span>
        <PickMenu
          label="Which app the meeting is on"
          value={via}
          options={VIA_OPTIONS}
          dataAttr="data-meeting-via"
          onPick={(k) => {
            const next = k as VirtualVia;
            setVia(next);
            setValue('');
            setTouched(false);
            report(next, '');
          }}
        />
      </div>
      {via === 'jitsi' ? (
        <div className={labelClassName}>
          <span>{meta.field}</span>
          <input type="hidden" name="virtual_value" value={value} />
          <p className="break-all text-sm font-normal normal-case tracking-normal text-ink/85" data-jitsi-link>
            {value || '…'}
          </p>
          <InfoTip label={JITSI_MADE_NOTE} align="start" labelClassName="text-[11px] font-normal normal-case tracking-normal text-ink/55">
            {JITSI_HOST_TIP}
          </InfoTip>
        </div>
      ) : (
        <label className={labelClassName}>
          {meta.field}
          <input
            type={meta.inputMode === 'tel' ? 'tel' : 'url'}
            inputMode={meta.inputMode}
            name="virtual_value"
            value={value}
            maxLength={500}
            autoComplete="off"
            placeholder={meta.placeholder}
            aria-invalid={error ? true : undefined}
            onChange={(e) => {
              setValue(e.target.value);
              report(via, e.target.value);
            }}
            onBlur={() => setTouched(true)}
            className={inputClassName}
          />
        </label>
      )}
      {error ? (
        <p role="alert" className="text-[11px] text-danger-700">
          {error}
        </p>
      ) : null}
      {meta.freeNote ? <p className="text-[11px] text-ink/50">{meta.freeNote}</p> : null}
      {createHref ? (
        <>
          <a
            href={createHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 self-start rounded-lg border border-ink/15 px-2.5 text-xs font-medium text-ink/75 hover:bg-ink/[0.04]"
          >
            <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Create a {meta.label} link
          </a>
          <p className="text-[11px] text-ink/50">Opens {meta.label} in your own account — paste the link here.</p>
        </>
      ) : null}
      {via === 'phone' ? <p className="text-[11px] text-warn-900">{PHONE_IS_ONE_PERSON}</p> : null}
    </div>
  );
}
