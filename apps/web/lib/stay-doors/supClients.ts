/** The picked client — its notes, handover, change orders, payment asks and challenge on
 *  `/vendor-dashboard/clients/<event>`, and its production sheet (`clients/[eventId]/actions.ts`,
 *  `clients/[eventId]/production-sheet/actions.ts`). */
export const SUP_CLIENTS_STAY_DOORS = [
  'supClients.createClientNote',
  'supClients.toggleClientNoteDone',
  'supClients.deleteClientNote',
  'supClients.vendorPostHandover',
  'supClients.vendorRaiseChangeOrder',
  'supClients.vendorRespondChangeOrder',
  'supClients.vendorWithdrawChangeOrder',
  'supClients.vendorAskForPayment',
  'supClients.vendorWithdrawPaymentAsk',
  'supClients.createVendorChallengeAction',
  'supClients.addPortionRule',
  'supClients.deletePortionRule',
] as const;
export type SupClientsStayDoor = (typeof SUP_CLIENTS_STAY_DOORS)[number];
