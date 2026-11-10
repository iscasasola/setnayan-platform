/**
 * Loading boundary for the picked client drawn OVER the Chats list. It renders NOTHING on purpose — the same reason as
 * `customers/@client/(..)clients/[eventId]/loading.tsx`: the list stays exactly where it is until the client lands.
 */
export default function PickedClientOverChatsLoading() {
  return null;
}
