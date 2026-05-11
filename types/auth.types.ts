// types/auth.types.ts

import { Permission } from "./rbac.types";

export type UserRole = 
  | 'super-admin' 
  | 'sales' 
  | 'accountant' 
  | 'operations' 
  | 'purchase-entry'
  | 'manager'
  | 'viewer'
  | 'editor';

  export interface UserProfile {
    id: string;
    name: string;
    email: string;
    role: UserRole;// | UserRole[]; // Support single or multiple roles
    permissions?: Permission[];
    contactNo?: string;
    organization?: string;
    accessToken: string;
    department?: string;
    isActive?: boolean;
    expiresAt?: Date;
  }

export type { Permission };
