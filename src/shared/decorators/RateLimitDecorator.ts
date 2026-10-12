import { SkipThrottle, Throttle } from '@nestjs/throttler';

import { DEFAULT_THROTTLER } from '../constants';

export type TRateLimitOptions = {
  /** Maximum number of requests allowed within `ttl` */
  limit: number;
  /** Window length in milliseconds */
  ttl: number;
};

/**
 * Overrides the global rate limit for a route or controller. The limit is
 * tracked per client IP and per route.
 *
 * @example
 * @RateLimit(RateLimitPreset.LOGIN)
 * @RateLimit({ limit: 20, ttl: 60_000 })
 */

export const RateLimit = ({
  limit,
  ttl,
}: TRateLimitOptions): MethodDecorator & ClassDecorator =>
  Throttle({ [DEFAULT_THROTTLER.name]: { limit, ttl } });

/**
 * Excludes a route or controller from rate limiting.
 */

export const SkipRateLimit = (): MethodDecorator & ClassDecorator =>
  SkipThrottle({ [DEFAULT_THROTTLER.name]: true });
