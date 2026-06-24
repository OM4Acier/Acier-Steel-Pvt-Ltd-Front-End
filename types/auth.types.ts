// types/auth.types.ts

import { Permission } from "./rbac.types";
import { UserRole } from "./user.types";

export type { UserRole };

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
