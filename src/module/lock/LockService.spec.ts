import { HttpException, HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

import { LockEvent, LockResource } from '@/shared/constants';
import { PrismaService } from '@/shared/prisma';

import { LockService } from './LockService';
import type { TLockSession } from './LockTypes';

const session = (userId: string): TLockSession => ({
  userId,
  fullName: `User ${userId}`,
  roles: ['ADMIN'],
  tokenVersion: 1,
});

const TARGET = { resource: LockResource.POST, id: '1' };

describe('LockService', () => {
  let service: LockService;

  const prisma = {
    post: { findUnique: mock(() => Promise.resolve({ id: 1 })) },
    user: { findUnique: mock(() => Promise.resolve({ fullName: 'Writer' })) },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [LockService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(LockService);
  });

  afterEach(() => service.onModuleDestroy());

  it('grants the lock to only one of two concurrent acquires', async () => {
    const [a, b] = await Promise.all([
      service.acquire('socket-a', session('a'), TARGET),
      service.acquire('socket-b', session('b'), TARGET),
    ]);

    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);

    const denied = a.ok ? b : a;

    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.lock?.holder.userId).toBeDefined();
  });

  it('rejects acquiring a missing record', async () => {
    prisma.post.findUnique.mockImplementationOnce(() =>
      Promise.resolve(null as never),
    );

    const ack = await service.acquire('socket-a', session('a'), TARGET);

    expect(ack).toEqual({ ok: false, error: 'Record not found.' });
  });

  it('frees the lock when the holder disconnects', async () => {
    await service.acquire('socket-a', session('a'), TARGET);

    service.releaseAll('socket-a', 'disconnected');

    const ack = await service.acquire('socket-b', session('b'), TARGET);

    expect(ack.ok).toBe(true);
  });

  it('locks one record under one key however its id is spelled', async () => {
    const a = await service.acquire('socket-a', session('a'), {
      ...TARGET,
      id: '01',
    });
    const b = await service.acquire('socket-b', session('b'), TARGET);

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(false);
  });

  it('rejects ids that only parse as numbers', async () => {
    const ack = await service.acquire('socket-a', session('a'), {
      ...TARGET,
      id: '0x1',
    });

    expect(ack.ok).toBe(false);
  });

  it('tells a user their other tab holds the lock', async () => {
    await service.acquire('tab-1', session('a'), TARGET);

    const ack = await service.acquire('tab-2', session('a'), TARGET);

    expect(ack).toMatchObject({
      ok: false,
      error: 'You are already editing this record in another tab.',
    });
  });

  it('does not lock for a socket that disconnected while loading', async () => {
    const server = { sockets: new Map(), to: () => server, emit: () => true };

    service.attach(server as never);

    const ack = await service.acquire('gone', session('a'), TARGET);

    expect(ack.ok).toBe(false);
    expect(service.snapshot(LockResource.POST)).toEqual([]);
  });

  describe('guardWrite', () => {
    const tokenOf = async (socketId: string, userId: string) => {
      const ack = await service.acquire(socketId, session(userId), TARGET);

      if (!ack.ok) throw new Error(ack.error);

      return ack.data.token;
    };

    const statusOf = (promise: Promise<unknown>) =>
      promise.then(
        () => null,
        (e: unknown) => (e as HttpException).getStatus(),
      );

    it('blocks a write while another user holds the lock', async () => {
      await tokenOf('socket-a', 'a');

      const write = mock(() => Promise.resolve('written'));

      const status = await statusOf(
        service.guardWrite(TARGET, { sub: 'b' }, undefined, 'updated', write),
      );

      expect(status).toBe(HttpStatus.LOCKED);
      expect(write).not.toHaveBeenCalled();
    });

    it('blocks a write from the same user in another tab', async () => {
      await tokenOf('tab-1', 'a');

      const status = await statusOf(
        service.guardWrite(TARGET, { sub: 'a' }, undefined, 'updated', () =>
          Promise.resolve(),
        ),
      );

      expect(status).toBe(HttpStatus.LOCKED);
    });

    it('requires the lock to update', async () => {
      const status = await statusOf(
        service.guardWrite(TARGET, { sub: 'a' }, undefined, 'updated', () =>
          Promise.resolve(),
        ),
      );

      expect(status).toBe(HttpStatus.PRECONDITION_REQUIRED);
    });

    it('lets the lock holder write and drops the lock on delete', async () => {
      const token = await tokenOf('socket-a', 'a');

      await service.guardWrite(TARGET, { sub: 'a' }, token, 'deleted', () =>
        Promise.resolve(),
      );

      expect(service.snapshot(LockResource.POST)).toEqual([]);
    });

    it('releases the lock after a save, once watchers are told', async () => {
      const events: string[] = [];
      const server = {
        sockets: new Map([['socket-a', {}]]),
        to: () => server,
        emit: (event: string, payload: { reason?: string }) =>
          events.push(payload.reason ? `${event}:${payload.reason}` : event),
      };

      service.attach(server as never);

      const token = await tokenOf('socket-a', 'a');

      await service.guardWrite(TARGET, { sub: 'a' }, token, 'updated', () =>
        Promise.resolve(),
      );

      expect(events).toEqual([
        LockEvent.ACQUIRED,
        LockEvent.RECORD_CHANGED,
        `${LockEvent.RELEASED}:saved`,
      ]);

      const next = await service.acquire('socket-a', session('b'), TARGET);

      expect(next.ok).toBe(true);
    });

    it('refuses to lock a record while it is being written', async () => {
      let finish = () => {};

      const write = service.guardWrite(
        TARGET,
        { sub: 'a' },
        undefined,
        'deleted',
        () => new Promise<void>((resolve) => (finish = resolve)),
      );

      const ack = await service.acquire('socket-b', session('b'), TARGET);

      finish();
      await write;

      expect(ack.ok).toBe(false);
    });
  });
});
