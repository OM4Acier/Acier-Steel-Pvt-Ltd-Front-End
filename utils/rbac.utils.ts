// utils/rbac.utils.ts
import { UserProfile, UserRole, Permission, AccessRule, AccessCheckResult, RBACConfig } from '@/types/rbac.types';

/**
 * RBAC Utility Class
 * Comprehensive Role-Based Access Control with advanced features
 */
class RBACManager {
  private config: RBACConfig;
  private accessCache: Map<string, { result: boolean; timestamp: number }>;
  private cacheDuration = 5 * 60 * 1000; // 5 minutes

  constructor(config: RBACConfig = {}) {
    this.config = {
      mode: 'allow',
      strictMode: false,
      logAccess: false,
      cacheResults: true,
      ...config
    };
    this.accessCache = new Map();
  }

  /**
   * 1. SIMPLE ROLE CHECK
   * Check if user has a specific role
   */
  hasRole(user: UserProfile, role: UserRole): boolean {
    if (!user) return false;
    
    const userRoles = Array.isArray(user.role) ? user.role : [user.role];
    return userRoles.includes(role);
  }

  /**
   * Check if user has ANY of the specified roles (OR logic)
   */
  hasAnyRole(user: UserProfile, roles: UserRole[]): boolean {
    if (!user || !roles || roles.length === 0) return false;
    
    const userRoles = Array.isArray(user.role) ? user.role : [user.role];
    return roles.some(role => userRoles.includes(role));
  }

  /**
   * Check if user has ALL specified roles (AND logic)
   */
  hasAllRoles(user: UserProfile, roles: UserRole[]): boolean {
    if (!user || !roles || roles.length === 0) return false;
    
    const userRoles = Array.isArray(user.role) ? user.role : [user.role];
    return roles.every(role => userRoles.includes(role));
  }

  /**
   * 2. BLOCKING BY ROLE
   * Check if user's role is blocked
   */
  isRoleBlocked(user: UserProfile, blockedRole: UserRole): boolean {
    return this.hasRole(user, blockedRole);
  }

  /**
   * Check if user has any blocked role
   */
  hasBlockedRole(user: UserProfile, blockedRoles: UserRole[]): boolean {
    return this.hasAnyRole(user, blockedRoles);
  }

  /**
   * 3. EMAIL-BASED ACCESS CONTROL
   */
  
  /**
   * Check if email is in allowed list
   */
  isEmailAllowed(email: string, allowedEmails: string[]): boolean {
    if (!email || !allowedEmails || allowedEmails.length === 0) return true;
    return allowedEmails.includes(email.toLowerCase());
  }

  /**
   * Check if email is blocked
   */
  isEmailBlocked(email: string, blockedEmails: string[]): boolean {
    if (!email || !blockedEmails || blockedEmails.length === 0) return false;
    return blockedEmails.includes(email.toLowerCase());
  }

  /**
   * Check if email domain is allowed
   */
  isEmailDomainAllowed(email: string, allowedDomains: string[]): boolean {
    if (!email || !allowedDomains || allowedDomains.length === 0) return true;
    
    const domain = email.split('@')[1]?.toLowerCase();
    return domain ? allowedDomains.includes(domain) : false;
  }

  /**
   * Check if email domain is blocked
   */
  isEmailDomainBlocked(email: string, blockedDomains: string[]): boolean {
    if (!email || !blockedDomains || blockedDomains.length === 0) return false;
    
    const domain = email.split('@')[1]?.toLowerCase();
    return domain ? blockedDomains.includes(domain) : false;
  }

  /**
   * 4. PERMISSION-BASED ACCESS
   */
  
  /**
   * Check if user has specific permission
   */
  hasPermission(user: UserProfile, permission: Permission): boolean {
    if (!user || !user.permissions) return false;
    return user.permissions.includes(permission);
  }

  /**
   * Check if user has any of the permissions
   */
  hasAnyPermission(user: UserProfile, permissions: Permission[]): boolean {
    if (!user || !user.permissions || !permissions) return false;
    return permissions.some(p => user.permissions!.includes(p));
  }

