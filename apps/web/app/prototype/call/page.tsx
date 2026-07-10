import type { Metadata } from 'next';
import { CallRoom } from './_components/call-room';

export const metadata: Metadata = {
  title: 'Call prototype · Setnayan',
  description: 'A free, peer-to-peer voice/video call prototype (vendor ↔ couple).',
  robots: { index: false, follow: false },
};

// Vendor↔couple CALL prototype. Standalone + no-auth so it opens on any two
// devices like the Live Studio demo; the transport (lib/call-webrtc.ts) is what
// productionizes into the accepted-thread call. Never statically rendered — the
// room comes from the query string.
export const dynamic = 'force-dynamic';

export default async function CallPrototypePage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>;
}) {
  const { room } = await searchParams;
  const cleanRoom = typeof room === 'string' ? room.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40) : '';
  return <CallRoom initialRoom={cleanRoom.length > 0 ? cleanRoom : null} />;
}
