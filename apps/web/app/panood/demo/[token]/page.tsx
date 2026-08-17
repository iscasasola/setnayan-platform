import Link from 'next/link';
import { after } from 'next/server';
import { CircleAlert } from 'lucide-react';
import { DoorShell } from '@/app/_components/door/door-shell';
import { purgeExpiredDemoSessions, resolveDemoToken } from '@/lib/demo-sessions';
import { CamJoinFlow } from './_components/cam-join-flow';

// Live Studio homepage DEMO join — `/panood/demo/[token]`. NOT the real Live
// Studio camera join (see `/panood/cam/[token]` for that): this is the
// ephemeral, no-sign-in live demo reached by scanning the ONE QR the
// homepage's Live Studio dock tile shows (DECISION_LOG 2026-07-03). Both phones
// scan the same code; camera slots go by claim order. A fresh token is minted
// every time the overlay opens — an old/reused/expired token fails closed to
// a friendly dead-end, same shape as the Papic demo join.
//
// Unlike the Papic demo page, joining is NOT marked here on load — the slot
// claim happens in the client flow after the camera is granted, so a scan
// that never turns its camera on doesn't burn one of the two slots.

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Live Studio demo',
  description: 'A live, no-signup demo of the Setnayan Live Studio control room.',
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


export default async function PanoodDemoJoinPage({ params }: Props) {
  const { token } = await params;
  const cleanToken = token?.trim();
  const resolved = cleanToken ? await resolveDemoToken(cleanToken) : null;

  after(() => purgeExpiredDemoSessions());

  if (!resolved || resolved.demoKind !== 'panood') {
    return (
      <DoorShell
        tone="dead_end"
        eyebrow={
          <>
            <CircleAlert aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Live Studio demo
          </>
        }
        title="This demo link expired."
        sub="Demo codes are fresh every time — open a new one from the Live Studio tile on the Setnayan homepage."
      >
        <Link href="/" className="button-secondary">
          Back to Setnayan
        </Link>
      </DoorShell>
    );
  }

  return (
    <Shell>
      <CamJoinFlow token={cleanToken} sessionId={resolved.sessionId} />
    </Shell>
  );
}
