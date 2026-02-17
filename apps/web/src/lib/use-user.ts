"use client";

export type UserRole = "admin" | "front_desk" | "housekeeping" | "manager";

export interface AppUser {
  id: string;
  username: string;
  role: UserRole;
}

const DEFAULT_USER: AppUser = {
  id: "default",
  username: "admin",
  role: "admin",
};

/**
 * Returns the current user. Auth is currently disabled —
 * returns default admin user so all UI is visible.
 * When auth is re-enabled, restore useAuth() integration.
 */
export function useUser(): AppUser {
  return DEFAULT_USER;
}

/** Check if role can see admin/manager-only items */
export function isAdminOrManager(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}
