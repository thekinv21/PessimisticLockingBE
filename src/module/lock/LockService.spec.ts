import { HttpException, HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

import { LockResource } from '@/shared/constants';
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

  describe('guardWrite', () => {
    it('blocks a write while another user holds the lock', async () => {
      await service.acquire('socket-a', session('a'), TARGET);

      const write = mock(() => Promise.resolve('written'));

      const error = await service
        .guardWrite(TARGET, { sub: 'b' }, 'updated', write)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.LOCKED);
      expect(write).not.toHaveBeenCalled();
    });

    it('lets the lock holder write and drops the lock on delete', async () => {
      await service.acquire('socket-a', session('a'), TARGET);

      await service.guardWrite(TARGET, { sub: 'a' }, 'deleted', () =>
        Promise.resolve(),
      );

      expect(service.snapshot(LockResource.POST)).toEqual([]);
    });
  });
});
