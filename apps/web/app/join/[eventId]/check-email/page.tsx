/**
 * /join/[eventId]/check-email — "we've emailed you a sign-in link".
 *
 * Ported onto the shared <DoorShell> (2026-08-17). It previously hand-copied
 * JoinShell's wrapper rather than importing it, and painted its icon in
 * `text-terracotta` — the atelier gold, 3.37:1 on cream.
 *
 * NO PROGRESS RAIL, deliberately. The wizard archetype's rail is for a flow
 * with 2+ DECISIONS; this screen asks for nothing and the guest is told they
 * may close the tab. A rail here would promise a sequence they are not in.
 */
import { MailCheck } from 'lucide-react';
import { DoorShell, DoorNotice } from '@/app/_components/door/door-shell';

export const metadata = { title: 'Check your email' };

type Props = {
  searchParams: Promise<{ email?: string }>;
};

export default async function CheckEmailPage({ searchParams }: Props) {
  const email = (await searchParams).email ?? '';

  return (
    <DoorShell
      eyebrow={
        <>
          <MailCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Check your email
        </>
      }
      title="Your sign-in link is on its way."
      sub={
        <>
          We sent it{email ? <> to <span className="font-medium text-ink">{email}</span></> : null}.
          Tap it to finish setting up your Setnayan account — your event will be waiting there,
          on any device.
        </>
      }
    >
      <DoorNotice>
        You&rsquo;re already on the guest list — the link just lets you sign in later. You can
        close this tab.
      </DoorNotice>
    </DoorShell>
  );
}