  /**
   * Check if user has all permissions
   */
  hasAllPermissions(user: UserProfile, permissions: Permission[]): boolean {
    if (!user || !user.permissions || !permissions) return false;
    return permissions.every(p => user.permissions!.includes(p));
  }

  /**
   * 5. ADVANCED ACCESS CHECK
   * Comprehensive access control with multiple rules
   */
  checkAccess(user: UserProfile | null, rule: AccessRule): AccessCheckResult {
    // Cache key for performance
    const cacheKey = this.getCacheKey(user, rule);
    
    // Check cache if enabled
    if (this.config.cacheResults) {
      const cached = this.accessCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
        return { allowed: cached.result, reason: 'From cache' };
      }
    }

    // Default deny if no user
    if (!user) {
      return this.createResult(false, 'No user provided');
    }

    // Check if user is active (if required)
    if (rule.requireActive && user.isActive === false) {
      return this.createResult(false, 'User is not active', 'Active check');
    }

    // Check expiry (if enabled)
    if (rule.expiryCheck && user.expiresAt) {
      if (new Date(user.expiresAt) < new Date()) {
        return this.createResult(false, 'User access has expired', 'Expiry check');
      }
    }

    // Check denied emails first (highest priority)
    if (rule.deniedEmails && this.isEmailBlocked(user.email, rule.deniedEmails)) {
      return this.createResult(false, 'Email is blocked', 'Email blacklist');
    }

    // Check denied email domains
    if (rule.deniedEmailDomains && this.isEmailDomainBlocked(user.email, rule.deniedEmailDomains)) {
      return this.createResult(false, 'Email domain is blocked', 'Domain blacklist');
    }

    // Check denied roles
    if (rule.deniedRoles && this.hasAnyRole(user, rule.deniedRoles)) {
      return this.createResult(false, 'User role is denied', 'Role blacklist');
    }

    // Check allowed emails (whitelist)
    if (rule.allowedEmails && rule.allowedEmails.length > 0) {
      if (!this.isEmailAllowed(user.email, rule.allowedEmails)) {
        return this.createResult(false, 'Email not in allowed list', 'Email whitelist');
      }
    }

    // Check allowed email domains
    if (rule.emailDomains && rule.emailDomains.length > 0) {
      if (!this.isEmailDomainAllowed(user.email, rule.emailDomains)) {
        return this.createResult(false, 'Email domain not allowed', 'Domain whitelist');
      }
    }

    // Check allowed roles
    if (rule.allowedRoles && rule.allowedRoles.length > 0) {
      const hasRequiredRole = rule.requireAllRoles
        ? this.hasAllRoles(user, rule.allowedRoles)
        : this.hasAnyRole(user, rule.allowedRoles);
      
      if (!hasRequiredRole) {
        return this.createResult(
          false,
          rule.requireAllRoles 
            ? 'User does not have all required roles' 
            : 'User does not have any required role',
          'Role check'
        );
      }
    }

    // Check required permissions
    if (rule.requiredPermissions && rule.requiredPermissions.length > 0) {
      const hasRequiredPermission = rule.requireAllPermissions
        ? this.hasAllPermissions(user, rule.requiredPermissions)
        : this.hasAnyPermission(user, rule.requiredPermissions);
      
      if (!hasRequiredPermission) {
        return this.createResult(
          false,
          rule.requireAllPermissions
            ? 'User does not have all required permissions'
            : 'User does not have any required permission',
          'Permission check'
        );
      }
    }

    // Check organization
    if (rule.requireOrganization && user.organization !== rule.requireOrganization) {
      return this.createResult(false, 'User organization mismatch', 'Organization check');
    }

    // Check department
    if (rule.requireDepartment && user.department) {
      if (!rule.requireDepartment.includes(user.department)) {
        return this.createResult(false, 'User department not allowed', 'Department check');
      }
    }

