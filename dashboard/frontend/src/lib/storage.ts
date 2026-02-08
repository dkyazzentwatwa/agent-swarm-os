import { useCallback, useEffect, useState } from 'react';

const STORAGE_PREFIX = 'agent-squad';

/**
 * Centralized localStorage utility with error handling and workspace scoping.
 *
 * Usage:
 *   storage.get('key', defaultValue)
 *   storage.set('key', value)
 *   storage.remove('key')
 *   storage.workspaceGet(workspaceId, 'key', defaultValue)
 *   storage.workspaceSet(workspaceId, 'key', value)
 */
export const storage = {
  /**
   * Get a value from localStorage
   */
  get<T = unknown>(key: string, defaultValue: T | null = null): T | null {
    try {
      const fullKey = `${STORAGE_PREFIX}.${key}`;
      const item = localStorage.getItem(fullKey);

      if (item === null) {
        return defaultValue;
      }

      // Try to parse as JSON, fall back to string if it fails
      try {
        return JSON.parse(item);
      } catch {
        return item;
      }
    } catch (error) {
      console.warn(`Failed to get storage key "${key}":`, error);
      return defaultValue;
    }
  },

  /**
   * Set a value in localStorage
   */
  set(key: string, value: unknown): void {
    try {
      const fullKey = `${STORAGE_PREFIX}.${key}`;
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(fullKey, stringValue);
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded', error);
      } else {
        console.warn(`Failed to set storage key "${key}":`, error);
      }
    }
  },

  /**
   * Remove a value from localStorage
   */
  remove(key: string): void {
    try {
      const fullKey = `${STORAGE_PREFIX}.${key}`;
      localStorage.removeItem(fullKey);
    } catch (error) {
      console.warn(`Failed to remove storage key "${key}":`, error);
    }
  },

  /**
   * Get a workspace-scoped value
   */
  workspaceGet<T = unknown>(workspaceId: string, key: string, defaultValue: T | null = null): T | null {
    return this.get<T>(`workspaces.${workspaceId}.${key}`, defaultValue);
  },

  /**
   * Set a workspace-scoped value
   */
  workspaceSet(workspaceId: string, key: string, value: unknown): void {
    this.set(`workspaces.${workspaceId}.${key}`, value);
  },

  /**
   * Remove a workspace-scoped value
   */
  workspaceRemove(workspaceId: string, key: string): void {
    this.remove(`workspaces.${workspaceId}.${key}`);
  },

  /**
   * Clear all storage for a workspace
   */
  workspaceClear(workspaceId: string): void {
    try {
      const prefix = `${STORAGE_PREFIX}.workspaces.${workspaceId}.`;
      const keys = Object.keys(localStorage);

      keys.forEach(key => {
        if (key.startsWith(prefix)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn(`Failed to clear workspace storage for "${workspaceId}":`, error);
    }
  },
};

/**
 * React hook for localStorage with automatic synchronization
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, (newValue: T) => void] {
  const [value, setValue] = useState<T>(() => storage.get<T>(key, defaultValue) ?? defaultValue);

  const setStoredValue = useCallback((newValue: T) => {
    setValue(newValue);
    storage.set(key, newValue);
  }, [key]);

  // Sync with other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      const fullKey = `${STORAGE_PREFIX}.${key}`;
      if (e.key === fullKey && e.newValue !== null) {
        try {
          const parsed = JSON.parse(e.newValue) as T;
          setValue(parsed);
        } catch {
          setValue(e.newValue as T);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [value, setStoredValue];
}

/**
 * React hook for workspace-scoped localStorage
 */
export function useWorkspaceStorage<T>(
  workspaceId: string,
  key: string,
  defaultValue: T
): [T, (newValue: T) => void] {
  const [value, setValue] = useState<T>(() =>
    storage.workspaceGet<T>(workspaceId, key, defaultValue) ?? defaultValue
  );

  const setStoredValue = useCallback((newValue: T) => {
    setValue(newValue);
    storage.workspaceSet(workspaceId, key, newValue);
  }, [workspaceId, key]);

  // Sync with other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      const fullKey = `${STORAGE_PREFIX}.workspaces.${workspaceId}.${key}`;
      if (e.key === fullKey && e.newValue !== null) {
        try {
          const parsed = JSON.parse(e.newValue);
          setValue(parsed);
        } catch {
          setValue(e.newValue);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [workspaceId, key]);

  return [value, setStoredValue];
}
