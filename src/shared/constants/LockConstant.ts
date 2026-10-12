import { Role } from './RoleConstant';

const SECOND = 1_000;

export const LOCK_NAMESPACE = '/locks';

/**
 * Records that can be locked for editing. The value is used in socket
 * payloads and room names.
 */

export const LockResource = {
  POST: 'post',
} as const;

export const LockEvent = {
  /**
   *  client -> server
   */
  WATCH: 'lock:watch',
  UNWATCH: 'lock:unwatch',
  ACQUIRE: 'lock:acquire',
  RENEW: 'lock:renew',
  RELEASE: 'lock:release',

  /**
   * server -> client
   */
  ACQUIRED: 'lock:acquired',
  RELEASED: 'lock:released',
  RECORD_CHANGED: 'record:changed',
} as const;

/**
 * Roles allowed to connect to the lock namespace; matches the roles allowed
 * to update records over REST.
 */

export const LOCK_ALLOWED_ROLES: readonly string[] = [Role.OWNER, Role.ADMIN];

/**
 * A lock is released when the holder sends no `lock:renew` for this long,
 * e.g. an edit form left open in a forgotten tab.
 */

export const LOCK_IDLE_TIMEOUT_MS = 5 * 60 * SECOND;

export const MAX_LOCKS_PER_SOCKET = 10;

/**
 * Socket.IO heartbeat; a closed tab or dropped network is detected within
 * pingInterval + pingTimeout and its locks are released.
 */

export const LOCK_PING_INTERVAL_MS = 10 * SECOND;

export const LOCK_PING_TIMEOUT_MS = 5 * SECOND;
