'use server';

import { revalidatePath } from 'next/cache';
import { publishSeating, unpublishSeating } from '../seating/actions';

/**
 * The control centre's switch — the SAME two actions the lab's panel uses
 * (`publishSeating` / `unpublishSeating`, `app/dashboard/[eventId]/seating/
 * actions.ts`), not a second pair. Two writers of one column is how surfaces
 * drift; these wrappers only add this page's revalidation and return void so a
 * plain <form action> can post them. The actions themselves own the auth, the
 * event scope and the "clear the gate, leave the printed signs" contract.
 */
export async function publishFromControlCentre(formData: FormData): Promise<void> {
  await publishSeating(formData);
  const eventId = formData.get('event_id');
  if (typeof eventId === 'string') revalidatePath(`/dashboard/${eventId}/plan3d`);
}

export async function unpublishFromControlCentre(formData: FormData): Promise<void> {
  await unpublishSeating(formData);
  const eventId = formData.get('event_id');
  if (typeof eventId === 'string') revalidatePath(`/dashboard/${eventId}/plan3d`);
}
