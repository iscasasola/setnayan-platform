import 'server-only';
import type { SupClientsStayDoor } from '@/lib/stay-doors/supClients';
import type { StayWords } from '@/lib/save-in-place';
import {
  createClientNote,
  createVendorChallengeAction,
  deleteClientNote,
  toggleClientNoteDone,
  vendorAskForPayment,
  vendorPostHandover,
  vendorRaiseChangeOrder,
  vendorRespondChangeOrder,
  vendorWithdrawChangeOrder,
  vendorWithdrawPaymentAsk,
} from '@/app/vendor-dashboard/clients/[eventId]/actions';
import { addPortionRule, deletePortionRule } from '@/app/vendor-dashboard/clients/[eventId]/production-sheet/actions';
import { kind, type Door } from './_door';

/**
 * The refusals the picked client's page says, in ITS words (each sentence is the banner that page draws for that flag):
 *   `?note=error`        — `customer-card-notes.tsx`;
 *   `?handover=…`        — the Deliver-the-handover block of `clients/[eventId]/page.tsx`;
 *   `?change_order=error` / `?change_order_resp=<not ok>` — its Change orders block (a status the database answered
 *                          other than `ok` did not go through, so it is never read as saved);
 *   `?ask=…`             — `payment-asks-panel.tsx`.
 * A missing event / note bounces to the clients list (`/vendor-dashboard/clients`), signed out → `/login`, no shop →
 * bare `/vendor-dashboard`: all outside `within`, so they navigate.
 */
const HANDOVER_REFUSED: Readonly<Record<string, string>> = {
  badurl: 'That album link needs to start with http(s)://.',
  nofile: 'Choose an image to upload.',
  empty: 'Add a note before sending.',
  upload: 'That image couldn’t upload — try a PNG/JPEG under 6 MB.',
};
const ASK_REFUSED: Readonly<Record<string, string>> = {
  amount: 'Put in an amount above zero.',
  notbooked: 'You can only ask a customer who has booked you.',
  error: 'That did not go through. Nothing was sent — try again.',
};
const CHANGE_ORDER_REFUSED = 'That didn’t go through — try again.';

const SUP_CLIENT_CARD_WORDS: StayWords = {
  within: [/^\/vendor-dashboard\/clients\/[^/]+$/],
  refuse: (q) => {
    if (q.get('note') === 'error') return 'Couldn’t save that — try again.';
    const handover = q.get('handover');
    if (handover && handover !== 'sent') return HANDOVER_REFUSED[handover] ?? 'That didn’t send — try again.';
    if (q.get('change_order') === 'error') return CHANGE_ORDER_REFUSED;
    const resp = q.get('change_order_resp');
    if (resp && resp !== 'ok') return CHANGE_ORDER_REFUSED;
    const ask = q.get('ask');
    if (ask && ASK_REFUSED[ask]) return ASK_REFUSED[ask];
    return null;
  },
};
const supClientCard = kind(SUP_CLIENT_CARD_WORDS, null);

/** The production sheet's own two refusals (`production-sheet/page.tsx`). */
const SUP_PRODUCTION_SHEET_WORDS: StayWords = {
  within: [/^\/vendor-dashboard\/clients\/[^/]+\/production-sheet$/],
  refuse: (q) =>
    q.get('rule') === 'invalid'
      ? 'Each rule needs a name, a unit, and a per-guest quantity above zero.'
      : q.get('rule') === 'error'
        ? 'That didn’t save — try again.'
        : null,
};
const supProductionSheet = kind(SUP_PRODUCTION_SHEET_WORDS, null);

export const SUP_CLIENTS: Readonly<Record<SupClientsStayDoor, Door>> = {
  'supClients.createClientNote': supClientCard(createClientNote),
  'supClients.toggleClientNoteDone': supClientCard(toggleClientNoteDone),
  'supClients.deleteClientNote': supClientCard(deleteClientNote),
  'supClients.vendorPostHandover': supClientCard(vendorPostHandover),
  'supClients.vendorRaiseChangeOrder': supClientCard(vendorRaiseChangeOrder),
  'supClients.vendorRespondChangeOrder': supClientCard(vendorRespondChangeOrder),
  'supClients.vendorWithdrawChangeOrder': supClientCard(vendorWithdrawChangeOrder),
  'supClients.vendorAskForPayment': supClientCard(vendorAskForPayment),
  'supClients.vendorWithdrawPaymentAsk': supClientCard(vendorWithdrawPaymentAsk),
  'supClients.createVendorChallengeAction': supClientCard(createVendorChallengeAction),
  'supClients.addPortionRule': supProductionSheet(addPortionRule),
  'supClients.deletePortionRule': supProductionSheet(deletePortionRule),
};
