// utils/dataStorage.ts
import { Lease } from '../types/Lease';
import { Entity, AppState } from '../types/Entity';

// Check if running in Electron
const isElectron = (): boolean => {
  return !!window.electronAPI;
};

// In-memory cache for leases (used for synchronous operations)
let leasesCache: Lease[] = [];

/**
 * Load all leases from file (Electron) or localStorage (browser)
 */
export const loadLeases = async (): Promise<Lease[]> => {
  try {
    if (isElectron()) {
      const leases = await window.electronAPI!.loadLeases();
      leasesCache = leases;
      return leases;
    } else {
      // Fallback to localStorage for browser development
      const savedLeases = localStorage.getItem('leases');
      if (savedLeases) {
        leasesCache = JSON.parse(savedLeases);
        return leasesCache;
      }
      return [];
    }
  } catch (error) {
    console.error('Error loading leases from storage:', error);
    return [];
  }
};

/**
 * Save all leases to file (Electron) or localStorage (browser)
 */
export const saveLeases = async (leases: Lease[]): Promise<void> => {
  try {
    leasesCache = leases;
    if (isElectron()) {
      await window.electronAPI!.saveLeases(leases);
    } else {
      // Fallback to localStorage for browser development
      localStorage.setItem('leases', JSON.stringify(leases));
    }
  } catch (error) {
    console.error('Error saving leases to storage:', error);
  }
};

/**
 * Add a new lease to storage
 */
export const addLease = async (lease: Lease): Promise<Lease[]> => {
  const leases = await loadLeases();
  const updatedLeases = [...leases, lease];
  await saveLeases(updatedLeases);
  return updatedLeases;
};

/**
 * Update an existing lease in storage
 */
export const updateLease = async (updatedLease: Lease): Promise<Lease[]> => {
  const leases = await loadLeases();
  const updatedLeases = leases.map(lease =>
    lease.id === updatedLease.id ? updatedLease : lease
  );
  await saveLeases(updatedLeases);
  return updatedLeases;
};

/**
 * Delete a lease from storage
 */
export const deleteLease = async (leaseId: string): Promise<Lease[]> => {
  const leases = await loadLeases();
  const updatedLeases = leases.filter(lease => lease.id !== leaseId);
  await saveLeases(updatedLeases);
  return updatedLeases;
};

/**
 * Get a single lease by ID
 */
export const getLeaseById = async (leaseId: string): Promise<Lease | undefined> => {
  const leases = await loadLeases();
  return leases.find(lease => lease.id === leaseId);
};

/**
 * Clear all leases from storage
 */
export const clearAllLeases = async (): Promise<void> => {
  leasesCache = [];
  if (isElectron()) {
    await window.electronAPI!.saveLeases([]);
  } else {
    localStorage.removeItem('leases');
  }
};

// ============================================
// Entity-related functions
// ============================================

let entitiesCache: Entity[] = [];

/**
 * Load all entities
 */
export const loadEntities = async (): Promise<Entity[]> => {
  try {
    if (isElectron()) {
      const entities = await window.electronAPI!.loadEntities();
      entitiesCache = entities;
      return entities;
    } else {
      const savedEntities = localStorage.getItem('entities');
      if (savedEntities) {
        entitiesCache = JSON.parse(savedEntities);
        return entitiesCache;
      }
      return [];
    }
  } catch (error) {
    console.error('Error loading entities:', error);
    return [];
  }
};

/**
 * Save/create an entity
 */
export const saveEntity = async (entity: Entity): Promise<boolean> => {
  try {
    if (isElectron()) {
      const result = await window.electronAPI!.saveEntity(entity);
      if (result) {
        await loadEntities(); // Refresh cache
      }
      return result;
    } else {
      const entities = await loadEntities();
      const existingIndex = entities.findIndex(e => e.id === entity.id);
      if (existingIndex >= 0) {
        entities[existingIndex] = entity;
      } else {
        entities.push(entity);
      }
      localStorage.setItem('entities', JSON.stringify(entities));
      entitiesCache = entities;
      return true;
    }
  } catch (error) {
    console.error('Error saving entity:', error);
    return false;
  }
};

/**
 * Delete an entity and all its data
 */
