import Link from 'next/link';
import { CircleAlert } from 'lucide-react';
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

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--m-paper)] px-4 py-12 text-[var(--m-ink)]">
      <div className="w-full max-w-md rounded-2xl border border-[var(--m-line)] bg-white p-7 text-center shadow-sm">
        {children}
      </div>
    </main>
  );
}

export default async function Plan3DDemoJoinPage({ params }: Props) {
  const { token } = await params;
  const result = await resolvePlan3DGuestToken(token);

  if (!result.ok) {
    return (
      <Shell>
        <CircleAlert aria-hidden className="mx-auto mt-3 h-7 w-7 text-[var(--m-mulberry)]" strokeWidth={1.75} />
        <h1 className="mt-3 text-xl font-semibold tracking-tight">This demo link expired</h1>
        <p className="mt-2 text-sm text-[var(--m-grey,#8c8884)]">
          Demo codes are fresh every time — open a new one from the 3D Plan tile on the Setnayan homepage.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex items-center justify-center rounded-md bg-[var(--m-mulberry)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Back to Setnayan
        </Link>
      </Shell>
    );
  }

  return <Plan3DGuestView scene={result.view.scene} guest={result.view.guest} />;
}
