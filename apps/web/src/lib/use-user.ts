"use client";

import { useAuth } from "@/components/auth-provider";

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
 * Returns the current user. When auth is disabled (user is null),
 * returns a default admin user so all UI is visible.
 */
export function useUser(): AppUser {
  const { user } = useAuth();
  if (!user) return DEFAULT_USER;
  return user as AppUser;
}

/** Check if role can see admin/manager-only items */
export function isAdminOrManager(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}
