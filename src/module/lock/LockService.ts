import {
  HttpException,
  HttpStatus,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';

import type { Namespace } from 'socket.io';

import {
  LOCK_IDLE_TIMEOUT_MS,
  LockEvent,
  LockResource,
  MAX_LOCKS_PER_SOCKET,
} from '@/shared/constants';
import { PrismaService } from '@/shared/prisma';
import type { TCurrentUser } from '@/shared/types';

import type {
  TEditLock,
  TLockAck,
  TLockReleased,
  TLockReleaseReason,
  TLockResource,
  TLockSession,
  TLockTarget,
  TRecordChangeAction,
  TRecordChanged,
} from './LockTypes';

type TActor = Pick<TCurrentUser, 'sub'>;

type TLockEntry = TEditLock & {
  socketId: string;
  timer?: ReturnType<typeof setTimeout>;
};

/**
 * Keeps the edit locks in memory and broadcasts every change over the lock
 * namespace. A lock belongs to one socket (one browser tab); it is released
 * when the tab releases it, disconnects or stays idle for
 * LOCK_IDLE_TIMEOUT_MS. State is per process: running several instances
 * requires moving it to Redis.
 */

@Injectable()
export class LockService implements OnModuleDestroy {
  private server?: Namespace;

  private readonly locks = new Map<string, TLockEntry>();

  private readonly socketLocks = new Map<string, Set<string>>();

  constructor(private readonly prisma: PrismaService) {}

  attach(server: Namespace): void {
    this.server = server;
  }

  onModuleDestroy(): void {
    this.locks.forEach(({ timer }) => clearTimeout(timer));
    this.locks.clear();
    this.socketLocks.clear();
  }

  /**
   * @returns Room a socket joins to receive the lock events of a resource
   */

  roomOf(resource: TLockResource): string {
    return `locks:${resource}`;
  }

  /**
   * @returns The current locks of a resource
   */

  snapshot(resource: TLockResource): TEditLock[] {
    return [...this.locks.values()]
      .filter((lock) => lock.resource === resource)
      .map((lock) => this.toPublic(lock));
  }

  /**
   * @description Locks the record for the socket. Acquiring a lock the socket
   * already holds renews it. When another tab holds it the current lock is
   * returned so the client can show who is editing.
   */

  async acquire(
    socketId: string,
    session: TLockSession,
    target: TLockTarget,
  ): Promise<TLockAck<TEditLock>> {
    if (!(await this.exists(target))) {
      return { ok: false, error: 'Record not found.' };
    }

    /**
     * No await below: the check and the insert run without interleaving, so
     * two concurrent acquires cannot both succeed.
     */

    const key = this.keyOf(target);
    const existing = this.locks.get(key);

    if (existing?.socketId === socketId) {
      return { ok: true, data: this.touch(existing) };
    }

    if (existing) {
      return {
        ok: false,
        error: `This record is currently being edited by ${existing.holder.fullName}.`,
        lock: this.toPublic(existing),
      };
    }

    const held = this.socketLocks.get(socketId) ?? new Set<string>();

    if (held.size >= MAX_LOCKS_PER_SOCKET) {
      return {
        ok: false,
        error: `You cannot edit more than ${MAX_LOCKS_PER_SOCKET} records at once.`,
      };
    }

    const entry: TLockEntry = {
      resource: target.resource,
      id: target.id,
      holder: { userId: session.userId, fullName: session.fullName },
      acquiredAt: new Date().toISOString(),
      expiresAt: '',
      socketId,
    };

    this.locks.set(key, entry);
    this.socketLocks.set(socketId, held.add(key));

    const lock = this.touch(entry);

    this.emit(LockEvent.ACQUIRED, lock);

    return { ok: true, data: lock };
  }

  /**
   * @description Extends the idle timeout; clients call it while the user
   * keeps editing.
   */

  renew(socketId: string, target: TLockTarget): TLockAck<TEditLock> {
    const entry = this.locks.get(this.keyOf(target));

    if (entry?.socketId !== socketId) {
      return { ok: false, error: 'You do not hold the lock on this record.' };
    }

    return { ok: true, data: this.touch(entry) };
  }

  /**
   * @description Idempotent; releasing a lock the socket does not hold is a
   * no-op.
   */

  release(socketId: string, target: TLockTarget): TLockAck {
    const entry = this.locks.get(this.keyOf(target));

    if (entry?.socketId === socketId) this.drop(entry, 'released');

    return { ok: true, data: undefined };
  }

  releaseAll(socketId: string, reason: TLockReleaseReason): void {
    this.socketLocks.get(socketId)?.forEach((key) => {
      const entry = this.locks.get(key);

      if (entry) this.drop(entry, reason);
    });

    this.socketLocks.delete(socketId);
  }

  /**
   * @param target The record being written
   * @param actor The signed-in user performing the write
   * @param action Broadcast to watchers after the write succeeds
   * @param write The database write
   * @throws 423 Locked when another user holds the lock on the record
   * @description REST counterpart of the socket lock: a write is rejected
   * while someone else edits the record, then every watcher is told that it
   * changed so they can refetch it.
   */

  async guardWrite<T>(
    target: TLockTarget,
    actor: TActor,
    action: TRecordChangeAction,
    write: () => Promise<T>,
  ): Promise<T> {
    const lock = this.locks.get(this.keyOf(target));

    if (lock && lock.holder.userId !== actor.sub) {
      throw new HttpException(
        `This record is currently being edited by ${lock.holder.fullName}.`,
        HttpStatus.LOCKED,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: actor.sub },
      select: { fullName: true },
    });

    const result = await write();

    const current = this.locks.get(this.keyOf(target));

    if (action === 'deleted' && current) this.drop(current, 'deleted');

    const change: TRecordChanged = {
      resource: target.resource,
      id: target.id,
      action,
      by: { userId: actor.sub, fullName: user?.fullName ?? '' },
      at: new Date().toISOString(),
    };

    this.emit(LockEvent.RECORD_CHANGED, change);

    return result;
  }

  /**
   * @description Restarts the idle timer of the lock.
   */

  private touch(entry: TLockEntry): TEditLock {
    clearTimeout(entry.timer);

    entry.timer = setTimeout(
      () => this.drop(entry, 'expired'),
      LOCK_IDLE_TIMEOUT_MS,
    );

    entry.expiresAt = new Date(Date.now() + LOCK_IDLE_TIMEOUT_MS).toISOString();

    return this.toPublic(entry);
  }

  private drop(entry: TLockEntry, reason: TLockReleaseReason): void {
    const key = this.keyOf(entry);

    if (this.locks.get(key) !== entry) return;

    clearTimeout(entry.timer);

    this.locks.delete(key);
    this.socketLocks.get(entry.socketId)?.delete(key);

    const released: TLockReleased = {
      resource: entry.resource,
      id: entry.id,
      reason,
    };

    this.emit(LockEvent.RELEASED, released, entry.socketId);
  }

  /**
   * @param socketId Also sent to this socket, so the holder learns its lock
   * expired even when it does not watch the resource
   */

  private emit(event: string, payload: TLockTarget, socketId?: string): void {
    if (!this.server) return;

    const room = this.server.to(this.roomOf(payload.resource));

    (socketId ? room.to(socketId) : room).emit(event, payload);
  }

  private async exists({ resource, id }: TLockTarget): Promise<boolean> {
    switch (resource) {
      case LockResource.POST: {
        const postId = Number(id);

        if (!Number.isSafeInteger(postId)) return false;

        const post = await this.prisma.post.findUnique({
          where: { id: postId },
          select: { id: true },
        });

        return post !== null;
      }
    }
  }

  private toPublic({
    resource,
    id,
    holder,
    acquiredAt,
    expiresAt,
  }: TLockEntry): TEditLock {
    return { resource, id, holder, acquiredAt, expiresAt };
  }

  private keyOf({ resource, id }: TLockTarget): string {
    return `${resource}:${id}`;
  }
}
