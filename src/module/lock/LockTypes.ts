import type { Socket } from 'socket.io';

import type { LockResource } from '@/shared/constants';

export type TLockResource = (typeof LockResource)[keyof typeof LockResource];

export type TLockTarget = {
  resource: TLockResource;
  id: string;
};

export type TLockHolder = {
  userId: string;
  fullName: string;
};

/**
 * Lock state as sent to clients.
 */

export type TEditLock = TLockTarget & {
  holder: TLockHolder;
  acquiredAt: string;
  expiresAt: string;
};

export type TLockReleaseReason =
  'released' | 'expired' | 'disconnected' | 'deleted';

export type TLockReleased = TLockTarget & { reason: TLockReleaseReason };

export type TRecordChangeAction = 'updated' | 'deleted';

export type TRecordChanged = TLockTarget & {
  action: TRecordChangeAction;
  by: TLockHolder;
  at: string;
};

/**
 * Authenticated user attached to the socket during the handshake.
 */

export type TLockSession = TLockHolder & {
  roles: string[];
  tokenVersion: number;
};

export type TLockSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  TLockSession
>;

/**
 * Acknowledgement returned to every client event.
 */

export type TLockAck<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string; lock?: TEditLock };
