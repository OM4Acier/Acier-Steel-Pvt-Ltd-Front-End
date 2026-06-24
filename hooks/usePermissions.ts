'use client';

import { useCallback } from 'react';
import { usePermissionStore } from '@/stores/permission-store';
import { AppModule } from '@/types/permissions';

/**
 * hooks/usePermissions.ts
 * 
 * Hook to access and check permissions for a specific module.
 * Uses conservative defaults if manifest or field is not found.
 */
export function usePermissions(module: AppModule) {
  const manifest = usePermissionStore((state) => state.manifests[module]);

  const isVisible = useCallback((fieldId: string): boolean => {
    if (!manifest) return true; // Show by default
    const field = manifest.fields.find((f) => f.fieldId === fieldId);
    return field ? field.visible : true;
  }, [manifest]);

  const isEditable = useCallback((fieldId: string): boolean => {
    if (!manifest) return false; // Protected by default
    const field = manifest.fields.find((f) => f.fieldId === fieldId);
    return field ? field.editable : false;
  }, [manifest]);

  const isDeletable = useCallback((fieldId: string): boolean => {
    if (!manifest) return false; // Protected by default
    const field = manifest.fields.find((f) => f.fieldId === fieldId);
    return field ? field.deletable : false;
  }, [manifest]);

  const canViewSection = useCallback((sectionId: string): boolean => {
    if (!manifest) return true; // Show by default
    const section = manifest.sections.find((s) => s.sectionId === sectionId);
    return section ? section.visible : true;
  }, [manifest]);

  const apiKey = useCallback((sectionId: string, key: string): string | null => {
    return canViewSection(sectionId) ? key : null;
  }, [canViewSection]);

  return {
    isVisible,
    isEditable,
    isDeletable,
    canViewSection,
    apiKey,
  };
}
