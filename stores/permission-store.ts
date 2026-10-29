import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PermissionsResponse } from '@/types/permissions';
import { permissionsApi } from '@/lib/api/endpoints/permissions';

/**
 * stores/permission-store.ts
 * 
 * Zustand store with localStorage persistence for user permission manifests.
 */

interface PermissionState {
  permissions: string[];
  version: string | null;
  role: string | null;
  roleChanged: boolean;
  loaded: boolean;
  
  // Actions
  load: () => Promise<void>;
  setManifests: (response: PermissionsResponse) => void;
  clearManifests: () => void;
  dismissRoleChange: () => void;
}

export const usePermissionStore = create<PermissionState>()(
  persist(
    (set, get) => ({
      permissions: [],
      version: null,
      role: null,
      roleChanged: false,
      loaded: false,

      load: async () => {
        const state = get();
        
        // If already loaded (hydrated), check version in background
        if (state.loaded && state.version) {
          permissionsApi.getPermissions()
            .then(res => {
              if (res && res.version !== state.version) {
                get().setManifests(res);
              }
            })
            .catch(() => {
              // Fail silently - continue using cached version
            });
          return;
        }

        // Fresh load
        try {
          const res = await permissionsApi.getPermissions();
          if (res) get().setManifests(res);
        } catch (err) {
          console.warn('[PermissionStore] Initial load failed:', err);
        }
      },

      setManifests: (response: PermissionsResponse) => {
        const { version, permissions, role } = response;
        const currentVersion = get().version;
        const currentRole = get().role;

        // Detect role change
        const roleChanged = !!currentRole && currentRole !== role;

        // Skip update if version matches AND role matches (optimisation)
        if (currentVersion === version && currentRole === role && get().loaded) {
          return;
        }

        set({
          permissions: permissions ?? [],
          version,
          role,
          loaded: true,
          roleChanged: get().roleChanged || roleChanged,
        });
      },

      clearManifests: () => {
        set({
          permissions: [],
          version: null,
          role: null,
          roleChanged: false,
          loaded: false,
        });
      },

      dismissRoleChange: () => {
        set({ roleChanged: false });
      },
    }),
    {
      name: 'app-permissions', // localStorage key
    }
  )
);
