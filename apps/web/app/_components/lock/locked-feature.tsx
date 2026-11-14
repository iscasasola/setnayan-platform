'use client';

/**
 * 🔒 THE SHARED LOCK — shown, tap to learn (Build 5 · Lane B; owner 10 Nov 2026: *"we do not hide it … show a lock …
 * tapping it will explain what is there"* · *"always show the Problem and Solution"*; HOUSE_TEMPLATES T30; corpus
 * `plans/free_unverified_limits_2026-11-10/00-FREE-UNVERIFIED-LIMITS.md` §11; memory `every-lock-shows-problem-and-solution`).
 *
 * A locked feature looks almost normal: its real name, its icon and a small 🔒 — never hidden, never greyed into
 * unreadability, never a dead button. Tapping it RISES FULL SCREEN (the shipped `RiseScreen`, T4) with, in this order:
 *   1. THE PROBLEM, then THE SOLUTION — the two lines from `lib/locks.ts` (the type will not take a lock without both);
 *   2. a real-looking preview of the feature, VIEW-ONLY (`inert`: nothing in it can be pressed or focused);
 *   3. the progress (verify: "2 of 3 papers in · then press Submit") or the price (plan: "₱… / 28 days");
 *   4. ONE button — **Get verified** (the shipped papers flow, `/vendor-dashboard/profile#docs`) or **Upgrade to <plan>**.
 *      ✕ falls back into the row they tapped.
 *
 * ONE component for every lock — chat (+) cards, Promote, Offer/Bundle Maker, Analytics, the cap rows, the paid tool
 * tiles, the Plan sheet. Never one per page. 🔑 The lock is the LOOK; `canUse` (`lib/locks.ts`) on the server is the RULE.
 *
 * 📱 THE STORE SHELL IS NOT TOLD TO UPGRADE (`tier-gate.tsx` rule, guideline 3.1.1): a plan lock there explains itself
 * and says plans are on the web, with no Upgrade button. Get verified is not a purchase and stays.
 *
 * 🔒 app/_components/lock/every-lock-shows-problem-and-solution.test.ts
 */
import { useState, type ReactNode } from 'react';
import { BadgeCheck, Lock, Sparkles } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { DatesRow } from '@/app/vendor-dashboard/customers/_components/dates-row';
import { RiseScreen } from '@/app/_components/rise/rise-screen';
import { LOCKS, type LockDef, type LockKey } from '@/lib/locks';
import { planWord } from '@/lib/vendor-plan-change-words';

/** Where the papers are sent from every verify lock — the shipped Get-verified fold. */
export const GET_VERIFIED_HREF = '/vendor-dashboard/profile#docs';

export type LockNeed =
  | { kind: 'verify'; /** `papersProgress(...)` */ progress: string }
  | { kind: 'plan'; plan: string; /** The catalogue price, worded ("₱… / 28 days") — never typed by the caller. */ price: string | null; href: string };

export function LockExplainer({
  lock,
  need,
  preview,
  storeShell = false,
  onClose,
}: {
  lock: LockKey;
  need: LockNeed;
  /** The view-only preview — a sample quote, a sample poster. Absent: the solution line stands alone. */
  preview?: ReactNode;
  storeShell?: boolean;
  onClose: () => void;
}) {
  const def: LockDef = LOCKS[lock];
  const isPlan = need.kind === 'plan';
  const opensLine = isPlan ? `Comes with ${planWord(need.plan)}` : 'Opens once you are Verified';
  const button =
    need.kind === 'verify' ? (
      <ActionButton tone="brand" main icon={BadgeCheck} label="Get verified" href={GET_VERIFIED_HREF} />
    ) : storeShell ? null : (
      <ActionButton tone="brand" main icon={Sparkles} label={`Upgrade to ${planWord(need.plan)}`} href={need.href} />
    );
  return (
    <RiseScreen title={def.name} line={opensLine} onClose={onClose} data={`lock-${lock}`} thumb={button}>
      <div className="px-4 pt-4" data-lock-explainer={lock}>
        <p className="hc-k2" data-lock-k="problem">The problem</p>
        <p className="pt-2 text-[16px] leading-snug text-ink" data-lock-problem="">
          {def.problem}
        </p>
        <div className="pt-5">
          <p className="hc-k2" data-lock-k="solution">The solution</p>
          <p className="pt-2 text-[16px] leading-snug text-ink" data-lock-solution="">
            {def.solution}
          </p>
        </div>
        {preview ? (
          <div className="pt-5">
            <p className="hc-k2">What it looks like</p>
            {/* View-only: nothing in the preview can be pressed or reached by Tab. Dividers, not a frame — a frame only on what you press. */}
            <div inert className="pointer-events-none mt-3 select-none border-y border-ink/10 py-3" data-lock-preview="">
              {preview}
            </div>
          </div>
        ) : null}
        <div className="mt-5" data-lock-progress="">
          <DatesRow
            data="lock-progress"
            lead={<Lock aria-hidden className="h-[18px] w-[18px] flex-none text-ink/55" strokeWidth={1.75} />}
            title={opensLine}
            line={
              need.kind === 'verify'
                ? need.progress
                : storeShell
                  ? 'Plans are chosen on setnayan.com'
                  : need.price ?? 'Price from the price sheet when you tap Upgrade'
            }
          />
        </div>
      </div>
    </RiseScreen>
  );
}

/**
 * The locked row: the feature's real name and icon, a small 🔒 and "Get verified" / "<Plan>", and a tap that rises the
 * explainer. `line` is the one-line benefit (absent: the Solution line).
 */
export function LockedFeature({
  lock,
  need,
  lead,
  line,
  preview,
  storeShell = false,
  data,
}: {
  lock: LockKey;
  need: LockNeed;
  lead?: ReactNode;
  line?: string;
  preview?: ReactNode;
  storeShell?: boolean;
  data?: string;
}) {
  const [open, setOpen] = useState(false);
  const def: LockDef = LOCKS[lock];
  return (
    <>
      <span className="contents" data-locked-feature={lock}>
        <DatesRow
          data={data ?? `lock-${lock}`}
          lead={lead}
          title={
            <span className="inline-flex items-center gap-1.5">
              {def.name}
              <Lock aria-label="Locked" className="h-3.5 w-3.5 flex-none text-ink/50" strokeWidth={2} />
            </span>
          }
          line={line ?? def.solution}
          badge={{ tone: 'quiet', word: need.kind === 'verify' ? 'Get verified' : planWord(need.plan) }}
          onOpen={() => setOpen(true)}
        />
      </span>
      {open ? <LockExplainer lock={lock} need={need} preview={preview} storeShell={storeShell} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** The same lock as a button at a row's end (the Plan sheet's locked "Upgrade", a tool tile's badge). */
export function LockButton({
  lock,
  need,
  label,
  preview,
  storeShell = false,
}: {
  lock: LockKey;
  need: LockNeed;
  /** The button's word — "Get verified" by default. */
  label?: string;
  preview?: ReactNode;
  storeShell?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span className="inline-flex" data-lock-button={lock}>
        <ActionButton
          tone="neutral"
          icon={Lock}
          label={label ?? (need.kind === 'verify' ? 'Get verified' : `Upgrade to ${planWord(need.plan)}`)}
          onClick={() => setOpen(true)}
        />
      </span>
      {open ? <LockExplainer lock={lock} need={need} preview={preview} storeShell={storeShell} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
