/**
 * 🗂 The picked client, intercepted over the supplier's Chats (see `messages/layout.tsx`). ONE page body: this file only
 * re-exports `clients/[eventId]/page.tsx`'s default, so the two addresses can never draw two different clients.
 */
export { default } from '../../../../clients/[eventId]/page';
