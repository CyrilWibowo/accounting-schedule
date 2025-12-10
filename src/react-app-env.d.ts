/// <reference types="react-scripts" />

import { Lease } from './types/Lease';

declare global {
  interface Window {
    electronAPI?: {
      loadLeases: () => Promise<Lease[]>;
      saveLeases: (leases: Lease[]) => Promise<boolean>;
    };
  }
}
