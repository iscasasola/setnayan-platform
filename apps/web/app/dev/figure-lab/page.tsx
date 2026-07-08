'use client';

/**
 * /dev/figure-lab — internal preview lab. DEV-ONLY: production builds 404 this route
 * (same kill-switch spirit as the seating lab's NEXT_PUBLIC_SEATING_3D guard).
 * NODE_ENV is inlined at build time, so the guard is free and the lab chunk
 * never loads in production.
 */

import { notFound } from 'next/navigation';
import dynamic from 'next/dynamic';

const FigureLabClient = dynamic(() => import('./figure-lab-client'), { ssr: false });

export default function FigureLabPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <FigureLabClient />;
}
