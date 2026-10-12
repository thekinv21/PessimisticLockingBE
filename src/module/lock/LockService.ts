import {
  HttpException,
  HttpStatus,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';

import { randomUUID } from 'node:crypto';
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
  TLockGrant,
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
  token: string;
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

  /**
   * Keys of records with a REST write in flight; they cannot be locked until
   * the write settles, so nobody opens a form on data about to change.
   */

  private readonly writing = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  attach(server: Namespace): void {
    this.server = server;
  }

  onModuleDestroy(): void {
    this.locks.forEach(({ timer }) => clearTimeout(timer));
    this.locks.clear();
    this.socketLocks.clear();
    this.writing.clear();
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
    input: TLockTarget,
  ): Promise<TLockAck<TLockGrant>> {
    const target = await this.resolve(input);

    if (!target) return { ok: false, error: 'Record not found.' };

    /**
     * The tab may have closed while the record was loading; its releaseAll
     * already ran, so a lock taken now would never be freed.
     */

    if (this.server && !this.server.sockets.has(socketId)) {
      return { ok: false, error: 'Disconnected.' };
    }

    /**
     * No await below: the check and the insert run without interleaving, so
     * two concurrent acquires cannot both succeed.
     */

    const key = this.keyOf(target);
    const existing = this.locks.get(key);

    if (existing?.socketId === socketId) {
      return { ok: true, data: this.toGrant(existing) };
    }

    if (existing) {
      return {
        ok: false,
        error:
          existing.holder.userId === session.userId
            ? 'You are already editing this record in another tab.'
            : `This record is currently being edited by ${existing.holder.fullName}.`,
        lock: this.toPublic(existing),
      };
    }

    if (this.writing.has(key)) {
      return {
        ok: false,
        error: 'This record is being saved. Please try again.',
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
      token: randomUUID(),
    };

    this.locks.set(key, entry);
    this.socketLocks.set(socketId, held.add(key));

    const grant = this.toGrant(entry);

    this.emit(LockEvent.ACQUIRED, this.toPublic(entry));

    return { ok: true, data: grant };
  }

  /**
   * @description Extends the idle timeout; clients call it while the user
   * keeps editing.
   */

  renew(socketId: string, target: TLockTarget): TLockAck<TEditLock> {
    const entry = this.locks.get(this.keyOf(this.canonical(target)));

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
    const entry = this.locks.get(this.keyOf(this.canonical(target)));

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
   * @param token The token `lock:acquire` returned to the writing tab
   * @param action Broadcast to watchers after the write succeeds
   * @param write The database write
   * @throws 423 Locked when another tab holds the lock on the record
   * @throws 428 Precondition Required when an update is sent without holding
   * the lock
   * @description REST counterpart of the socket lock: an update must come
   * from the tab holding the lock, a delete only from it while the record is
   * locked. Every watcher is then told that the record changed, and the
   * lock is released.
   */

  async guardWrite<T>(
    target: TLockTarget,
    actor: TActor,
    token: string | undefined,
    action: TRecordChangeAction,
    write: () => Promise<T>,
  ): Promise<T> {
    const key = this.keyOf(this.canonical(target));
    const lock = this.locks.get(key);

    if (lock && (lock.token !== token || lock.holder.userId !== actor.sub)) {
      throw new HttpException(
        lock.holder.userId === actor.sub
          ? 'You are editing this record in another tab.'
          : `This record is currently being edited by ${lock.holder.fullName}.`,
        HttpStatus.LOCKED,
      );
    }

    if (!lock && action === 'updated') {
      throw new HttpException(
        'Your edit lock has expired. Reopen the record to edit it.',
        HttpStatus.PRECONDITION_REQUIRED,
      );
    }

    if (this.writing.has(key)) {
      throw new HttpException(
        'This record is being saved. Please try again.',
        HttpStatus.LOCKED,
      );
    }

    this.writing.add(key);

    try {
      const result = await write();

      const change: TRecordChanged = {
        resource: target.resource,
        id: this.canonical(target).id,
        action,
        by: {
          userId: actor.sub,
          fullName: lock?.holder.fullName ?? (await this.fullNameOf(actor)),
        },
        at: new Date().toISOString(),
      };

      /**
       * Changed before released: watchers refetch the record before it
       * becomes editable. The holder's tab leaves the page after saving, so
       * the lock is freed here instead of waiting for its release.
       */

      this.emit(LockEvent.RECORD_CHANGED, change);

      if (lock) this.drop(lock, action === 'deleted' ? 'deleted' : 'saved');

      return result;
    } finally {
      this.writing.delete(key);
    }
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

  /**
   * @returns The canonical target when the record exists, otherwise null
   */

  private async resolve(target: TLockTarget): Promise<TLockTarget | null> {
    const canonical = this.canonical(target);

    switch (canonical.resource) {
      case LockResource.POST: {
        const postId = Number(canonical.id);

        if (!Number.isSafeInteger(postId) || String(postId) !== canonical.id) {
          return null;
        }

        const post = await this.prisma.post.findUnique({
          where: { id: postId },
          select: { id: true },
        });

        return post ? canonical : null;
      }
    }
  }

  /**
   * @description One spelling per record, so '01', '1.0' and '0x1' cannot
   * lock post 1 under different keys. Ids that are not positive integers are
   * kept as they are and never match an existing record.
   */

  private canonical({ resource, id }: TLockTarget): TLockTarget {
    switch (resource) {
      case LockResource.POST:
        return {
          resource,
          id: /^\d+$/.test(id) ? String(Number(id)) : id,
        };
    }
  }

  private async fullNameOf(actor: TActor): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: actor.sub },
      select: { fullName: true },
    });

    return user?.fullName ?? '';
  }

  private toGrant(entry: TLockEntry): TLockGrant {
    return { ...this.touch(entry), token: entry.token };
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
