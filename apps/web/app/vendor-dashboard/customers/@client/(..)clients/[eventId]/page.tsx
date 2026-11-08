/**
 * 🗂 The picked client, intercepted over the Clients list (see `customers/layout.tsx`). ONE page body: this file only
 * re-exports `clients/[eventId]/page.tsx`'s default, so the two addresses can never draw two different clients.
 */
export { default } from '../../../../clients/[eventId]/page';