    // Check time-based access
    if (rule.allowedDays || rule.allowedHours) {
      const now = new Date();
      
      if (rule.allowedDays) {
        const currentDay = now.getDay();
        if (!rule.allowedDays.includes(currentDay)) {
          return this.createResult(false, 'Access not allowed on this day', 'Time check');
        }
      }
      
      if (rule.allowedHours) {
        const currentHour = now.getHours();
        if (currentHour < rule.allowedHours.start || currentHour >= rule.allowedHours.end) {
          return this.createResult(false, 'Access not allowed at this time', 'Time check');
        }
      }
    }

    // Custom validator (most flexible)
    if (rule.customValidator) {
      try {
        const customResult = rule.customValidator(user);
        if (!customResult) {
          return this.createResult(false, 'Custom validation failed', 'Custom validator');
        }
      } catch (error) {
        return this.createResult(false, 'Custom validator error', 'Custom validator');
      }
    }

    // All checks passed
    const result = this.createResult(true, 'Access granted');
    
    // Cache result
    if (this.config.cacheResults) {
      this.accessCache.set(cacheKey, { result: true, timestamp: Date.now() });
    }

    return result;
  }

  /**
   * Helper method to create result object
   */
  private createResult(allowed: boolean, reason?: string, deniedBy?: string): AccessCheckResult {
    if (this.config.logAccess) {
      console.log(`[RBAC] Access ${allowed ? 'GRANTED' : 'DENIED'}: ${reason || 'No reason'}`);
    }
    
    return {
      allowed,
      reason,
      deniedBy
    };
  }

  /**
   * Generate cache key
   */
  private getCacheKey(user: UserProfile | null, rule: AccessRule): string {
    if (!user) return 'no-user';
    return `${user.id}-${JSON.stringify(rule)}`;
  }

  /**
   * Clear access cache
   */
  clearCache(): void {
    this.accessCache.clear();
  }

  /**
   * 6. CONVENIENCE METHODS
   */

  /**
   * Check if user is super admin
   */
  isSuperAdmin(user: UserProfile): boolean {
    return this.hasRole(user, 'super-admin');
  }

  /**
   * Check if user can access resource
   */
  canAccess(user: UserProfile, allowedRoles: UserRole[]): boolean {
    // Super admin always has access
    if (this.isSuperAdmin(user)) return true;
    
    return this.hasAnyRole(user, allowedRoles);
  }

  /**
   * Check if user can perform action
   */
  canPerform(user: UserProfile, permission: Permission): boolean {
    // Super admin can do everything
    if (this.isSuperAdmin(user)) return true;
    
    return this.hasPermission(user, permission);
  }
}

// Export singleton instance
export const rbac = new RBACManager();

// Export class for custom instances
export { RBACManager };

/**
 * SIMPLE HELPER FUNCTIONS
 * Quick access functions for common use cases
 */

/**
 * Check if user has specific role
 */
export const hasRole = (user: UserProfile, role: UserRole): boolean => {
  return rbac.hasRole(user, role);
};

/**
 * Check if user has any of the roles
 */
export const hasAnyRole = (user: UserProfile, roles: UserRole[]): boolean => {
  return rbac.hasAnyRole(user, roles);
};

/**
 * Check if user has all roles
 */
export const hasAllRoles = (user: UserProfile, roles: UserRole[]): boolean => {
  return rbac.hasAllRoles(user, roles);
};

/**
 * Check if user's role is blocked
 */
export const isRoleBlocked = (user: UserProfile, role: UserRole): boolean => {
  return rbac.isRoleBlocked(user, role);
};

/**
 * Check if user's email is blocked
 */
export const isEmailBlocked = (email: string, blockedEmails: string[]): boolean => {
  return rbac.isEmailBlocked(email, blockedEmails);
};

/**
 * Check comprehensive access
 */
export const checkAccess = (user: UserProfile | null, rule: AccessRule): AccessCheckResult => {
  return rbac.checkAccess(user, rule);
};

/**
 * Check if super admin
 */
export const isSuperAdmin = (user: UserProfile): boolean => {
  return rbac.isSuperAdmin(user);
};