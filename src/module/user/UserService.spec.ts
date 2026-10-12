import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { Role } from '@/shared/constants';
import { PrismaService } from '@/shared/prisma';

import { UserService } from './UserService';

const ADMIN = { sub: 'admin-1', roles: [Role.ADMIN] };
const OWNER = { sub: 'owner-1', roles: [Role.OWNER] };

const ROLE_ID = 'clh3am8hi0000qwer1234abcd';

/**
 * The settled error of a promise expected to reject.
 */

const rejectionOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => new Error('Expected the promise to reject'),
    (error: unknown) => error,
  );

describe('UserService', () => {
  let service: UserService;

  const prisma = {
    user: {
      findFirst: mock(),
      findUnique: mock(),
      create: mock(),
      update: mock(),
      updateMany: mock(),
      delete: mock(),
    },
    role: { findMany: mock() },
  };

  beforeEach(async () => {
    Object.values(prisma.user).forEach((fn) => fn.mockReset());
    prisma.role.findMany.mockReset();

    const moduleRef = await Test.createTestingModule({
      providers: [UserService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(UserService);
  });

  const createDto = (roleId = ROLE_ID) => ({
    fullName: 'New User',
    email: 'new@example.com',
    password: 'Password123!',
    roles: [{ id: roleId }],
  });

  describe('create', () => {
    it('forbids an admin from assigning an equal role', async () => {
      prisma.role.findMany.mockResolvedValue([
        { id: ROLE_ID, name: Role.ADMIN },
      ]);

      expect(
        await rejectionOf(service.create(createDto(), ADMIN)),
      ).toBeInstanceOf(ForbiddenException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('lets an admin assign a lower role', async () => {
      prisma.role.findMany.mockResolvedValue([
        { id: ROLE_ID, name: Role.USER },
      ]);
      prisma.user.findUnique.mockResolvedValue(null);

      await service.create(createDto(), ADMIN);

      expect(prisma.user.create).toHaveBeenCalledTimes(1);
    });

    it('lets an owner assign any role', async () => {
      prisma.role.findMany.mockResolvedValue([
        { id: ROLE_ID, name: Role.OWNER },
      ]);
      prisma.user.findUnique.mockResolvedValue(null);

      await service.create(createDto(), OWNER);

      expect(prisma.user.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('delete', () => {
    it('forbids a non-owner from deleting themselves', async () => {
      expect(
        await rejectionOf(service.delete(ADMIN.sub, ADMIN)),
      ).toBeInstanceOf(ForbiddenException);
    });

    it('hides owners from admins', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      expect(
        await rejectionOf(service.delete('owner-1', ADMIN)),
      ).toBeInstanceOf(NotFoundException);

      expect(prisma.user.findFirst.mock.calls[0][0].where).toMatchObject({
        roles: { none: { role: { name: Role.OWNER } } },
      });
    });

    it('forbids an admin from deleting another admin', async () => {
      prisma.user.findFirst.mockResolvedValue({
        isActive: true,
        roles: [{ role: { name: Role.ADMIN } }],
      });

      expect(
        await rejectionOf(service.delete('admin-2', ADMIN)),
      ).toBeInstanceOf(ForbiddenException);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('forbids a non-owner from changing their own roles', async () => {
      expect(
        await rejectionOf(
          service.update(ADMIN.sub, { roles: [{ id: ROLE_ID }] }, ADMIN),
        ),
      ).toBeInstanceOf(ForbiddenException);
    });
  });
});
