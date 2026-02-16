/// <reference types="react-scripts" />

import type { Lease } from './types/Lease';
import type { Asset, CIPAsset } from './types/Asset';
import type { Entity, AppState } from './types/Entity';

export {};

declare global {
  interface Window {
    electronAPI?: {
      // Legacy lease operations
      loadLeases: () => Promise<Lease[]>;
      saveLeases: (leases: Lease[]) => Promise<boolean>;

      // Entity operations
      loadEntities: () => Promise<Entity[]>;
      saveEntity: (entity: Entity) => Promise<boolean>;
      deleteEntity: (entityId: string) => Promise<boolean>;

      // Entity-specific lease operations
      loadEntityLeases: (entityId: string) => Promise<Lease[]>;
      saveEntityLeases: (entityId: string, leases: Lease[]) => Promise<boolean>;

      // Entity-specific asset operations
      loadEntityAssets: (entityId: string) => Promise<Asset[]>;
      saveEntityAssets: (entityId: string, assets: Asset[]) => Promise<boolean>;

      // Entity-specific CIP asset operations
      loadEntityCIPAssets: (entityId: string) => Promise<CIPAsset[]>;
      saveEntityCIPAssets: (entityId: string, assets: CIPAsset[]) => Promise<boolean>;

      // App state operations
      loadAppState: () => Promise<AppState>;
      saveAppState: (appState: AppState) => Promise<boolean>;

      // Dialog operations
      showOpenDialog: () => Promise<string | null>;

      // Settings operations
      getDataPath: () => Promise<string>;
      setDataPath: (dataPath: string) => Promise<boolean>;
    };
  }
}
