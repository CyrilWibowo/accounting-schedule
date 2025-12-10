// types/Lease.ts
export interface OpeningBalance {
  id: string;
  openingDate: string;
  isNewLeaseExtension: boolean;
  rightToUseAssets: number;
  accDeprRightToUseAssets: number;
  leaseLiabilityCurrent: number;
  leaseLiabilityNonCurrent: number;
  depreciationExpense: number;
  interestExpenseRent: number;
  rentExpense: number;
}

export type Branch = 'PERT' | 'MACK' | 'MTIS' | 'MUSW' | 'NEWM' | 'ADEL' | 'BLAC' | 'CORP' | 'PERT-RTS' | 'MACK-RTS' | 'ADEL-RTS' | 'PARK' | '';

export interface BaseLease {
  id: string;
  leaseId: string;
  entity: string;
  lessor: string;
  branch: Branch;
  borrowingRate: string;
  incrementMethods: { [year: number]: string };
  overrideAmounts: { [year: number]: string };
  openingBalances: OpeningBalance[];
}

export interface PropertyLease extends BaseLease {
  type: 'Property';
  propertyAddress: string;
  commencementDate: string;
  expiryDate: string;
  options: string;
  annualRent: string;
  fixedIncrementRate: string;
  rbaCpiRate: string;
}

export interface MotorVehicleLease extends BaseLease {
  type: 'Motor Vehicle';
  description: string;
  vinSerialNo: string;
  regoNo: string;
  engineNumber: string;
  vehicleType: string;
  deliveryDate: string;
  expiryDate: string;
  annualRent: string;
}

export type Lease = PropertyLease | MotorVehicleLease;