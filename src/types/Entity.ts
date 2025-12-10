// types/Entity.ts

export interface Entity {
  id: string;
  name: string;
  abnAcn: string;
  address: string;
}

export interface AppState {
  selectedEntityId: string | null;
}
