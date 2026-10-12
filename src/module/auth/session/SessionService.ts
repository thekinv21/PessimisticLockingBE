import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/shared/prisma';
import type { TJwtPayload } from '@/shared/types';

export type TSession = {
  userId: string;
  fullName: string;
  roles: string[];
  tokenVersion: number;
};

/**
 * Resolves a verified token to the current session. Shared by the HTTP guard
 * and the socket gateways so both apply the same revocation rules.
 */

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * @returns null when the user is missing, inactive or the token was revoked
   * (tokenVersion mismatch). Roles are read from the database so role changes
   * apply immediately; inactive roles are left out.
   */

  async load({ sub, tokenVersion }: TJwtPayload): Promise<TSession | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: sub },
      select: {
        fullName: true,
        tokenVersion: true,
        isActive: true,
        roles: {
          where: { role: { isActive: true } },
          select: { role: { select: { name: true } } },
        },
      },
    });

    if (!user || !user.isActive || user.tokenVersion !== tokenVersion) {
      return null;
    }

    return {
      userId: sub,
      fullName: user.fullName,
      roles: user.roles.map(({ role }) => role.name),
      tokenVersion,
    };
  }
}
