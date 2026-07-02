import Link from 'next/link';
import { after } from 'next/server';
import { CircleAlert } from 'lucide-react';
import { purgeExpiredDemoSessions, resolveDemoToken } from '@/lib/demo-sessions';
import { plan3dGuestById, PLAN3D_DEMO_GUESTS } from '@/app/_components/home/plan3d-demo-scene';
import { Plan3dWalk } from './_components/plan3d-walk';

// 3D Plan homepage DEMO join — `/3d_plan/demo/[token]?g=<guestId>`. Scanning a
// guest's QR from the homepage pop-up opens the SAMPLE room (Maria & Jose,
// fictional guests — zero privacy surface) AS that guest; "Where am I seated?"
// plays the entrance-to-seat walk. Fresh tokens every overlay open; a stale QR
// fails closed to the same friendly dead-end shape as the Papic demo.

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '3D Plan live demo · Setnayan',
  description: 'A live, no-signup demo of the Setnayan 3D seat plan and wayfinding.',
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ g?: string }> };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--m-paper)] px-4 py-8 text-[var(--m-ink)]">
      <div className="w-full max-w-md rounded-2xl border border-[var(--m-line)] bg-white p-6 text-center shadow-sm">
        {children}
      </div>
    </main>
  );
}

export default async function Plan3dDemoJoinPage({ params, searchParams }: Props) {
  const [{ token }, { g }] = await Promise.all([params, searchParams]);
  const cleanToken = token?.trim();
  const resolved = cleanToken ? await resolveDemoToken(cleanToken) : null;

  after(() => purgeExpiredDemoSessions());

  if (!resolved || resolved.demoKind !== '3d_plan') {
    return (
      <Shell>
        <CircleAlert aria-hidden className="mx-auto mt-3 h-7 w-7 text-[var(--m-mulberry)]" strokeWidth={1.75} />
        <h1 className="mt-3 text-xl font-semibold tracking-tight">This demo link expired</h1>
        <p className="mt-2 text-sm text-[var(--m-grey,#8c8884)]">
          Demo codes are fresh every time — open a new one from the 3D Plan tile
          on the Setnayan homepage.
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

  // The guest binding rides the QR's query param — cosmetic (every guest is
  // fictional sample data), so an unknown id just falls back to the first guest.
  const guest = plan3dGuestById(g) ?? PLAN3D_DEMO_GUESTS[0]!;

  return <Plan3dWalk guest={guest} />;
}
