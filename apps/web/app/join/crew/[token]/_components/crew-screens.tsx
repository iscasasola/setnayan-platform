import { ActionButton } from '@/components/action-button';
import type { ReactNode } from 'react';
import { Hourglass, LogIn, QrCode, ShieldCheck } from 'lucide-react';
import { HubRunOfShow } from '@/app/vendor-dashboard/on-the-day/_components/hub-screen';
import type { RunOfShowBlock } from '@/lib/run-of-show';
import { CREW_NO_SCANNER_LINE, CREW_ROLE_LABEL, crewRoleOpens, crewToolsWords, type CrewRole } from '@/lib/crew-pass';
import { CrewJoinForm } from './crew-name-form';

/**
 * 📱 THE CREW PHONE'S SCREENS (owner 2026-10-29, DECISION_LOG "CREW JOIN THE SUPPLIER'S EVENT HUB BY QR — AND SEE ONLY
 * THE EVENT HUB"; prototype "Crew for the day"). A crew member sees ONLY the Event Hub: no Today, no Customers, no
 * Shop, no money, no settings, no bar — just this one event's tools their role opens (Member: run of show + scanner;
 * Helper: scanner only — and the scanner only for a COORDINATOR shop's crew, the one shop whose scanner door opens).
 * Everything else they could reach is a sentence saying why not. Draws only — the page reads.
 */
export function CrewFrame({ children }: { children: ReactNode }) {
  return (
    <main className="app-surface mx-auto min-h-screen w-full max-w-xl bg-paper px-4 pb-16 pt-6" data-crew-screen="">
      {children}
    </main>
  );
}

/** "No account: first scan asks a name." */
export function CrewNameForm({ token, shopWords, anonymous }: { token: string; shopWords: string; anonymous: boolean }) {
  return (
    <CrewFrame>
      <div className="space-y-4" data-crew-state="name">
        <QrCode aria-hidden className="h-8 w-8 text-sn-accent" strokeWidth={1.6} />
        <h1 className="text-[22px] font-medium leading-snug text-ink">Join the crew</h1>
        <p className="text-[14.5px] text-ink/70">
          {shopWords} will see your name and tap Allow. Then this phone opens their Event Hub for this event — only the
          tools you need on the day.
        </p>
        <CrewJoinForm token={token} anonymous={anonymous} />
      </div>
    </CrewFrame>
  );
}

/** Waiting for the Allow, removed, ended, a dead QR — one sentence and nothing else to press. */
export function CrewStatus({ title, line, waiting = false, children }: { title: string; line: string; waiting?: boolean; children?: ReactNode }) {
  return (
    <CrewFrame>
      <div className="space-y-3" data-crew-state={waiting ? 'waiting' : 'closed'}>
        {waiting ? (
          <Hourglass aria-hidden className="h-8 w-8 text-sn-accent" strokeWidth={1.6} />
        ) : (
          <ShieldCheck aria-hidden className="h-8 w-8 text-ink/50" strokeWidth={1.6} />
        )}
        <h1 className="text-[22px] font-medium leading-snug text-ink">{title}</h1>
        <p className="text-[14.5px] text-ink/70">{line}</p>
        {children}
      </div>
    </CrewFrame>
  );
}

/** Signed out, and anonymous joining is not switched on yet — sign in, then back to the same QR. */
export function CrewSignIn({ token }: { token: string }) {
  const back = `/join/crew/${token}`;
  return (
    <CrewStatus title="Sign in to join the crew" line="Use any Setnayan account — you land back here and the shop taps Allow.">
      <ActionButton tone="brand" main icon={<LogIn aria-hidden strokeWidth={1.9} />} label="Sign in" href={`/login?next=${encodeURIComponent(back)}`} />
    </CrewStatus>
  );
}

/**
 * THE CREW'S EVENT HUB — this event only, the tools the role opens. The run of show is the hosts' (read for this event
 * only, after the pass was proven); the scanner asks the database one guest at a time.
 */
export function CrewEventHub({
  eventName,
  shopName,
  dayWords,
  place,
  name,
  role,
  coordinator,
  blocks,
  endsWords,
  scanner,
}: {
  /** The crew's scanner — the shipped seat scanner on the crew door, handed in by the page (it carries a server action). */
  scanner: ReactNode;
  eventName: string;
  shopName: string;
  dayWords: string | null;
  place: string | null;
  name: string;
  role: CrewRole;
  /** Is the shop the coordinator trade? Only then does the scanner's door open — so only then is it drawn. */
  coordinator: boolean;
  /** Member only; null = the read failed (said). */
  blocks: readonly RunOfShowBlock[] | null;
  endsWords: string;
}) {
  const opens = crewRoleOpens(role, coordinator);
  return (
    <CrewFrame>
      <div data-crew-state="hub" data-crew-role={role}>
        <p className="text-[13px] text-ink/60">Event Hub · {shopName} crew</p>
        <div className="sn-tile-dark mt-2 rounded-2xl p-4">
          <p className="text-[11.5px] font-medium uppercase tracking-[0.12em]" style={{ color: 'rgba(251,251,250,0.62)' }}>
            {name} · {CREW_ROLE_LABEL[role]} · {crewToolsWords(role, coordinator)}
          </p>
          <p className="mt-1 truncate text-[19px] font-medium" style={{ color: 'var(--m-paper)' }}>
            {eventName}
          </p>
          <p className="mt-0.5 truncate text-[13.5px]" style={{ color: 'rgba(251,251,250,0.72)' }}>
            {[dayWords, place].filter(Boolean).join(' · ')}
          </p>
        </div>
        <p className="pt-2 text-[12.5px] text-ink/55">Your pass {endsWords}. The shop can take this phone off the crew any time.</p>
        {opens.scanner ? (
          <div className="pt-2" data-crew-tool="scanner">
            <p className="home-k2 pt-3">Scanner</p>
            {scanner}
          </div>
        ) : (
          <p className="pt-3 text-[14px] leading-snug text-ink/70" data-crew-tool="none">
            {CREW_NO_SCANNER_LINE(shopName, role)}
          </p>
        )}
        {opens.runOfShow ? (
          <div data-crew-tool="run-of-show">
            <HubRunOfShow blocks={blocks} moreHref={null} all />
          </div>
        ) : null}
      </div>
    </CrewFrame>
  );
}
