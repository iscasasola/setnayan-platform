'use client';

import './analytics-growing.css';
import { LockedFeature } from '@/app/_components/lock/locked-feature';
import { CardSellPic } from './new-graph-pics';
import { GRAPH_SAMPLE } from './graph-sample';

/**
 * 🔒 ANALYTICS BEYOND SIMPLE COUNTS OPENS ONCE VERIFIED (Build 6 · Lane I, on Build 5 Lane B's shared lock; DECISION_LOG
 * 2026-11-10 "FREE (UNVERIFIED): THE LAST SEVEN, AND EVERY LIMIT LIFTS ON VERIFIED"; corpus
 * `plans/free_unverified_limits_2026-11-10/00-FREE-UNVERIFIED-LIMITS.md` §5: *"Analytics beyond simple counts (views and
 * inquiries stay as numbers)"*).
 *
 * An unverified shop keeps its counts — the pinned opened · asked · booked row — and sees the graphs as ONE lock, never
 * hidden: the shared `LockedFeature` (its real name, a 🔒, tap → Problem → Solution → the view-only preview → the papers
 * progress → Get verified). The preview is the "Which card sells" picture on the SAMPLE data the empty tiles already
 * draw (`GRAPH_SAMPLE`) — never this shop's numbers, which the server did not read.
 *
 * The RULE is `canUse('analytics', …)` on the server (`performance/page.tsx` returns before any graph read); this is
 * only the LOOK. 🔒 app/_components/lock/every-lock-shows-problem-and-solution.test.ts · performance/every-graph-is-a-tile.test.ts
 */
export function AnalyticsLock({ progress }: { progress: string }) {
  return (
    <div className="mt-4" data-analytics-locked="">
      <LockedFeature
        lock="analytics"
        need={{ kind: 'verify', progress }}
        line="Every graph, and what we recommend you do next"
        preview={
          <div data-growth="">
            <CardSellPic c={GRAPH_SAMPLE.cardsell} />
          </div>
        }
      />
    </div>
  );
}
