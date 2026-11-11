/**
 * # The open decision pins' bodies — each open topic OPENS (owner-approved prototype 11 Nov 2026): what it holds,
 * newest first, its Edit topic and its Close · settled (`DecisionPanel`), keyed by its pin. Loaded only when a chat has
 * an open topic. Close · settled here is the same `chat_decision_set_closed` door `DecisionToggle` uses.
 */
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

import type { PinFact } from '@/lib/chat-pins';

const DecisionPanel = dynamic(() => import('./decision-panel').then((m) => m.DecisionPanel));

export function decisionPinBodies(facts: readonly PinFact[]): Record<string, ReactNode> {
  const out: Record<string, ReactNode> = {};
  for (const f of facts) {
    if (f.kind !== 'decision') continue;
    out[f.key] = <DecisionPanel topicId={f.key.slice('decision:'.length)} title={f.title} />;
  }
  return out;
}
