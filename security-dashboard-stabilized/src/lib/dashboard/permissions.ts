export type Permission =
  | "read:threats"
  | "write:threats"
  | "read:incidents"
  | "write:incidents"
  | "read:compliance"
  | "write:compliance"
  | "read:chatbot"
  | "write:chatbot"
  | "read:reports"
  | "write:reports"
  | "read:settings"
  | "write:settings"
  | "read:team"
  | "write:team"
  | "read:hunts"
  | "write:hunts"
  | "read:lab"
  | "write:lab";

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  Admin: [
    "read:threats", "write:threats",
    "read:incidents", "write:incidents",
    "read:compliance", "write:compliance",
    "read:chatbot", "write:chatbot",
    "read:reports", "write:reports",
    "read:settings", "write:settings",
    "read:team", "write:team",
    "read:hunts", "write:hunts",
    "read:lab", "write:lab"
  ],
  Analyst: [
    "read:threats", "write:threats",
    "read:incidents", "write:incidents",
    "read:compliance", "write:compliance",
    "read:chatbot", "write:chatbot",
    "read:reports",
    "read:settings",
    "read:team",
    "read:hunts", "write:hunts",
    "read:lab", "write:lab"
  ],
  Viewer: [
    "read:threats",
    "read:incidents",
    "read:compliance",
    "read:chatbot",
    "read:reports",
    "read:settings",
    "read:team",
    "read:hunts",
    "read:lab"
  ]
};



export function hasPermission(role: string, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}
