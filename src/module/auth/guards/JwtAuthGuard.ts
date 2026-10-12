import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import type { Request } from 'express';

import type { TCurrentUser, TJwtPayload } from '@/shared/types';

import { JwtTokenService } from '../jwt';
import { SessionService } from '../session';

const INVALID_TOKEN =
  'The access token is invalid or has expired. Please provide a valid access token.';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtTokenService: JwtTokenService,
    private readonly sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: TCurrentUser }>();

    const [type, token, ...rest] =
      request.headers.authorization?.split(' ') ?? [];

    if (type !== 'Bearer' || !token || rest.length) {
      throw new UnauthorizedException(
        'Authorization header is missing or invalid. Please provide a valid Bearer token.',
      );
    }

    let payload: TJwtPayload;

    try {
      payload = await this.jwtTokenService.verifyAccessToken(token);
    } catch {
      throw new UnauthorizedException(INVALID_TOKEN);
    }

    const session = await this.sessionService.load(payload);

    if (!session) throw new UnauthorizedException(INVALID_TOKEN);

    request.user = { sub: session.userId, roles: session.roles };

    return true;
  }
}
