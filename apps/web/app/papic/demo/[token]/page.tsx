import Link from 'next/link';
import { after } from 'next/server';
import { CircleAlert } from 'lucide-react';
import { markDemoSessionJoined, purgeExpiredDemoSessions, resolveDemoToken } from '@/lib/demo-sessions';
import { DemoJoinFlow } from './_components/demo-join-flow';

// Papic homepage DEMO join — `/papic/demo/[token]`. NOT the real Papic product
// (see `/papic/join/[token]` for that): this is the ephemeral, no-sign-in,
// no-real-event live demo reached by scanning one of the two QR codes the
// homepage's Papic dock tile shows (DECISION_LOG 2026-07-03). A fresh pair of
// tokens is minted every time that overlay opens — an old/reused/expired
// token fails closed to a friendly dead-end, same shape as the real join flow.

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Papic live demo · Setnayan',
  description: 'A live, no-signup demo of Setnayan Papic candid capture.',
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

export default async function PapicDemoJoinPage({ params }: Props) {
  const { token } = await params;
  const cleanToken = token?.trim();
  const resolved = cleanToken ? await resolveDemoToken(cleanToken) : null;

  after(() => purgeExpiredDemoSessions());

  if (resolved) after(() => markDemoSessionJoined(resolved.sessionId, resolved.role));

  if (!resolved || resolved.demoKind !== 'papic') {
    return (
      <Shell>
        <CircleAlert aria-hidden className="mx-auto mt-3 h-7 w-7 text-[var(--m-mulberry)]" strokeWidth={1.75} />
        <h1 className="mt-3 text-xl font-semibold tracking-tight">This demo link expired</h1>
        <p className="mt-2 text-sm text-[var(--m-grey,#8c8884)]">
          Demo codes are fresh every time — open a new one from the Papic tile on
          the Setnayan homepage.
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

  return (
    <Shell>
      <DemoJoinFlow sessionId={resolved.sessionId} role={resolved.role} token={cleanToken} />
    </Shell>
  );
}
