/// <reference types="react-scripts" />

import { Lease } from './types/Lease';
import { Entity, AppState } from './types/Entity';

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

      // App state operations
      loadAppState: () => Promise<AppState>;
      saveAppState: (appState: AppState) => Promise<boolean>;
    };
  }
}
