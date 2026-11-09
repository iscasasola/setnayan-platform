/** Contracts — "Make visible to couple" and "Cancel contract" on `/vendor-dashboard/contracts/<id>` (`contracts/actions.ts`). */
export const SV_CONTRACTS_STAY_DOORS = ['svContracts.publishContractToCouple', 'svContracts.cancelContract'] as const;
export type SvContractsStayDoor = (typeof SV_CONTRACTS_STAY_DOORS)[number];
