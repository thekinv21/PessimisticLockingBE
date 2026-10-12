import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';

import type { Namespace } from 'socket.io';
import type { z } from 'zod';

import {
  LOCK_ALLOWED_ROLES,
  LOCK_NAMESPACE,
  LOCK_PING_INTERVAL_MS,
  LOCK_PING_TIMEOUT_MS,
  LockEvent,
} from '@/shared/constants';
import { PrismaService } from '@/shared/prisma';

import { env } from '@/config';
import { JwtTokenService } from '@/module/auth/jwt';

import { LockTargetSchema, LockWatchSchema } from './LockSchema';
import { LockService } from './LockService';
import type {
  TEditLock,
  TLockAck,
  TLockSession,
  TLockSocket,
} from './LockTypes';

const INVALID_PAYLOAD: TLockAck<never> = {
  ok: false,
  error: 'Invalid payload.',
};

/**
 * Edit lock events. Clients connect to the `/locks` namespace with
 * `auth: { token: <access token> }`. Global guards, pipes and interceptors do
 * not apply to gateways, so authentication and validation happen here.
 */

@WebSocketGateway({
  namespace: LOCK_NAMESPACE,
  cors: { origin: env.CORS_ORIGINS },
  pingInterval: LOCK_PING_INTERVAL_MS,
  pingTimeout: LOCK_PING_TIMEOUT_MS,
})
export class LockGateway implements OnGatewayInit, OnGatewayDisconnect {
  constructor(
    private readonly lockService: LockService,
    private readonly jwtTokenService: JwtTokenService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Namespace): void {
    this.lockService.attach(server);

    server.use((socket, next) => {
      this.authenticate(socket as TLockSocket).then(
        () => next(),
        () => next(new Error('Unauthorized')),
      );
    });
  }

  handleDisconnect(socket: TLockSocket): void {
    this.lockService.releaseAll(socket.id, 'disconnected');
  }

  /**
   * @description Subscribes to the lock events of a resource (e.g. a list
   * page) and returns its current locks.
   */

  @SubscribeMessage(LockEvent.WATCH)
  async watch(
    @ConnectedSocket() socket: TLockSocket,
    @MessageBody() body: unknown,
  ): Promise<TLockAck<TEditLock[]>> {
    const payload = this.parse(LockWatchSchema, body);

    if (!payload) return INVALID_PAYLOAD;

    await socket.join(this.lockService.roomOf(payload.resource));

    return { ok: true, data: this.lockService.snapshot(payload.resource) };
  }

  @SubscribeMessage(LockEvent.UNWATCH)
  async unwatch(
    @ConnectedSocket() socket: TLockSocket,
    @MessageBody() body: unknown,
  ): Promise<TLockAck> {
    const payload = this.parse(LockWatchSchema, body);

    if (!payload) return INVALID_PAYLOAD;

    await socket.leave(this.lockService.roomOf(payload.resource));

    return { ok: true, data: undefined };
  }

  /**
   * @description Called when the edit form opens. The session is re-read so
   * a revoked token or removed role cannot take new locks.
   */

  @SubscribeMessage(LockEvent.ACQUIRE)
  async acquire(
    @ConnectedSocket() socket: TLockSocket,
    @MessageBody() body: unknown,
  ): Promise<TLockAck<TEditLock>> {
    const payload = this.parse(LockTargetSchema, body);

    if (!payload) return INVALID_PAYLOAD;

    const session = await this.loadSession(
      socket.data.userId,
      socket.data.tokenVersion,
    );

    if (!session) {
      socket.disconnect(true);

      return { ok: false, error: 'Unauthorized.' };
    }

    socket.data = session;

    return this.lockService.acquire(socket.id, session, payload);
  }

  @SubscribeMessage(LockEvent.RENEW)
  renew(
    @ConnectedSocket() socket: TLockSocket,
    @MessageBody() body: unknown,
  ): TLockAck<TEditLock> {
    const payload = this.parse(LockTargetSchema, body);

    if (!payload) return INVALID_PAYLOAD;

    return this.lockService.renew(socket.id, payload);
  }

  /**
   * @description Called when the edit form closes (save, cancel, route
   * change). Closing the tab is handled by the disconnect.
   */

  @SubscribeMessage(LockEvent.RELEASE)
  release(
    @ConnectedSocket() socket: TLockSocket,
    @MessageBody() body: unknown,
  ): TLockAck {
    const payload = this.parse(LockTargetSchema, body);

    if (!payload) return INVALID_PAYLOAD;

    return this.lockService.release(socket.id, payload);
  }

  /**
   * @throws When the token is missing, invalid, revoked or the user may not
   * edit records
   */

  private async authenticate(socket: TLockSocket): Promise<void> {
    const token: unknown = socket.handshake.auth?.token;

    if (typeof token !== 'string' || !token) throw new Error('Missing token');

    const { sub, tokenVersion } = await this.jwtTokenService.verifyAccessToken(
      token.replace(/^Bearer /, ''),
    );

    const session = await this.loadSession(sub, tokenVersion);

    if (!session) throw new Error('Session is not allowed');

    socket.data = session;
  }

  /**
   * @returns null when the user is missing, inactive, has a revoked token or
   * holds none of the LOCK_ALLOWED_ROLES
   */

  private async loadSession(
    sub: string,
    tokenVersion: number,
  ): Promise<TLockSession | null> {
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

    const roles = user.roles.map(({ role }) => role.name);

    if (!roles.some((role) => LOCK_ALLOWED_ROLES.includes(role))) return null;

    return { userId: sub, fullName: user.fullName, roles, tokenVersion };
  }

  private parse<T>(schema: z.ZodType<T>, body: unknown): T | null {
    const result = schema.safeParse(body);

    return result.success ? result.data : null;
  }
}
