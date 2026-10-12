import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JwtSignOptions } from '@nestjs/jwt';
import { JwtService } from '@nestjs/jwt';

import type { TJwtPayload } from '@/shared/types';

import type { TEnv } from '@/config';

const ALGORITHM = 'HS256';
const ISSUER = 'websocket-realtime-notifications';
const AUDIENCE = 'websocket-realtime-notifications-client';

type TExpiresIn = JwtSignOptions['expiresIn'];

export type TTokenPair = {
  accessToken: string;
  accessTokenExpireAt: string;
  refreshToken: string;
  refreshTokenExpireAt: string;
};

@Injectable()
export class JwtTokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpiresIn: TExpiresIn;
  private readonly refreshExpiresIn: TExpiresIn;

  constructor(
    private readonly jwtService: JwtService,
    configService: ConfigService<TEnv, true>,
  ) {
    /**
     * Length and distinctness of the secrets are enforced by the env schema.
     */

    this.accessSecret = configService.get('JWT_ACCESS_SECRET', { infer: true });

    this.refreshSecret = configService.get('JWT_REFRESH_SECRET', {
      infer: true,
    });

    this.accessExpiresIn = configService.get('JWT_ACCESS_EXPIRES_IN', {
      infer: true,
    }) as TExpiresIn;

    this.refreshExpiresIn = configService.get('JWT_REFRESH_EXPIRES_IN', {
      infer: true,
    }) as TExpiresIn;
  }

  /**
   * @param payload Claims shared by both tokens
   * @returns This operation will sign an access/refresh token pair with their expiry dates
   */

  async generateTokens(payload: TJwtPayload): Promise<TTokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.sign(payload, this.accessSecret, this.accessExpiresIn),
      this.sign(payload, this.refreshSecret, this.refreshExpiresIn),
    ]);

    return {
      accessToken,
      accessTokenExpireAt: this.expiresAt(accessToken),
      refreshToken,
      refreshTokenExpireAt: this.expiresAt(refreshToken),
    };
  }

  /**
   * @throws When the signature, algorithm, claims or expiry is invalid
   */

  verifyAccessToken(accessToken: string): Promise<TJwtPayload> {
    return this.verify(accessToken, this.accessSecret);
  }

  /**
   * @throws When the signature, algorithm, claims or expiry is invalid
   */

  verifyRefreshToken(refreshToken: string): Promise<TJwtPayload> {
    return this.verify(refreshToken, this.refreshSecret);
  }

  /**
   * Access and refresh tokens carry the same claims; they cannot be swapped
   * because each type is signed with its own secret.
   */

  private sign(
    { sub, tokenVersion }: TJwtPayload,
    secret: string,
    expiresIn: TExpiresIn,
  ): Promise<string> {
    return this.jwtService.signAsync(
      { sub, tokenVersion },
      {
        algorithm: ALGORITHM,
        secret,
        expiresIn,
        issuer: ISSUER,
        audience: AUDIENCE,
      },
    );
  }

  /**
   *
   * @param token
   * @param secret
   * @returns verified token
   */

  private async verify(token: string, secret: string): Promise<TJwtPayload> {
    const { sub, tokenVersion } = await this.jwtService.verifyAsync<
      Partial<TJwtPayload>
    >(token, {
      algorithms: [ALGORITHM],
      secret,
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    if (typeof sub !== 'string' || typeof tokenVersion !== 'number') {
      throw new Error('Invalid token claims');
    }

    return { sub, tokenVersion };
  }

  /**
   *
   * @param token
   * @returns expiresAt time for token
   */

  private expiresAt(token: string): string {
    const { exp } = this.jwtService.decode<{ exp: number }>(token);

    return new Date(exp * 1000).toISOString();
  }
}
