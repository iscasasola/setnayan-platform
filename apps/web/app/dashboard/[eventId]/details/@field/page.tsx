/**
 * The record itself (`/details`) — no field open. Without this, closing a field
 * (a soft navigation back to the record) would leave the slot showing it.
 */
export default function RecordFieldNone() {
  return null;
}
