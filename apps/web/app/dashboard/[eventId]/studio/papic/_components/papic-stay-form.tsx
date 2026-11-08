'use client';

import type { FormHTMLAttributes, ReactNode } from 'react';
import { StayForm } from '@/app/_components/stay-form';
import type { PapicDoor } from '../_lib/papic-in-place';

/**
 * 📍 A PAPIC FORM THAT SAVES IN PLACE (owner, live 2026-10-26: *"saving minimum and maximum on papic resets the whole
 * screen"* · *"when i turn of a challenge. it should just remove it … it jumped to a different page"*).
 *
 * The app-wide `StayForm` (`app/_components/stay-form.tsx`) on a Papic door — the SAME form, the same fields, the same
 * action kept as `action` for a phone without JavaScript. With JavaScript the submit goes through the one door
 * (`papic.<door>`), so the page re-renders in place; a refusal is said right under the form in Papic's own words.
 */
export function PapicStayForm({
  door,
  ...rest
}: { door: PapicDoor; action: (fd: FormData) => unknown; children: ReactNode } & Omit<FormHTMLAttributes<HTMLFormElement>, 'action' | 'onSubmit' | 'children'>) {
  return <StayForm door={`papic.${door}`} {...rest} />;
}
