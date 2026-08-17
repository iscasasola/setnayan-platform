import Link from 'next/link';
import { after } from 'next/server';
import { CircleAlert } from 'lucide-react';
import { DoorShell } from '@/app/_components/door/door-shell';
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
  title: 'Papic live demo',
  description: 'A live, no-signup demo of Setnayan Papic candid capture.',
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

/**
 * The LIVE demo's own frame. Deliberately NOT <DoorShell>: this wraps the
 * working demo, not a refusal — a doorway's wordmark, eyebrow and threshold
 * edge would announce an entrance to somebody already inside the thing.
 * The dead-end branch above IS a door and uses the shared shell.
 */
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
      <DoorShell
        tone="dead_end"
        eyebrow={
          <>
            <CircleAlert aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Papic demo
          </>
        }
        title="This demo link expired."
        sub="Demo codes are fresh every time — open a new one from the Papic tile on the Setnayan homepage."
      >
        <Link href="/" className="button-secondary">
          Back to Setnayan
        </Link>
      </DoorShell>
    );
  }

  return (
    <Shell>
      <DemoJoinFlow sessionId={resolved.sessionId} role={resolved.role} token={cleanToken} />
    </Shell>
  );
}
