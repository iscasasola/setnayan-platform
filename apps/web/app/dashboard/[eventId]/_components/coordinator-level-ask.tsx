'use client';

import { useId, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Eye, KeyRound } from 'lucide-react';

import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import { PeekToast } from '@/app/_components/toast/peek-toast';
import { VendorAvatar, deriveVendorInitials } from '@/app/_components/vendor-avatar';
import { setDelegateArea } from '@/app/dashboard/[eventId]/hosts/actions';
import {
  ACCESS_LEVEL_AREA,
  ACCESS_LEVEL_UNDO,
  LEVEL_LINE,
  LEVEL_MORE,
  LEVEL_WORD,
  levelTodayWords,
  type CoordinatorAccessLevel,
} from '@/lib/coordinator-access-level';
import { HomeTodayItem } from './home-parts';

/** One connected coordinator the hosts have not answered for: the seat, and the SHOP that joined (name + logo). */
export type LevelAsk = { moderatorId: string; shop: string | null; logoUrl: string | null };
type Said = { key: number; tone: 'ok' | 'bad'; words: string; undo?: LevelAsk };

/** The two choices, in the owner's order; Full access is the primary one. */
const CHOICES: readonly { level: CoordinatorAccessLevel; Icon: typeof Eye; primary: boolean }[] = [
  { level: 'limited', Icon: Eye, primary: false },
  { level: 'full', Icon: KeyRound, primary: true },
];

/**
 * 🔑 THE COORDINATOR'S ACCESS — A LINE IN HOME'S TODAY LIST, ANSWERED IN THE HOUSE SHEET (owner 2026-10-29: *"The popup
 * for the access and other popups above the header can be presented better"*). It sat ABOVE the cover as a plain block
 * with two buttons; now it is ONE Today line — "<shop> joined as your coordinator · Pick their access" — sorted first
 * (it waits on the hosts), and the press opens the shared `Sheet` (bottom on a portrait phone, the right panel from the
 * couple dashboard's `tab:` line up): the shop's logo + name, then two choice rows, Limited · Full access (each title +
 * one short line, the rest behind the ⓘ), Full access the primary.
 *
 * A choice writes EXACTLY as before (`setDelegateArea`, area `access_level` — Full = the co-host seat) and saves IN
 * PLACE: the sheet closes, the line leaves at once, the toast says what was given with Undo (the toast's own action
 * pill). A refusal puts the line back and says why. The answer stays changeable in Event details › Access.
 */
export function CoordinatorLevelAsk({
  eventId,
  asks,
  unread,
  accessHref,
}: {
  eventId: string;
  asks: LevelAsk[];
  /** The seats could not be read — said, with the one door to where access is set. */
  unread: boolean;
  accessHref: string;
}) {
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [openFor, setOpenFor] = useState<LevelAsk | null>(null);
  const [said, setSaid] = useState<Said | null>(null);
  const [busy, startTransition] = useTransition();
  const headingId = useId();

  const say = (s: Omit<Said, 'key'>) => setSaid({ ...s, key: Date.now() });

  const answer = (ask: LevelAsk, level: CoordinatorAccessLevel) => {
    setOpenFor(null);
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

  const undo = (ask: LevelAsk) => {
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
      <HomeTodayItem
        href={accessHref}
        tone="warn"
        words="We couldn’t check your coordinator’s access"
        tail="Open who has access"
        dataAttr={['data-coordinator-level', 'unread']}
      />
    );
  }

  const open = asks.filter((a) => !answered.has(a.moderatorId));
  const shopOf = (a: LevelAsk) => a.shop?.trim() || 'Your coordinator';
  return (
    <>
      {open.map((ask) => (
        <HomeTodayItem
          key={ask.moderatorId}
          words={levelTodayWords(ask.shop)}
          tail="Pick their access"
          onPress={() => setOpenFor(ask)}
          disabled={busy}
          dataAttr={['data-coordinator-level', 'ask']}
        />
      ))}
      <Sheet open={openFor !== null} onClose={() => setOpenFor(null)} labelledById={headingId} rise>
        {openFor ? (
          <div className="px-4 pb-4 pt-3.5" data-coordinator-level-sheet="">
            <div className="flex items-center gap-3 pr-12">
              <VendorAvatar
                logoUrl={openFor.logoUrl}
                initials={deriveVendorInitials(shopOf(openFor))}
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
              />
              <div className="min-w-0">
                <InfoTip
                  label={shopOf(openFor)}
                  labelAs="h3"
                  labelId={headingId}
                  labelClassName="text-[19px] font-semibold leading-snug tracking-tight text-ink [overflow-wrap:anywhere]"
                  align="start"
                >
                  {LEVEL_WORD.limited}: {LEVEL_MORE.limited} {LEVEL_WORD.full}: {LEVEL_MORE.full} You can change it any
                  time in Event details › Access.
                </InfoTip>
                <p className="text-sm text-ink/60">Joined as your coordinator. What can they do?</p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2" role="group" aria-label="Their access">
              {CHOICES.map(({ level, Icon, primary }) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => answer(openFor, level)}
                  disabled={busy}
                  data-testid={`coordinator-level-${level}`}
                  className={`sn-press flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition disabled:opacity-60 ${
                    primary ? 'border-mulberry bg-mulberry text-cream' : 'border-ink/15 bg-cream text-ink hover:border-ink/30'
                  }`}
                >
                  <Icon aria-hidden className={`h-5 w-5 shrink-0 ${primary ? 'text-cream' : 'text-mulberry'}`} strokeWidth={1.9} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{LEVEL_WORD[level]}</span>
                    <span className={`block text-[13px] ${primary ? 'text-cream/80' : 'text-ink/60'}`}>{LEVEL_LINE[level]}</span>
                  </span>
                  <ChevronRight aria-hidden className={`h-4 w-4 shrink-0 ${primary ? 'text-cream/80' : 'text-ink/35'}`} strokeWidth={2} />
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </Sheet>
      {toast}
    </>
  );
}
