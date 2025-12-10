// types/Entity.ts

export interface Entity {
  id: string;
  name: string;
  companyCode: string;
  abnAcn: string;
  address: string;
}

export interface AppState {
  selectedEntityId: string | null;
}
