"use client";

import { useAuth } from "@/components/auth-provider";

export type UserRole = "admin" | "front_desk" | "housekeeping" | "manager";

export interface AppUser {
  id: string;
  username: string;
  role: UserRole;
}

const FALLBACK_USER: AppUser = {
  id: "default",
  username: "admin",
  role: "admin",
};

export function useUser(): AppUser {
  const { user } = useAuth();
  if (user) {
    return { id: user.id, username: user.username, role: user.role as UserRole };
  }
  return FALLBACK_USER;
}

export function isAdminOrManager(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}
