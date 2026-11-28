'use client';

/**
 * 👗 The send (plan A10): her design's picture, the design in words, her main numbers, the privacy line, and one Send.
 * What she sends is checked by the shop's own action (`op: 'send'`); a refusal reads as a plain reason with Try again.
 * No price and no estimate here: the shop prices the design on the server, from its own list.
 */
import { useState } from 'react';
import { Send } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { GownStill } from '@/app/_components/plan3d/kit/gown-view';
import type { GownBody, GownConfig, GownHand, GownQuantities } from '@/lib/gown-config';
import type { GownBodyEstimates } from '@/lib/gown/body/estimate';
import { gownSayHeight, gownSayLength, type GownUnits } from '@/lib/gown/flow';
import { gownDesignSummary, gownSendInput, gownSendPrivacy } from '@/lib/gown/send';
import { gownAction } from './gown-call';
import css from './gown-designer.module.css';

export type GownSendProps = {
  threadId: string;
  shopName: string;
  config: GownConfig;
  body: GownBody;
  hand: GownHand;
  fabrics: readonly { id: string; label: string }[];
  units: GownUnits;
  /** From the stage's last full build; null until the gown has been measured once. */
  measured: { quantities: GownQuantities; estimates: GownBodyEstimates } | null;
  onSent: () => void;
};

export function GownSend({ threadId, shopName, config, body, hand, fabrics, units, measured, onSent }: GownSendProps) {
  const [state, setState] = useState<'idle' | 'sending' | { error: string }>('idle');
  const lines = gownDesignSummary(config, fabrics), v = body.vals;
  const send = async () => {
    if (!measured) return;
    setState('sending');
    const r = await gownAction(gownSendInput(threadId, { config, body, hand, ...measured }));
    if (r.ok) { setState('idle'); onSent(); } else setState({ error: r.message });
  };
  return (
    <div className="grid gap-3" data-gown-send>
      <div className={css.stillBox}>
        <GownStill design={config} alt={lines.slice(0, 3).join(', ')} vals={v} fine={{ athletic: body.athletic, bustT: body.bustT, given: body.given }} />
      </div>
      <ul className="grid gap-1 text-sn-13" data-gown-summary>
        {lines.map((l) => <li key={l}>{l}</li>)}
      </ul>
      <p className="text-sn-13" data-gown-body-line>
        {`Height ${gownSayHeight(v.height, units)} · bust ${gownSayLength(v.bust, units)} · waist ${gownSayLength(v.waist, units)} · hips ${gownSayLength(v.hips, units)} · ${config.heel ? `${gownSayLength(config.heel, units)} heels` : 'flat shoes'}`}
      </p>
      <p className="text-sn-13 text-ink/75" data-gown-privacy>{gownSendPrivacy(shopName)}</p>
      {typeof state === 'object' ? <p className="text-sn-13" role="alert">{state.error}</p> : null}
      <ActionButton tone="brand" main icon={Send} label={typeof state === 'object' ? 'Try again' : state === 'sending' ? 'Sending…' : `Send to ${shopName}`} onClick={send} disabled={!measured || state === 'sending'} data-gown-send-btn="" />
    </div>
  );
}
