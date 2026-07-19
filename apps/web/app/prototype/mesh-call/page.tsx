import type { Metadata } from 'next';
import Link from 'next/link';
import { MeshRoom } from './_components/mesh-room';

/**
 * Prototype route for the N-way mesh call (lib/mesh-call-webrtc). Open the same
 * ?room= on 2–4 devices to test a group call before the transport is wired into
 * vendor↔couple threads. noindex — not a product surface.
 */
export const metadata: Metadata = {
  title: 'Mesh call (prototype)',
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ room?: string }> };

export default async function MeshCallPrototypePage({ searchParams }: Props) {
  const { room } = await searchParams;
  const clean = room?.trim();
  const suggested = crypto.randomUUID().slice(0, 8);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-xl font-semibold tracking-tight">Mesh call — prototype</h1>
      <p className="mt-1 text-sm text-[var(--m-grey,#8c8884)]">
        Up to 4 people, peer-to-peer. Open this same link on 2–4 devices to test a group call.
      </p>

      {clean ? (
        <div className="mt-6">
          <MeshRoom room={clean} />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <p className="text-sm">Start a room, then share its link with 1–3 others:</p>
          <Link
            href={`/prototype/mesh-call?room=${suggested}`}
            className="inline-flex rounded-md bg-[var(--m-mulberry,#7a2e4a)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Create a room
          </Link>
        </div>
      )}
    </main>
  );
}
