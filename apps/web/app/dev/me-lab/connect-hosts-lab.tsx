import Link from 'next/link';
import { SubmitButton } from '@/app/_components/submit-button';
import { DoorShell, DoorActions } from '@/app/_components/door/door-shell';
import { ConnectHostsTick } from '@/app/[slug]/_components/connect-hosts-tick';
import { LabHostRequests } from './connect-hosts-lab-requests';
import { connectHostsLine } from '@/lib/guest-connects-hosts';
import { seatConfirmLine } from '@/lib/seat-binding';

/**
 * 🤝 `/dev/me-lab?connect=1` — the two screens of "Also connect with <the hosts>" (owner 2026-10-21), with no
 * database: (1) the link step — "Save this invitation?" as `/join/{id}/connect/confirm` draws it, and the signed-in
 * "Yes, save to my account" as `save-to-account.tsx` draws it — each with the tick, through the SAME `ConnectHostsTick`
 * the pages render; (2) the host's People → Requests row, through the shipped `PeopleRosterView` in its Requests mode,
 * fed the row the ask writes. The presses go nowhere here (no action is bound).
 */
export function ConnectHostsLab() {
  const line = seatConfirmLine({ seatName: 'Sarah Bernaldo', accountEmail: 'sarah.bernaldo@example.com' });
  const tick = connectHostsLine(['Indalecio', 'Claire']);
  return (
    <main className="min-h-dvh bg-cream text-ink">
      <section data-lab-connect="confirm">
        <DoorShell eyebrow="Your invitation" title={line.whose} sub={line.where}>
          <DoorActions>
            <form>
              <div className="mb-4">
                <ConnectHostsTick line={tick} />
              </div>
              <SubmitButton className="button-primary w-full" pendingLabel="Saving…">
                Yes, save it
              </SubmitButton>
            </form>
            <Link href="/" className="button-secondary">
              Not me
            </Link>
          </DoorActions>
        </DoorShell>
      </section>
      <section data-lab-connect="signed-in" className="mx-auto max-w-[430px] space-y-2 px-4 py-8">
        <form className="space-y-2" data-seat-confirm="">
          <p className="text-sm text-ink/80">
            {line.whose} {line.where}
          </p>
          <ConnectHostsTick line={tick} />
          <SubmitButton className="button-primary min-h-[56px] w-full" pendingLabel="Saving…">
            Yes, save to my account
          </SubmitButton>
        </form>
      </section>
      <section data-lab-connect="requests" className="mx-auto max-w-[430px] px-4 py-8">
        <LabHostRequests />
      </section>
    </main>
  );
}
