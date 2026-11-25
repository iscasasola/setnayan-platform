import Link from 'next/link';
import { CircleAlert, QrCode, RotateCcw } from 'lucide-react';
import { DoorShell } from '@/app/_components/door/door-shell';
import { actionButtonClass } from '@/components/action-button-class';
import { routes } from '@/lib/routes';
import { resolvePlan3DGuestToken } from '@/app/_actions/plan3d-demo-actions';
import { Plan3DGuestView } from './_components/plan3d-guest-view';

// 3D Plan homepage DEMO join — `/3d_plan/demo/[token]`. Reached by scanning
// the QR minted when a visitor clicks a seated guest in the desktop overlay
// (DECISION_LOG 2026-07-03). Read-only, no sign-in, no real event — a fresh
// token is minted per click and never reused; an old/reused/expired token
// fails closed to a friendly dead-end, same shape as `/papic/demo/[token]`.

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '3D Plan live demo',
  description: 'A live, no-signup demo of Setnayan 3D seating — find your seat before the day.',
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

export default async function Plan3DDemoJoinPage({ params }: Props) {
  const { token } = await params;
  const result = await resolvePlan3DGuestToken(token);

  if (!result.ok) {
    // A7-03: two different dead ends, two different asks. An old code points to where fresh codes are made today
    // (/pa3d/try — the homepage tile it used to name is gone); a failed read says so and offers the same link again.
    const expired = result.reason === 'expired';
    return (
      <DoorShell
        tone="dead_end"
        eyebrow={
          <>
            <CircleAlert aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            3D Plan demo
          </>
        }
        title={expired ? 'This demo link expired.' : 'We couldn’t open this demo.'}
        sub={
          expired
            ? 'Demo codes are fresh every time. Open the demo room and tap a seated guest for a new one.'
            : 'Your link is fine. Something on our end didn’t load. Try again in a moment.'
        }
      >
        {expired ? (
          <Link href={routes.pa3d.try()} className={actionButtonClass('brand', { main: true })}>
            <QrCode aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Open the demo room
          </Link>
        ) : (
          <Link href={`/3d_plan/demo/${encodeURIComponent(token)}`} className={actionButtonClass('brand', { main: true })}>
            <RotateCcw aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Try again
          </Link>
        )}
      </DoorShell>
    );
  }

  return <Plan3DGuestView scene={result.view.scene} guest={result.view.guest} />;
}
