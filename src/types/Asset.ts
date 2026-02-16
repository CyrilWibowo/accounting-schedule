export interface Asset {
  id: string;
  assetType: 'Regular';
  description: string;
  tagNo: string;
  serialNo: string;
  category: AssetCategory;
  branch: AssetBranch;
  cost: string;
  vendorName: string;
  invoice: string;
  usefulLife: string;
  depreciationRate: string;
}

export interface CIPAsset {
  id: string;
  assetType: 'CIP';
  description: string;
  category: AssetCategory;
  vendorName: string;
  invoice: string;
  date: string;
  branch: AssetBranch;
  amount: string;
  completed: 'Y' | 'N';
  completionDate: string;
}

export type AssetCategory = '' | 'Office Equipment' | 'Motor Vehicle' | 'Warehouse Equipment' | 'Manufacturing Equipment' | 'Equipment for Leased' | 'Software';
export type AssetBranch = '' | 'CORP' | 'PERT' | 'MACK' | 'MTIS' | 'MUSW' | 'NEWM' | 'ADEL' | 'BLAC' | 'PARK';
