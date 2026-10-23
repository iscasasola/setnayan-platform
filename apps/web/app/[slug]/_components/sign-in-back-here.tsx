'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signInBackHereNext } from '@/lib/sign-in-back-here';

/**
 * The not-found page's "Sign in" — returns the person to the address they opened (lib/sign-in-back-here.ts).
 * `usePathname` answers on the server render too, so the href is right before any script runs.
 */
export function SignInBackHere({ className }: { className: string }) {
  const pathname = usePathname();
  return (
    <Link href={`/login?next=${signInBackHereNext(pathname)}`} data-sign-in-back-here="" className={className}>
      Sign in
    </Link>
  );
}
