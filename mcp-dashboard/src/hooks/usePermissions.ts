import { useAuth } from "../contexts/AuthContext";

export type Permission = 
  | "view_all_tenants"
  | "manage_users"
  | "manage_tenants"
  | "view_metrics"
  | "export_data"
  | "manage_settings";

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    "view_all_tenants",
    "manage_users",
    "manage_tenants",
    "view_metrics",
    "export_data",
    "manage_settings",
  ],
  manager: [
    "view_metrics",
    "export_data",
  ],
  user: [],
};

export function usePermissions() {
  const { profile, tenant } = useAuth();
  
  const role = profile?.role || "user";
  const permissions = ROLE_PERMISSIONS[role] || [];
  
  const hasPermission = (permission: Permission): boolean => {
    return permissions.includes(permission);
  };
  
  const canViewAllTenants = hasPermission("view_all_tenants");
  const canManageUsers = hasPermission("manage_users");
  const canManageTenants = hasPermission("manage_tenants");
  const canViewMetrics = hasPermission("view_metrics");
  const canExportData = hasPermission("export_data");
  const canManageSettings = hasPermission("manage_settings");
  
  // Manager só vê seu próprio tenant
  const allowedTenantId = canViewAllTenants ? null : tenant?.id;
  
  return {
    role,
    permissions,
    hasPermission,
    canViewAllTenants,
    canManageUsers,
    canManageTenants,
    canViewMetrics,
    canExportData,
    canManageSettings,
    allowedTenantId,
    isAdmin: role === "admin",
    isManager: role === "manager",
    isUser: role === "user",
  };
}
