import Link from 'next/link';
import { CircleAlert } from 'lucide-react';
import { DoorShell } from '@/app/_components/door/door-shell';
import { resolvePlan3DGuestToken } from '@/app/_actions/plan3d-demo-actions';
import { Plan3DGuestView } from './_components/plan3d-guest-view';

// 3D Plan homepage DEMO join — `/3d_plan/demo/[token]`. Reached by scanning
// the QR minted when a visitor clicks a seated guest in the desktop overlay
// (DECISION_LOG 2026-07-03). Read-only, no sign-in, no real event — a fresh
// token is minted per click and never reused; an old/reused/expired token
// fails closed to a friendly dead-end, same shape as `/papic/demo/[token]`.

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '3D Plan live demo · Setnayan',
  description: 'A live, no-signup demo of Setnayan 3D seating — find your seat before the day.',
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

export default async function Plan3DDemoJoinPage({ params }: Props) {
  const { token } = await params;
  const result = await resolvePlan3DGuestToken(token);

  if (!result.ok) {
    return (
      <DoorShell
        tone="dead_end"
        eyebrow={
          <>
            <CircleAlert aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            3D Plan demo
          </>
        }
        title="This demo link expired."
        sub="Demo codes are fresh every time — open a new one from the 3D Plan tile on the Setnayan homepage."
      >
        <Link href="/" className="button-secondary">
          Back to Setnayan
        </Link>
      </DoorShell>
    );
  }

  return <Plan3DGuestView scene={result.view.scene} guest={result.view.guest} />;
}
