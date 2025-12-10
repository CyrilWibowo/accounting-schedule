// utils/dataStorage.ts
import { Lease } from '../types/Lease';

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
