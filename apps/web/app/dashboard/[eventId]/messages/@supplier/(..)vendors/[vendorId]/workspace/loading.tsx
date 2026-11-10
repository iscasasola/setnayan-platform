/**
 * Loading boundary for the picked supplier drawn OVER the host's Chats. It renders NOTHING on purpose (the supplier
 * side's reason, `vendor-dashboard/customers/@client/(..)clients/[eventId]/loading.tsx`): the list stays exactly where
 * it is until the supplier's screen lands, instead of the workspace skeleton painting over it.
 */
export default function PickedSupplierOverChatsLoading() {
  return null;
}
