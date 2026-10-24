/**
 * /dev/papic-camera-lab — the REAL guest camera (`PapicGuestCapture`) and the REAL
 * supplier camera (`PapicCaptureController`) on fixture props, with no sign-in and
 * no database. DEV-ONLY: production builds 404 this route.
 *
 * Why it exists (2026-10-23, Papic "save first, send later"): the walk proves the
 * uploader in WebKit + Chromium — shoot offline, reconnect, everything lands once
 * — against an intercepted server (the walk script answers sign / record /
 * attach and the presigned PUTs itself), so nothing here reaches a real bucket or
 * the production database. The camera is the page's fake stream (the walk script
 * draws a real photograph into it).
 *
 *   (default)       the guest camera
 *   ?lane=vendor    the supplier camera
 */
import { notFound } from 'next/navigation';
import { LabCamera } from './lab-camera';

export default async function PapicCameraLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const lane = sp.lane === 'vendor' ? 'vendor' : 'guest';
  return <LabCamera lane={lane} />;
}
