'use client';

import React, { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { AppModule } from '@/types/permissions';

/**
 * components/PermissionGate.tsx
 * 
 * Declarative wrapper to conditionally render children based on permission manifests.
 * Enforces either 'field' or 'section' check via TypeScript.
 */

type PermissionGateProps = {
  module: AppModule;
  fallback?: ReactNode;
  children: ReactNode;
} & (
  | { field: string; section?: never }
  | { section: string; field?: never }
);

export function PermissionGate({
  module,
  field,
  section,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { isVisible, canViewSection } = usePermissions(module);

  let hasAccess = true;

  if (field) {
    hasAccess = isVisible(field);
  } else if (section) {
    hasAccess = canViewSection(section);
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
