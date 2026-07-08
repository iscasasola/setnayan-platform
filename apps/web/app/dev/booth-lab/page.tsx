'use client';

/**
 * /dev/booth-lab — internal preview grid for the booth-template kit
 * (2026-07-08 booth-chassis slice). Renders every shipped template on a
 * neutral floor so the mascot-smooth chassis/props/staff-idle work can be
 * eyeballed without a DB scene — the /dev/figure-lab precedent, kept for the
 * catalog-complete PR (the other 37 categories land here first).
 */

import dynamic from 'next/dynamic';

const BoothLabClient = dynamic(() => import('./booth-lab-client'), { ssr: false });

export default function BoothLabPage() {
  return <BoothLabClient />;
}
