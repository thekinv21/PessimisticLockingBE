import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { PrismaService } from '@/shared/prisma';

import { UserService } from '../user/UserService';
import { AuthService } from './AuthService';
import { JwtTokenService } from './jwt';

/**
 * The settled error of a promise expected to reject.
 */

const rejectionOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => new Error('Expected the promise to reject'),
    (error: unknown) => error,
  );

describe('AuthService', () => {
  let service: AuthService;

  const prisma = {
    user: {
      findUnique: mock(),
      update: mock(),
      updateMany: mock(),
      findUniqueOrThrow: mock(),
    },
    role: { findUnique: mock() },
  };

  const jwtTokenService = {
    verifyRefreshToken: mock(),
    generateTokens: mock(),
  };

  beforeEach(async () => {
    Object.values(prisma.user).forEach((fn) => fn.mockReset());
    Object.values(jwtTokenService).forEach((fn) => fn.mockReset());

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtTokenService, useValue: jwtTokenService },
        { provide: UserService, useValue: { createAccount: mock() } },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('login', () => {
    it('rejects an unknown email without revealing it', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      expect(
        await rejectionOf(
          service.login({ email: 'nobody@example.com', password: 'secret' }),
        ),
      ).toBeInstanceOf(UnauthorizedException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('rejects a token that fails verification', async () => {
      jwtTokenService.verifyRefreshToken.mockRejectedValue(new Error('bad'));

      expect(
        await rejectionOf(service.refresh({ refreshToken: 'garbage' })),
      ).toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a replayed token (version already bumped)', async () => {
      jwtTokenService.verifyRefreshToken.mockResolvedValue({
        sub: 'user-1',
        tokenVersion: 3,
      });
      prisma.user.updateMany.mockResolvedValue({ count: 0 });

      expect(
        await rejectionOf(service.refresh({ refreshToken: 'replayed' })),
      ).toBeInstanceOf(UnauthorizedException);

      expect(jwtTokenService.generateTokens).not.toHaveBeenCalled();
    });

    it('issues tokens for the bumped version', async () => {
      jwtTokenService.verifyRefreshToken.mockResolvedValue({
        sub: 'user-1',
        tokenVersion: 3,
      });
      prisma.user.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        id: 'user-1',
        fullName: 'Test',
        email: 'test@example.com',
        avatar: null,
        isActive: true,
        password: 'hash',
        tokenVersion: 4,
        roles: [],
      });
      jwtTokenService.generateTokens.mockResolvedValue({});

      await service.refresh({ refreshToken: 'valid' });

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-1', isActive: true, tokenVersion: 3 },
        data: { tokenVersion: { increment: 1 } },
      });
      expect(jwtTokenService.generateTokens).toHaveBeenCalledWith({
        sub: 'user-1',
        tokenVersion: 4,
      });
    });
  });
});
