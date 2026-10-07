/**
 * /dev/more-menu-lab — the More-menu service pages (corpus
 * `MORE_MENU_PAGES_AUDIT_2026-10-07_fable.md`) on fixture data: no sign-in,
 * no database. DEV-ONLY: production builds 404 this route, the same
 * kill-switch as `/dev/home-lab`. It draws the REAL shared pieces
 * (`ServiceHead` · `RowGroup` · `ServiceRow` · `ThumbBar` · `ActionButton`)
 * and each page's REAL row components, so the side-by-side against the
 * prototype is of what ships.
 *
 *   ?page=live            Live stream · Live Watch (step 1 — the shop window as one row)
 *   &state=add|request_sent|launch|blocked|expired
 */
import { notFound } from 'next/navigation';
import { Play } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { ThumbBar, ThumbBarSpacer } from '@/components/thumb-bar';
import { RowGroup, ServiceHead } from '@/components/service-rows';
import { MoreCamerasRow } from '@/app/dashboard/[eventId]/studio/live-studio-control/_components/more-cameras-row';
import { statusPillForState } from '@/app/_components/app-store/state-cta';
import type { AddOnState } from '@/lib/add-on-state';

export const dynamic = 'force-dynamic';

const STATES: readonly AddOnState[] = ['add', 'request_sent', 'launch', 'blocked', 'expired'];

export default async function MoreMenuLab({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; state?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const state = (STATES as readonly string[]).includes(sp.state ?? '') ? (sp.state as AddOnState) : 'add';

  return (
    <main className="mx-auto min-h-[100dvh] max-w-[40rem] bg-cream px-4 pt-3">
      {(sp.page ?? 'live') === 'live' ? (
        <>
          <ServiceHead
            title="Live stream"
            brand="Live Watch"
            status={statusPillForState(state)?.label ?? 'One camera free'}
            line="Phones are cameras. Guests watch on your Event Hub."
            info={<>Cut any camera onto the Main Stage with a tap, or let guests pick their own view.</>}
          />
          <RowGroup>
            <MoreCamerasRow
              state={state}
              href="/dev/more-menu-lab"
              choosePlan={{
                eventId: 'lab',
                triggerLabel: 'Add Live Watch',
                priceFromLabel: '₱2,500',
                plans: [
                  {
                    sku_code: 'LIVE_STUDIO',
                    name: 'Live Watch',
                    scope: 'Everything unlocks for one event.',
                    price: '₱2,500',
                    unit: '',
                    badge: 'Per event',
                    priceCentavos: '250000',
                  },
                ],
              }}
            />
          </RowGroup>
          <ThumbBarSpacer />
          <ThumbBar label="Live stream tools">
            <ActionButton tone="ok" main icon={Play} label="Go live" href="/dev/more-menu-lab" />
          </ThumbBar>
        </>
      ) : null}
    </main>
  );
}
