export const Role = {
  ADMIN: 'ADMIN',
  USER: 'USER',
  OWNER: 'OWNER',
  MANAGER: 'MANAGER',
} as const;

/**
 * Privilege rank of each role; a higher rank outranks a lower one.
 * Unknown role names rank as USER.
 */

export const RoleRank: Record<string, number> = {
  [Role.USER]: 0,
  [Role.MANAGER]: 1,
  [Role.ADMIN]: 2,
  [Role.OWNER]: 3,
};

/**
 * Roles the system depends on: only OWNER may deactivate or delete them.
 */

export const PROTECTED_ROLES: readonly string[] = [
  Role.OWNER,
  Role.ADMIN,
  Role.USER,
];
