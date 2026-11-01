'use client';

import type { ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { BASIC_SETUP_HOME, basicSetupLine, pageIsHeld, type BasicSetupHold } from '@/lib/basic-setup-gate';

/**
 * 🧰 BASIC SETUP FIRST (owner 2026-10-29: "complete the basic setup of their shop. Which is a must before they can do
 * anything"). The supplier layout's ONE hold: on a held page it draws a calm "Finish your basic setup first" with one
 * button back to Today's setup — never a dead end, never an error. Every open page (Today, Your details, Events you
 * run, chat, the account) renders as it always did. The rule is `pageIsHeld` (`lib/basic-setup-gate.ts`); this only
 * draws it. Wraps the page body only — the top bar (sign-out under the avatar) and the bottom bar stay.
 */
export function BasicSetupHold({
  hold,
  children,
  at,
}: {
  hold: BasicSetupHold | null;
  children: ReactNode;
  /** /dev only — the address to judge instead of the browser's (the lab draws the supplier pages at /dev/…). */
  at?: string;
}) {
  const live = usePathname() ?? '';
  const pathname = at ?? live;
  const seg = useSearchParams()?.get('seg') ?? null;
  if (!pageIsHeld(pathname, hold, seg) || !hold) return <>{children}</>;
  return (
    <section
      data-basic-setup-hold=""
      aria-labelledby="basic-setup-hold-title"
      className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-4 py-10"
    >
      <h1 id="basic-setup-hold-title" className="font-serif text-[24px] italic leading-tight text-ink">
        <InfoTip label="Finish your basic setup first" align="start">
          Couples see your shop once its basics are in — your logo, name, address, contact, the year you started and
          what you do. Your messages, your settings and any event you run stay open meanwhile.
        </InfoTip>
      </h1>
      <p className="mt-1 text-[15px] text-ink/70" data-basic-setup-left="">
        {basicSetupLine(hold)}
      </p>
      <div className="mt-5">
        <ActionButton tone="brand" main icon={ArrowLeft} label="Back to setup" href={BASIC_SETUP_HOME} className="min-h-11" />
      </div>
    </section>
  );
}
