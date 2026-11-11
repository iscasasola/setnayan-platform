/**
 * # The open decision pins' bodies — each open topic OPENS (owner-approved prototype 11 Nov 2026): what it holds,
 * newest first, its Edit topic and its Close · settled (`DecisionPanel`), keyed by its pin. Loaded only when a chat has
 * an open topic. Close · settled here is the `chat_decision_set_closed` door.
 */
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

import type { PinFact } from '@/lib/chat-pins';
import type { FiledMessage } from '@/lib/chat-decisions';

const DecisionPanel = dynamic(() => import('./decision-panel').then((m) => m.DecisionPanel));

/** `lab` — dev labs only (no database): fixture filed rows per topic id, and the viewer. */
export function decisionPinBodies(
  facts: readonly PinFact[],
  lab?: { filed: Record<string, FiledMessage[]>; me: string },
): Record<string, ReactNode> {
  const out: Record<string, ReactNode> = {};
  for (const f of facts) {
    if (f.kind !== 'decision') continue;
    const topicId = f.key.slice('decision:'.length);
    out[f.key] = (
      <DecisionPanel
        topicId={topicId}
        title={f.title}
        kicker={`Decision · ${f.openedByYou ? 'you' : 'they'} opened it`}
        lab={lab ? { filed: lab.filed[topicId] ?? [], me: lab.me } : undefined}
      />
    );
  }
  return out;
}
