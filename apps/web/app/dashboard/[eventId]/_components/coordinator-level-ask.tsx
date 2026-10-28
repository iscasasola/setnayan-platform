'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Eye, KeyRound, ShieldQuestion } from 'lucide-react';

import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { PeekToast } from '@/app/_components/toast/peek-toast';
import { setDelegateArea } from '@/app/dashboard/[eventId]/hosts/actions';
import {
  ACCESS_LEVEL_AREA,
  ACCESS_LEVEL_UNDO,
  LEVEL_LINE,
  LEVEL_WORD,
  type CoordinatorAccessLevel,
} from '@/lib/coordinator-access-level';

type Ask = { moderatorId: string; title: string };
type Said = { key: number; tone: 'ok' | 'bad'; words: string; undo?: Ask };

/**
 * The card's body — one ask per connected coordinator (title + one short line; what each level means behind the ⓘ),
 * two house ActionButtons, Limited · Full access. A press saves IN PLACE: the ask leaves at once, the toast says what
 * was given, with Undo (6 s, the toast's own action pill). A refusal puts the ask back and says why. The choice stays
 * changeable in Event details › Access (`accessHref`).
 */
export function CoordinatorLevelAsk({
  eventId,
  asks,
  unread,
  accessHref,
}: {
  eventId: string;
  asks: Ask[];
  /** The seats could not be read — said, with the one door to where access is set. */
  unread: boolean;
  accessHref: string;
}) {
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [said, setSaid] = useState<Said | null>(null);
  const [busy, startTransition] = useTransition();

  const say = (s: Omit<Said, 'key'>) => setSaid({ ...s, key: Date.now() });

  const answer = (ask: Ask, level: CoordinatorAccessLevel) => {
    setAnswered((a) => new Set(a).add(ask.moderatorId));
    startTransition(async () => {
      const res = await setDelegateArea(eventId, ask.moderatorId, ACCESS_LEVEL_AREA, level);
      if (!res.ok) {
        setAnswered((a) => {
          const n = new Set(a);
          n.delete(ask.moderatorId);
          return n;
        });
        say({ tone: 'bad', words: res.error });
        return;
      }
      say({ tone: 'ok', words: `${LEVEL_WORD[level]} given. You can change it in Event details › Access.`, undo: ask });
    });
  };

  const undo = (ask: Ask) => {
    startTransition(async () => {
      const res = await setDelegateArea(eventId, ask.moderatorId, ACCESS_LEVEL_AREA, ACCESS_LEVEL_UNDO);
      if (!res.ok) {
        say({ tone: 'bad', words: res.error });
        return;
      }
      setAnswered((a) => {
        const n = new Set(a);
        n.delete(ask.moderatorId);
        return n;
      });
      setSaid(null);
    });
  };

  const toast =
    said && typeof document !== 'undefined'
      ? createPortal(
          <PeekToast
            key={said.key}
            tone={said.tone}
            data="coordinator-level"
            action={said.undo ? { label: 'Undo', onPress: () => undo(said.undo!) } : undefined}
            onGone={() => setSaid(null)}
          >
            {said.words}
          </PeekToast>,
          document.body,
        )
      : null;

  if (unread) {
    return (
      <Link href={accessHref} className="sn-tile flex items-center gap-3 p-4 transition hover:border-terracotta" data-coordinator-level="unread">
        <ShieldQuestion aria-hidden className="h-5 w-5 shrink-0 text-terracotta" strokeWidth={1.75} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">We couldn’t check your coordinator’s access</span>
          <span className="mt-0.5 block text-xs text-ink/60">Open who has access to see it.</span>
        </span>
        <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-ink/35" strokeWidth={1.75} />
      </Link>
    );
  }

  const open = asks.filter((a) => !answered.has(a.moderatorId));
  return (
    <>
      {open.map((ask) => (
        <section key={ask.moderatorId} className="py-3" data-coordinator-level="ask" aria-label={ask.title}>
          <InfoTip label={ask.title} labelAs="p" labelClassName="text-[15px] font-semibold leading-snug text-ink" align="start">
            {LEVEL_WORD.limited}: {LEVEL_LINE.limited} {LEVEL_WORD.full}: {LEVEL_LINE.full} You can change it any time in
            Event details › Access.
          </InfoTip>
          <p className="mt-0.5 text-[13px] text-ink/60">They’ve joined your event. Pick what they can do.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton
              tone="neutral"
              icon={Eye}
              label={LEVEL_WORD.limited}
              onClick={() => answer(ask, 'limited')}
              disabled={busy}
              className="min-h-11"
              data-testid="coordinator-level-limited"
            />
            <ActionButton
              tone="brand"
              icon={KeyRound}
              label={LEVEL_WORD.full}
              onClick={() => answer(ask, 'full')}
              disabled={busy}
              className="min-h-11"
              data-testid="coordinator-level-full"
            />
          </div>
        </section>
      ))}
      {toast}
    </>
  );
}
