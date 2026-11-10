/**
 * # The open decision pins' bodies — each open topic's Close control (`DecisionToggle`), keyed by its pin. Loaded only
 * when a chat has an open topic.
 */
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

import type { PinFact } from '@/lib/chat-pins';

const DecisionToggle = dynamic(() => import('./decision-toggle').then((m) => m.DecisionToggle));

export function decisionPinBodies(facts: readonly PinFact[]): Record<string, ReactNode> {
  const out: Record<string, ReactNode> = {};
  for (const f of facts) {
    if (f.kind !== 'decision') continue;
    out[f.key] = <DecisionToggle topicId={f.key.slice('decision:'.length)} closed={false} />;
  }
  return out;
}