export const deleteEntity = async (entityId: string): Promise<boolean> => {
  try {
    if (isElectron()) {
      const result = await window.electronAPI!.deleteEntity(entityId);
      if (result) {
        await loadEntities(); // Refresh cache
      }
      return result;
    } else {
      const entities = await loadEntities();
      const filtered = entities.filter(e => e.id !== entityId);
      localStorage.setItem('entities', JSON.stringify(filtered));
      localStorage.removeItem(`entity-leases-${entityId}`);
      entitiesCache = filtered;
      return true;
    }
  } catch (error) {
    console.error('Error deleting entity:', error);
    return false;
  }
};

/**
 * Load leases for a specific entity
 */
export const loadEntityLeases = async (entityId: string): Promise<Lease[]> => {
  try {
    if (isElectron()) {
      return await window.electronAPI!.loadEntityLeases(entityId);
    } else {
      const savedLeases = localStorage.getItem(`entity-leases-${entityId}`);
      if (savedLeases) {
        return JSON.parse(savedLeases);
      }
      return [];
    }
  } catch (error) {
    console.error('Error loading entity leases:', error);
    return [];
  }
};

/**
 * Save leases for a specific entity
 */
export const saveEntityLeases = async (entityId: string, leases: Lease[]): Promise<boolean> => {
  try {
    if (isElectron()) {
      return await window.electronAPI!.saveEntityLeases(entityId, leases);
    } else {
      localStorage.setItem(`entity-leases-${entityId}`, JSON.stringify(leases));
      return true;
    }
  } catch (error) {
    console.error('Error saving entity leases:', error);
    return false;
  }
};

/**
 * Add a lease to a specific entity
 */
export const addEntityLease = async (entityId: string, lease: Lease): Promise<Lease[]> => {
  const leases = await loadEntityLeases(entityId);
  const updatedLeases = [...leases, lease];
  await saveEntityLeases(entityId, updatedLeases);
  return updatedLeases;
};

/**
 * Update a lease within a specific entity
 */
export const updateEntityLease = async (entityId: string, updatedLease: Lease): Promise<Lease[]> => {
  const leases = await loadEntityLeases(entityId);
  const updatedLeases = leases.map(lease =>
    lease.id === updatedLease.id ? updatedLease : lease
  );
  await saveEntityLeases(entityId, updatedLeases);
  return updatedLeases;
};

/**
 * Delete a lease from a specific entity
 */
export const deleteEntityLease = async (entityId: string, leaseId: string): Promise<Lease[]> => {
  const leases = await loadEntityLeases(entityId);
  const updatedLeases = leases.filter(lease => lease.id !== leaseId);
  await saveEntityLeases(entityId, updatedLeases);
  return updatedLeases;
};

/**
 * Update the entity field (company code) for all leases of a specific entity
 */
export const updateEntityLeasesCompanyCode = async (entityId: string, newCompanyCode: string): Promise<boolean> => {
  try {
    const leases = await loadEntityLeases(entityId);
    const updatedLeases = leases.map(lease => ({
      ...lease,
      entity: newCompanyCode
    }));
    await saveEntityLeases(entityId, updatedLeases);
    return true;
  } catch (error) {
    console.error('Error updating entity leases company code:', error);
    return false;
  }
};

// ============================================
// App State functions
// ============================================

/**
 * Load app state (selected entity, etc.)
 */
export const loadAppState = async (): Promise<AppState> => {
  try {
    if (isElectron()) {
      return await window.electronAPI!.loadAppState();
    } else {
      const savedState = localStorage.getItem('app-state');
      if (savedState) {
        return JSON.parse(savedState);
      }
      return { selectedEntityId: null };
    }
  } catch (error) {
    console.error('Error loading app state:', error);
    return { selectedEntityId: null };
  }
};

/**
 * Save app state
 */
export const saveAppState = async (appState: AppState): Promise<boolean> => {
  try {
    if (isElectron()) {
      return await window.electronAPI!.saveAppState(appState);
    } else {
      localStorage.setItem('app-state', JSON.stringify(appState));
      return true;
    }
  } catch (error) {
    console.error('Error saving app state:', error);
    return false;
  }
};
