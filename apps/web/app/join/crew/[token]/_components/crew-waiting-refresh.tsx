'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** While a crew phone waits for the Allow, re-ask every 15 s — only while the page is looked at. */
export function CrewWaitingRefresh() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, 15_000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
